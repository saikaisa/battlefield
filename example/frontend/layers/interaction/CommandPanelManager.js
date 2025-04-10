import { ref, reactive } from 'vue';

/**
 * 指令面板管理器类
 * 负责管理和处理用户指令
 */
export class CommandPanelManager {
  /**
   * 构造函数
   * @param {Object} mapInteractionManager - 地图交互管理器实例
   * @param {Object} apiService - API服务实例
   */
  constructor(mapInteractionManager, apiService) {
    this.mapInteractionManager = mapInteractionManager;
    this.apiService = apiService;
    
    // 指令面板状态
    this.state = reactive({
      visible: true, // 面板可见性
      activeTab: 'move', // 当前激活的标签页
      availableCommands: [], // 可用指令列表
      selectedCommand: null, // 当前选中的指令
      commandParams: {}, // 指令参数
      isExecuting: false, // 是否正在执行指令
      executionResult: null, // 指令执行结果
      commandHistory: [] // 指令历史记录
    });
    
    // 初始化可用指令
    this.initializeCommands();
    
    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 初始化可用指令
   */
  initializeCommands() {
    this.state.availableCommands = [
      {
        id: 'move',
        name: '移动',
        description: '移动选中的部队到指定位置',
        icon: 'el-icon-position',
        requiresSelection: true,
        params: [
          { name: 'forceId', type: 'hidden', value: null },
          { name: 'path', type: 'path', value: [] }
        ]
      },
      {
        id: 'attack',
        name: '攻击',
        description: '使用选中的部队攻击目标',
        icon: 'el-icon-aim',
        requiresSelection: true,
        params: [
          { name: 'attackerForceId', type: 'hidden', value: null },
          { name: 'targetHexId', type: 'hex', value: null }
        ]
      },
      {
        id: 'form_battlegroup',
        name: '组建战斗群',
        description: '将选中的部队组建为战斗群',
        icon: 'el-icon-connection',
        requiresSelection: true,
        params: [
          { name: 'forceIds', type: 'hidden', value: [] },
          { name: 'commandForceId', type: 'select', value: null, options: [] }
        ]
      },
      {
        id: 'form_formation',
        name: '编组',
        description: '将选中的部队编组',
        icon: 'el-icon-set-up',
        requiresSelection: true,
        params: [
          { name: 'forceIds', type: 'hidden', value: [] },
          { name: 'formationName', type: 'text', value: '', label: '编组名称' }
        ]
      },
      {
        id: 'end_turn',
        name: '结束回合',
        description: '结束当前回合，进入下一回合',
        icon: 'el-icon-switch-button',
        requiresSelection: false,
        params: []
      }
    ];
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听部队选中事件
    window.addEventListener('force-selected', (event) => {
      const forceId = event.detail.forceId;
      this.updateCommandParams('forceId', forceId);
      this.updateCommandParams('attackerForceId', forceId);
      
      // 更新战斗群指挥部队选项
      this.updateBattlegroupCommandOptions([forceId]);
    });
    
    // 监听多部队选中事件
    window.addEventListener('selection-confirmed', (event) => {
      const forces = event.detail.forces;
      if (forces && forces.length > 0) {
        this.updateCommandParams('forceIds', forces);
        
        // 更新战斗群指挥部队选项
        this.updateBattlegroupCommandOptions(forces);
      }
    });
    
    // 监听路径确认事件
    window.addEventListener('path-confirmed', (event) => {
      const path = event.detail.path;
      const forceId = event.detail.forceId;
      
      this.updateCommandParams('path', path);
      this.updateCommandParams('forceId', forceId);
      
      // 自动切换到移动指令
      this.selectCommand('move');
    });
    
    // 监听攻击确认事件
    window.addEventListener('attack-confirmed', (event) => {
      const attackerForceId = event.detail.attackerForceId;
      const targetHexId = event.detail.targetHexId;
      
      this.updateCommandParams('attackerForceId', attackerForceId);
      this.updateCommandParams('targetHexId', targetHexId);
      
      // 自动切换到攻击指令
      this.selectCommand('attack');
    });
    
    // 监听交互模式变更事件
    window.addEventListener('mode-changed', (event) => {
      const mode = event.detail.mode;
      
      // 根据交互模式切换指令
      switch (mode) {
        case 'move':
          this.selectCommand('move');
          break;
          
        case 'attack':
          this.selectCommand('attack');
          break;
          
        case 'select':
          // 选择模式下不切换指令
          break;
      }
    });
  }

  /**
   * 更新战斗群指挥部队选项
   * @param {Array} forceIds - 部队ID列表
   */
  updateBattlegroupCommandOptions(forceIds) {
    // 获取组建战斗群指令
    const formBattlegroupCommand = this.state.availableCommands.find(cmd => cmd.id === 'form_battlegroup');
    
    if (formBattlegroupCommand) {
      // 获取指挥部队参数
      const commandForceParam = formBattlegroupCommand.params.find(param => param.name === 'commandForceId');
      
      if (commandForceParam) {
        // 清空选项
        commandForceParam.options = [];
        
        // 为每个部队添加选项
        forceIds.forEach(forceId => {
          // 获取部队数据
          const entity = this.apiService.getForceEntity(forceId);
          
          if (entity && entity.properties.forceData) {
            const forceName = entity.properties.forceData.force_name;
            
            // 添加选项
            commandForceParam.options.push({
              value: forceId,
              label: forceName || `部队 ${forceId}`
            });
          }
        });
        
        // 默认选择第一个选项
        if (commandForceParam.options.length > 0) {
          commandForceParam.value = commandForceParam.options[0].value;
        }
      }
    }
  }

  /**
   * 选择指令
   * @param {string} commandId - 指令ID
   */
  selectCommand(commandId) {
    const command = this.state.availableCommands.find(cmd => cmd.id === commandId);
    
    if (!command) {
      console.error(`找不到指令: ${commandId}`);
      return;
    }
    
    // 更新选中的指令
    this.state.selectedCommand = command;
    
    // 切换到对应的标签页
    this.state.activeTab = commandId;
    
    // 根据指令设置交互模式
    switch (commandId) {
      case 'move':
        this.mapInteractionManager.setMode('move');
        break;
        
      case 'attack':
        this.mapInteractionManager.setMode('attack');
        break;
        
      case 'form_battlegroup':
      case 'form_formation':
        this.mapInteractionManager.setMode('select');
        break;
        
      default:
        this.mapInteractionManager.setMode('normal');
        break;
    }
  }

  /**
   * 更新指令参数
   * @param {string} paramName - 参数名称
   * @param {any} value - 参数值
   */
  updateCommandParams(paramName, value) {
    // 更新命令参数
    this.state.commandParams[paramName] = value;
    
    // 同时更新所有指令中的对应参数
    this.state.availableCommands.forEach(command => {
      const param = command.params.find(p => p.name === paramName);
      if (param) {
        param.value = value;
      }
    });
  }

  /**
   * 执行指令
   */
  async executeCommand() {
    if (!this.state.selectedCommand) {
      console.error('未选择指令');
      return;
    }
    
    // 检查是否需要选中部队
    if (this.state.selectedCommand.requiresSelection) {
      const hasSelection = this.checkSelectionRequirement();
      
      if (!hasSelection) {
        console.error('请先选择部队');
        return;
      }
    }
    
    // 获取指令参数
    const params = {};
    this.state.selectedCommand.params.forEach(param => {
      params[param.name] = param.value;
    });
    
    // 标记为正在执行
    this.state.isExecuting = true;
    
    try {
      // 调用API执行指令
      const result = await this.apiService.executeCommand(this.state.selectedCommand.id, params);
      
      // 更新执行结果
      this.state.executionResult = result;
      
      // 添加到历史记录
      this.addToHistory(this.state.selectedCommand, params, result);
      
      // 处理执行结果
      this.handleExecutionResult(result);
      
      return result;
    } catch (error) {
      console.error('执行指令失败:', error);
      
      // 更新执行结果
      this.state.executionResult = {
        success: false,
        error: error.message || '执行指令失败'
      };
      
      // 添加到历史记录
      this.addToHistory(this.state.selectedCommand, params, this.state.executionResult);
      
      throw error;
    } finally {
      // 标记为执行完成
      this.state.isExecuting = false;
    }
  }

  /**
   * 检查选中部队要求
   * @returns {boolean} 是否满足要求
   */
  checkSelectionRequirement() {
    const command = this.state.selectedCommand;
    
    if (!command) return false;
    
    // 检查各种参数是否已设置
    if (command.params.find(p => p.name === 'forceId')) {
      return !!this.state.commandParams.forceId;
    }
    
    if (command.params.find(p => p.name === 'attackerForceId')) {
      return !!this.state.commandParams.attackerForceId;
    }
    
    if (command.params.find(p => p.name === 'forceIds')) {
      return this.state.commandParams.forceIds && this.state.commandParams.forceIds.length > 0;
    }
    
    return true;
  }

  /**
   * 处理执行结果
   * @param {Object} result - 执行结果
   */
  handleExecutionResult(result) {
    if (!result.success) {
      // 执行失败，显示错误信息
      console.error('指令执行失败:', result.error);
      return;
    }
    
    // 根据指令类型处理结果
    switch (this.state.selectedCommand.id) {
      case 'move':
        this.handleMoveResult(result);
        break;
        
      case 'attack':
        this.handleAttackResult(result);
        break;
        
      case 'form_battlegroup':
        this.handleFormBattlegroupResult(result);
        break;
        
      case 'form_formation':
        this.handleFormFormationResult(result);
        break;
        
      case 'end_turn':
        this.handleEndTurnResult(result);
        break;
    }
    
    // 重置交互模式
    this.mapInteractionManager.setMode('normal');
    
    // 清除选中状态
    this.mapInteractionManager.clearSelection();
  }

  /**
   * 处理移动结果
   * @param {Object} result - 执行结果
   */
  handleMoveResult(result) {
    // 触发移动动画事件
    const event = new CustomEvent('move-animation', {
      detail: {
        forceId: this.state.commandParams.forceId,
        path: this.state.commandParams.path,
        result: result
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * 处理攻击结果
   * @param {Object} result - 执行结果
   */
  handleAttackResult(result) {
    // 触发战斗动画事件
    const event = new CustomEvent('battle-animation', {
      detail: {
        attackerForceId: this.state.commandParams.attackerForceId,
        targetHexId: this.state.commandParams.targetHexId,
        result: result
      }
    });
    window.dispatchEvent(event);
    
    // 触发战斗信息事件
    const infoEvent = new CustomEvent('battle-occurred', {
      detail: result.battleResult
    });
    window.dispatchEvent(infoEvent);
  }

  /**
   * 处理组建战斗群结果
   * @param {Object} result - 执行结果
   */
  handleFormBattlegroupResult(result) {
    // 触发战斗群更新事件
    const event = new CustomEvent('battlegroup-updated', {
      detail: {
        battlegroupId: result.battlegroupId,
        forceIds: this.state.commandParams.forceIds,
        commandForceId: this.state.commandParams.commandForceId
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * 处理编组结果
   * @param {Object} result - 执行结果
   */
  handleFormFormationResult(result) {
    // 触发编组更新事件
    const event = new CustomEvent('formation-updated', {
      detail: {
        formationId: result.formationId,
        formationName: this.state.commandParams.formationName,
        forceIds: this.state.commandParams.forceIds
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * 处理结束回合结果
   * @param {Object} result - 执行结果
   */
  handleEndTurnResult(result) {
    // 触发回合更新事件
    const event = new CustomEvent('turn-updated', {
      detail: {
        currentTurn: result.currentTurn,
        currentFaction: result.currentFaction
      }
    });
    window.dispatchEvent(event);
    
    // 触发系统信息更新事件
    const systemEvent = new CustomEvent('system-updated', {
      detail: {
        currentTurn: result.currentTurn,
        currentFaction: result.currentFaction
      }
    });
    window.dispatchEvent(systemEvent);
  }

  /**
   * 添加到历史记录
   * @param {Object} command - 指令对象
   * @param {Object} params - 指令参数
   * @param {Object} result - 执行结果
   */
  addToHistory(command, params, result) {
    // 创建历史记录项
    const historyItem = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      command: command.name,
      params: { ...params },
      result: { ...result },
      success: result.success
    };
    
    // 添加到历史记录
    this.state.commandHistory.unshift(historyItem);
    
    // 限制历史记录数量
    if (this.state.commandHistory.length > 50) {
      this.state.commandHistory.pop();
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory() {
    this.state.commandHistory = [];
  }

  /**
   * 切换面板可见性
   */
  toggleVisibility() {
    this.state.visible = !this.state.visible;
  }

  /**
   * 获取面板状态
   * @returns {Object} 面板状态
   */
  getState() {
    return this.state;
  }
}
