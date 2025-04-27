import { reactive, ref } from 'vue';
import * as API from '@/services/api';
import { openGameStore } from '@/store';
import { showSuccess, showError, showWarning } from '@/layers/interaction-layer/MessageBox';

/**
 * 命令服务 - 负责接收、解析和执行来自不同源的命令
 * 支持从UI界面和外部文件/API获取命令
 */
export class CommandService {
  static instance = null;

  constructor() {
    // 单例模式
    if (CommandService.instance) {
      return CommandService.instance;
    }
    CommandService.instance = this;

    // 命令处理器映射表
    this.commandHandlers = {};
    
    // 命令执行状态
    this.state = reactive({
      isProcessing: false,      // 是否正在处理命令
      currentCommand: null,     // 当前正在处理的命令
      commandQueue: [],         // 命令队列
      lastExecutionResult: null // 最近一次命令执行结果
    });

    // 可订阅的事件
    this.events = {
      onCommandReceived: [], // 收到命令时触发
      onCommandExecuted: [], // 执行命令后触发
      onCommandError: []     // 命令执行出错时触发
    };

    // 注册内置命令处理器
    this._registerBuiltinHandlers();
  }

  /**
   * 注册命令处理器
   * @param {string} commandType 命令类型
   * @param {Function} handler 处理函数
   */
  registerHandler(commandType, handler) {
    if (typeof handler !== 'function') {
      console.error(`命令处理器必须是函数: ${commandType}`);
      return;
    }
    this.commandHandlers[commandType] = handler;
  }

  /**
   * 获取已注册的命令类型列表
   * @returns {string[]} 命令类型列表
   */
  getRegisteredCommandTypes() {
    return Object.keys(this.commandHandlers);
  }

  /**
   * 添加事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   * @returns {Function} 取消监听的函数
   */
  addEventListener(eventName, callback) {
    if (!this.events[eventName]) {
      console.error(`未知事件: ${eventName}`);
      return () => {};
    }
    
    this.events[eventName].push(callback);
    
    return () => {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    };
  }

