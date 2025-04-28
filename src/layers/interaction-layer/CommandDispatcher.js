/**
 * 命令分发模块 - 接收并解析来自面板、API JSON和文件的命令
 * 并调用CommandProcessor执行命令
 */
import { openGameStore } from '@/store';
import { CommandProcessor } from './CommandProcessor';
import { showSuccess, showError, showWarning } from './MessageBox';
import { CommandType, CommandSource, CommandStatus } from '@/config/CommandConfig';

/**
 * CommandDispatcher类 - 负责命令的接收、分发与执行
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
    this.processor = CommandProcessor.getInstance(viewer);
    this.processor.initMilitaryManager();
    this.autoModeTimer = null;
    this.store = openGameStore();
  }
  
  /**
   * 创建命令对象
   * @param {string} type 命令类型
   * @param {Object} params 命令参数
   * @param {number} [interval] 命令执行间隔(毫秒)，负数表示关闭自动模式
   * @param {string} [source] 命令来源
   * @returns {Object} 命令对象
   */
  createCommand(type, params, interval = 0, source = CommandSource.UI) {
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
   * 校验命令格式
   * @param {Object} command 命令对象
   * @returns {boolean} 是否通过校验
   */
  validateCommand(command) {
    // 基本格式校验
    if (!command.type || !command.params) {
      return false;
    }
    
    // 根据命令类型进行特定校验
    switch (command.type) {
      case CommandType.ORBIT_MODE:
        return typeof command.params.enabled === 'boolean';
      
      case CommandType.CHANGE_LAYER:
        return Number.isInteger(command.params.layerIndex) && command.params.layerIndex >= 1 && command.params.layerIndex <= 3;
      
      case CommandType.SELECTION_MODE:
        return typeof command.params.isMultiSelect === 'boolean';
        
      case CommandType.MOVE:
        return !!command.params.forceId && Array.isArray(command.params.path);
      
      case CommandType.ATTACK:
        return !!command.params.commandForceId && !!command.params.targetHex;
        
      case CommandType.CREATE_FORCE:
        return !!command.params.hexId && !!command.params.faction && Array.isArray(command.params.composition);
        
      case CommandType.MERGE_FORCES:
        return !!command.params.hexId && Array.isArray(command.params.forceIds) && command.params.forceIds.length > 1;
        
      case CommandType.SPLIT_FORCE:
        return !!command.params.forceId && !!command.params.splitDetails;
        
      // 其他命令类型不需要参数或有默认值
      case CommandType.RESET_CAMERA:
      case CommandType.FOCUS_FORCE:
      case CommandType.NEXT_FACTION:
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * 直接执行命令（从UI模块调用）
   * @param {string} type 命令类型
   * @param {Object} params 命令参数
   * @returns {Promise<Object>} 执行结果
   */
  async executeCommand(type, params) {
    // 如果处于自动模式，则UI命令不执行
    if (this.store.autoMode) {
      showWarning('系统处于自动模式，无法执行手动命令');
      return null;
    }
    
    // 如果有命令正在执行，不执行新命令
    if (this.store.isExecuting && !this.store.autoMode) {
      showWarning('有命令正在执行，请稍候再试');
      return null;
    }
    
    // 创建命令并添加到队列
    const command = this.createCommand(type, params);
    
    // 验证命令
    if (!this.validateCommand(command)) {
      showError('命令格式无效');
      return null;
    }
    
    // 将命令添加到队列
    this.store.addCommandToQueue(command);
    
    // 立即执行命令
    return this.executeQueuedCommand(command.id);
  }
  
  /**
   * 从API拉取命令
   * @param {string} url API地址
   * @returns {Promise<Array<Object>>} 拉取到的命令列表
   */
  async fetchCommandsFromAPI(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const commands = this._parseCommands(data, CommandSource.API);
      
      // 将命令添加到队列
      commands.forEach(cmd => this.store.addCommandToQueue(cmd));
      
      showSuccess(`成功从API拉取${commands.length}条命令`);
      return commands;
    } catch (error) {
      console.error('从API拉取命令失败:', error);
      showError(`从API拉取命令失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 从文件加载命令
   * @param {File} file JSON文件对象
   * @returns {Promise<Array<Object>>} 加载的命令列表
   */
  async loadCommandsFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          const commands = this._parseCommands(data, CommandSource.FILE);
          
          // 将命令添加到队列
          commands.forEach(cmd => this.store.addCommandToQueue(cmd));
          
          showSuccess(`成功从文件加载${commands.length}条命令`);
          resolve(commands);
        } catch (error) {
          reject(new Error(`解析命令文件失败: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };
      
      reader.readAsText(file);
    });
  }
  
  /**
   * 解析命令数据
   * @private
   * @param {Object|Array} data 命令数据
   * @param {string} source 命令来源
   * @returns {Array<Object>} 解析后的命令列表
   */
  _parseCommands(data, source) {
    let commandList = Array.isArray(data) ? data : [data];
    
    return commandList.map(cmd => {
      // 验证命令格式
      if (!cmd.type) {
        throw new Error(`无效的命令格式: 缺少type字段`);
      }
      
      // 标准化命令格式
      const command = this.createCommand(
        cmd.type,
        cmd.params || {},
        cmd.interval || 0,
        source
      );
      
      // 校验命令
      if (!this.validateCommand(command)) {
        throw new Error(`命令格式无效: ${command.type}`);
      }
      
      return command;
    });
  }
  
  /**
   * 执行队列中的指定命令，是执行命令的唯一入口
   * @param {string} commandId 命令ID
   * @returns {Promise<Object>} 执行结果
   */
  async executeQueuedCommand(commandId) {
    // 如果有命令正在执行，不执行新命令
    if (this.store.isExecuting && !this.store.autoMode) {
      showWarning('有命令正在执行，请稍候再试');
      return null;
    }
    
    // 查找命令，确定命令是否存在
    const command = this.store.commandQueue.find(cmd => cmd.id === commandId);
    if (!command) {
      showError(`找不到指定的命令: ${commandId}`);
      return null;
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
      const historyItem = {
        result, // { status, message, data }
        command // { id, type, params, startTime, endTime, interval, source, status }
      }
      // 添加到历史记录
      this.store.addCommandToHistory(historyItem);
      
      return historyItem;
    } catch (error) {
      // 从队列中移除
      this.store.removeCommandFromQueue(commandId);

      // 生成结果
      const result = {
        status: CommandStatus.FAILED,
        message: error.message, 
        data: null
      }
      // 更新命令状态
      command.status = result.status;
      command.endTime = Date.now();
      
      // 添加到历史记录
      this.store.addCommandToHistory({ result, command });
      
      throw error;
    } finally {
      // 执行完成了，设置当前命令为null
      this.store.setCurrentCommand(null);
      
      // 如果是自动模式，并且命令有间隔，则设置定时器执行下一条命令
      if (this.store.autoMode && command.interval >= 0) {
        this.scheduleNextCommand(command.interval);
      }
      // 如果命令设置了负的间隔，表示关闭自动模式
      else if (command.interval < 0) {
        this.toggleAutoMode(false);
      }
    }
  }
  
  /**
   * 分发命令至process各方法
   * @private
   * @param {Object} command 命令对象
   * @returns {Promise<Object>} result
   * result: {
   *   status: CommandStatus, // failed, finished
   *   message: string, // 用于历史记录中描述执行结果
   *   data: any  // 返回的数据
   * }
   */
  async _dispatchCommand(command) {
    const { type, params } = command;
    
    switch (type) {
      // 场景控制命令
      case CommandType.ORBIT_MODE:
        return this.processor.toggleOrbitMode(params.enabled);
      
      case CommandType.RESET_CAMERA:
        return this.processor.resetCamera();
      
      case CommandType.FOCUS_FORCE:
        return this.processor.focusOnSelectedForce();
      
      case CommandType.CHANGE_LAYER:
        return this.processor.changeLayer(params.layerIndex);
      
      case CommandType.SELECTION_MODE:
        return this.processor.setSelectionMode(params.isMultiSelect);
      
      case CommandType.NEXT_FACTION:
        return this.processor.switchToNextFaction();
      
      // 军事单位命令
      case CommandType.MOVE:
        if (!this.processor.move) {
          throw new Error('移动命令尚未实现');
        }
        return this.processor.move(params.forceId, params.path);
      
      case CommandType.ATTACK:
        if (!this.processor.attack) {
          throw new Error('攻击命令尚未实现');
        }
        return this.processor.attack(
          params.commandForceId, 
          params.targetHex, 
          params.supportForceIds
        );
      
      case CommandType.CREATE_FORCE:
        if (!this.processor.createForce) {
          throw new Error('创建部队命令尚未实现');
        }
        return this.processor.createForce(
          params.hexId, 
          params.faction, 
          params.composition, 
          params.formationId
        );
      
      case CommandType.MERGE_FORCES:
        if (!this.processor.mergeForces) {
          throw new Error('合并部队命令尚未实现');
        }
        return this.processor.mergeForces(params.hexId, params.forceIds);
      
      case CommandType.SPLIT_FORCE:
        if (!this.processor.splitForce) {
          throw new Error('拆分部队命令尚未实现');
        }
        return this.processor.splitForce(params.forceId, params.splitDetails);
      
      default:
        throw new Error(`未知的命令类型: ${type}`);
    }
  }
  
  /**
   * 开始自动执行队列中的命令
   */
  startAutoMode() {
    this.toggleAutoMode(true);
    this.scheduleNextCommand(0);
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
    this.store.setAutoMode(enable);
    
    // 如果关闭自动模式且存在计时器，则清除计时器
    if (!enable && this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
  }
  
  /**
   * 安排执行下一条命令，上一条命令执行完成时执行这个方法
   * @param {number} delay 延迟时间(毫秒)
   */
  scheduleNextCommand(delay = 0) {
    if (!this.store.autoMode) return;
    
    if (this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
    
    // 延迟delay毫秒后执行executeNextCommand方法
    this.autoModeTimer = setTimeout(() => {
      this.executeNextCommand();
    }, delay);
  }
  
  /**
   * 执行队列中下一条可执行的命令
   */
  async executeNextCommand() {
    if (!this.store.autoMode) return;
    
    // 如果有命令在执行，等待它完成
    if (this.store.isExecuting) {
      this.scheduleNextCommand(500);
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
      await this.executeQueuedCommand(nextCommand.id);
    } else {
      // 队列中没有可执行的命令，停止自动模式
      this.toggleAutoMode(false);
      showSuccess('命令队列执行完毕，自动模式已关闭');
    }
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    if (this.autoModeTimer) {
      clearTimeout(this.autoModeTimer);
      this.autoModeTimer = null;
    }
    
    CommandDispatcher.#instance = null;
  }
}

// 导出命令服务实例
export const CommandService = {
  async executeCommand(type, params) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.executeCommand(type, params);
  },
  
  async executeQueuedCommand(commandId) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.executeQueuedCommand(commandId);
  },
  
  async loadCommandsFromFile(file) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.loadCommandsFromFile(file);
  },
  
  async fetchCommandsFromAPI(url) {
    const dispatcher = CommandDispatcher.getInstance();
    return dispatcher.fetchCommandsFromAPI(url);
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