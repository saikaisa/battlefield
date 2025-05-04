// src/utils/HexForceMapper.js
import { reactive } from 'vue';

/**
 * 管理六角格与部队之间的双向映射
 */
export const HexForceMapper = reactive({
  // 六角格ID -> Set(部队ID)
  hexToForceMap: new Map(),

  // 部队ID -> 六角格ID
  forceToHexMap: new Map(),

  /** 初始化映射关系 */
  initMapping(hexCells = [], forces = []) {
    this.hexToForceMap.clear();
    this.forceToHexMap.clear();

    hexCells.forEach(hex => {
      this.hexToForceMap.set(hex.hexId, new Set());
    });

    forces.forEach(force => {
      this.forceToHexMap.set(force.forceId, force.hexId);
      if (this.hexToForceMap.has(force.hexId)) {
        this.hexToForceMap.get(force.hexId).add(force.forceId);
      } else {
        this.hexToForceMap.set(force.hexId, new Set([force.forceId]));
      }
    });
  },

  /** 部队移动到新位置 */
  moveForceToHex(forceId, newHexId) {
    const oldHexId = this.forceToHexMap.get(forceId);
    if (oldHexId && this.hexToForceMap.has(oldHexId)) {
      this.hexToForceMap.get(oldHexId).delete(forceId);
    }
    this.forceToHexMap.set(forceId, newHexId);
    if (!this.hexToForceMap.has(newHexId)) {
      this.hexToForceMap.set(newHexId, new Set());
    }
    this.hexToForceMap.get(newHexId).add(forceId);
  },

  /** 查询某六角格所有部队ID */
  getForcesByHexId(hexId) {
    return Array.from(this.hexToForceMap.get(hexId) || []);
  },

  /** 查询某部队所在六角格ID */
  getHexByForceId(forceId) {
    return this.forceToHexMap.get(forceId);
  },

  /** 添加部队 */
  addForceById(forceId, hexId) {
    this.forceToHexMap.set(forceId, hexId);
    if (!this.hexToForceMap.has(hexId)) {
      this.hexToForceMap.set(hexId, new Set());
    }
    this.hexToForceMap.get(hexId).add(forceId);
  },

  /** 删除部队 */
  removeForceById(forceId) {
    const hexId = this.forceToHexMap.get(forceId);
    if (hexId && this.hexToForceMap.has(hexId)) {
      this.hexToForceMap.get(hexId).delete(forceId);
    }
    this.forceToHexMap.delete(forceId);
  }
});
