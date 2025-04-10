import axios from 'axios';

/**
 * API服务类
 * 负责与后端API进行通信
 */
export class ApiService {
  /**
   * 构造函数
   * @param {string} baseURL - API基础URL
   */
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    
    // 创建axios实例
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 添加请求拦截器
    this.client.interceptors.request.use(
      config => {
        // 在发送请求之前做些什么
        return config;
      },
      error => {
        // 对请求错误做些什么
        return Promise.reject(error);
      }
    );
    
    // 添加响应拦截器
    this.client.interceptors.response.use(
      response => {
        // 对响应数据做些什么
        return response.data;
      },
      error => {
        // 对响应错误做些什么
        return Promise.reject(error);
      }
    );
    
    // 部队实体缓存
    this.forceEntities = new Map();
  }

  /**
   * 获取六角格数据
   * @returns {Promise} 六角格数据
   */
  async getHexGrid() {
    try {
      return await this.client.get('/hex/grid');
    } catch (error) {
      console.error('获取六角格数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取六角格详情
   * @param {string} hexId - 六角格ID
   * @returns {Promise} 六角格详情
   */
  async getHexDetail(hexId) {
    try {
      return await this.client.get(`/hex/${hexId}`);
    } catch (error) {
      console.error(`获取六角格 ${hexId} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有部队
   * @returns {Promise} 部队列表
   */
  async getForces() {
    try {
      const response = await this.client.get('/force/list');
      
      // 转换为对象格式，以ID为键
      const forces = {};
      response.forEach(force => {
        forces[force.force_id] = force;
      });
      
      return forces;
    } catch (error) {
      console.error('获取部队列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取部队详情
   * @param {number} forceId - 部队ID
   * @returns {Promise} 部队详情
   */
  async getForce(forceId) {
    try {
      return await this.client.get(`/force/${forceId}`);
    } catch (error) {
      console.error(`获取部队 ${forceId} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 获取部队实体
   * @param {number} forceId - 部队ID
   * @returns {Entity} 部队实体
   */
  getForceEntity(forceId) {
    return this.forceEntities.get(forceId);
  }

  /**
   * 设置部队实体
   * @param {number} forceId - 部队ID
   * @param {Entity} entity - 部队实体
   */
  setForceEntity(forceId, entity) {
    this.forceEntities.set(forceId, entity);
  }

  /**
   * 获取所有战斗群
   * @returns {Promise} 战斗群列表
   */
  async getBattlegroups() {
    try {
      const response = await this.client.get('/battlegroup/list');
      
      // 转换为对象格式，以ID为键
      const battlegroups = {};
      response.forEach(battlegroup => {
        battlegroups[battlegroup.battlegroup_id] = battlegroup;
      });
      
      return battlegroups;
    } catch (error) {
      console.error('获取战斗群列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取战斗群详情
   * @param {string} battlegroupId - 战斗群ID
   * @returns {Promise} 战斗群详情
   */
  async getBattlegroup(battlegroupId) {
    try {
      return await this.client.get(`/battlegroup/${battlegroupId}`);
    } catch (error) {
      console.error(`获取战斗群 ${battlegroupId} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有编队
   * @returns {Promise} 编队列表
   */
  async getFormations() {
    try {
      const response = await this.client.get('/formation/list');
      
      // 转换为对象格式，以ID为键
      const formations = {};
      response.forEach(formation => {
        formations[formation.formation_id] = formation;
      });
      
      return formations;
    } catch (error) {
      console.error('获取编队列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取编队详情
   * @param {string} formationId - 编队ID
   * @returns {Promise} 编队详情
   */
  async getFormation(formationId) {
    try {
      return await this.client.get(`/formation/${formationId}`);
    } catch (error) {
      console.error(`获取编队 ${formationId} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 获取所有目标点
   * @returns {Promise} 目标点列表
   */
  async getObjectives() {
    try {
      return await this.client.get('/objective/list');
    } catch (error) {
      console.error('获取目标点列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有兵种
   * @returns {Promise} 兵种列表
   */
  async getUnitTypes() {
    try {
      const response = await this.client.get('/unittype/list');
      
      // 转换为对象格式，以ID为键
      const unitTypes = {};
      response.forEach(unitType => {
        unitTypes[unitType.unit_type_id] = unitType;
      });
      
      return unitTypes;
    } catch (error) {
      console.error('获取兵种列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取兵种详情
   * @param {string} unitTypeId - 兵种ID
   * @returns {Promise} 兵种详情
   */
  async getUnitType(unitTypeId) {
    try {
      return await this.client.get(`/unittype/${unitTypeId}`);
    } catch (error) {
      console.error(`获取兵种 ${unitTypeId} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 执行指令
   * @param {string} commandType - 指令类型
   * @param {Object} params - 指令参数
   * @returns {Promise} 执行结果
   */
  async executeCommand(commandType, params) {
    try {
      return await this.client.post('/command/execute', {
        command_type: commandType,
        params
      });
    } catch (error) {
      console.error(`执行指令 ${commandType} 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取移动路径
   * @param {number} forceId - 部队ID
   * @param {string} targetHexId - 目标六角格ID
   * @returns {Promise} 移动路径
   */
  async getMovementPath(forceId, targetHexId) {
    try {
      return await this.client.get('/movement/path', {
        params: {
          force_id: forceId,
          target_hex_id: targetHexId
        }
      });
    } catch (error) {
      console.error(`获取移动路径失败:`, error);
      throw error;
    }
  }

  /**
   * 获取战斗预测
   * @param {number} attackerForceId - 攻击方部队ID
   * @param {string} targetHexId - 目标六角格ID
   * @returns {Promise} 战斗预测
   */
  async getBattlePrediction(attackerForceId, targetHexId) {
    try {
      return await this.client.get('/battle/prediction', {
        params: {
          attacker_force_id: attackerForceId,
          target_hex_id: targetHexId
        }
      });
    } catch (error) {
      console.error(`获取战斗预测失败:`, error);
      throw error;
    }
  }

  /**
   * 获取战斗记录
   * @param {number} page - 页码
   * @param {number} size - 每页大小
   * @returns {Promise} 战斗记录
   */
  async getBattleLogs(page = 1, size = 10) {
    try {
      return await this.client.get('/battle/logs', {
        params: {
          page,
          size
        }
      });
    } catch (error) {
      console.error(`获取战斗记录失败:`, error);
      throw error;
    }
  }

  /**
   * 获取移动记录
   * @param {number} page - 页码
   * @param {number} size - 每页大小
   * @returns {Promise} 移动记录
   */
  async getMovementLogs(page = 1, size = 10) {
    try {
      return await this.client.get('/movement/logs', {
        params: {
          page,
          size
        }
      });
    } catch (error) {
      console.error(`获取移动记录失败:`, error);
      throw error;
    }
  }

  /**
   * 获取系统配置
   * @returns {Promise} 系统配置
   */
  async getSystemConfig() {
    try {
      return await this.client.get('/system/config');
    } catch (error) {
      console.error('获取系统配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取游戏状态
   * @returns {Promise} 游戏状态
   */
  async getGameStatus() {
    try {
      return await this.client.get('/system/status');
    } catch (error) {
      console.error('获取游戏状态失败:', error);
      throw error;
    }
  }

  /**
   * 初始化游戏
   * @param {Object} config - 游戏配置
   * @returns {Promise} 初始化结果
   */
  async initializeGame(config) {
    try {
      return await this.client.post('/system/initialize', config);
    } catch (error) {
      console.error('初始化游戏失败:', error);
      throw error;
    }
  }

  /**
   * 重置游戏
   * @returns {Promise} 重置结果
   */
  async resetGame() {
    try {
      return await this.client.post('/system/reset');
    } catch (error) {
      console.error('重置游戏失败:', error);
      throw error;
    }
  }
}
