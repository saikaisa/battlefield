// src/utils/HexForceMapper.js
import { reactive } from 'vue';

/**
 * 管理六角格与部队之间的双向映射关系
 * 
 * 主要职责：
 * 1. 维护六角格-部队的双向映射
 * 2. 提供高效的查询接口
 * 3. 确保数据一致性
 */
export const HexForceMapper = reactive({
  // 六角格ID -> 部队ID集合: Map<string, Set<string>>
  hexToForceMap: new Map(),

  // 部队ID -> 六角格ID: Map<string, string>
  forceToHexMap: new Map(),

  /** 
   * 初始化映射关系
   * @param {Array} hexCells 六角格数组
   * @param {Array} forces 部队数组
   */
  initMapping(hexCells = [], forces = []) {
    // 清理现有映射
    this.hexToForceMap.clear();
    this.forceToHexMap.clear();

    // 初始化六角格映射
    hexCells.forEach(hex => {
      if (hex?.hexId) {
        this.hexToForceMap.set(hex.hexId, new Set());
      }
    });

    // 初始化部队映射
    forces.forEach(force => {
      if (force?.forceId && force?.hexId) {
        this._addForceMapping(force.forceId, force.hexId);
      }
    });
  },

  /** 
   * 部队移动到新位置
   * @param {string} forceId 部队ID
   * @param {string} newHexId 新的六角格ID
   * @returns {boolean} 是否移动成功
   */
  moveForceToHex(forceId, newHexId) {
    if (!forceId || !newHexId) {
      console.warn('HexForceMapper: Invalid forceId or newHexId');
      return false;
    }

    // 移除旧映射
    const oldHexId = this.forceToHexMap.get(forceId);
    if (oldHexId) {
      const oldHexForces = this.hexToForceMap.get(oldHexId);
      if (oldHexForces) {
        oldHexForces.delete(forceId);
      }
    }

    // 添加新映射
    return this._addForceMapping(forceId, newHexId);
  },

  /** 
   * 查询某六角格内所有部队ID
   * @param {string} hexId 六角格ID
   * @returns {Array<string>} 部队ID数组
   */
  getForcesByHexId(hexId) {
    if (!hexId) return [];
    const forces = this.hexToForceMap.get(hexId);
    return forces ? Array.from(forces) : [];
  },

  /** 
   * 查询某部队所在六角格ID
   * @param {string} forceId 部队ID
   * @returns {string|null} 六角格ID
   */
  getHexByForceId(forceId) {
    return forceId ? this.forceToHexMap.get(forceId) || null : null;
  },

  /** 
   * 往地图上添加部队
   * @param {string} forceId 部队ID
   * @param {string} hexId 六角格ID
   * @returns {boolean} 是否添加成功
   */
  addForceById(forceId, hexId) {
    if (!forceId || !hexId) {
      console.warn('HexForceMapper: Invalid forceId or hexId');
      return false;
    }
    return this._addForceMapping(forceId, hexId);
  },

  /** 
   * 删除地图上的部队
   * @param {string} forceId 部队ID
   * @returns {boolean} 是否删除成功
   */
  removeForceById(forceId) {
    if (!forceId) {
      console.warn('HexForceMapper: Invalid forceId');
      return false;
    }

    const hexId = this.forceToHexMap.get(forceId);
    if (hexId) {
      const hexForces = this.hexToForceMap.get(hexId);
      if (hexForces) {
        hexForces.delete(forceId);
      }
      this.forceToHexMap.delete(forceId);
      return true;
    }
    return false;
  },

  /**
   * 检查某个六角格是否存在
   * @param {string} hexId 六角格ID
   * @returns {boolean}
   */
  hasHex(hexId) {
    return hexId ? this.hexToForceMap.has(hexId) : false;
  },

  /**
   * 检查某个部队是否存在
   * @param {string} forceId 部队ID
   * @returns {boolean}
   */
  hasForce(forceId) {
    return forceId ? this.forceToHexMap.has(forceId) : false;
  },

  /**
   * 获取某个六角格内的部队数量
   * @param {string} hexId 六角格ID
   * @returns {number}
   */
  getForceCountInHex(hexId) {
    const forces = this.hexToForceMap.get(hexId);
    return forces ? forces.size : 0;
  },

  /**
   * 内部方法：添加部队映射
   * @private
   */
  _addForceMapping(forceId, hexId) {
    // 确保六角格映射存在
    if (!this.hexToForceMap.has(hexId)) {
      this.hexToForceMap.set(hexId, new Set());
    }

    // 添加双向映射
    this.hexToForceMap.get(hexId).add(forceId);
    this.forceToHexMap.set(forceId, hexId);
    return true;
  }
});
