// src\layers\interaction-layer\CommandDispatcher.js
import { openGameStore } from '@/store';
import { CommandProcessor, CommandError } from './CommandProcessor';
import { CommandType, CommandSource, CommandStatus } from '@/config/CommandConfig';
import { GameMode } from '@/config/GameModeConfig';
import { GameModeManager } from './GameModeManager';
import { showSuccess, showError } from './utils/MessageBox';

/**
 * CommandDispatcher类 - 负责命令的接收、分发与执行
 * 
 * 命令分发器是命令处理器的唯一入口，负责接收并解析来自面板、API JSON和文件的命令
 * 并调用CommandProcessor执行命令
 * 
 * --------------------- 命令结构 ---------------------
 * // 命令对象
 * command(basic): {
 *   type: CommandType,     // 命令类型
 *   params: Object,        // 命令参数
 *   interval: number,      // 命令执行间隔(可选，默认为-1)
 *   source: CommandSource, // 命令来源(可选，默认是UI)
 * }
 * command(full): {
 *   id: string,            // 命令ID
 *   type: CommandType,     // 命令类型
 *   params: Object,        // 命令参数
 *   startTime: number,     // 命令执行开始时间
 *   endTime: number,       // 命令执行完成时间
 *   interval: number,      // 命令执行间隔(毫秒)，负数表示关闭自动模式
 *   source: CommandSource, // 命令来源
 *   status: CommandStatus, // 命令状态
 * }
 * // 执行命令返回的结果
 * result: {
 *   status: CommandStatus, // failed, finished
 *   message: string,       // 用于历史记录中描述执行结果
 *   data: Object,          // 返回的数据
 * }
 * // 命令执行完成后生成的历史记录条目
 * historyCommand: {
 *   result: Object,        // 执行结果
 *   command: Object,       // 命令对象
 * }
 * ---------------------------------------------------
 */
export class CommandDispatcher {
  static #instance = null;
  static #autoId = 1; // 自增命令ID
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {CommandDispatcher} 单例实例
   */
  static getInstance(viewer) {
    if (!CommandDispatcher.#instance) {
      CommandDispatcher.#instance = new CommandDispatcher(viewer);
    }
    return CommandDispatcher.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.autoModeTimer = null;
    this.store = openGameStore();
    this.processor = null;
    this.gameModeManager = null;
  }

  init() {
    this.gameModeManager = GameModeManager.getInstance();
    this.processor = CommandProcessor.getInstance(this.viewer);
  }
  
  /**
   * 直接执行命令（从UI模块调用）
   * @param {string} type 命令类型
   * @param {Object} params 命令参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeCommandFromUI(type, params) {
    // 如果处于自动模式，则UI命令不执行
    if (this.store.autoMode) {
      throw new CommandError('系统处于自动模式，无法执行手动命令', 'validation');
    }
    
    // 如果有命令正在执行，不执行新命令
    if (this.store.isExecuting && !this.store.autoMode) {
      throw new CommandError('有命令正在执行，请稍候再试', 'validation');
    }
    
    // 创建命令并添加到队列
    const command = this._createCommand(type, params);
    
    // 验证命令
    if (!this._validateCommand(command)) {
      throw new CommandError('命令格式无效', 'validation');
    }
    
    // 将命令添加到队列
    this.store.addCommandToQueue(command);
    
    // 立即执行命令
    return this.executeQueuedCommand(command.id);
  }

  /**
   * 手动添加命令
   * @param {Object} data 命令数据
   * @returns {Promise<Object>} 执行结果
   */
  async addManualCommand(data) {
    try {
      // 解析命令 - _parseCommands返回一个数组
      const commands = this._parseCommands(data, CommandSource.MANUAL);
      
      // 将命令添加到队列
      commands.forEach(cmd => this.store.addCommandToQueue(cmd));
      
      return commands.length;
    } catch (error) {
      throw new CommandError(`手动添加命令失败: ${error.message}`, 'validation');
    }
  }
  
  /**
   * 从API加载命令
   * @param {string} url API地址
   * @returns {Promise<Array<Object>>} 加载的命令列表
   * 
   * API返回格式要求:
   * API应返回一个JSON格式的命令数组或单个命令对象，每个命令对象至少需要包含:
   * - type: 命令类型
   * - params: 命令参数对象
   * 
   * 示例:
   * [
   *   {
   *     "type": "MOVE_FORCE",
   *     "params": { "forceId": "123", "targetHexId": "A1" },
   *     "interval": 1000
   *   },
   *   {
   *     "type": "ATTACK",
   *     "params": { "attackerId": "123", "targetId": "456" }
   *   }
   * ]
   */
  async loadCommandsFromAPI(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new CommandError(`${response.status} ${response.statusText}`, 'network');
      }
      
