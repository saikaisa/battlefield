// src\layers\interaction-layer\utils\HexSelectValidator.js
import { openGameStore } from "@/store";
import { ModesConfig } from "@/config/GameModeConfig";
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import { OverviewConsole } from "@/layers/interaction-layer/utils/OverviewConsole";
import { Battlegroup } from "@/models/MilitaryUnit";
import { watch } from 'vue';

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
    // 添加监听器
    this.setupWatchers();
  }

  /**
   * 设置监听器，监听attackState和selectedHexIds的变化
   * @private
   */
  setupWatchers() {
    watch(
      [
        () => this.store.attackState.phase,
        () => this.store.attackState.commandForceId,
        () => this.store.attackState.enemyCommandForceId,
        () => this.store.attackState.supportForceIds,
        () => this.store.attackState.enemySupportForceIds,
        () => this.store.selectedHexIds
      ],
      () => {
        // console.log(`wahwhahwhawhawhawh`)
        // 只在攻击准备模式下自动更新战斗群预览
        if (this.store.gameMode === 'ATTACK_PREPARE' && this.store.attackState.phase) {
          this._previewBattlegroups();
        }
      },
      { immediate: false, deep: true }
    );
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
   * @param {string} hexId 本次选中的需要验证的六角格
   * @returns {boolean} 是否允许添加到选中六角格
   * @private
   */
  _validateMovePath(hexId) {
    // ===== movePrepare函数执行完后到这个函数
    // ===== 在每一次鼠标点击六角格时，都会经过该函数验证
    console.log('[HexSelectValidator] 验证移动路径');
    const store = openGameStore();
    const selectedHexIds = Array.from(store.selectedHexIds);
    
    // 获取当前选中的部队
    const selectedForceIds = Array.from(store.selectedForceIds);
    if (!selectedForceIds.length) {
      console.warn('[HexSelectValidator] 没有选中的部队');
      return false; // 没有选中的部队，无法验证移动路径
    }
    
    const force = store.getForceById(selectedForceIds[0]);
    if (!force) {
      console.warn('[HexSelectValidator] 无法获取部队信息');
      return false; // 无法获取部队信息
    }
    
    // 获取当前六角格和正在验证的六角格
    const currentHexCell = store.getHexCellById(hexId);
    if (!currentHexCell) {
      console.warn('[HexSelectValidator] 无效的六角格');
      return false; // 无效的六角格
    }
    
    // 检查如果点击的是已选中的六角格，则将该六角格之后的所有六角格从选中六角格中删除
    // 点击的这个六角格会在SceneInteractor中被取消选中，所以这里就先不取消了，不然又会切换回来
    const clickedIndex = selectedHexIds.indexOf(hexId);
    if (clickedIndex !== -1) {
      console.log('[HexSelectValidator] 点击的是已选中的六角格');
      // 如果点击的是已选中的六角格，截取到该位置
      const newSelectedHexIds = selectedHexIds.slice(0, clickedIndex + 1);
      
      // 更新选中的六角格
      store.setSelectedHexIds(newSelectedHexIds);
      
      // 在控制台中更新路径信息，但要去除当前六角格
      this._updatePathInfo(force, newSelectedHexIds.slice(0, -1));
      
      return true;
    }
    
    // 2. 检查新六角格是否与已选中六角格路径中的任意一个六角格相接
    let optimizedPath = null;
    let isNeighborOfAny = false;
    
    // 从起点开始检查，找到与新六角格相邻的选中六角格
    for (let i = 0; i < selectedHexIds.length; i++) {
      const hexCell = store.getHexCellById(selectedHexIds[i]);
      const isNeighborOfCurrent = hexCell.neighbors.some(n => n.hexId === hexId);
      console.log(`${hexCell.hexId}/${hexId}的邻居六角格有：${hexCell.neighbors.map(n => n.hexId)}`);

      if (isNeighborOfCurrent) {
        // 找到相邻的六角格，构建新路径（截取到该位置+当前六角格）
        optimizedPath = [...selectedHexIds.slice(0, i + 1), hexId];
        isNeighborOfAny = true;
        break;
      }
    }
    
    // 如果不与任何已选中六角格相邻，则拒绝选择
    if (!isNeighborOfAny) {
      console.log('[HexSelectValidator] 不相接则不提示任何信息，相当于无反馈');
      // 不相接则不提示任何信息，相当于无反馈
      return false;
    }
    
    // 3. 检查新六角格是否隶属方为敌方
    const currentFaction = store.currentFaction;
    if (currentHexCell.battlefieldState.controlFaction !== 'neutral' && 
        currentHexCell.battlefieldState.controlFaction !== currentFaction) {
      showWarning('无法移动到敌方控制的六角格');
      return false;
    }
    
    // 4. 检查新六角格的passability是否允许当前部队的军种service通行
    const terrainPassability = currentHexCell.terrainAttributes.passability;
    if (force.service === 'land' && !terrainPassability.land) {
      showWarning('陆军部队无法通过该地形');
      return false;
    } else if (force.service === 'sea' && !terrainPassability.naval) {
      showWarning('海军部队无法通过该地形');
      return false;
    } else if (force.service === 'air' && !terrainPassability.air) {
      showWarning('空军部队无法通过该地形');
      return false;
    }
    
    // 5. 计算行动力消耗（使用优化后的路径）
    let totalActionPointCost = force.computeActionPointsForPath(optimizedPath);
    console.log('[HexSelectValidator] 计算行动力消耗', totalActionPointCost);

    // 6. 检查点击这个新六角格后扣除行动力是否小于0
    const remainingActionPoints = force.actionPoints - totalActionPointCost;
    if (remainingActionPoints < 0) {
      const costForCurrentHex = force.getActionPointCost(hexId);
      showWarning(`该六角格需要${costForCurrentHex}点行动力，现在只剩${force.actionPoints - totalActionPointCost + costForCurrentHex}点，无法到达此处`);
      return false;
    }
    
    // 所有检查通过，更新选中的六角格为优化后的路径
    // 注意：但是不把当前六角格加入，当前六角格交给SceneInteractor处理
    store.setSelectedHexIds(optimizedPath.slice(0, -1));
    console.log('[HexSelectValidator] 更新选中的六角格为优化后的路径', optimizedPath);
    
    // 在控制台中显示当前路径的行动力消耗信息
    this._updatePathInfo(force, optimizedPath, totalActionPointCost, remainingActionPoints);
    
    // 返回true表示验证通过
    return true;
  }

  /**
   * 更新路径信息在控制台中显示
   * @param {Object} force 部队对象
   * @param {Array} path 路径数组
   * @param {number} [totalCost] 总消耗
   * @param {number} [remaining] 剩余行动力
   * @private
   */
  _updatePathInfo(force, path, totalCost, remaining) {    
    // 如果未提供消耗值，重新计算
    if (totalCost === undefined) {
      totalCost = force.computeActionPointsForPath(path);
      remaining = force.actionPoints - totalCost;
    }
    
    OverviewConsole.updateLine('move_path_info', 
      `移动路径消耗行动力: ${totalCost}，剩余: ${remaining}`, 
      'warning');
  }

  /**
   * 验证攻击目标和支援部队
   * @param {string} hexId 本次选中的需要验证的六角格
   * @returns {boolean} 是否允许添加到选中六角格
   * @private
   */
  _validateAttackTarget(hexId) {
    console.log('[HexSelectValidator] 验证攻击目标或支援部队');
    const store = openGameStore();
    
    // 获取攻击状态
    const attackState = store.attackState;
    if (!attackState.phase) {
      console.warn('[HexSelectValidator] 攻击状态未初始化');
      return false;
    }
    
    const { phase, commandForceId } = attackState;
    
    // 获取指挥部队信息
    const commandForce = store.getForceById(commandForceId);
    if (!commandForce) {
      console.warn('[HexSelectValidator] 无法获取指挥部队信息');
      showWarning('无法获取指挥部队信息');
      return false;
    }
    
    // 获取当前六角格
    const currentHexCell = store.getHexCellById(hexId);
    if (!currentHexCell) {
      console.warn('[HexSelectValidator] 无效的六角格');
      return false;
    }
    
    // 获取指挥部队所在的六角格
    const commandHexId = commandForce.hexId;
    const commandHex = store.getHexCellById(commandHexId);
    if (!commandHex) {
      console.warn('[HexSelectValidator] 无法获取指挥部队所在的六角格');
      return false;
    }
    
    // 检查六角格是否在指挥范围内
    const commandRange = commandForce.commandRange;
    const hexesInRange = commandHex.getHexCellInRange(commandRange);
    const isInRange = hexesInRange.some(hex => hex && hex.hexId === hexId);
    // 允许选择指挥部队自己所在的六角格
    if (!isInRange && hexId !== commandHexId) {
      console.warn('[HexSelectValidator] 六角格不在指挥范围内');
      showWarning('该六角格不在指挥范围内');
      return false;
    }
    
    // === 阶段一：选择目标六角格（敌方指挥部队） ===
    if (phase === 'selectTarget') {
      // 获取敌方阵营
      const enemyFaction = commandForce.faction === 'blue' ? 'red' : 'blue';
      
      // 如果选择的是敌方六角格
      if (currentHexCell.battlefieldState.controlFaction === enemyFaction) {
        
        // 获取目标六角格中的所有敌方部队
        const enemyForcesInHex = currentHexCell.forcesIds
          .map(fid => store.getForceById(fid))
          .filter(force => force && force.faction === enemyFaction);
          
        if (!enemyForcesInHex || enemyForcesInHex.length === 0) {
          console.warn('[HexSelectValidator] 目标六角格没有敌方部队');
          showWarning('目标六角格没有敌方部队');
          return false;
        }
        
        // 如果当前选中的六角格已经是敌方指挥部队所在六角格，则取消选择
        if (attackState.enemyCommandForceId) {
          const enemyCommandForce = store.getForceById(attackState.enemyCommandForceId);
          if (enemyCommandForce && enemyCommandForce.hexId === hexId) {
            // 清除敌方指挥部队和支援部队
            store.attackState.enemyCommandForceId = null;
            store.attackState.enemySupportForceIds = [];
            
            return true;
          }
        }
        
        // 如果之前已经选中了其他敌方指挥部队所在六角格，取消选中
        if (attackState.enemyCommandForceId) {
          const previousEnemyCommandForce = store.getForceById(attackState.enemyCommandForceId);
          if (previousEnemyCommandForce) {
            // 取消选中该敌方指挥部队所在的六角格
            store.removeSelectedHexId(previousEnemyCommandForce.hexId);
          }
        }
        
        // 从敌方部队中选择指挥范围最大的作为敌方指挥部队
        const enemyCommandForce = enemyForcesInHex.reduce((max, force) => 
          (force.commandRange > max.commandRange) ? force : max, enemyForcesInHex[0]);
        
        // 设置敌方指挥部队
        store.attackState.enemyCommandForceId = enemyCommandForce.forceId;
        
        // 找出敌方指挥范围内的支援部队
        this._updateEnemySupportForces(enemyCommandForce);
        
        return true;
      } else {
        // 如果选择的不是敌方六角格，不允许选择
        showWarning('请选择敌方控制的六角格作为攻击目标');
        return false;
      }
    } 
    // === 阶段二：选择支援部队 ===
    else if (phase === 'selectSupport') {
      if (hexId === commandHexId) {
        showWarning('指挥部队所在六角格不能取消！');
        return false;
      }

      // 检查是否有友方部队
      const forcesInHex = currentHexCell.forcesIds;
      if (!forcesInHex || forcesInHex.length === 0) {
        console.warn('[HexSelectValidator] 该六角格没有部队');
        showWarning('该六角格没有部队可选择');
        return false;
      }
      
      // 找出该六角格中的友方部队
      const friendlyForces = forcesInHex.filter(fid => {
        const force = store.getForceById(fid);
        return force && force.faction === commandForce.faction;
      });
      
      if (friendlyForces.length === 0) {
        console.warn('[HexSelectValidator] 该六角格没有友方部队');
        showWarning('请选择含有友方部队的六角格');
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 更新敌方支援部队列表
   * @param {Object} enemyCommandForce 敌方指挥部队
   * @private
   */
  _updateEnemySupportForces(enemyCommandForce) {
    const store = openGameStore();
    
    // 清空现有敌方支援部队
    store.attackState.enemySupportForceIds = [];
    
    if (!enemyCommandForce) return;
    
    // 获取敌方指挥部队所在六角格
    const hexId = enemyCommandForce.hexId;
    const hexCell = store.getHexCellById(hexId);
    
    if (!hexCell) return;
    
    // 获取指挥范围内的六角格
    const commandRange = enemyCommandForce.commandRange;
    const hexesInRange = hexCell.getHexCellInRange(commandRange);
    
    // 找出指挥范围内的所有敌方部队（不包括指挥部队本身）
    hexesInRange.forEach(rangeHex => {
      if (!rangeHex) return;
      
      const forcesInHex = rangeHex.forcesIds || [];
      forcesInHex.forEach(forceId => {
        const force = store.getForceById(forceId);
        if (force && force.faction === enemyCommandForce.faction && force.forceId !== enemyCommandForce.forceId) {
          store.attackState.enemySupportForceIds.push(forceId);
        }
      });
    });
  }
  
  /**
   * 预览战斗群 - 私有方法，从store自动获取数据
   * @private
   */
  _previewBattlegroups() {
    const store = openGameStore();
    
    // 如果不在攻击准备阶段，不执行
    if (store.gameMode !== 'ATTACK_PREPARE' || !store.attackState.phase) {
      return;
    }
    
    // 从攻击状态中获取指挥部队
    const commandForceId = store.attackState.commandForceId;
    const commandForce = store.getForceById(commandForceId);
    if (!commandForce) {
      console.warn('[HexSelectValidator] 无法获取指挥部队信息');
      return;
    }
    
    // 从攻击状态中获取敌方指挥部队
    const enemyCommandForceId = store.attackState.enemyCommandForceId;
    const enemyCommandForce = enemyCommandForceId ? store.getForceById(enemyCommandForceId) : null;
    
    // 构建友方战斗群 - 使用选中六角格中的所有友军部队
    const friendlyForces = [];
    
    // 获取所有当前选中的六角格
    const selectedHexIds = Array.from(store.selectedHexIds);
    
    // 从选中的六角格中获取所有友方部队
    selectedHexIds.forEach(hexId => {
      const hexCell = store.getHexCellById(hexId);
      if (hexCell && hexCell.forcesIds) {
        hexCell.forcesIds.forEach(forceId => {
          const force = store.getForceById(forceId);
          if (force && force.faction === commandForce.faction) {
            friendlyForces.push(force);
          }
        });
      }
    });
    
    // 如果没有选中六角格或没有找到友方部队，至少加入指挥部队
    if (friendlyForces.length === 0) {
      friendlyForces.push(commandForce);
    }
    
    // 确保没有重复的部队
    const uniqueForceIds = new Set();
    const uniqueFriendlyForces = friendlyForces.filter(force => {
      if (uniqueForceIds.has(force.forceId)) {
        return false;
      }
      uniqueForceIds.add(force.forceId);
      return true;
    });
    
    // 创建友方战斗群对象
    const friendlyForceIds = uniqueFriendlyForces.map(force => force.forceId);
    const friendlyBattlegroup = new Battlegroup({
      faction: commandForce.faction,
      commandForceId: commandForce.forceId,
      forceIdList: friendlyForceIds
    });
    
    // 获取友方战斗群的联合进攻火力值
    const friendlyAttackPower = friendlyBattlegroup.jointAttackFirepower;
    
    // 统计部队分布维度 - 基于部队的service属性统计
    let landForces = 0, seaForces = 0, airForces = 0;
    uniqueFriendlyForces.forEach(force => {
      if (force.service === 'land') landForces++;
      else if (force.service === 'sea') seaForces++;
      else if (force.service === 'air') airForces++;
    });
    
    const friendlyDistribution = `陆${landForces}/海${seaForces}/空${airForces}`;
    
    // 更新战斗预览信息
    OverviewConsole.updateLine('current_stage', `===== 攻击准备模式：${store.attackState.phase === 'selectTarget' ? '选择攻击目标' : '选择参战部队'} =====`);
    
    // 判断是否有敌方战斗群
    if (enemyCommandForce) {
      // 构建敌方战斗群
      const enemyForceIds = [enemyCommandForce.forceId];
      
      // 添加敌方支援部队
      const enemySupportForceIds = store.attackState.enemySupportForceIds || [];
      enemySupportForceIds.forEach(forceId => {
        if (forceId !== enemyCommandForce.forceId) {
          enemyForceIds.push(forceId);
          console.log(`添加敌方支援部队: ${forceId}, 当前敌方部队列表: ${enemyForceIds.join(', ')}`);
        }
      });
      
      // 创建敌方战斗群对象
      const enemyBattlegroup = new Battlegroup({
        faction: enemyCommandForce.faction,
        commandForceId: enemyCommandForce.forceId,
        forceIdList: enemyForceIds
      });
      
      // 获取敌方战斗群的联合火力值（只关注防御火力）
      const enemyDefensePower = enemyBattlegroup.jointDefenseFirepower;
      
      // 统计敌方部队分布维度 - 基于部队的service属性统计
      let enemyLandForces = 0, enemySeaForces = 0, enemyAirForces = 0;
      enemyBattlegroup._forces().forEach(force => {
        if (force.service === 'land') enemyLandForces++;
        else if (force.service === 'sea') enemySeaForces++;
        else if (force.service === 'air') enemyAirForces++;
      });
      
      const enemyDistribution = `陆${enemyLandForces}/海${enemySeaForces}/空${enemyAirForces}`;
      
      // 显示我方部队信息
      const friendlyInfo = [
        `我方指挥部队：${commandForce.forceName}`,
        `我方参战部队组成：${friendlyDistribution}`
      ].join('\n');
      
      // 显示敌方部队信息
      const enemyInfo = [
        `敌方指挥部队：${enemyCommandForce.forceName}`,
        `敌方参战部队组成：${enemyDistribution}`
      ].join('\n');
      
      // 更新表格内容
      const tableContent = [
        '        | 我方           | 敌方        ',
        '------------------------------------------',
        `指挥半径 | ${`${commandForce.commandRange}`.padEnd(14)} | ${`${enemyCommandForce.commandRange}`.padEnd(14)}`,
        `指挥能力 | ${`${commandForce.commandCapability.toFixed(1)}`.padEnd(14)} | ${`${enemyCommandForce.commandCapability.toFixed(1)}`.padEnd(14)}`,
        `对陆火力 | ${this._formatNumber(friendlyAttackPower.land).padEnd(14)} | ${this._formatNumber(enemyDefensePower.land).padEnd(14)}`,
        `对海火力 | ${this._formatNumber(friendlyAttackPower.sea).padEnd(14)} | ${this._formatNumber(enemyDefensePower.sea).padEnd(14)}`,
        `对空火力 | ${this._formatNumber(friendlyAttackPower.air).padEnd(14)} | ${this._formatNumber(enemyDefensePower.air).padEnd(14)}`
      ].join('\n');
      
      OverviewConsole.updateLine('friendly_info', friendlyInfo, 'info');
      OverviewConsole.updateLine('enemy_info', enemyInfo, 'error');
      OverviewConsole.updateLine('battle_table', tableContent, 'stat');
      
      // 更新提示信息
      if (store.attackState.phase === 'selectTarget') {
        OverviewConsole.updateLine('prepare_attack_info', `已选择目标敌方六角格，锁定目标以进入下一步。`, 'warning');
      } else {
        OverviewConsole.updateLine('prepare_attack_info', `请选择我方需要参战的六角格。`, 'warning');
      }
    } else {
      // 显示我方部队信息
      const friendlyInfo = [
        `我方指挥部队：${commandForce.forceName}`,
        `我方参战部队组成：${friendlyDistribution}`
      ].join('\n');
      
      // 显示敌方未选择信息
      const enemyInfo = [
        `敌方指挥部队：未选择`,
        `敌方参战部队组成：未选择`
      ].join('\n');
      
      // 只有友方战斗群时的表格更新
      const tableContent = [
        '        | 我方           | 敌方        ',
        '------------------------------------------',
        `指挥半径 | ${`${commandForce.commandRange}`.padEnd(14)} | 未选择         `,
        `指挥能力 | ${`${commandForce.commandCapability.toFixed(1)}`.padEnd(14)} | 未选择         `,
        `对陆火力 | ${this._formatNumber(friendlyAttackPower.land).padEnd(14)} | 未选择         `,
        `对海火力 | ${this._formatNumber(friendlyAttackPower.sea).padEnd(14)} | 未选择         `,
        `对空火力 | ${this._formatNumber(friendlyAttackPower.air).padEnd(14)} | 未选择         `
      ].join('\n');
      
      OverviewConsole.updateLine('friendly_info', friendlyInfo, 'info');
      OverviewConsole.updateLine('enemy_info', enemyInfo, 'error');
      OverviewConsole.updateLine('battle_table', tableContent, 'stat');
      
      OverviewConsole.updateLine('prepare_attack_info', `请在指挥范围内选取需要打击的敌方六角格。`, 'warning');
    }
  }
  
  /**
   * 格式化数字，使用m表示百万级，b表示十亿级等
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
}

// 导出单例服务
export const SelectValidator = {
  validate(hexId) {
    return HexSelectValidator.getInstance().validate(hexId);
  },
  // 为了兼容性保留此方法，但实际调用新的内部方法
  previewBattlegroups() {
    return HexSelectValidator.getInstance()._previewBattlegroups();
  }
}; 