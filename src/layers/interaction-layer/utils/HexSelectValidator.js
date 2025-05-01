// src\layers\interaction-layer\utils\HexSelectValidator.js
import { openGameStore } from "@/store";
import { ModesConfig } from "@/config/GameModeConfig";

/**
 * 六角格选择验证器
 * 负责验证不同游戏模式下六角格选择是否合法
 */
export class HexSelectValidator {
  static #instance = null;

  /**
   * 获取单例实例
   * @returns {HexSelectValidator} 单例实例
   */
  static getInstance() {
    if (!HexSelectValidator.#instance) {
      HexSelectValidator.#instance = new HexSelectValidator();
    }
    return HexSelectValidator.#instance;
  }

  /**
   * 构造函数
   * @private
   */
  constructor() {
    this.store = openGameStore();
  }

  /**
   * 验证六角格选择
   * 根据当前游戏模式和选择规则验证六角格选择的有效性
   * @param {string} hexId 要选择的六角格ID
   * @returns {boolean} 是否允许选择
   */
  validate(hexId) {
    const mode = this.store.gameMode;
    const validator = ModesConfig[mode].interaction.validator;

    // 如果没有验证器，直接允许选择
    if (!validator) return true;

    // 根据验证器类型验证选择
    switch (validator) {
      case 'validateMovePath':
        return this._validateMovePath(hexId);
      case 'validateAttackTarget':
        return this._validateAttackTarget(hexId);
      default:
        console.warn(`未知的验证器: ${validator}`);
        return true;
    }
  }

  /**
   * 验证移动路径
   * 检查是否是有效的移动路径（必须连续相邻）
   * @param {string} hexId 要添加到路径的六角格ID
   * @returns {boolean} 是否允许添加到路径
   * @private
   */
  _validateMovePath(hexId) {
    const selectedHexIds = Array.from(this.store.selectedHexIds);
    
    // 如果路径为空，允许选择任何格子作为起点
    if (selectedHexIds.length === 0) {
      return true;
    }

    // 如果路径只有一个格子（起点），检查新格子是否与起点相邻
    if (selectedHexIds.length === 1) {
      return this._isAdjacent(selectedHexIds[0], hexId);
    }
    
    // 对于已有的路径，检查新格子是否与路径末端相邻
    const lastHexId = selectedHexIds[selectedHexIds.length - 1];
    return this._isAdjacent(lastHexId, hexId);
  }

  /**
   * 验证攻击目标
   * 检查是否是有效的攻击目标（距离检查、敌友检查等）
   * @param {string} hexId 目标六角格ID
   * @returns {boolean} 是否是有效的攻击目标
   * @private
   */
  _validateAttackTarget(hexId) {
    const selectedHexIds = Array.from(this.store.selectedHexIds);
    
    // 如果没有选中任何格子，允许选择任何格子作为攻击者位置
    if (selectedHexIds.length === 0) {
      return true;
    }
    
    // 检查是否在攻击范围内
    const attackerHexId = selectedHexIds[0];
    const distance = this._getHexDistance(attackerHexId, hexId);
    
    // 假设攻击范围为1-2格
    return distance >= 1 && distance <= 2;
  }

  /**
   * 检查两个六角格是否相邻
   * @param {string} hexId1 第一个六角格ID
   * @param {string} hexId2 第二个六角格ID
   * @returns {boolean} 是否相邻
   * @private
   */
  _isAdjacent(hexId1, hexId2) {
    // 从Store获取两个六角格的位置信息
    const hex1 = this.store.getHexCellById(hexId1);
    const hex2 = this.store.getHexCellById(hexId2);
    
    if (!hex1 || !hex2) return false;
    
    // 计算两个六角格的坐标距离
    // 这里假设hexId格式为"q_r"，如 "0_0", "1_-1" 等
    const [q1, r1] = hexId1.split('_').map(Number);
    const [q2, r2] = hexId2.split('_').map(Number);
    
    // 计算六角格坐标系下的距离
    const s1 = -q1 - r1;
    const s2 = -q2 - r2;
    
    // 六角格距离计算公式
    const distance = Math.max(
      Math.abs(q1 - q2),
      Math.abs(r1 - r2),
      Math.abs(s1 - s2)
    );
    
    return distance === 1;
  }
  
  /**
   * 获取两个六角格之间的距离
   * @param {string} hexId1 第一个六角格ID
   * @param {string} hexId2 第二个六角格ID
   * @returns {number} 距离值
   * @private
   */
  _getHexDistance(hexId1, hexId2) {
    const [q1, r1] = hexId1.split('_').map(Number);
    const [q2, r2] = hexId2.split('_').map(Number);
    
    const s1 = -q1 - r1;
    const s2 = -q2 - r2;
    
    return Math.max(
      Math.abs(q1 - q2),
      Math.abs(r1 - r2),
      Math.abs(s1 - s2)
    );
  }
}

// 导出单例服务
export const SelectValidator = {
  validate(hexId) {
    return HexSelectValidator.getInstance().validate(hexId);
  }
}; 