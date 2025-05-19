// src\store\index.js
import { defineStore } from "pinia";
import { reactive, ref, isReactive, watch } from "vue";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { RuleConfig } from "@/config/GameConfig";
import { CommandLimit } from "@/config/CommandConfig";
import { GameMode } from "@/config/GameModeConfig";
import { HexVisualStyles } from "@/config/HexVisualStyles";
import { OverviewConsole } from "@/layers/interaction-layer/utils/OverviewConsole";

/** 工具函数：把传入对象转成"已 reactive 的指定类实例" */
function Rea(input, ClassCtor) {
  let inst = input instanceof ClassCtor ? input : new ClassCtor(input);
  return isReactive(inst) ? inst : reactive(inst);
}

export const openGameStore = defineStore("gameStore", () => {
  /* ========================= 状态定义 ========================= */
  /* 1. 图层状态 */
  const layerIndex = ref(1);  // 当前图层: 1=默认, 2=地形, 3=隐藏
  const highlightStyle = ref(HexVisualStyles.selected);  // 选中六角格高亮样式
  const rangeStyle = ref({ blue: HexVisualStyles.selectedBlue, red: HexVisualStyles.selectedRed });  // 指挥范围高亮样式
  const commanderStyle = ref({ blue: HexVisualStyles.commanderBlue, red: HexVisualStyles.commanderRed });  // 指挥部队高亮样式
  const supportStyle = ref({ blue: HexVisualStyles.supportBlue, red: HexVisualStyles.supportRed });  // 支援部队高亮样式

  /* 2. 游戏回合状态 */
  const currentRound = ref(RuleConfig.startRound);  // 当前回合数
  const currentFaction = ref(RuleConfig.firstFaction);  // 当前操作阵营
  const factionFinished = reactive({ blue: false, red: false }); // 记录各阵营是否完成当前回合操作

  /* 3. 主数据容器 */
  const hexCellMap     = reactive(new Map());  // Map<hexId, HexCell>
  const unitMap        = reactive(new Map());  // Map<unitId, Unit>
  const forceMap       = reactive(new Map());  // Map<forceId, Force>
  const battlegroupMap = reactive(new Map());  // Map<battlegroupId , Battlegroup>
  const formationMap   = reactive(new Map());  // Map<formationId , Formation>

  /* 4. 选中状态 */
  const selectedHexIds   = reactive(new Set());
  const selectedForceIds = reactive(new Set());
  const lockedSelection = reactive({ hexIds: new Set(), forceIds: new Set() });

  /* 4.1 攻击准备状态 */
  const attackState = reactive({
    phase: null,              // 攻击阶段: 'selectTarget'/'selectSupport'/null
    commandForceId: null,     // 指挥部队ID
    supportForceIds: [],      // 支援部队ID数组
    enemyCommandForceId: null, // 敌方指挥部队ID
    enemySupportForceIds: [],  // 敌方支援部队ID数组
  });

  /* 5. 命令系统相关状态 */
  const isExecuting = ref(false);      // 是否有命令正在执行
  const commandQueue = reactive([]);    // 命令队列 [{id, type, params, startTime, endTime, interval, source, status}]
  const currentCommand = ref(null);     // 当前执行的命令
  const commandHistory = reactive([]);  // 命令执行历史
  
  // 命令队列和历史记录的过滤器状态
  const commandQueueFilter = reactive({ API: true, FILE: true, MANUAL: true });
  const commandHistoryFilter = reactive({ UI: true, API: true, FILE: true, MANUAL: true });
  
  /* 6. 游戏模式相关状态 */
  const gameMode = ref(GameMode.FREE);  // 当前游戏模式
  const autoMode = ref(false);          // 是否处于自动模式，独立于游戏模式
  
  // UI控制
  const disabledPanels = reactive(new Set());  // 禁用的面板ID集合
  const disabledButtons = reactive(new Set()); // 禁用的按钮ID集合
  
  // 交互控制
  const mouseInteract = ref(true);     // 是否允许鼠标在地图上进行选中交互
  const selectMode = ref('single');    // 部队与六角格选择模式：'single', 'multi'
  const linkMode = ref('linked');      // 部队与六角格关联模式：'linked', 'independent'
  const cameraControlEnabled = ref(true);      // 是否允许相机控制

  /* ========================= 方法定义 ========================= */
  // -------------------- 图层控制 --------------------
  const setLayerIndex = idx => layerIndex.value = idx;

  // -------------------- 高亮样式控制 --------------------
  const setHighlightStyle = style => highlightStyle.value = style;

  // -------------------- 回合控制 --------------------
  /** 切换到下一阵营，如果当前阵营完成回合操作，则切换到下一回合 */
  function switchToNextFaction() {
    factionFinished[currentFaction.value] = true;
    if (factionFinished.blue && factionFinished.red) {
      currentRound.value++;
      factionFinished.blue = factionFinished.red = false;
      currentFaction.value = RuleConfig.firstFaction;
    } else {
      currentFaction.value = currentFaction.value === 'blue' ? 'red' : 'blue';
    }
  }

  /** 获取当前回合信息 */
  function getRoundInfo() {
    return {
      round: currentRound.value,
      faction: currentFaction.value,
      isFinished: factionFinished[currentFaction.value]
    };
  }

  // -------------------- 六角格操作 --------------------
  /** 添加六角格 */
  function addHexCell(data) { 
    const cell = Rea(data, HexCell); 
    hexCellMap.set(cell.hexId, cell); 
  }
  /** 批量设置六角格，这会清空原有六角格 */
  function setHexCells(cells) { 
    hexCellMap.clear(); 
    cells.forEach(data => addHexCell(data)); 
  }
  /** 获取所有六角格 */
  const getHexCells = () => Array.from(hexCellMap.values());
  /** 根据 id 获取六角格 */
  const getHexCellById = id => hexCellMap.get(id) || null;
  /** 移除六角格 */
  const removeHexCellById = id => hexCellMap.delete(id);

  // -------------------- 兵种操作 --------------------
  /** 添加兵种 */
  function addUnit(data) { 
    const unit = Rea(data, Unit); 
    unitMap.set(unit.unitId, unit); 
  }
  /** 根据 id 获取兵种 */
  const getUnitById = id => unitMap.get(id) || null;
  /** 获取所有兵种 */
  const getUnits = () => Array.from(unitMap.values());
  /** 获取当前阵营可用兵种 */
  const getUnitsByFaction = faction => getUnits().filter(unit => unit.factionAvailability.includes(faction));
  /** 移除兵种 */
  const removeUnitById = id => unitMap.delete(id);

  // -------------------- 部队操作 --------------------
  /** 添加部队 */
  function addForce(data) { 
    const force = Rea(data, Force); 
    forceMap.set(force.forceId, force); 
  }
  /** 删除部队 */
  const removeForceById = id => forceMap.delete(id);
  /** 根据 id 获取部队 */
  const getForceById = id => forceMap.get(id) || null;
  /** 获取所有部队 */
  const getForces = () => Array.from(forceMap.values());
  /** 根据阵营获取部队 */
  const getForcesByFaction = faction => getForces().filter(f => f.faction === faction);
  /** 获取部队所在阵营 */
  const getFactionByForceId = id => {
    const force = getForceById(id);
    return force ? force.faction : null;
  };

  // -------------------- 战斗群操作 --------------------
  /** 添加战斗群 */
  function addBattlegroup(data) { 
    const bg = Rea(data, Battlegroup); 
    battlegroupMap.set(bg.battlegroupId, bg); 
  }
  /** 删除战斗群 */
  const removeBattlegroupById = id => battlegroupMap.delete(id);
  /** 根据 id 获取战斗群 */
  const getBattlegroupById = id => battlegroupMap.get(id) || null;
  /** 获取所有战斗群 */
  const getBattlegroups = () => Array.from(battlegroupMap.values());
  /** 根据阵营获取战斗群 */
  const getBattlegroupsByFaction = faction => getBattlegroups().filter(bg => bg.faction === faction);

  // -------------------- 编队操作 --------------------
  /** 添加编队 */
  function addFormation(data) { 
    const formation = Rea(data, Formation); 
    formationMap.set(formation.formationId, formation); 
  }
  /** 删除编队 */
  const removeFormationById = id => formationMap.delete(id);
  /** 根据 id 获取编队 */
  const getFormationById = id => formationMap.get(id) || null;
  /** 获取所有编队 */
  const getFormations = () => Array.from(formationMap.values());
  /** 根据阵营获取编队 */
  const getFormationsByFaction = faction => getFormations().filter(f => f.faction === faction);
  /** 添加部队到编队，或将部队转移到另一个编队 */
  function addForceToFormation(forceId, formationId) {
    const force = forceMap.get(forceId);
    const formation = formationMap.get(formationId);
    if (!force || !formation || force.faction !== formation.faction) return;
    removeForceFromCurrentFormation(forceId);
    if (!formation.forceIdList.includes(forceId)) {
      formation.forceIdList.push(forceId);
    }
  }
  /** 将部队从当前编队中移除 */
  function removeForceFromCurrentFormation(forceId) {
    for (const formation of formationMap.values()) {
      const idx = formation.forceIdList.indexOf(forceId);
      if (idx !== -1) formation.forceIdList.splice(idx, 1);
    }
  }
  /** 获取部队所在编队 */
  function getFormationByForceId(forceId) {
    for (const formation of formationMap.values()) {
      if (formation.forceIdList.includes(forceId)) return formation;
    }
    return null;
  }

  // -------------------- 选中状态操作 --------------------
  // 监听selectedHexIds和selectedForceIds的变化，自动同步
  watch([selectedHexIds, selectedForceIds], () => {
    // 仅当选择模式需要强制保持部队在六角格内时同步
    if (linkMode.value === 'linked') {
      syncForcesInSelectedHex();
    }
  });

  /** 
   * 同步选中六角格与部队的关系
   * 仅在linkMode为'linked'时生效
   */
  function syncForcesInSelectedHex() {
    // 仅在linked模式下执行，独立模式不处理部队选择
    if (linkMode.value !== 'linked') return;
    
    // 遍历所有选中部队，移除不在当前选中六角格中的部队ID
    for (const forceId of selectedForceIds) {
      // 不移除锁定选中的部队
      if (lockedSelection.forceIds.has(forceId)) {
        continue;
      }
      const force = getForceById(forceId);
      // 移除不在选中六角格中的部队
      if (!force || !force.hexId || !selectedHexIds.has(force.hexId)) {
        selectedForceIds.delete(forceId);
      }
    }
  }

  // ================== 锁定选中 ==================
  /** 添加锁定选中六角格 */
  const addLockedHexId = id => lockedSelection.hexIds.add(id);
  /** 添加锁定选中部队 */
  const addLockedForceId = id => lockedSelection.forceIds.add(id);
  /** 移除锁定选中六角格 */
  const removeLockedHexId = id => lockedSelection.hexIds.delete(id);
  /** 移除锁定选中部队 */
  const removeLockedForceId = id => lockedSelection.forceIds.delete(id);
  /** 获取锁定选中六角格 */
  const getLockedHexIds = () => Array.from(lockedSelection.hexIds);
  /** 获取锁定选中部队 */
  const getLockedForceIds = () => Array.from(lockedSelection.forceIds);
  /** 批量设置锁定选中 */
  const setLockedSelection = (hexIds, forceIds) => {
    clearLockedSelection();
    if (hexIds) hexIds.forEach(id => addLockedHexId(id));
    if (forceIds) forceIds.forEach(id => addLockedForceId(id));
  }
  /** 清空锁定选中 */
  const clearLockedSelection = () => {
    lockedSelection.hexIds.clear();
    lockedSelection.forceIds.clear();
  }

  // ================== 选中六角格 ==================

  /** 添加选中六角格，支持单选/多选模式 */
  const addSelectedHexId = id => {
    // 如果这个六角格在选中列表中，则先确保其在最后一位
    if (selectedHexIds.has(id)) {
      selectedHexIds.delete(id);
      selectedHexIds.add(id);
    }
    if (lockedSelection.hexIds.has(id)) {
      return;
    }
    // 检查当前模式下是否允许多选，如果不允许则先清空
    if (selectMode.value === 'single' && selectedHexIds.size > 0) {
      clearSelectedHexIds();
    }
    // 添加新的选中ID
    selectedHexIds.add(id);
  };

  /** 移除除锁定六角格以外的选中六角格 */
  const removeSelectedHexId = id => {
    if (lockedSelection.hexIds.has(id)) {
      return;
    }
    selectedHexIds.delete(id);
  };

  /** 获取选中六角格 */
  const getSelectedHexIds = () => selectedHexIds;

  /** 清空除了锁定六角格以外的选中六角格 */
  const clearSelectedHexIds = () => {
    for (const id of selectedHexIds) {
      removeSelectedHexId(id);
    }
  };

  /** 设置选中六角格数组，根据当前选择模式应用规则 */
  const setSelectedHexIds = hexIds => {
    clearSelectedHexIds();
    hexIds.forEach(id => addSelectedHexId(id));
  }

  // ================== 选中部队 ==================
  /** 添加选中部队，自动处理与六角格的关联 */
  const addSelectedForceId = id => {
    const force = getForceById(id);
    if (!force) return;

    if (lockedSelection.forceIds.has(id)) {
      return;
    }
    // 单选模式下只能选中一个部队
    if (selectMode.value === 'single') {
      clearSelectedForceIds();
    }
    // 添加部队所在的六角格，会自动根据单选/多选模式选中，以及linked同步
    addSelectedHexId(force.hexId);
    // 再添加部队，以防出现先添加部队但未添加六角格而又被linked模式移除的情况
    selectedForceIds.add(id);
  };

  /** 移除选中部队 */
  const removeSelectedForceId = id => {
    if (lockedSelection.forceIds.has(id)) {
      return;
    }
    selectedForceIds.delete(id);
  };

  /** 获取选中部队 */
  const getSelectedForceIds = () => selectedForceIds;

  /** 清空选中部队 */
  const clearSelectedForceIds = () => {
    for (const id of selectedForceIds) {
      removeSelectedForceId(id);
    }
  };

  /** 设置选中部队数组，处理与六角格的关联 */
  const setSelectedForceIds = forceIds => {
    clearSelectedForceIds();
    forceIds.forEach(id => addSelectedForceId(id));
  };

  // -------------------- 攻击状态操作 --------------------
  /** 初始化攻击状态 */
  function initAttackState(commandForceId, phase = 'selectTarget', supportForceIds = [], enemyCommandForceId = null, enemySupportForceIds = []) {
    attackState.phase = phase;
    attackState.commandForceId = commandForceId;
    attackState.supportForceIds = supportForceIds;
    attackState.enemyCommandForceId = enemyCommandForceId;
    attackState.enemySupportForceIds = enemySupportForceIds;
  }

  /** 清除攻击状态 */
  function clearAttackState() {
    attackState.phase = null;
    attackState.commandForceId = null;
    attackState.supportForceIds = [];
    attackState.enemyCommandForceId = null;
    attackState.enemySupportForceIds = [];
  }

  // -------------------- 命令系统操作 --------------------
  /** 设置自动模式 */
  function setAutoMode(mode) {
    autoMode.value = mode;
  }

  /** 添加命令到队列 */
  function addCommandToQueue(command) {
    // 限制队列长度，每种source的命令单独具有上限
    const sourceCommands = commandQueue.filter(cmd => cmd.source === command.source);
    if (sourceCommands.length >= CommandLimit.QUEUE_LIMIT) {
      // 找到相同source的最早的命令并移除
      const oldestIndex = commandQueue.findIndex(cmd => cmd.source === command.source);
      if (oldestIndex !== -1) {
        commandQueue.splice(oldestIndex, 1);
      }
    }
    
    // 添加必要的字段，如果缺少的话
    if (!command.status) command.status = 'pending';
    if (command.interval === undefined) command.interval = 0;
    
    commandQueue.push(command);
    console.log('添加命令到队列', command);
    return command;
  }
  
  /** 从队列中移除命令 */
  function removeCommandFromQueue(commandId) {
    const index = commandQueue.findIndex(cmd => cmd.id === commandId);
    if (index !== -1) {
      commandQueue.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /** 更新队列中命令的顺序 */
  function reorderCommandQueue(newOrderedIds) {
    // 创建一个按新顺序排列的命令列表
    const newQueue = [];
    
    // 首先添加按新顺序排列的命令（这些是显示/未被过滤的命令）
    for (const id of newOrderedIds) {
      const cmd = commandQueue.find(c => c.id === id);
      if (cmd) newQueue.push(cmd);
    }
    
    // 确保所有命令都在，以防新列表漏掉什么
    for (const cmd of commandQueue) {
      if (!newQueue.some(c => c.id === cmd.id)) {
        newQueue.push(cmd);
      }
    }
    
    // 清空并重新填充队列
    commandQueue.splice(0, commandQueue.length, ...newQueue);
  }
  
  /** 添加命令到历史记录 */
  function addCommandToHistory(commandObj) {
    commandHistory.unshift(commandObj);
    // 限制历史记录的长度，所有source共用这个上限
    if (commandHistory.length > CommandLimit.HISTORY_LIMIT) {
      commandHistory.pop();
    }
  }
  
  /** 清空命令队列 */
  function clearCommandQueue() {
    commandQueue.splice(0, commandQueue.length);
  }
  
  /** 清空命令历史 */
  function clearCommandHistory() {
    commandHistory.splice(0, commandHistory.length);
  }
  
  /** 设置当前命令 */
  function setCurrentCommand(command) {
    currentCommand.value = command;
    isExecuting.value = !!command;
  }
  
  /** 设置命令队列过滤器 */
  function setCommandQueueFilter(filter) {
    Object.keys(commandQueueFilter).forEach(key => {
      if (filter[key] !== undefined) {
        commandQueueFilter[key] = filter[key];
      }
    });
  }
  
  /** 设置命令历史过滤器 */
  function setCommandHistoryFilter(filter) {
    Object.keys(commandHistoryFilter).forEach(key => {
      if (filter[key] !== undefined) {
        commandHistoryFilter[key] = filter[key];
      }
    });
  }

  // -------------------- 游戏模式操作 --------------------
  /** 设置游戏模式 */
  function setGameMode(mode) {
    gameMode.value = mode;
  }
  
  /** 设置禁用的面板 */
  function setDisabledPanels(panels) {
    disabledPanels.clear();
    if (Array.isArray(panels)) {
      panels.forEach(panel => disabledPanels.add(panel));
    }
  }
  
  /** 设置禁用的按钮 */
  function setDisabledButtons(buttons) {
    disabledButtons.clear();
    if (Array.isArray(buttons)) {
      buttons.forEach(button => disabledButtons.add(button));
    }
  }
  
  /** 设置是否启用鼠标交互 */
  function setMouseInteract(enabled) {
    mouseInteract.value = enabled;
  }

  /** 设置六角格和部队选择模式 */
  function setSelectMode(mode) {
    selectMode.value = mode;
  }

  /** 设置部队选择模式 */
  function setLinkMode(mode) {
    linkMode.value = mode;
  }
  
  /** 设置相机控制启用状态 */
  function setCameraControlEnabled(enabled) {
    cameraControlEnabled.value = enabled;
  }

  /** 判断面板是否禁用 */
  function isPanelDisabled(panelId) {
    return disabledPanels.has(panelId);
  }
  
  /** 判断按钮是否禁用 */
  function isButtonDisabled(buttonId) {
    return disabledButtons.has(buttonId);
  }

  /** 获取总览控制台 */
  const getOverviewConsole = () => OverviewConsole;

  return {
    // 状态导出
    layerIndex,
    highlightStyle,
    rangeStyle,
    commanderStyle,
    supportStyle,
    currentRound,
    currentFaction,
    factionFinished,
    hexCellMap,
    unitMap,
    forceMap,
    battlegroupMap,
    formationMap,
    selectedHexIds,
    selectedForceIds,
    lockedSelection,
    attackState,  // 导出攻击状态
    
    // 命令系统状态
    autoMode,
    isExecuting,
    commandQueue,
    currentCommand,
    commandHistory,
    commandQueueFilter,
    commandHistoryFilter,

    // 游戏模式状态
    gameMode,
    disabledPanels,
    disabledButtons,
    mouseInteract,
    selectMode,
    linkMode,
    cameraControlEnabled,

    // 方法导出
    setLayerIndex,
    setHighlightStyle,
    switchToNextFaction,
    getRoundInfo,
    
    // 六角格方法
    addHexCell,
    setHexCells,
    getHexCells,
    getHexCellById,
    removeHexCellById,
    
    // 兵种方法
    addUnit,
    removeUnitById,
    getUnitById,
    getUnits,
    getUnitsByFaction,

    // 部队方法
    addForce,
    removeForceById,
    getForceById,
    getForces,
    getForcesByFaction,
    getFactionByForceId,

    // 战斗群方法
    addBattlegroup,
    removeBattlegroupById,
    getBattlegroupById,
    getBattlegroups,
    getBattlegroupsByFaction,

    // 编队方法
    addFormation,
    removeFormationById,
    getFormationById,
    getFormations,
    getFormationsByFaction,
    addForceToFormation,
    removeForceFromCurrentFormation,
    getFormationByForceId,
    
    // 选中状态方法
    addSelectedHexId,
    removeSelectedHexId,
    clearSelectedHexIds,
    getSelectedHexIds,
    setSelectedHexIds,
    addSelectedForceId,
    removeSelectedForceId,
    clearSelectedForceIds,
    getSelectedForceIds,
    setSelectedForceIds,

    // 锁定选中方法
    addLockedHexId,
    addLockedForceId,
    removeLockedHexId,
    removeLockedForceId,
    getLockedHexIds,
    getLockedForceIds,
    setLockedSelection,
    clearLockedSelection,
    
    // 攻击状态方法
    initAttackState,
    clearAttackState,
    
    // 命令系统方法
    setAutoMode,
    addCommandToQueue,
    removeCommandFromQueue,
    reorderCommandQueue,
    addCommandToHistory,
    clearCommandQueue,
    clearCommandHistory,
    setCurrentCommand,
    setCommandQueueFilter,
    setCommandHistoryFilter,
    
    // 游戏模式方法
    setGameMode,
    setDisabledPanels,
    setDisabledButtons,
    setMouseInteract,
    setSelectMode,
    setLinkMode,
    setCameraControlEnabled,
    isPanelDisabled,
    isButtonDisabled,

    // 控制台方法
    getOverviewConsole
  };
});