      const data = await response.json();
      const commands = this._parseCommands(data, CommandSource.API);
      
      // 将命令添加到队列
      commands.forEach(cmd => this.store.addCommandToQueue(cmd));
      
      return commands.length;
    } catch (error) {
      if (error instanceof CommandError) {
        throw error;
      }
      throw new CommandError(`从API加载命令失败: ${error.message}`, 'network');
    }
  }

  /**
   * 从文件加载命令
   * @param {File} file JSON文件对象
   * @returns {Promise<Array<Object>>} 加载的命令列表
   * 
   * JSON文件格式要求:
   * 文件应包含一个命令数组，每个命令对象至少需要包含:
   * - type: 命令类型
   * - params: 命令参数对象
   * 
   * 示例:
   * [
   *   {
   *     "type": "MOVE_FORCE",
   *     "params": { "forceId": "123", "targetHexId": "A1" },
   *     "interval": 1000
   *   },
   *   {
   *     "type": "ATTACK",
   *     "params": { "attackerId": "123", "targetId": "456" }
   *   }
   * ]
   */
  async loadCommandsFromFile(file) {
    try {
      const content = await this._readFileAsText(file);
      const data = JSON.parse(content);
      const commands = this._parseCommands(data, CommandSource.FILE);
      
      // 将命令添加到队列
      commands.forEach(cmd => this.store.addCommandToQueue(cmd));
      
      return commands.length;
    } catch (error) {
      if (error instanceof CommandError) {
        throw error;
      }
      throw new CommandError(`从文件加载命令失败: ${error.message}`, 'file');
    }
  }

  /**
   * 执行队列中的指定命令，是执行命令的唯一入口
   * @param {string} commandId 命令ID
   * @returns {Promise<Object>} 历史记录 historyCommand
   */
  async executeQueuedCommand(commandId) {
    // 如果非自动模式下有命令正在执行，不执行新命令
    if (this.store.isExecuting && !this.store.autoMode) {
      throw new CommandError('有命令正在执行，请稍候再试', 'validation');
    }
    
    // 查找命令，确定命令是否存在
    const command = this.store.commandQueue.find(cmd => cmd.id === commandId);
    if (!command) {
      throw new CommandError(`找不到指定的命令: ${commandId}`, 'validation');
    }
    
    try {
      // 更新命令状态
      this.store.setCurrentCommand(command);
      command.status = CommandStatus.EXECUTING;
      command.startTime = Date.now();
      
      // 执行命令获取结果
      const result = await this._dispatchCommand(command);
      
      // 从队列中移除
      this.store.removeCommandFromQueue(commandId);
      
      // 更新命令状态
      command.status = result.status;
      command.endTime = Date.now();
      
      // 生成历史记录条目
      const historyCommand = {
        result, // { status, message, data }
        command // { id, type, params, startTime, endTime, interval, source, status }
      };
      
      // 添加到历史记录
      this.store.addCommandToHistory(historyCommand);
      
      return historyCommand;
    } catch (error) {
      // 从队列中移除
      this.store.removeCommandFromQueue(commandId);

      // 生成执行失败的结果
      const result = {
        status: CommandStatus.FAILED,
        message: error instanceof CommandError ? error.message : `执行失败: ${error.message}`, 
        data: error instanceof CommandError ? error.data : null
      };
      
      // 更新命令状态
      command.status = result.status;
      command.endTime = Date.now();
      
      // 添加到历史记录
      this.store.addCommandToHistory({ result, command });
      
      // 继续抛出错误，让上层处理
      throw error;
    } finally {
      // 执行完成了，设置当前命令为null
      this.store.setCurrentCommand(null);
      
      // 如果是自动模式，并且命令有间隔，则设置定时器执行下一条命令
      if (this.store.autoMode && command.interval >= 0) {
        this._scheduleNextCommand(command.interval);
      }
      // 如果命令设置了负的间隔，表示关闭自动模式
      else if (command.interval < 0) {
        this.toggleAutoMode(false);
      }
    }
  }

  /**
   * 开始自动执行队列中的命令
   */
  startAutoMode() {
    this.toggleAutoMode(true);
    this._scheduleNextCommand(0);
  }
  
  /**
   * 停止自动执行
   */
  stopAutoMode() {
    this.toggleAutoMode(false);
  }
  
  /**
   * 切换自动模式
   * @param {boolean} enable 是否启用自动模式
   */
  toggleAutoMode(enable) {
    // 设置 store 中的自动模式状态
    this.store.setAutoMode(enable);
    
    // 如果关闭自动模式且存在计时器，则清除计时器
    if (!enable && this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
    
    // 如果关闭自动模式，恢复到自由模式
    if (!enable) {
      this.gameModeManager.setMode(GameMode.FREE);
    }
  }
  
  /**
   * 创建命令对象
   * @param {string} type 命令类型
   * @param {Object} params 命令参数
   * @param {number} [interval] 命令执行间隔(毫秒)，负数表示关闭自动模式
   * @param {string} [source] 命令来源
   * @returns {Object} 命令对象 command
   */
  _createCommand(type, params, interval = 0, source = CommandSource.UI) {
    return {
      id: `CMD_${CommandDispatcher.#autoId++}`,
      type,
      params,
      startTime: 0,
      endTime: 0,
      interval,
      source,
      status: CommandStatus.PENDING
    };
  }
  
  /**
   * 校验命令基本格式
   * @param {Object} command 命令对象
   * @returns {boolean} 是否通过校验
   */
  _validateCommand(command) {
    // 基本格式校验
    if (!command.type || !command.params) {
      return false;
    }
    
    // 根据命令类型进行特定校验
    switch (command.type) {
      case CommandType.PANORAMA_MODE:
        return typeof command.params.enabled === 'boolean';
      case CommandType.ORBIT_MODE:
        return typeof command.params.enabled === 'boolean';
      case CommandType.CHANGE_LAYER:
        return Number.isInteger(command.params.layerIndex) && command.params.layerIndex >= 1 && command.params.layerIndex <= 3;
      case CommandType.STATISTIC:
        return typeof command.params.enabled === 'boolean';
      case CommandType.MOVE_PREPARE:
        return !!command.params.forceId;
      case CommandType.ATTACK_PREPARE:
        return !!command.params.forceId;
      case CommandType.MOVE:
        return !!command.params.forceId && Array.isArray(command.params.path) && command.params.path.length > 1;
      case CommandType.ATTACK:
        return !!command.params.commandForceId && Array.isArray(command.params.supportForceIds) && !!command.params.targetHex;
      case CommandType.EDIT_UNIT:
        return !!command.params.unitData;
      case CommandType.DELETE_UNIT:
        return !!command.params.unitId;
      case CommandType.CREATE_FORCE:
        return !!command.params.forceData;
      case CommandType.MERGE_FORCES:
        return !!command.params.newForceName && Array.isArray(command.params.forceIds) && command.params.forceIds.length > 1;
      case CommandType.SPLIT_FORCE:
        return !!command.params.forceId && Array.isArray(command.params.splitDetails) && command.params.splitDetails.length > 1;
      case CommandType.CREATE_FORMATION:
        return !!command.params.name && !!command.params.faction;
      case CommandType.ADD_FORCE_TO_FORMATION:
        return !!command.params.forceId && !!command.params.formationId;
      case CommandType.DELETE_FORMATION:
        return !!command.params.formationId;
      case CommandType.RESET_CAMERA:
        return true;
      case CommandType.FOCUS_FORCE:
        return true;
      case CommandType.NEXT_FACTION:
        return true;
      default:
        return false;
    }
  }

  /**
   * 解析命令JSON数据
   * @private
   * @param {Object|Array} data 命令JSON数据
   * @param {string} source 命令来源
   * @returns {Array<Object>} 解析后的命令列表
   */
  _parseCommands(data, source) {
    let commandList = Array.isArray(data) ? data : [data];
    
    return commandList.map(cmd => {
      // 验证命令格式
      if (!cmd.type) {
        throw new CommandError('无效的命令格式: 缺少type字段', 'validation');
      }
      
      // 标准化命令格式
      const command = this._createCommand(
        cmd.type,
        cmd.params || {},
        cmd.interval || 0,
        source
      );
      
      // 校验命令
      if (!this._validateCommand(command)) {
        throw new CommandError(`命令格式无效: ${command.type}`, 'validation');
      }
      
      return command;
    });
  }

  /**
   * 分发命令至processor各方法
   * @private
   * @param {Object} command 命令对象
   * @returns {Promise<Object>} 执行结果 result
   */
  async _dispatchCommand(command) {
    const { type, params } = command;
    
    // 根据命令类型执行对应的命令
    let result;
    
    switch (type) {
      // 通用命令
      case CommandType.NEXT_FACTION:
        result = await this.processor.switchToNextFaction();
        break;

      case CommandType.MOVE:
        result = await this.processor.move(params.forceId, params.path);
        break;

      case CommandType.ATTACK:
        result = await this.processor.attack(params.commandForceId, params.targetHex, params.supportForceIds);
        break;

      case CommandType.EDIT_UNIT:
        result = await this.processor.editUnit(params.unitData);
        break;

      case CommandType.DELETE_UNIT:
        result = await this.processor.deleteUnit(params.unitId);
        break;

      case CommandType.CREATE_FORCE:
        result = await this.processor.createForce(params.forceData, params.formationId || null);
        break;
      
      case CommandType.MERGE_FORCES:
        result = await this.processor.mergeForces(params.newForceName, params.forceIds, params.formationId || null);
        break;
      
      case CommandType.SPLIT_FORCE:
        result = await this.processor.splitForce(params.forceId, params.splitDetails);
        break;

      case CommandType.CREATE_FORMATION:
        result = await this.processor.createFormation(params.name, params.faction);
        break;
        
      case CommandType.ADD_FORCE_TO_FORMATION:
        result = await this.processor.addForceToFormation(params.forceId, params.formationId);
        break;
        
      case CommandType.DELETE_FORMATION:
        result = await this.processor.deleteFormation(params.formationId);
        break;

      case CommandType.PANORAMA_MODE:
        result = await this.processor.setPanoramaMode(params.enabled);
        break;
      
      case CommandType.ORBIT_MODE:
        result = await this.processor.toggleOrbitMode(params.enabled);
        break;

      case CommandType.CHANGE_LAYER:
        result = await this.processor.changeLayer(params.layerIndex);
        break;

      case CommandType.STATISTIC:
        result = await this.processor.toggleStatMode(params.enabled);
        break;

      case CommandType.MOVE_PREPARE:
        result = await this.processor.movePrepare(params.forceId);
        break;
        
      case CommandType.ATTACK_PREPARE:
        result = await this.processor.attackPrepare(params.forceId);
        break;
      
      case CommandType.RESET_CAMERA:
        result = await this.processor.resetCamera();
        break;
      
      case CommandType.FOCUS_FORCE:
        result = await this.processor.focusOnForce(params.forceId || params.hexId || null);
        break;
 
      default:
        throw new CommandError(`未知的命令类型: ${type}`, 'validation');
    }
    
    return result;
  }
  
  /**
   * 自动模式下，安排执行下一条命令，上一条命令执行完成时执行这个方法
   * @param {number} delay 延迟时间(毫秒)
   */
  _scheduleNextCommand(delay = 0) {
    if (!this.store.autoMode) return;
    
    if (this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
    
    // 延迟delay毫秒后执行executeNextCommand方法
    this.autoModeTimer = setTimeout(() => {
      this._executeNextCommand();
    }, delay);
  }
  
  /**
   * 自动模式下，执行队列中下一条可执行的命令
   */
  async _executeNextCommand() {
    if (!this.store.autoMode) return;
    
    // 如果有命令在执行，等待它完成
    if (this.store.isExecuting) {
      this._scheduleNextCommand(500);
      console.warn(`有命令在执行，但执行到这里时本不该有命令执行！`);
      return;
    }
    
    // 根据过滤器查找下一条符合条件的命令
    const nextCommand = this.store.commandQueue.find(cmd => {
      // 检查命令状态
      const isPending = cmd.status === CommandStatus.PENDING;
      
      // 检查命令来源是否在当前过滤器中
      const isSourceAllowed = this.store.commandQueueFilter[cmd.source] === true;
      
      return isPending && isSourceAllowed;
    });
    
    if (nextCommand) {
      try {
        await this.executeQueuedCommand(nextCommand.id);
      } catch (error) {
        // 出错时，停止自动模式
        this.toggleAutoMode(false);
        showError('命令执行失败，自动模式已关闭');
      }
    } else {
      // 队列中没有可执行的命令，停止自动模式
      this.toggleAutoMode(false);
      showSuccess('命令队列执行完毕，自动模式已关闭');
    }
  }

  /**
   * 将文件读取为文本的辅助方法
   * @private
   * @param {File} file 要读取的文件
   * @returns {Promise<string>} 文件内容
   */
  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new CommandError('读取文件失败', 'file'));
      reader.readAsText(file);
    });
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    if (this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
    this.gameModeManager = null;
    this.processor = null;
    CommandDispatcher.#instance = null;
  }
}

// 导出命令服务实例
export const CommandService = {
  async executeCommandFromUI(type, params) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.executeCommandFromUI(type, params);
  },

  async addManualCommand(data) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.addManualCommand(data);
  },
  
  async loadCommandsFromFile(file) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.loadCommandsFromFile(file);
  },
  
  async loadCommandsFromAPI(url) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.loadCommandsFromAPI(url);
  },

  async executeQueuedCommand(commandId) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.executeQueuedCommand(commandId);
  },
  
  startAutoMode() {
    const dispatcher = CommandDispatcher.getInstance();
    dispatcher.startAutoMode();
  },
  
  stopAutoMode() {
    const dispatcher = CommandDispatcher.getInstance();
    dispatcher.stopAutoMode();
  },
  
  toggleAutoMode(enable) {
    const dispatcher = CommandDispatcher.getInstance();
    dispatcher.toggleAutoMode(enable);
  }
};