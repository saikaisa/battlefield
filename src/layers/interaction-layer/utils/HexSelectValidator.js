// src\layers\interaction-layer\utils\HexSelectValidator.js
import { openGameStore } from "@/store";
import { ModesConfig } from "@/config/GameModeConfig";
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import { OverviewConsole } from "@/layers/interaction-layer/utils/OverviewConsole";

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
    
    // 1. 检查如果点击的是已选中的六角格，则将该六角格之后的所有六角格从选中六角格中删除
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
   * 验证攻击目标和支援部队
   * @param {string} hexId 本次选中的需要验证的六角格
   * @returns {boolean} 是否允许添加到选中六角格
   * @private
   */
  _validateAttackTarget() {
    // 1. 从选中部队中获取指挥部队
    // 2. 先选敌方目标，这个类里面存一下两阶段，选完敌方目标了自动进入下一阶段（通过总览控制台进行提示）
    // 3. 敌方目标只能选指挥范围内的，如果没有，则无法进入攻击模式
    // 注：我觉得选中部队的时候可以动态显示其指挥范围。到时候改一下
    // 4. 选完敌方目标选指挥范围内的支援部队
    // 5. 最后提交
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
      `移动路径消耗行动力: ${totalCost}/${force.actionPoints}，剩余: ${remaining}`, 
      'warning');
  }
}

// 导出单例服务
export const SelectValidator = {
  validate(hexId) {
    return HexSelectValidator.getInstance().validate(hexId);
  }
}; 