import { Color, Math as CesiumMath } from 'cesium';

/**
 * 战争迷雾管理器类
 * 负责计算和渲染战争迷雾效果
 */
export class FogOfWarManager {
  /**
   * 构造函数
   * @param {Object} viewer - Cesium Viewer实例
   * @param {Object} hexGridGenerator - 六角网格生成器实例
   */
  constructor(viewer, hexGridGenerator) {
    this.viewer = viewer;
    this.hexGridGenerator = hexGridGenerator;
    this.fogEntities = [];
    this.visibleHexes = {
      blue: new Set(),
      red: new Set()
    };
  }

  /**
   * 初始化战争迷雾
   * 默认所有六角格对双方都不可见
   */
  initializeFog() {
    const hexData = this.hexGridGenerator.getAllHexData();
    
    // 设置所有六角格初始可见性
    Object.keys(hexData).forEach(hexId => {
      this.updateHexVisibility(hexId, { blue: false, red: false });
    });
  }

  /**
   * 更新六角格可见性
   * @param {string} hexId - 六角格ID
   * @param {Object} visibleTo - 可见性状态
   */
  updateHexVisibility(hexId, visibleTo) {
    // 更新六角格数据中的可见性
    this.hexGridGenerator.updateHexVisibility(hexId, visibleTo);
    
    // 更新可见六角格集合
    if (visibleTo.blue) {
      this.visibleHexes.blue.add(hexId);
    } else {
      this.visibleHexes.blue.delete(hexId);
    }
    
    if (visibleTo.red) {
      this.visibleHexes.red.add(hexId);
    } else {
      this.visibleHexes.red.delete(hexId);
    }
  }

  /**
   * 计算部队可见范围
   * @param {Object} force - 部队数据
   * @param {string} faction - 阵营
   * @returns {Array} 可见的六角格ID列表
   */
  calculateVisibleHexes(force, faction) {
    const visibleHexes = [];
    const hexData = this.hexGridGenerator.getAllHexData();
    const forceHexId = force.hex_id;
    const forceHex = hexData[forceHexId];
    
    if (!forceHex) return visibleHexes;
    
    const visibilityRadius = force.survival_attributes.visibility_radius;
    const { row, col } = forceHex.position;
    
    // 遍历所有六角格，检查是否在可见范围内
    Object.keys(hexData).forEach(hexId => {
      const hex = hexData[hexId];
      const hexRow = hex.position.row;
      const hexCol = hex.position.col;
      
      // 计算六角格距离
      // 注意：这是一个简化的距离计算，实际项目中应考虑六角格的偏移
      const distance = this.calculateHexDistance(row, col, hexRow, hexCol);
      
      // 如果在可见范围内，添加到可见列表
      if (distance <= visibilityRadius) {
        // 检查视线是否被阻挡（简化版，实际项目中应考虑地形高度）
        if (this.hasLineOfSight(forceHex, hex)) {
          visibleHexes.push(hexId);
        }
      }
    });
    
    return visibleHexes;
  }

  /**
   * 计算两个六角格之间的距离
   * @param {number} row1 - 第一个六角格的行号
   * @param {number} col1 - 第一个六角格的列号
   * @param {number} row2 - 第二个六角格的行号
   * @param {number} col2 - 第二个六角格的列号
   * @returns {number} 距离
   */
  calculateHexDistance(row1, col1, row2, col2) {
    // 考虑六角格的偏移
    const x1 = col1 + (row1 % 2) * 0.5;
    const x2 = col2 + (row2 % 2) * 0.5;
    const dx = x2 - x1;
    const dy = row2 - row1;
    
    // 六角格距离计算
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
  }

  /**
   * 检查两个六角格之间是否有视线
   * @param {Object} fromHex - 起始六角格
   * @param {Object} toHex - 目标六角格
   * @returns {boolean} 是否有视线
   */
  hasLineOfSight(fromHex, toHex) {
    // 简化版的视线检查，实际项目中应考虑地形高度和障碍物
    // 这里假设山地和城市会阻挡视线
    const blockingTerrains = ['mountain'];
    
    // 如果目标六角格是阻挡地形，有50%的概率阻挡视线
    if (blockingTerrains.includes(toHex.terrain_attributes.terrain_type)) {
      return Math.random() > 0.5;
    }
    
    // 默认有视线
    return true;
  }

  /**
   * 更新部队视野
   * @param {Array} forces - 部队列表
   */
  updateForcesVision(forces) {
    // 重置可见六角格
    this.visibleHexes = {
      blue: new Set(),
      red: new Set()
    };
    
    // 计算每个部队的可见范围
    forces.forEach(force => {
      const faction = force.faction;
      const visibleHexes = this.calculateVisibleHexes(force, faction);
      
      // 更新可见六角格
      visibleHexes.forEach(hexId => {
        const currentVisibility = this.hexGridGenerator.getHexData(hexId)?.visibility.visible_to || {};
        this.updateHexVisibility(hexId, {
          ...currentVisibility,
          [faction]: true
        });
      });
    });
    
    // 更新所有六角格的视觉样式
    this.updateAllHexesVisualStyle();
  }

  /**
   * 更新所有六角格的视觉样式
   */
  updateAllHexesVisualStyle() {
    const hexData = this.hexGridGenerator.getAllHexData();
    
    Object.keys(hexData).forEach(hexId => {
      this.hexGridGenerator.updateHexVisualStyle(hexId);
    });
  }

  /**
   * 渲染战争迷雾
   * @param {string} faction - 当前视角阵营
   */
  renderFogOfWar(faction) {
    // 清除现有的迷雾实体
    this.clearFogEntities();
    
    const hexData = this.hexGridGenerator.getAllHexData();
    const visibleHexes = this.visibleHexes[faction];
    
    // 为不可见的六角格添加迷雾效果
    Object.keys(hexData).forEach(hexId => {
      if (!visibleHexes.has(hexId)) {
        this.addFogEntity(hexId);
      }
    });
  }

  /**
   * 为六角格添加迷雾实体
   * @param {string} hexId - 六角格ID
   */
  addFogEntity(hexId) {
    const hexData = this.hexGridGenerator.getHexData(hexId);
    
    if (hexData) {
      const hexEntity = this.hexGridGenerator.hexEntities.find(entity => entity.name === hexId);
      
      if (hexEntity && hexEntity.polygon) {
        // 修改六角格样式为迷雾效果
        hexEntity.polygon.material = Color.DARKGRAY.withAlpha(0.7);
        hexEntity.polygon.outlineColor = Color.GRAY;
        
        // 添加到迷雾实体列表
        this.fogEntities.push(hexEntity);
      }
    }
  }

  /**
   * 清除迷雾实体
   */
  clearFogEntities() {
    // 恢复所有六角格的原始样式
    this.fogEntities.forEach(entity => {
      const hexId = entity.name;
      this.hexGridGenerator.updateHexVisualStyle(hexId);
    });
    
    // 清空迷雾实体列表
    this.fogEntities = [];
  }

  /**
   * 切换阵营视角
   * @param {string} faction - 阵营
   */
  switchFaction(faction) {
    this.renderFogOfWar(faction);
  }
}
