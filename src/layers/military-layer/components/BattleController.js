// src\layers\military-layer\components\BattleController.js
// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { Battlegroup } from '@/models/MilitaryUnit';

/**
 * 军事战斗控制器
 * 
 * 主要职责：
 * 1. 管理战斗的全流程
 * 2. 处理战斗结果的视觉反馈、战斗裁决与结算
 * 3. 协调战斗过程中的模型行为和动画
 * 4. 在总览界面格式化显示战斗结果
 */
export class BattleController {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {BattleController} 单例实例
   */
  static getInstance(viewer) {
    if (!BattleController.#instance) {
      BattleController.#instance = new BattleController(viewer);
    }
    return BattleController.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
  }

  /**
   * 获取指挥范围内的所有部队
   * @param {Object} commandForce 指挥部队对象
   * @param {string} [factionFilter] 可选的阵营过滤器，仅返回指定阵营的部队
   * @returns {Array} 部队对象数组
   */
  getForcesInCommandRange(commandForce, factionFilter = null) {
    const store = this.store;
    
    // 部队列表
    const forces = [];
    
    if (!commandForce) return forces;
    
    // 获取指挥部队所在六角格
    const hexId = commandForce.hexId;
    const hexCell = store.getHexCellById(hexId);
    
    if (!hexCell) return forces;
    
    // 首先处理指挥部队所在六角格中的其他部队
    const forcesInCommandHex = hexCell.forcesIds || [];
    forcesInCommandHex.forEach(forceId => {
      const force = store.getForceById(forceId);
      if (force && force.forceId !== commandForce.forceId) {
        // 如果指定了阵营过滤，则只添加该阵营的部队
        if (factionFilter === null || force.faction === factionFilter) {
          forces.push(force);
        }
      }
    });
    
    // 获取指挥范围内的六角格
    const commandRange = commandForce.commandRange;
    const hexesInRange = hexCell.getHexCellInRange(commandRange);
    
    // 处理指挥范围内的其他六角格中的部队
    hexesInRange.forEach(rangeHex => {
      if (!rangeHex) return;
      
      const forcesInHex = rangeHex.forcesIds || [];
      forcesInHex.forEach(forceId => {
        const force = store.getForceById(forceId);
        if (force) {
          // 如果指定了阵营过滤，则只添加该阵营的部队
          if (factionFilter === null || force.faction === factionFilter) {
            forces.push(force);
          }
        }
      });
    });
    
    return forces;
  }

  /** 
   * 验证支援部队是否都在指挥部队的指挥范围内
   * @param {string} commandForceId 指挥部队ID
   * @param {Array<string>} supportForceIds 支援部队ID数组
   * @returns {boolean} 是否所有支援部队都在指挥范围内
   */
  validateSupportForcesInRange(commandForceId, supportForceIds) {
    const store = this.store;
    const commandForce = store.getForceById(commandForceId);
    
    if (!commandForce) return false;
    
    // 获取指挥范围内的所有部队
    const forcesInRange = this.getForcesInCommandRange(commandForce, commandForce.faction);
    
    // 验证每个支援部队是否在指挥范围内
    const forcesInRangeIds = new Set(forcesInRange.map(force => force.forceId));
    
    // 检查是否每个支援部队ID都在范围内
    return supportForceIds.every(forceId => 
      // 注意：以下条件检查避免将指挥部队本身也算作支援部队
      forceId === commandForceId || forcesInRangeIds.has(forceId));
  }

