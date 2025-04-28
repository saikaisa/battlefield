import { reactive, ref } from 'vue';
import * as API from '@/services/api';
import { openGameStore } from '@/store';
import { showSuccess, showError, showWarning } from '@/layers/interaction-layer/MessageBox';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';

/**
 * 命令处理模块 - 调用其他各模块的方法执行命令
 * 该模块的方法为命令，被CommandDispatcher调用
 */
export class CommandProcessor {
  static #instance = null;

  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {CommandProcessor} 单例实例
   */
  static getInstance(viewer) {
    if (!CommandProcessor.#instance) {
      CommandProcessor.#instance = new CommandProcessor(viewer);
    }
    return CommandProcessor.#instance;
  }

  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.sceneManager = SceneManager.getInstance(viewer);
    this.cameraController = CameraViewController.getInstance(viewer);
    this.militaryManager = null; // 延迟初始化
  }

  /**
   * 初始化军事管理器引用
   */
  initMilitaryManager() {
    if (!this.militaryManager) {
      this.militaryManager = MilitaryManager.getInstance(this.viewer);
    }
  }

  // ================ 场景控制命令 ================

  /**
   * 切换 Orbit 模式
   * @param {boolean} enabled 是否启用 Orbit 模式
   * @returns {Object} 命令执行结果
   */
  toggleOrbitMode(enabled) {
    try {
      this.cameraController.setOrbitMode(enabled);
      return { success: true, message: `轨道模式已${enabled ? '启用' : '禁用'}` };
    } catch (error) {
      showError(`切换轨道模式失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重置相机位置
   * @returns {Object} 命令执行结果
   */
  resetCamera() {
    try {
      this.cameraController.resetCamera();
      return { success: true, message: '相机已重置' };
    } catch (error) {
      showError(`重置相机失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 聚焦到选中的部队
   * @returns {Object} 命令执行结果
   */
  focusOnSelectedForce() {
    try {
      const selectedForceIds = this.store.getSelectedForceIds();
      if (selectedForceIds.size === 0) {
        showWarning('没有选中任何部队');
        return { success: false, message: '没有选中任何部队' };
      }

      const forceId = Array.from(selectedForceIds)[0];
      const force = this.store.getForceById(forceId);
      if (!force || !force.hexId) {
        showWarning('无法定位选中的部队');
        return { success: false, message: '无法定位选中的部队' };
      }

      const hexCell = this.store.getHexCellById(force.hexId);
      if (!hexCell) {
        showWarning('无法获取部队所在的六角格');
        return { success: false, message: '无法获取部队所在的六角格' };
      }

      const center = hexCell.getCenter();
      this.cameraController.focusOnLocation(center.longitude, center.latitude);
      return { success: true, message: '已聚焦到选中部队' };
    } catch (error) {
      showError(`聚焦到部队失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 切换图层
   * @param {number} layerIndex 图层索引
   * @returns {Object} 命令执行结果
   */
  changeLayer(layerIndex) {
    try {
      this.store.setLayerIndex(layerIndex);
      this.sceneManager.refreshHexGrid();
      return { success: true, message: `已切换到图层 ${layerIndex}` };
    } catch (error) {
      showError(`切换图层失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 切换选择模式
   * @param {boolean} isMultiSelect 是否为多选模式
   * @returns {Object} 命令执行结果
   */
  setSelectionMode(isMultiSelect) {
    try {
      this.sceneManager.setMultiSelectMode(isMultiSelect);
      return { success: true, message: `已切换到${isMultiSelect ? '多选' : '单选'}模式` };
    } catch (error) {
      showError(`切换选择模式失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 切换到下一个阵营/回合
   * @returns {Object} 命令执行结果
   */
  switchToNextFaction() {
    try {
      // 记录切换前的回合数
      const prevRound = this.store.currentRound;

      // 清空所有选中状态
      this.store.clearSelectedHexIds();
      this.store.clearSelectedForceIds();

      // 切换到下一个阵营
      this.store.switchToNextFaction();

      // 如果回合数发生变化，说明进入新回合，需要重置所有部队状态
      if (this.store.currentRound > prevRound) {
        // 重置所有部队的行动力和战斗机会
        const forces = this.store.getForces();
        forces.forEach(force => {
          force.resetActionPoints();
          force.refreshCombatChance();
          force.recoverTroopStrength();
        });
      }

      // 重新计算部队可见性
      if (this.militaryManager && this.militaryManager.renderer) {
        this.militaryManager.renderer.updateForceInstanceVisibility();
      }

      showSuccess(`已切换到${this.store.currentFaction}方，当前回合: ${this.store.currentRound}`);
      return { 
        success: true, 
        message: `已切换到${this.store.currentFaction}方，当前回合: ${this.store.currentRound}`,
        data: {
          faction: this.store.currentFaction,
          round: this.store.currentRound
        }
      };
    } catch (error) {
      showError(`切换阵营失败: ${error.message}`);
      throw error;
    }
  }

  // ================ 军事单位命令 ================
  
  // 这些方法将在后续实现
  // move, attack, createForce, mergeForces, splitForce等

  /**
   * 销毁实例
   */
  destroy() {
    CommandProcessor.#instance = null;
  }
}
