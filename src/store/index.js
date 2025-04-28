// src\store\index.js
import { defineStore } from "pinia";
import { reactive, ref, isReactive } from "vue";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { RuleConfig } from "@/config/GameConfig";
import { CommandLimit } from "@/config/CommandConfig";
/** 工具函数：把传入对象转成"已 reactive 的指定类实例" */
function Rea(input, ClassCtor) {
  let inst = input instanceof ClassCtor ? input : new ClassCtor(input);
  return isReactive(inst) ? inst : reactive(inst);
}

export const openGameStore = defineStore("gameStore", () => {
  /* ========================= 状态定义 ========================= */
  /* 1. 图层状态 */
  const layerIndex = ref(1);  // 当前图层: 1=默认, 2=地形, 3=隐藏
  
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

  /* 5. 命令系统相关状态 */
  const autoMode = ref(false);          // 是否处于自动模式
  const isExecuting = ref(false);      // 是否有命令正在执行
  const commandQueue = reactive([]);    // 命令队列 [{id, type, params, startTime, endTime, interval, source, status}]
  const currentCommand = ref(null);     // 当前执行的命令
  const commandHistory = reactive([]);  // 命令执行历史
  
  // 命令队列和历史记录的过滤器状态
  const commandQueueFilter = reactive({ API: true, FILE: true, MANUAL: true });
  const commandHistoryFilter = reactive({ UI: true, API: true, FILE: true, MANUAL: true });

  /* ========================= 方法定义 ========================= */
  // -------------------- 图层控制 --------------------
  const setLayerIndex = idx => layerIndex.value = idx;

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

  // -------------------- 部队操作 --------------------
  /** 添加部队 */
  function addForce(data) { 
    const force = Rea(data, Force); 
    forceMap.set(force.forceId, force); 
  }
  /** 根据 id 获取部队 */
  const getForceById = id => forceMap.get(id) || null;
  /** 获取所有部队 */
  const getForces = () => Array.from(forceMap.values());
  /** 根据阵营获取部队 */
  const getForcesByFaction = faction => getForces().filter(f => f.faction === faction);

  // -------------------- 战斗群操作 --------------------
  /** 添加战斗群 */
  function addBattlegroup(data) { 
    const bg = Rea(data, Battlegroup); 
    battlegroupMap.set(bg.battlegroupId, bg); 
  }
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
  /** 添加选中六角格 */
  const addSelectedHexId = id => selectedHexIds.add(id);
  /** 移除选中六角格 */
  const removeSelectedHexId = id => selectedHexIds.delete(id);
  /** 清空选中六角格 */
  const clearSelectedHexIds = () => selectedHexIds.clear();
  /** 获取选中六角格 */
  const getSelectedHexIds = () => selectedHexIds;

  /** 添加选中部队 */
  const addSelectedForceId = id => selectedForceIds.add(id);
  /** 移除选中部队 */
  const removeSelectedForceId = id => selectedForceIds.delete(id);
  /** 清空选中部队 */
  const clearSelectedForceIds = () => selectedForceIds.clear();
  /** 获取选中部队 */
  const getSelectedForceIds = () => selectedForceIds;

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

  return {
    // 状态导出
    layerIndex,
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
    
    // 命令系统状态
    autoMode,
    isExecuting,
    commandQueue,
    currentCommand,
    commandHistory,
    commandQueueFilter,
    commandHistoryFilter,

    // 方法导出
    setLayerIndex,
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
    getUnitById,
    getUnits,
    getUnitsByFaction,

    // 部队方法
    addForce,
    getForceById,
    getForces,
    getForcesByFaction,
    
    // 战斗群方法
    addBattlegroup,
    getBattlegroupById,
    getBattlegroups,
    getBattlegroupsByFaction,
    // 编队方法
    addFormation,
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
    addSelectedForceId,
    removeSelectedForceId,
    clearSelectedForceIds,
    getSelectedForceIds,
    
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
  };
});