  /**
   * 从六角格中找出最佳指挥部队
   * @param {string} hexId 六角格ID
   * @param {string} strategy 选择策略：'commandCapability'(指挥能力优先), 'commandRange'(指挥范围优先), 'bestAttack'(进攻最优), 'bestDefense'(防御最优)
   * @param {string} [faction] 可选的阵营过滤器，仅考虑指定阵营的部队
   * @returns {Object|null} 最佳指挥部队对象，如果没有找到则返回null
   */
  findBestCommandForce(hexId, strategy = 'bestDefense', faction = null) {
    const store = this.store;
    const hexCell = store.getHexCellById(hexId);
    
    if (!hexCell || !hexCell.forcesIds || hexCell.forcesIds.length === 0) {
      return null;
    }
    
    // 获取六角格内的部队，如果指定了阵营则过滤
    let forces = hexCell.forcesIds
      .map(id => store.getForceById(id))
      .filter(force => force && (faction === null || force.faction === faction));
    
    if (forces.length === 0) {
      return null;
    }
    
    // 如果策略是指挥能力优先或指挥范围优先，直接比较相应属性
    if (strategy === 'commandCapability' || strategy === 'commandRange') {
      const attr = strategy === 'commandCapability' ? 'commandCapability' : 'commandRange';
      
      // 按指定属性排序，找出最高的
      forces.sort((a, b) => b[attr] - a[attr]);
      return forces[0];
    }
    
    // 如果策略是进攻最优或防御最优，则需要构建战斗群并比较
    if (strategy === 'bestAttack' || strategy === 'bestDefense') {
      // 首先按指挥能力和范围找出可能的最佳指挥部队候选
      const candidates = forces.length > 1 ? 
        forces.sort((a, b) => 
          (b.commandCapability + b.commandRange) - (a.commandCapability + a.commandRange)
        ).slice(0, Math.min(2, forces.length)) : forces;
      
      if (candidates.length === 1) {
        return candidates[0]; // 如果只有一个候选，直接返回
      }
      
      // 为每个候选部队创建战斗群并评估战斗力
      let bestForce = null;
      let bestPower = -1;
      
      for (const force of candidates) {
        // 获取该部队作为指挥部队时的所有支援部队
        const supportForces = this.getForcesInCommandRange(force, force.faction);
        
        // 创建战斗群
        const battlegroup = new Battlegroup({
          faction: force.faction,
          commandForceId: force.forceId,
          forceIdList: [force.forceId, ...supportForces.map(f => f.forceId)]
        });
        
        // 根据策略评估战斗力
        const powerType = strategy === 'bestAttack' ? 'jointAttackFirepower' : 'jointDefenseFirepower';
        const power = battlegroup[powerType];
        
        // 计算总战斗力 (简单相加land/sea/air)
        const totalPower = power.land + power.sea + power.air;
        
        // 更新最佳部队
        if (totalPower > bestPower) {
          bestPower = totalPower;
          bestForce = force;
        }
      }
      
      return bestForce;
    }
    
    // 默认情况下，返回第一个部队
    return forces[0];
  }
  
  /**
   * 创建战斗效果的均匀分布
   * @param {Array<string>} attackerHexIds 攻击方六角格ID列表
   * @param {Array<string>} defenderHexIds 防守方六角格ID列表
   * @param {number} effectCount 要生成的效果数量
   * @returns {Array} 战斗效果数组，每个元素包含起点和终点六角格ID
   */
  createDistributedBattleEffects(attackerHexIds, defenderHexIds, effectCount = 20) {
    // 这里仅提供一个框架方法，具体实现可以根据需求调整
    const battleEffects = [];
    
    // 简单实现：均匀分配攻击效果
    const totalAttackers = attackerHexIds.length;
    const totalDefenders = defenderHexIds.length;
    
    if (totalAttackers === 0 || totalDefenders === 0) return battleEffects;
    
    // 计算每个攻击方六角格应该发起的攻击数量
    const effectsPerAttacker = Math.max(1, Math.floor(effectCount / totalAttackers));
    
    // 为每个攻击方六角格分配目标
    for (let i = 0; i < totalAttackers; i++) {
      const attackerHexId = attackerHexIds[i];
      
      for (let j = 0; j < effectsPerAttacker; j++) {
        // 目标六角格循环选择，确保每个防守方六角格都有机会被攻击
        const defenderHexId = defenderHexIds[j % totalDefenders];
        
        battleEffects.push({
          from: attackerHexId,
          to: defenderHexId,
          delay: Math.random() * 1000, // 随机延迟，使效果看起来更自然
          type: Math.random() > 0.3 ? 'bullet' : 'missile' // 随机效果类型
        });
      }
    }
    
    // 如果还有剩余的效果数量，随机分配
    const remainingEffects = effectCount - (totalAttackers * effectsPerAttacker);
    for (let i = 0; i < remainingEffects; i++) {
      const attackerIndex = Math.floor(Math.random() * totalAttackers);
      const defenderIndex = Math.floor(Math.random() * totalDefenders);
      
      battleEffects.push({
        from: attackerHexIds[attackerIndex],
        to: defenderHexIds[defenderIndex],
        delay: Math.random() * 1000,
        type: Math.random() > 0.5 ? 'bullet' : 'missile'
      });
    }
    
    return battleEffects;
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    BattleController.#instance = null;
  }
}
