// src\layers\military-layer\components\BattleController.js
// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { Battlegroup } from '@/models/MilitaryUnit';
import { BattleConfig, MilitaryConfig } from '@/config/GameConfig';
import { BattleEffectsRenderer } from './BattleEffectsRenderer';
import { OverviewConsole } from '@/layers/interaction-layer/utils/OverviewConsole';
import { MilitaryInstanceGenerator } from './MilitaryInstanceGenerator';

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
    
    // 初始化战斗特效渲染器
    this.effectsRenderer = BattleEffectsRenderer.getInstance(viewer);
    // 当前战斗ID计数器
    this.battleCounter = 0;
    // 战斗回调缓存，用于异步等待战斗处理完成
    this.battleCallbacks = new Map();
  }

  /**
   * 获取指挥范围内的所有部队(不包括指挥部队本身)
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
   * 执行战斗流程
   * @param {string} attackerCommandForceId 攻击方指挥部队ID
   * @param {Array<string>} attackerSupportForceIds 攻击方支援部队ID数组
   * @param {string} defenderCommandForceId 防守方指挥部队ID
   * @param {Array<string>} defenderSupportForceIds 防守方支援部队ID数组 
   * @returns {Promise<Object>} 战斗结果
   */
  async executeBattle(attackerCommandForceId, attackerSupportForceIds, defenderCommandForceId, defenderSupportForceIds) {
    try {
      // 创建战斗ID
      const battleId = `battle_${++this.battleCounter}`;
      
      // 获取攻击方和防守方部队对象
      const attackerCommand = this.store.getForceById(attackerCommandForceId);
      const defenderCommand = this.store.getForceById(defenderCommandForceId);
      
      if (!attackerCommand || !defenderCommand) {
        throw new Error('找不到指挥部队');
      }
      
      // 过滤掉无效的支援部队ID
      const validAttackerSupportIds = Array.isArray(attackerSupportForceIds) ? 
        attackerSupportForceIds.filter(id => id !== attackerCommandForceId && this.store.getForceById(id)) : [];
      const validDefenderSupportIds = Array.isArray(defenderSupportForceIds) ? 
        defenderSupportForceIds.filter(id => id !== defenderCommandForceId && this.store.getForceById(id)) : [];
      
      // 创建攻击方和防守方战斗群
      const attackerBattlegroup = new Battlegroup({
        BattlegroupId: `BG_A_${battleId}`,
        faction: attackerCommand.faction,
        commandForceId: attackerCommandForceId,
        forceIdList: [attackerCommandForceId, ...validAttackerSupportIds]
      });
      const defenderBattlegroup = new Battlegroup({
        BattlegroupId: `BG_D_${battleId}`,
        faction: defenderCommand.faction,
        commandForceId: defenderCommandForceId,
        forceIdList: [defenderCommandForceId, ...validDefenderSupportIds]
      });

      // 输出战斗报告头部
      this._printBattleReportHeader(battleId, attackerBattlegroup, defenderBattlegroup);
      
      // 记录战前联合火力值
      const initialAttackPower = this._getTotalFirepower(attackerBattlegroup.jointAttackFirepower);
      const initialDefensePower = this._getTotalFirepower(defenderBattlegroup.jointDefenseFirepower);
      
      // 进行战斗裁决 - 获取预期结果
      const expectedResults = this._executeBattleAdjudication(battleId, attackerBattlegroup, defenderBattlegroup);
      
      // 生成战斗效果
      // // 设置战斗效果计时器
      // const battleEffectsTimer = setTimeout(() => {
      //   console.log('战斗效果执行中...');
      // }, 10000);
      
      // // 等待战斗效果执行完成
      // await new Promise(resolve => {
      //   setTimeout(() => {
      //     clearTimeout(battleEffectsTimer);
      //     resolve();
      //   }, 20000);
      // });
      await this._executeBattleEffects(battleId, attackerBattlegroup, defenderBattlegroup);
      
      // 应用战斗结果 - 获取实际结果
      const actualResults = this._applyBattleResults(attackerBattlegroup, defenderBattlegroup, expectedResults);
      
      // 计算战后联合火力值
      const finalAttackPower = this._getTotalFirepower(attackerBattlegroup.jointAttackFirepower);
      const finalDefensePower = this._getTotalFirepower(defenderBattlegroup.jointDefenseFirepower);
      
      // 计算火力值下降百分比
      const attackPowerLossPercent = initialAttackPower > 0 ? 
        ((initialAttackPower - finalAttackPower) / initialAttackPower) : 0;
      const defensePowerLossPercent = initialDefensePower > 0 ? 
        ((initialDefensePower - finalDefensePower) / initialDefensePower) : 0;
      
      // 根据火力值下降百分比判断胜负
      const battleOutcome = this._determineBattleOutcome(
        attackPowerLossPercent,
        defensePowerLossPercent
      );

      // 消耗战斗机会
      attackerBattlegroup.consumeCombatChances('attacker');
      defenderBattlegroup.consumeCombatChances('defender');
      
      // 创建战斗报告数据
      return {
        success: true,
        battleId: battleId,
        attackingCommand: {
          forceId: attackerCommandForceId,
          name: attackerCommand.forceName,
          faction: attackerCommand.faction
        },
        defendingCommand: {
          forceId: defenderCommandForceId,
          name: defenderCommand.forceName,
          faction: defenderCommand.faction
        },
        attackerForceIds: [attackerCommandForceId, ...validAttackerSupportIds],
        defenderForceIds: [defenderCommandForceId, ...validDefenderSupportIds],
        // 火力值损失
        powerComparison: {
          initial: {
            attacker: initialAttackPower,
            defender: initialDefensePower
          },
          final: {
            attacker: finalAttackPower,
            defender: finalDefensePower
          },
          lossPercent: {
            attacker: attackPowerLossPercent,
            defender: defensePowerLossPercent
          }
        },
        // 战斗结果
        outcome: battleOutcome,
        // 部队的损失信息
        forceLosses: [...actualResults.attacker.forceLosses, ...actualResults.defender.forceLosses],
        // 添加维度损失统计数据
        dimensionalResults: {
          attacker: {
            dimensionTotalLosses: actualResults.attacker.dimensionTotalLosses, // 各维度的损失兵力值
            totalLoss: actualResults.attacker.totalLoss // 损失的总兵力
          },
          defender: {
            dimensionTotalLosses: actualResults.defender.dimensionTotalLosses,
            totalLoss: actualResults.defender.totalLoss
          }
        }
      };
    } catch (error) {
      console.error('执行战斗失败', error);
      OverviewConsole.error(`战斗执行失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 在总览面板打印战斗报告头部
   * @param {string} battleId 战斗ID
   * @param {Battlegroup} attackerBG 攻击方战斗群
   * @param {Battlegroup} defenderBG 防守方战斗群
   * @private
   */
  _printBattleReportHeader(battleId, attackerBG, defenderBG) {
    OverviewConsole.stat(`========== 战斗开始: ${battleId} ==========`);
    
    // 获取参战单位信息
    const attackerForces = attackerBG.forceIdList.map(id => this.store.getForceById(id)).filter(Boolean);
    const defenderForces = defenderBG.forceIdList.map(id => this.store.getForceById(id)).filter(Boolean);
    
    // 攻击方指挥部队
    const attackerCommand = this.store.getForceById(attackerBG.commandForceId);
    // 防守方指挥部队
    const defenderCommand = this.store.getForceById(defenderBG.commandForceId);
    
    // 输出攻击方信息
    OverviewConsole.stat('------ 进攻方 ------');
    OverviewConsole.log(`一共${attackerForces.length}支部队参与战斗`);
    OverviewConsole.stat(`\n【进攻方指挥部队】`);
    OverviewConsole.log(`${attackerCommand.forceName}，指挥能力：${attackerCommand.combatChance}`);
    
    // 输出攻击方支援部队
    OverviewConsole.stat('【进攻方支援部队】');
    const attackerSupports = attackerForces.filter(f => f.forceId !== attackerBG.commandForceId);
    if (attackerSupports.length > 0) {
      attackerSupports.forEach(force => {
        if (force.combatChance <= 0) {
          OverviewConsole.warning(`${force.forceName}（无法战斗）`);
        } else {
          OverviewConsole.log(`${force.forceName}`);
        }
      });
    } else {
      OverviewConsole.log('无支援部队');
    }
    
    // 输出防守方信息
    OverviewConsole.stat('\n------ 防守方 ------');
    OverviewConsole.error(`一共${defenderForces.length}支部队参与战斗`);
    OverviewConsole.stat(`\n【防守方指挥部队】`);
    if (defenderCommand.combatChance < 0) {
      const fatigueLevel = -defenderCommand.combatChance;
      OverviewConsole.warning(`${defenderCommand.forceName}（疲劳等级${fatigueLevel}）`);
    } else {
      OverviewConsole.error(`${defenderCommand.forceName}`);
    }
    
    // 输出防守方支援部队
    OverviewConsole.stat('【防守方支援部队】');
    const defenderSupports = defenderForces.filter(f => f.forceId !== defenderBG.commandForceId);
    if (defenderSupports.length > 0) {
      defenderSupports.forEach(force => {
        if (force.combatChance < 0) {
          const fatigueLevel = -force.combatChance;
          OverviewConsole.warning(`${force.forceName}（疲劳等级${fatigueLevel}）`);
        } else {
          OverviewConsole.error(`${force.forceName}`);
        }
      });
    } else {
      OverviewConsole.error('无支援部队');
    }
  }

  /**
   * 执行战斗裁决
   * @param {string} battleId 战斗ID
   * @param {Battlegroup} attackerBG 攻击方战斗群
   * @param {Battlegroup} defenderBG 防守方战斗群
   * @returns {Object} 战斗裁决预期结果
   * @private
   */
  _executeBattleAdjudication(battleId, attackerBG, defenderBG) {
    // 获取联合火力值
    const attackerFirepower = attackerBG.jointAttackFirepower;
    const defenderFirepower = defenderBG.jointDefenseFirepower;
    
    // 初始化预期结果
    const expectedResults = {
      attacker: { losses: { land: 0, sea: 0, air: 0 }, totalLoss: 0 },
      defender: { losses: { land: 0, sea: 0, air: 0 }, totalLoss: 0 }
    };
    
    // 在每个维度上进行战斗裁决
    const dimensions = ['land', 'sea', 'air'];
    
    for (const dimension of dimensions) {
      // 获取该维度的火力值
      const atkFirepower = attackerFirepower[dimension] || 0;
      const defFirepower = defenderFirepower[dimension] || 0;
      
      // 计算火力比值
      let ratio = 0;
      if (defFirepower > 0) {
        ratio = atkFirepower / defFirepower;
      } else if (atkFirepower > 0) {
        ratio = 999; // 防御方火力为0，攻击方有火力，设为极大值
      } else {
        // 双方火力都为0，跳过该维度
        continue;
      }
      
      // 确定战斗比率所在的区间
      let ratioIndex = 0;
      for (let i = 0; i < BattleConfig.powerRatioRanges.length; i++) {
        const range = BattleConfig.powerRatioRanges[i];
        if (ratio >= range.min && ratio < range.max) {
          ratioIndex = i;
          break;
        }
      }
      
      // 骰子摇号 (1-6)
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      
      // 从战斗裁决表中获取结果
      const adjudicationResult = BattleConfig.battleTable[diceRoll - 1][ratioIndex];
      
      // 解析结果 (格式为 "A1/D2" 表示攻击方损失1级，防御方损失2级)
      const [attackerLoss, defenderLoss] = adjudicationResult.split('/');
      
      // 获取对应的实际损失值
      const attackerLossValue = BattleConfig.strengthLossMap[attackerLoss] || 0;
      const defenderLossValue = BattleConfig.strengthLossMap[defenderLoss] || 0;
      
      // 记录预期损失
      expectedResults.attacker.losses[dimension] = attackerLossValue;
      expectedResults.defender.losses[dimension] = defenderLossValue;
      expectedResults.attacker.totalLoss += attackerLossValue;
      expectedResults.defender.totalLoss += defenderLossValue;
      
      // 输出该维度战斗结果
      OverviewConsole.log(`\n▶ ${dimension === 'land' ? '陆上' : dimension === 'sea' ? '海上' : '空中'}战斗:`);
      OverviewConsole.log(`  进攻火力: ${this._formatNumber(atkFirepower)} vs 防御火力: ${this._formatNumber(defFirepower)}`);
      OverviewConsole.log(`  火力比: ${ratio.toFixed(2)} (${BattleConfig.powerRatioRanges[ratioIndex].name})`);
      OverviewConsole.log(`  骰子: ${diceRoll}, 战损: ${adjudicationResult}`);
      OverviewConsole.log(`  进攻方在此维度的每支部队预期损失 ${attackerLossValue} 点兵力`);
      OverviewConsole.log(`  防守方在此维度的每支部队预期损失 ${defenderLossValue} 点兵力`);
    }
    
    return expectedResults;
  }
  
  /**
   * 执行战斗视觉效果
   * @param {string} battleId 战斗ID
   * @param {Battlegroup} attackerBG 攻击方战斗群
   * @param {Battlegroup} defenderBG 防守方战斗群
   * @returns {Promise<void>}
   * @private
   */
  async _executeBattleEffects(battleId, attackerBG, defenderBG) {
    // 获取部队实例映射表
    const forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap();
    
    // 获取参与战斗的攻击方部队（只有有战斗机会的部队才参与攻击）
    const attackerForces = attackerBG.forceIdList
      .map(id => this.store.getForceById(id))
      .filter(f => f && f.combatChance > 0);
    
    // 获取参与战斗的防守方部队
    const defenderForces = defenderBG.forceIdList
      .map(id => this.store.getForceById(id))
      .filter(Boolean);
    
    // 收集攻击方部队实例
    const attackerForceInstances = attackerForces
      .map(force => forceInstanceMap.get(force.forceId))
      .filter(Boolean);
    
    // 收集防守方部队实例
    const defenderForceInstances = defenderForces
      .map(force => forceInstanceMap.get(force.forceId))
      .filter(Boolean);
    
    // 如果双方没有有效的部队实例，则无法创建战斗效果
    if (attackerForceInstances.length === 0 || defenderForceInstances.length === 0) {
      OverviewConsole.warning('无法生成战斗效果: 找不到有效的攻击方或防守方部队实例');
      return;
    }
    
    // 获取攻击方和防守方所在的六角格ID，用于备选
    const attackerHexIds = [...new Set(attackerForces.map(force => force.hexId).filter(Boolean))];
    const defenderHexIds = [...new Set(defenderForces.map(force => force.hexId).filter(Boolean))];
    
    // 输出战斗效果开始信息
    OverviewConsole.log('\n开始战斗...');
    
    // 创建战斗效果配置
    const battleEffectsConfig = this._createBattleEffectsConfig(
      battleId,
      attackerForceInstances,
      defenderForceInstances,
      attackerHexIds,
      defenderHexIds
    );
    
    // 渲染战斗效果并等待完成
    try {
      await this.effectsRenderer.createBattleEffects(battleId, battleEffectsConfig);
    } catch (error) {
      console.error('渲染战斗效果失败', error);
      OverviewConsole.error(`渲染战斗效果失败: ${error.message}`);
    }
    
    // 输出战斗效果结束信息
    OverviewConsole.log('战斗结束...');
  }
  
  /**
   * 应用战斗结果到部队
   * @param {Battlegroup} attackerBG 攻击方战斗群
   * @param {Battlegroup} defenderBG 防守方战斗群
   * @param {Object} expectedResults 战斗预期结果
   * @returns {Object} 实际应用的战斗结果
   * @private
   */
  _applyBattleResults(attackerBG, defenderBG, expectedResults) {
    // 实际战斗结果记录
    const actualResults = {
      attacker: { 
        dimensionTotalLosses: { land: 0, sea: 0, air: 0 }, // 各维度的损失兵力值
        totalLoss: 0, // 总损失兵力值
        forceLosses: [], // 每个部队的损失详情 {部队id, 部队名称, 原始兵力, 损失兵力, 损失百分比, 剩余兵力, 维度}
      },
      defender: { 
        dimensionTotalLosses: { land: 0, sea: 0, air: 0 }, 
        totalLoss: 0,
        forceLosses: [],
      }
    };
    
    // 应用攻击方和防守方损失
    this._applyDimensionalLosses(attackerBG, expectedResults.attacker.losses, actualResults.attacker);
    this._applyDimensionalLosses(defenderBG, expectedResults.defender.losses, actualResults.defender);
    
    return actualResults;
  }
  
  /**
   * 按维度应用损失到战斗群
   * @param {Battlegroup} battlegroup 战斗群
   * @param {Object} dimensionalLosses 各维度损失值 {land, sea, air}
   * @param {Object} result 实际结果记录对象，将被修改
   * @private
   */
  _applyDimensionalLosses(battlegroup, dimensionalLosses, result) {
    const store = this.store;
    const dimensions = ['land', 'sea', 'air'];
    
    // 获取战斗群中的所有部队
    const forces = battlegroup.forceIdList
      .map(id => store.getForceById(id))
      .filter(Boolean);
    
    if (forces.length === 0) return;
    
    // 按军种对部队进行分类
    const serviceMap = {
      land: forces.filter(force => force.service === 'land'),
      sea: forces.filter(force => force.service === 'sea'),
      air: forces.filter(force => force.service === 'air')
    };
    
    // 记录每个部队的损失情况
    result.forceLosses = [];
    
    // 处理每个维度的损失
    for (const dimension of dimensions) {
      const lossValue = dimensionalLosses[dimension];
      
      // 如果该维度没有损失或没有对应军种的部队，跳过
      if (lossValue <= 0 || serviceMap[dimension].length === 0) continue;
      
      // 该维度的部队
      const dimensionForces = serviceMap[dimension];
      
      // 实际应用的总损失
      let actualDimensionTotalLoss = 0;
      
      // 应用损失
      dimensionForces.forEach(force => {
        // 记录原始兵力
        const originalStrength = force.troopStrength;
        // 应用损失
        const actualLoss = originalStrength - force.consumeTroopStrength(lossValue);
        
        // 累计该维度的实际损失
        actualDimensionTotalLoss += actualLoss;
        
        // 记录部队的损失情况
        const forceLoss = {
          forceId: force.forceId,
          name: force.forceName,
          originalStrength: originalStrength,
          strengthLoss: actualLoss,
          strengthLossPercent: originalStrength > 0 ? actualLoss / originalStrength : 0,
          remainingStrength: force.troopStrength,
          dimension: dimension
        };
        
        // 添加到损失记录
        result.forceLosses.push(forceLoss);
      });
      
      // 记录该维度的实际损失
      result.dimensionTotalLosses[dimension] = actualDimensionTotalLoss;
      result.totalLoss += actualDimensionTotalLoss;
    }
  }

  /**
   * 根据双方火力值下降百分比确定战斗结果
   * @param {number} attackerLossPercent 攻击方火力值下降百分比
   * @param {number} defenderLossPercent 防守方火力值下降百分比
   * @returns {Object} 战斗结果
   * @private
   */
  _determineBattleOutcome(attackerLossPercent, defenderLossPercent) {
    let result = '';
    let victorSide = '';
    let attackerState = '';
    let defenderState = '';
    
    // 判断各自的状态
    if (attackerLossPercent >= 1.0) {
      attackerState = '全军覆没';
    } else if (attackerLossPercent >= 0.75) {
      attackerState = '溃败';
    } else if (attackerLossPercent >= 0.5) {
      attackerState = '元气大伤';
    } else if (attackerLossPercent >= 0.25) {
      attackerState = '损失严重';
    } else {
      attackerState = '轻微损失';
    }
    
    if (defenderLossPercent >= 1.0) {
      defenderState = '全军覆没';
    } else if (defenderLossPercent >= 0.75) {
      defenderState = '溃败';
    } else if (defenderLossPercent >= 0.5) {
      defenderState = '元气大伤';
    } else if (defenderLossPercent >= 0.25) {
      defenderState = '损失严重';
    } else {
      defenderState = '轻微损失';
    }
    
    // 判断胜负
    // 如果双方损失都很小,判定为试探性接触
    if (attackerLossPercent < 0.1 && defenderLossPercent < 0.1) {
      result = '双方试探性接触。';
      victorSide = 'draw';
    }
    // 如果一方损失很小而另一方损失较大,判定为单方面突袭
    else if (attackerLossPercent < 0.2 && defenderLossPercent > 0.4) {
      result = '进攻方成功突袭！';
      victorSide = 'attacker';
    }
    else if (defenderLossPercent < 0.2 && attackerLossPercent > 0.4) {
      result = '防守方成功反击！';
      victorSide = 'defender';
    }
    // 双方都有较大损失时,根据损失比例判定胜负
    else if (attackerLossPercent > defenderLossPercent * 2) {
      result = '防守方大获全胜！';
      victorSide = 'defender';
    } else if (attackerLossPercent > defenderLossPercent * 1.2) {
      result = '防守方小胜。';
      victorSide = 'defender';
    } else if (defenderLossPercent > attackerLossPercent * 2) {
      result = '进攻方大获全胜！';
      victorSide = 'attacker';
    } else if (defenderLossPercent > attackerLossPercent * 1.2) {
      result = '进攻方小胜。';
      victorSide = 'attacker';
    } else {
      result = '战斗势均力敌。';
      victorSide = 'draw';
    }
    
    return {
      result,
      victorSide,
      attackerState,
      defenderState
    };
  }

  /**
   * 在总览面板打印战斗报告总结
   * @param {Object} battleResult 战斗结果数据
   */
  printBattleReportSummary(battleResult) {
    if (!battleResult) return;
    
    // 获取参战部队
    const attackerForces = battleResult.attackerForceIds
      .map(id => this.store.getForceById(id))
      .filter(Boolean);
    const defenderForces = battleResult.defenderForceIds
      .map(id => this.store.getForceById(id))
      .filter(Boolean);
    
    // 获取指挥部队
    const attackingCommand = this.store.getForceById(battleResult.attackingCommand.forceId);
    const defendingCommand = this.store.getForceById(battleResult.defendingCommand.forceId);
    
    // 创建部队兵力变化的映射表
    const forceLossMap = new Map();
    // 从battleResult.forceLosses中获取每个部队的损失信息
    if (battleResult.forceLosses && Array.isArray(battleResult.forceLosses)) {
      battleResult.forceLosses.forEach(loss => {
        if (loss && loss.forceId) {
          forceLossMap.set(loss.forceId, loss);
        }
      });
    }

    OverviewConsole.stat('========== 战斗结果报告 ==========');
    OverviewConsole.stat(`【战斗编号 ${battleResult.battleId}】`);
    
    // =================== 按阵营显示各部队及其兵力值变化 ===================
    // ------------- 显示进攻方信息 -------------
    OverviewConsole.stat('\n---- 进攻方部队当前状态 ----'); 
    OverviewConsole.log('【指挥部队】');
    // 显示指挥部队状态
    this._displayForceInfo(attackingCommand, forceLossMap);
    
    // 获取攻击方支援部队
    const attackerSupportForces = attackerForces.filter(f => f.forceId !== attackingCommand.forceId);
    OverviewConsole.log('【支援部队】');
    // 输出攻击方支援部队信息
    attackerSupportForces.forEach(force => {
      this._displayForceInfo(force, forceLossMap);
    });
    
    // ------------- 显示防守方信息 -------------
    OverviewConsole.stat('\n---- 防守方部队当前状态 ----');
    OverviewConsole.log('【指挥部队】');
    
    // 显示防守方指挥部队状态
    this._displayForceInfo(defendingCommand, forceLossMap, true);
    
    // 获取防守方支援部队
    const defenderSupportForces = defenderForces.filter(f => f.forceId !== defendingCommand.forceId);
    OverviewConsole.log('【支援部队】');
    // 输出防守方支援部队信息
    defenderSupportForces.forEach(force => {
      this._displayForceInfo(force, forceLossMap, true);
    });

    // =================== 输出各维度兵力损失 ===================
    const dimResAttacker = battleResult.dimensionalResults.attacker;
    const dimResDefender = battleResult.dimensionalResults.defender;
    OverviewConsole.stat(`\n---- 各维度兵力损失 ----`);
    OverviewConsole.log(`陆地：进攻方损失${dimResAttacker.dimensionTotalLosses.land}兵力，防守方损失${dimResDefender.dimensionTotalLosses.land}兵力`);
    OverviewConsole.log(`海上：进攻方损失${dimResAttacker.dimensionTotalLosses.sea}兵力，防守方损失${dimResDefender.dimensionTotalLosses.sea}兵力`);
    OverviewConsole.log(`空中：进攻方损失${dimResAttacker.dimensionTotalLosses.air}兵力，防守方损失${dimResDefender.dimensionTotalLosses.air}兵力`);
    OverviewConsole.log(`合计：进攻方损失${dimResAttacker.totalLoss}兵力，防守方损失${dimResDefender.totalLoss}兵力`);

    // =================== 输出联合火力值损失 ===================
    const powerComparison = battleResult.powerComparison;
    OverviewConsole.stat(`\n---- 火力值损失 ----`);
    
    // 根据损失比例选择不同的输出样式
    const attackerLossPercent = powerComparison.lossPercent.attacker * 100;
    const defenderLossPercent = powerComparison.lossPercent.defender * 100;
    
    // 进攻方损失显示
    if (attackerLossPercent > 50) {
      OverviewConsole.error(`进攻方: ${this._formatNumber(powerComparison.initial.attacker)} ==> ${this._formatNumber(powerComparison.final.attacker)}(-${attackerLossPercent.toFixed(2)}%)`);
    } else if (attackerLossPercent > 20) {
      OverviewConsole.warning(`进攻方: ${this._formatNumber(powerComparison.initial.attacker)} ==> ${this._formatNumber(powerComparison.final.attacker)}(-${attackerLossPercent.toFixed(2)}%)`);
    } else {
      OverviewConsole.log(`进攻方: ${this._formatNumber(powerComparison.initial.attacker)} ==> ${this._formatNumber(powerComparison.final.attacker)}(-${attackerLossPercent.toFixed(2)}%)`);
    }
    
    // 防守方损失显示
    if (defenderLossPercent > 50) {
      OverviewConsole.error(`防守方: ${this._formatNumber(powerComparison.initial.defender)} ==> ${this._formatNumber(powerComparison.final.defender)}(-${defenderLossPercent.toFixed(2)}%)`);
    } else if (defenderLossPercent > 20) {
      OverviewConsole.warning(`防守方: ${this._formatNumber(powerComparison.initial.defender)} ==> ${this._formatNumber(powerComparison.final.defender)}(-${defenderLossPercent.toFixed(2)}%)`);
    } else {
      OverviewConsole.log(`防守方: ${this._formatNumber(powerComparison.initial.defender)} ==> ${this._formatNumber(powerComparison.final.defender)}(-${defenderLossPercent.toFixed(2)}%)`);
    }
    
    // =================== 输出战斗结果 ===================
    const outcome = battleResult.outcome;
    OverviewConsole.stat(`\n---- 战斗结果 ----`);

    // 根据胜负方显示不同样式
    if (outcome.victorSide === 'attacker') {
      OverviewConsole.success(`【双方状态】进攻方: ${outcome.attackerState}, 防守方: ${outcome.defenderState}`);
      OverviewConsole.success(`【胜负结果】${outcome.result}`);
    } else if (outcome.victorSide === 'defender') {
      OverviewConsole.error(`【双方状态】进攻方: ${outcome.attackerState}, 防守方: ${outcome.defenderState}`);
      OverviewConsole.error(`【胜负结果】${outcome.result}`);
    } else {
      OverviewConsole.log(`【双方状态】进攻方: ${outcome.attackerState}, 防守方: ${outcome.defenderState}`);
      OverviewConsole.log(`【胜负结果】${outcome.result}`);
    }
    
    OverviewConsole.stat('========== 战斗结束 ==========');
  }
  
  /**
   * 获取火力值总和
   * @param {Object} firepower 火力值对象 {land, sea, air}
   * @returns {number} 火力值总和
   * @private
   */
  _getTotalFirepower(firepower) {
    return firepower.land + firepower.sea + firepower.air;
  }

  /**
   * 创建战斗效果的均匀分布
   * @param {Array<string>} attackerHexIds 攻击方六角格ID列表
   * @param {Array<string>} defenderHexIds 防守方六角格ID列表
   * @param {number} effectCount 要生成的效果数量
   * @returns {Array} 战斗效果数组，每个元素包含起点和终点六角格ID
   */
  _createDistributedBattleEffects(attackerHexIds, defenderHexIds, effectCount = 20) {
    // 战斗效果配置数组
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
      const attackerHex = this.store.getHexCellById(attackerHexId);
      
      // 只处理有效的攻击方六角格
      if (attackerHex) {
        // 获取攻击方六角格中心位置
        const attackerCenter = attackerHex.getCenter();
        
        for (let j = 0; j < effectsPerAttacker; j++) {
          // 目标六角格循环选择，确保每个防守方六角格都有机会被攻击
          const defenderHexId = defenderHexIds[j % totalDefenders];
          const defenderHex = this.store.getHexCellById(defenderHexId);
          
          // 只处理有效的防守方六角格
          if (defenderHex) {
            // 获取防守方六角格中心位置
            const defenderCenter = defenderHex.getCenter();
            
            // 随机选择子弹类型
            const bulletType = Math.random() > 0.7 ? 
              (Math.random() > 0.5 ? 'missile' : 'shell') : 'plainBullet';
            
            battleEffects.push({
              from: {
                position: { ...attackerCenter, height: attackerCenter.height + 20 },
                hexId: attackerHexId
              },
              to: {
                position: { ...defenderCenter, height: defenderCenter.height + 10 },
                hexId: defenderHexId
              },
              type: bulletType,
              delay: Math.random() * 1000, // 随机延迟，使效果看起来更自然
              speed: this._getBulletSpeed(bulletType)
            });
          }
        }
      }
    }
    
    // 如果还有剩余的效果数量，随机分配
    const remainingEffects = effectCount - (totalAttackers * effectsPerAttacker);
    for (let i = 0; i < remainingEffects; i++) {
      const attackerIndex = Math.floor(Math.random() * totalAttackers);
      const defenderIndex = Math.floor(Math.random() * totalDefenders);
      
      const attackerHexId = attackerHexIds[attackerIndex];
      const defenderHexId = defenderHexIds[defenderIndex];
      
      const attackerHex = this.store.getHexCellById(attackerHexId);
      const defenderHex = this.store.getHexCellById(defenderHexId);
      
      // 只处理两个六角格都有效的情况
      if (attackerHex && defenderHex) {
        // 获取六角格中心位置
        const attackerCenter = attackerHex.getCenter();
        const defenderCenter = defenderHex.getCenter();
        
        // 随机选择子弹类型
        const bulletType = Math.random() > 0.7 ? 
          (Math.random() > 0.5 ? 'missile' : 'shell') : 'plainBullet';
        
        battleEffects.push({
          from: {
            position: { ...attackerCenter, height: attackerCenter.height + 20 },
            hexId: attackerHexId
          },
          to: {
            position: { ...defenderCenter, height: defenderCenter.height + 10 },
            hexId: defenderHexId
          },
          type: bulletType,
          delay: Math.random() * 1000,
          speed: this._getBulletSpeed(bulletType)
        });
      }
    }
    
    return battleEffects;
  }

  /**
     * 显示部队信息
     * @param {Object} force 部队对象
     * @param {Map} forceLossMap 部队损失信息映射
     * @param {boolean} isDefender 是否是防守方
     * @returns {Object} 部队信息
     */
  _displayForceInfo(force, forceLossMap, isDefender = false) {
    const strength = force.troopStrength;
    const forceLoss = forceLossMap.get(force.forceId);
    
    // 从forceLoss中获取兵力损失
    const strengthLoss = forceLoss ? forceLoss.strengthLoss : 0;
    let strengthDisplay = '';
    
    // 如果有损失，显示变化；否则只显示当前值
    if (strengthLoss > 0) {
      strengthDisplay = `兵力值：${strength}（-${strengthLoss}）`;
    } else {
      strengthDisplay = `兵力值：${strength}`;
    }
    
    // 添加疲劳等级信息（仅适用于防守方）
    let fatigueInfo = '';
    if (isDefender && force.combatChance < 0) {
      const fatigueLevel = -force.combatChance;
      fatigueInfo = `，疲劳等级${fatigueLevel}`;
    }
    
    // 构建完整的显示文本
    const displayText = `${force.forceName} | ${strengthDisplay}${fatigueInfo}`;
    
    // 根据兵力值选择显示颜色
    if (strength === 0) {
      OverviewConsole.error(displayText);
    } else if (strength <= 30) {
      OverviewConsole.warning(displayText);
    } else {
      OverviewConsole.success(displayText);
    }
    
    return {
      force,
      strengthLoss,
      currentStrength: strength
    };
  }
  
  /**
   * 格式化数字
   * @param {number} num 要格式化的数字
   * @returns {string} 格式化后的字符串
   * @private
   */
  _formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    
    // 转为数字确保格式化正确
    num = Number(num);
    
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(3) + 'b';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(3) + 'm';
    } else {
      // 百万以下数字精确显示
      return String(Math.round(num));
    }
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    BattleController.#instance = null;
  }

  /**
   * 创建战斗效果配置
   * @param {string} battleId 战斗ID
   * @param {Array<Object>} attackerForceInstances 攻击方部队实例数组
   * @param {Array<Object>} defenderForceInstances 防守方部队实例数组
   * @param {Array<string>} fallbackAttackerHexIds 攻击方备选六角格ID数组
   * @param {Array<string>} fallbackDefenderHexIds 防守方备选六角格ID数组
   * @returns {Array<Object>} 战斗效果配置数组
   * @private
   */
  _createBattleEffectsConfig(battleId, attackerForceInstances, defenderForceInstances, fallbackAttackerHexIds, fallbackDefenderHexIds) {
    // 战斗效果配置数组
    const battleEffectsConfig = [];
    
    // 从BattleConfig中获取子弹和爆炸效果配置
    const bulletEffectCount = BattleConfig.animation.bulletEffectCount || 20;
    const minBulletsPerAttacker = BattleConfig.animation.minBulletsPerAttacker || 2;
    const baseMinBulletsMultiplier = 2; // 基础倍率倍数
    
    // 防守方部队分配表，用于均匀分配攻击目标
    const defenderTargets = [];
    defenderForceInstances.forEach(defenderForce => {
      if (defenderForce.pose && defenderForce.pose.position) {
        defenderTargets.push({
          forceInstance: defenderForce,
          position: defenderForce.pose.position,
          hexId: defenderForce.force.hexId,
          bulletCount: 0 // 记录已分配到该目标的子弹数量
        });
      }
    });
    
    // 如果没有有效的防守方目标，则使用备选六角格
    if (defenderTargets.length === 0 && fallbackDefenderHexIds.length > 0) {
      fallbackDefenderHexIds.forEach(hexId => {
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          const center = hexCell.getCenter();
          defenderTargets.push({
            forceInstance: null,
            position: center,
            hexId: hexId,
            bulletCount: 0
          });
        }
      });
    }
    
    // 如果仍然没有目标，则无法创建战斗效果
    if (defenderTargets.length === 0) {
      OverviewConsole.warning('无法生成战斗效果: 找不到有效的防守方目标');
      return battleEffectsConfig;
    }
    
    // 计算所有部队的总战斗力，用于动态调整子弹数量
    let totalAttackerUnits = 0;
    attackerForceInstances.forEach(attackerForce => {
      if (attackerForce.unitInstanceMap) {
        totalAttackerUnits += attackerForce.unitInstanceMap.size;
      }
    });
    
    // 为每个攻击方部队实例创建战斗效果
    attackerForceInstances.forEach(attackerForce => {
      // 只处理有效位置的部队
      if (attackerForce.pose && attackerForce.pose.position) {
        // 计算该部队应该发射的子弹比例
        const unitCount = attackerForce.unitInstanceMap ? attackerForce.unitInstanceMap.size : 0;
        const forceRatio = totalAttackerUnits > 0 ? unitCount / totalAttackerUnits : 0;
        
        // 获取攻击方部队的兵种实例
        const attackerUnitInstances = Array.from(attackerForce.unitInstanceMap.values())
          .filter(unitInstance => unitInstance.activeModel && unitInstance.renderingKey);
        
        // 只处理有效的兵种实例
        if (attackerUnitInstances.length > 0) {
          // 为每个兵种实例创建战斗效果
          attackerUnitInstances.forEach(unitInstance => {
            // 获取兵种对应的模型配置
            const modelConfig = MilitaryConfig.models[unitInstance.renderingKey] || {};
            
            // 获取子弹类型
            const bulletType = modelConfig.bullet || 'none';
            
            // 只为能发射子弹的模型创建效果
            if (bulletType !== 'none') {
              // 根据子弹类型确定发射次数和间隔
              let fireCount, fireInterval;
              switch (bulletType) {
                case 'plainBullet':
                  fireCount = Math.floor(Math.random() * 3) + 3; // 3-5次
                  fireInterval = 300 + Math.random() * 200; // 300-500毫秒
                  break;
                case 'shell':
                  fireCount = Math.floor(Math.random() * 2) + 1; // 1-2次
                  fireInterval = 800 + Math.random() * 400; // 800-1200毫秒
                  break;
                case 'missile':
                  fireCount = 1; // 通常只发射一次
                  fireInterval = 0; // 不需要间隔
                  break;
                default:
                  fireCount = 1;
                  fireInterval = 500;
              }
              
              // 根据部队比例动态调整子弹数量，但保证最小发射数
              // 总子弹数 * 部队比例 * 基础倍率，确保小部队也有足够的发射量
              const dynamicMinBullets = Math.max(
                minBulletsPerAttacker,
                Math.ceil(bulletEffectCount * forceRatio * baseMinBulletsMultiplier)
              );
              fireCount = Math.max(fireCount, dynamicMinBullets);
              
              // 获取兵种实例的位置
              const sourcePosition = this._getUnitModelPosition(unitInstance, attackerForce);
              
              // 调整部队朝向，面向被攻击方
              this._adjustForceOrientation(attackerForce, defenderTargets[0]);
              
              // 创建该兵种实例的所有子弹效果
              for (let i = 0; i < fireCount; i++) {
                // 选择目标 - 按照当前被分配子弹最少的目标优先
                defenderTargets.sort((a, b) => a.bulletCount - b.bulletCount);
                const target = defenderTargets[0];
                target.bulletCount++; // 增加目标的子弹计数
                
                // 随机化子弹落点，增加真实感
                const randomizedTargetPosition = this._randomizeTargetPosition(
                  target.forceInstance ? 
                    this._getForcePosition(target.forceInstance) : 
                    this._getHexPosition(target.hexId)
                );
                
                // 计算延迟时间 - 使子弹发射时间分散
                const delay = i * fireInterval + Math.random() * 300;
                
                // 创建子弹效果配置
                battleEffectsConfig.push({
                  battleId: battleId,
                  type: bulletType,
                  from: {
                    unitInstance: unitInstance,
                    forceInstance: attackerForce,
                    position: sourcePosition,
                    hexId: attackerForce.force.hexId
                  },
                  to: {
                    forceInstance: target.forceInstance,
                    position: randomizedTargetPosition,
                    hexId: target.hexId
                  },
                  delay: delay,
                  speed: this._getBulletSpeed(bulletType)
                });
              }
            }
          });
        }
      }
    });
    
    // 如果没有生成任何战斗效果，则使用备选方案
    if (battleEffectsConfig.length === 0) {
      console.warn('未能生成基于部队实例的战斗效果，使用备选方案');
      // 创建简单的六角格之间的战斗效果
      const fallbackEffects = this._createDistributedBattleEffects(
        fallbackAttackerHexIds,
        fallbackDefenderHexIds,
        bulletEffectCount
      );
      
      // 添加战斗ID
      fallbackEffects.forEach(effect => {
        effect.battleId = battleId;
      });
      
      return fallbackEffects;
    }
    
    return battleEffectsConfig;
  }
  
  /**
   * 调整部队朝向，使其面向目标
   * @param {Object} forceInstance 部队实例
   * @param {Object} target 目标对象
   * @private
   */
  _adjustForceOrientation(forceInstance, target) {
    if (!forceInstance || !forceInstance.pose || !target) return;
    
    try {
      // 获取源位置和目标位置
      const sourcePos = forceInstance.pose.position;
      let targetPos;
      
      if (target.forceInstance && target.forceInstance.pose && target.forceInstance.pose.position) {
        targetPos = target.forceInstance.pose.position;
      } else if (target.position) {
        targetPos = target.position;
      } else {
        return; // 无法获取目标位置
      }
      
      // 计算朝向角度
      const dLon = (targetPos.longitude - sourcePos.longitude) * Math.PI / 180;
      const dLat = (targetPos.latitude - sourcePos.latitude) * Math.PI / 180;
      const bearing = Math.atan2(dLon, dLat);
      
      // 更新部队朝向
      forceInstance.pose.heading = bearing;
      
      // 如果部队有实体模型，同步更新模型朝向
      if (forceInstance.entity && forceInstance.entity.orientation) {
        const hpr = new Cesium.HeadingPitchRoll(bearing, 0, 0);
        forceInstance.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
          Cesium.Cartesian3.fromDegrees(sourcePos.longitude, sourcePos.latitude, sourcePos.height),
          hpr
        );
      }
    } catch (e) {
      console.warn('调整部队朝向失败', e);
    }
  }
  
  /**
   * 随机化目标位置，增加真实感
   * @param {Object} position 原始位置对象 {longitude, latitude, height}
   * @returns {Object} 随机化后的位置对象
   * @private
   */
  _randomizeTargetPosition(position) {
    if (!position) return position;
    
    // 定义随机范围（米）
    const randomRange = 30; // 30米范围内随机
    
    // 经纬度的随机偏移量（近似，1度约111km）
    const metersPerDegree = 111000;
    const lonOffset = (Math.random() * 2 - 1) * randomRange / (metersPerDegree * Math.cos(position.latitude * Math.PI / 180));
    const latOffset = (Math.random() * 2 - 1) * randomRange / metersPerDegree;
    
    // 高度的随机偏移量
    const heightOffset = (Math.random() * 2 - 1) * 5; // ±5米
    
    return {
      longitude: position.longitude + lonOffset,
      latitude: position.latitude + latOffset,
      height: (position.height || 0) + heightOffset
    };
  }

  /**
   * 获取兵种实例的模型位置
   * @param {Object} unitInstance 兵种实例
   * @param {Object} forceInstance 部队实例
   * @returns {Object} 位置对象 {longitude, latitude, height}
   * @private
   */
  _getUnitModelPosition(unitInstance, forceInstance) {
    // 如果有活跃模型，尝试从模型矩阵中获取位置
    if (unitInstance.activeModel) {
      try {
        const modelMatrix = unitInstance.activeModel.modelMatrix;
        const modelPos = new Cesium.Cartesian3();
        Cesium.Matrix4.getTranslation(modelMatrix, modelPos);
        
        // 将Cartesian3转换为经纬度
        const cartographic = Cesium.Cartographic.fromCartesian(modelPos);
        return {
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
          latitude: Cesium.Math.toDegrees(cartographic.latitude),
          height: cartographic.height
        };
      } catch (e) {
        console.warn('从模型中获取位置失败，使用部队位置替代', e);
      }
    }
    
    // 如果无法从模型中获取位置，则使用部队位置加上兵种偏移
    if (forceInstance.pose && forceInstance.pose.position) {
      const forcePos = forceInstance.pose.position;
      const offset = unitInstance.localOffset || { x: 0, y: 0 };
      
      // 根据部队朝向计算偏移后的位置
      const heading = forceInstance.pose.heading || 0;
      const offsetDistance = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
      const offsetAngle = Math.atan2(offset.y, offset.x) + heading;
      
      // 计算经纬度偏移
      // 简化计算，1度≈111km，转换为偏移量
      const metersPerDegree = 111000;
      const lonOffset = (offsetDistance * Math.cos(offsetAngle)) / (metersPerDegree * Math.cos(forcePos.latitude * Math.PI / 180));
      const latOffset = (offsetDistance * Math.sin(offsetAngle)) / metersPerDegree;
      
      return {
        longitude: forcePos.longitude + lonOffset,
        latitude: forcePos.latitude + latOffset,
        height: forcePos.height + 2 // 稍微抬高，避免与地面重合
      };
    }
    
    // 均无法获取，返回默认位置
    return { longitude: 0, latitude: 0, height: 0 };
  }

  /**
   * 获取部队实例的位置
   * @param {Object} forceInstance 部队实例
   * @returns {Object} 位置对象 {longitude, latitude, height}
   * @private
   */
  _getForcePosition(forceInstance) {
    if (forceInstance && forceInstance.pose && forceInstance.pose.position) {
      return { ...forceInstance.pose.position };
    } else if (forceInstance && forceInstance.force && forceInstance.force.hexId) {
      return this._getHexPosition(forceInstance.force.hexId);
    }
    return { longitude: 0, latitude: 0, height: 0 };
  }

  /**
   * 获取六角格的中心位置
   * @param {string} hexId 六角格ID
   * @returns {Object} 位置对象 {longitude, latitude, height}
   * @private
   */
  _getHexPosition(hexId) {
    const hexCell = this.store.getHexCellById(hexId);
    if (hexCell) {
      const center = hexCell.getCenter();
      return { ...center };
    }
    return { longitude: 0, latitude: 0, height: 0 };
  }

  /**
   * 获取子弹速度
   * @param {string} bulletType 子弹类型
   * @returns {number} 子弹速度(米/秒)
   * @private
   */
  _getBulletSpeed(bulletType) {
    switch (bulletType) {
      case 'plainBullet':
        return BattleConfig.animation.bulletSpeed || 500;
      case 'shell':
        return BattleConfig.animation.shellSpeed || 300;
      case 'missile':
        return BattleConfig.animation.missileSpeed || 200;
      default:
        return BattleConfig.animation.bulletSpeed || 500;
    }
  }
}