  /**
   * 触发事件
   * @private
   * @param {string} eventName 事件名称
   * @param {*} data 事件数据
   */
  _triggerEvent(eventName, data) {
    if (!this.events[eventName]) return;
    
    this.events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件处理出错: ${eventName}`, error);
      }
    });
  }

  /**
   * 注册内置命令处理器
   * @private
   */
  _registerBuiltinHandlers() {
    // 移动命令处理器
    this.registerHandler('MOVE', async (command) => {
      const { force_id, path } = command.params;
      if (!force_id || !path || !Array.isArray(path)) {
        throw new Error('移动命令参数不完整');
      }
      
      const result = await API.move({ force_id, path });
      return result;
    });

    // 攻击命令处理器
    this.registerHandler('ATTACK', async (command) => {
      const { command_force_id, target_hex, support_force_ids } = command.params;
      if (!command_force_id || !target_hex) {
        throw new Error('攻击命令参数不完整');
      }
      
      const result = await API.attack({ 
        command_force_id, 
        target_hex, 
        support_force_ids: support_force_ids || [] 
      });
      return result;
    });

    // 创建部队命令处理器
    this.registerHandler('CREATE_FORCE', async (command) => {
      const { force_name, faction, hex_id, composition } = command.params;
      if (!faction || !hex_id || !composition) {
        throw new Error('创建部队命令参数不完整');
      }
      
      const result = await API.createForce({ force_name, faction, hex_id, composition });
      return result;
    });

    // 合并部队命令处理器
    this.registerHandler('MERGE_FORCES', async (command) => {
      const { force_ids, force_name, hex_id } = command.params;
      if (!force_ids || !Array.isArray(force_ids) || force_ids.length < 2) {
        throw new Error('合并部队命令参数不完整');
      }
      
      const result = await API.mergeForces({ force_ids, force_name, hex_id });
      return result;
    });

    // 拆分部队命令处理器
    this.registerHandler('SPLIT_FORCE', async (command) => {
      const { force_id, hex_id, split_details } = command.params;
      if (!force_id || !split_details || !Array.isArray(split_details)) {
        throw new Error('拆分部队命令参数不完整');
      }
      
      const result = await API.splitForce({ force_id, hex_id, split_details });
      return result;
    });

    // 查询命令处理器
    this.registerHandler('QUERY', async (command) => {
      const { query_type, params } = command.params;
      if (!query_type) {
        throw new Error('查询命令参数不完整');
      }
      
      let result;
      switch (query_type) {
        case 'HEX':
          result = await API.queryHex(params);
          break;
        case 'FORCES':
          result = await API.queryForces(params);
          break;
        case 'UNIT_TYPES':
          result = await API.queryUnitTypes(params);
          break;
        case 'BATTLEGROUPS':
          result = await API.queryBattlegroups(params);
          break;
        case 'FORMATIONS':
          result = await API.queryFormations(params);
          break;
        default:
          throw new Error(`未知查询类型: ${query_type}`);
      }
      
      return result;
    });
  }

  /**
   * 提交命令到队列
   * @param {Object} command 命令对象
   * @param {string} command.type 命令类型
   * @param {Object} command.params 命令参数
   * @param {string} [command.source='ui'] 命令来源
   * @returns {Promise<Object>} 命令执行结果
   */
  async submitCommand(command) {
    if (!command.type || !this.commandHandlers[command.type]) {
      const errorMsg = `未知命令类型: ${command.type}`;
      showError(errorMsg);
      throw new Error(errorMsg);
    }

    // 为命令添加元数据
    const enhancedCommand = {
      ...command,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      timestamp: Date.now(),
      source: command.source || 'ui',
      status: 'pending'
    };

    // 将命令添加到队列
    this.state.commandQueue.push(enhancedCommand);
    this._triggerEvent('onCommandReceived', enhancedCommand);

    // 如果当前没有处理中的命令，立即处理
    if (!this.state.isProcessing) {
      return this._processNextCommand();
    }
    
    // 返回一个Promise，等待命令被处理
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const index = this.state.commandQueue.findIndex(cmd => cmd.id === enhancedCommand.id);
        if (index === -1) {
          // 命令已经被处理完成
          clearInterval(checkInterval);
          if (enhancedCommand.status === 'success') {
            resolve(enhancedCommand.result);
          } else {
            reject(new Error(enhancedCommand.error || '命令执行失败'));
          }
        }
      }, 100);
      
      // 设置超时
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('命令执行超时'));
      }, 30000);
    });
  }

  /**
   * 处理下一个队列中的命令
   * @private
   * @returns {Promise<Object>} 命令执行结果
   */
  async _processNextCommand() {
    if (this.state.commandQueue.length === 0) {
      this.state.isProcessing = false;
      this.state.currentCommand = null;
      return null;
    }
    
    this.state.isProcessing = true;
    const command = this.state.commandQueue.shift();
    this.state.currentCommand = command;
    
    try {
      const handler = this.commandHandlers[command.type];
      const result = await handler(command);
      
      // 更新命令状态
      command.status = 'success';
      command.result = result;
      
      // 显示成功消息
      if (result.status === 'success') {
        showSuccess(result.message || `${command.type} 命令执行成功`);
      } else {
        showWarning(result.message || '命令返回了非成功状态');
      }
      
      this.state.lastExecutionResult = result;
      this._triggerEvent('onCommandExecuted', { command, result });
      
      return result;
    } catch (error) {
      // 更新命令状态
      command.status = 'error';
      command.error = error.message;
      
      // 显示错误消息
      showError(`命令执行失败: ${error.message}`);
      
      this._triggerEvent('onCommandError', { command, error });
      throw error;
    } finally {
      // 处理队列中的下一个命令
      setTimeout(() => {
        this._processNextCommand();
      }, 0);
    }
  }

  /**
   * 从外部文件加载命令（支持JSON格式）
   * @param {File} file JSON文件对象
   * @returns {Promise<Array>} 提交的命令结果
   */
  async loadCommandsFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const commands = JSON.parse(content);
          
          if (!Array.isArray(commands)) {
            throw new Error('文件内容必须是命令数组');
          }
          
          // 依次提交所有命令
          const results = [];
          for (const cmd of commands) {
            // 添加来源标记
            cmd.source = 'file';
            
            try {
              const result = await this.submitCommand(cmd);
              results.push({ command: cmd, result, status: 'success' });
            } catch (error) {
              results.push({ command: cmd, error: error.message, status: 'error' });
            }
          }
          
          resolve(results);
        } catch (error) {
          showError(`解析命令文件失败: ${error.message}`);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        showError('读取文件失败');
        reject(new Error('读取文件失败'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * 从外部API获取命令
   * @param {string} url API端点URL
   * @param {Object} options 请求选项
   * @returns {Promise<Array>} 提交的命令结果
   */
  async fetchCommandsFromAPI(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const commands = await response.json();
      
      if (!Array.isArray(commands)) {
        throw new Error('API返回内容必须是命令数组');
      }
      
      // 依次提交所有命令
      const results = [];
      for (const cmd of commands) {
        // 添加来源标记
        cmd.source = 'api';
        
        try {
          const result = await this.submitCommand(cmd);
          results.push({ command: cmd, result, status: 'success' });
        } catch (error) {
          results.push({ command: cmd, error: error.message, status: 'error' });
        }
      }
      
      return results;
    } catch (error) {
      showError(`从API获取命令失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 清空命令队列
   */
  clearCommandQueue() {
    this.state.commandQueue = [];
  }
}

// 创建并导出全局单例
export const commandService = new CommandService();

// 导出便捷方法
export const submitCommand = (command) => commandService.submitCommand(command);
export const loadCommandsFromFile = (file) => commandService.loadCommandsFromFile(file);
export const fetchCommandsFromAPI = (url, options) => commandService.fetchCommandsFromAPI(url, options); 