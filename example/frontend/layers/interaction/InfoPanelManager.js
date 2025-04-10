import { ref, reactive, computed } from 'vue';

/**
 * 信息面板管理器类
 * 负责管理和显示各类信息面板
 */
export class InfoPanelManager {
  /**
   * 构造函数
   * @param {Object} hexGridGenerator - 六角网格生成器实例
   * @param {Object} unitPlacer - 单位放置器实例
   */
  constructor(hexGridGenerator, unitPlacer) {
    this.hexGridGenerator = hexGridGenerator;
    this.unitPlacer = unitPlacer;
    
    // 面板状态
    this.state = reactive({
      activePanels: [], // 当前激活的面板列表
      hexInfoVisible: false, // 六角格信息面板可见性
      forceInfoVisible: false, // 部队信息面板可见性
      battleInfoVisible: false, // 战斗信息面板可见性
      systemInfoVisible: false, // 系统信息面板可见性
      
      selectedHexId: null, // 当前选中的六角格ID
      selectedForceId: null, // 当前选中的部队ID
      
      hexInfo: null, // 六角格信息
      forceInfo: null, // 部队信息
      battleInfo: null, // 战斗信息
      systemInfo: { // 系统信息
        currentFaction: 'blue',
        currentTurn: 1,
        gameStatus: 'running',
        objectives: []
      }
    });
    
    // 计算属性
    this.computedProperties = {
      // 六角格地形描述
      terrainDescription: computed(() => {
        if (!this.state.hexInfo) return '';
        
        const terrainType = this.state.hexInfo.terrain_attributes.terrain_type;
        const terrainMap = {
          plain: '平原',
          mountain: '山地',
          urban: '城市',
          water: '水域',
          forest: '森林',
          desert: '沙漠'
        };
        
        return terrainMap[terrainType] || terrainType;
      }),
      
      // 六角格可通行性描述
      passabilityDescription: computed(() => {
        if (!this.state.hexInfo) return '';
        
        const passability = this.state.hexInfo.terrain_attributes.passability;
        const descriptions = [];
        
        if (passability.land) descriptions.push('陆军可通行');
        if (passability.naval) descriptions.push('海军可通行');
        if (passability.air) descriptions.push('空军可通行');
        
        return descriptions.join('，');
      }),
      
      // 部队战斗力描述
      combatPowerDescription: computed(() => {
        if (!this.state.forceInfo) return '';
        
        const attackPower = this.state.forceInfo.attack_firepower;
        const defensePower = this.state.forceInfo.defense_firepower;
        
        return `攻击: ${this.formatFirepower(attackPower)}，防御: ${this.formatFirepower(defensePower)}`;
      })
    };
    
    // 初始化事件监听
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 监听六角格选中事件
    window.addEventListener('hex-selected', (event) => {
      const hexId = event.detail.hexId;
      this.showHexInfo(hexId);
    });
    
    // 监听部队选中事件
    window.addEventListener('force-selected', (event) => {
      const forceId = event.detail.forceId;
      this.showForceInfo(forceId);
    });
    
    // 监听战斗事件
    window.addEventListener('battle-occurred', (event) => {
      const battleInfo = event.detail;
      this.showBattleInfo(battleInfo);
    });
    
    // 监听系统事件
    window.addEventListener('system-updated', (event) => {
      const systemInfo = event.detail;
      this.updateSystemInfo(systemInfo);
    });
  }

  /**
   * 显示六角格信息
   * @param {string} hexId - 六角格ID
   */
  showHexInfo(hexId) {
    const hexData = this.hexGridGenerator.getHexData(hexId);
    
    if (!hexData) {
      console.error(`找不到六角格数据: ${hexId}`);
      return;
    }
    
    // 更新状态
    this.state.selectedHexId = hexId;
    this.state.hexInfo = hexData;
    this.state.hexInfoVisible = true;
    
    // 添加到激活面板列表
    if (!this.state.activePanels.includes('hex')) {
      this.state.activePanels.push('hex');
    }
  }

  /**
   * 显示部队信息
   * @param {number} forceId - 部队ID
   */
  showForceInfo(forceId) {
    const entity = this.unitPlacer.unitEntities.get(forceId);
    
    if (!entity) {
      console.error(`找不到部队实体: ${forceId}`);
      return;
    }
    
    const forceData = entity.properties.forceData;
    
    // 更新状态
    this.state.selectedForceId = forceId;
    this.state.forceInfo = forceData;
    this.state.forceInfoVisible = true;
    
    // 添加到激活面板列表
    if (!this.state.activePanels.includes('force')) {
      this.state.activePanels.push('force');
    }
  }

  /**
   * 显示战斗信息
   * @param {Object} battleInfo - 战斗信息
   */
  showBattleInfo(battleInfo) {
    // 更新状态
    this.state.battleInfo = battleInfo;
    this.state.battleInfoVisible = true;
    
    // 添加到激活面板列表
    if (!this.state.activePanels.includes('battle')) {
      this.state.activePanels.push('battle');
    }
  }

  /**
   * 更新系统信息
   * @param {Object} systemInfo - 系统信息
   */
  updateSystemInfo(systemInfo) {
    // 更新状态
    this.state.systemInfo = { ...this.state.systemInfo, ...systemInfo };
    this.state.systemInfoVisible = true;
    
    // 添加到激活面板列表
    if (!this.state.activePanels.includes('system')) {
      this.state.activePanels.push('system');
    }
  }

  /**
   * 关闭面板
   * @param {string} panelType - 面板类型
   */
  closePanel(panelType) {
    switch (panelType) {
      case 'hex':
        this.state.hexInfoVisible = false;
        break;
        
      case 'force':
        this.state.forceInfoVisible = false;
        break;
        
      case 'battle':
        this.state.battleInfoVisible = false;
        break;
        
      case 'system':
        this.state.systemInfoVisible = false;
        break;
    }
    
    // 从激活面板列表中移除
    this.state.activePanels = this.state.activePanels.filter(panel => panel !== panelType);
  }

  /**
   * 格式化火力值
   * @param {Object} firepower - 火力值对象
   * @returns {string} 格式化后的火力值
   */
  formatFirepower(firepower) {
    if (!firepower) return '0';
    
    // 如果是简单数值
    if (typeof firepower === 'number') {
      return firepower.toFixed(1);
    }
    
    // 如果是复杂对象
    let result = '';
    
    if (firepower.land) result += `陆:${firepower.land.toFixed(1)} `;
    if (firepower.sea) result += `海:${firepower.sea.toFixed(1)} `;
    if (firepower.air) result += `空:${firepower.air.toFixed(1)}`;
    
    return result.trim();
  }

  /**
   * 获取面板状态
   * @returns {Object} 面板状态
   */
  getState() {
    return this.state;
  }

  /**
   * 获取计算属性
   * @returns {Object} 计算属性
   */
  getComputedProperties() {
    return this.computedProperties;
  }
}
