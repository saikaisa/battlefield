/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
// import { HexForceMapper } from '@/utils/HexForceMapper';
import { ModelTemplateLoader } from "./ModelTemplateLoader";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { MilitaryMovementController } from "./MilitaryMovementController";
import { ModelPoseCalculator } from "./ModelPoseCalculator";
import { HexForceMapper } from "@/layers/interaction-layer/utils/HexForceMapper";
import { HexVisualStyles } from "@/config/HexVisualStyles";

/**
 * 军事单位实例渲染器
 * 
 * 主要职责：
 * 1. 管理部队模型的渲染
 * 2. 处理部队位置更新和 LOD 切换
 * 3. 管理部队的移动、交战渲染
 */
export class MilitaryInstanceRenderer {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MilitaryInstanceRenderer} 单例实例
   */
  static getInstance(viewer) {
    if (!MilitaryInstanceRenderer.#instance) {
      MilitaryInstanceRenderer.#instance = new MilitaryInstanceRenderer(viewer);
    }
    return MilitaryInstanceRenderer.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();

    // 初始化模型姿态计算器
    this.poseCalculator = ModelPoseCalculator.getInstance(viewer);
    // 初始化实例生成器
    this.generator = MilitaryInstanceGenerator.getInstance(viewer);
    // 初始化移动控制器
    this.movementController = MilitaryMovementController.getInstance(viewer);
    // 获取部队实例映射表
    this.forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap();
    // 更新循环监听器
    this._updateHandle = null;
  }

  /**
   * 重新生成所有部队实例
   */
  regenerateAllForceInstances() {
    this.store.getForces().forEach(force => {
      // 移除部队实例
      this.generator.removeForceInstanceById(force.forceId);
      // 创建新的部队实例
      this.generator.createForceInstance(force);
      // 将新的部队实例渲染在地图上
      this._renderForceInstance(force);
    });
    this.update();
  }

  /**
   * 处理部队实例变化（新增删除和渲染）
   * 根据传入的部队ID列表，更新地图上的部队实例显示
   * 
   * @param {string[]} [newForceIds] - 新的完整部队ID列表
   * @param {string[]} [removedForceIds] - 已被移除的部队ID列表
   * 
   * 当两个参数都为空时，会重新同步所有部队实例
   */
  updateForceInstance(newForceIds, removedForceIds) {
    // 如果未传入参数，则重新渲染所有部队
    if (!newForceIds || !removedForceIds) {
      // 遍历所有存在的部队
      const allForces = this.store.getForces();
      const allForceIds = allForces.map(force => force.forceId);
      
      // 清理那些已从部队数据中删除，但仍然存在于forceInstanceMap中的部队实例
      for (const instanceId of this.forceInstanceMap.keys()) {
        if (!allForceIds.includes(instanceId)) {
          this.generator.removeForceInstanceById(instanceId);
        }
      }
      
      // 渲染所有存在的部队
      allForces.forEach(force => {
        // 检查部队是否已有实例
        if (!this.forceInstanceMap.has(force.forceId)) {
          // 对于没有实例的部队，创建实例
          this.generator.createForceInstance(force);
        }
        // 无论是否已有实例，都调用渲染方法（内部会判断是否重复显示）
        this._renderForceInstance(force);
      });
      return;
    }
    
    // 为新的完整部队ID列表中不在forceInstanceMap里的部队创建渲染实例并渲染
    newForceIds.forEach(id => {
      if (!this.forceInstanceMap.has(id)) {
        const force = this.store.getForceById(id);
        if (force) {
          this.generator.createForceInstance(force);
          this._renderForceInstance(force);
        }
      }
    });

    // 移除已删除部队的渲染实例
    removedForceIds.forEach(id => {
      this.generator.removeForceInstanceById(id);
    });
  }

  /**
   * 启动更新循环，每帧执行一次
   */
  update() {
    if (this._updateHandle) return;
    
    // TODO: 调用MilitaryBattleController进行战斗动画渲染
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 更新所有部队
      this.forceInstanceMap.forEach((forceInstance, forceId) => {
        // 首先检查部队是否在移动中
        const isMoving = this.movementController.movingForces.has(forceId);
        
        if (isMoving) {
          // 移动中的部队：计算新位置并更新
          this.movementController.updateMovingForces(forceId);
        } 
        else {
          // 静止部队：更新LOD
          this._updateModelLOD(forceInstance);
        }
      });
      
      // 清理已完成移动的部队
      this.movementController.cleanupFinishedMovements();
    });
  }

  /**
   * 更新部队实例和六角格的可见性
   * 根据当前阵营和六角格可见性设置更新部队和六角格的显示状态
   */
  updateHexObjectVisibility() {
    const currentFaction = this.store.currentFaction;
    
    // 遍历所有部队实例，更新其可见性
    this.forceInstanceMap.forEach((forceInstance, forceId) => {
      const force = forceInstance.force;
      if (!force) return;
      
      // 获取部队所在的六角格
      const hexId = force.hexId;
      if (!hexId) return;
      
      // 获取六角格对象
      const hexCell = this.store.getHexCellById(hexId);
      if (!hexCell) return;
      
      // 检查六角格是否对当前阵营可见
      const isVisible = hexCell.visibility?.visibleTo ? 
        (hexCell.visibility.visibleTo[currentFaction] === true) : true;
      
      // 更新所有兵种实例的可见性
      forceInstance.unitInstanceMap.forEach(unitInstance => {
        if (unitInstance.currentModel) {
          unitInstance.currentModel.show = isVisible;
        }
      });
    });
    
    // 遍历所有六角格，更新不可见遮罩样式
    this.store.getHexCells().forEach(hexCell => {
      if (!hexCell) return;
      
      // 检查六角格是否对当前阵营可见
      const isVisible = hexCell.visibility?.visibleTo ? 
        (hexCell.visibility.visibleTo[currentFaction] === true) : true;
      
      // 根据可见性添加或删除不可见遮罩样式
      if (!isVisible) {
        // 添加不可见遮罩样式
        hexCell.addVisualStyle(HexVisualStyles.invisible);
      } else {
        // 删除不可见遮罩样式
        hexCell.removeVisualStyleByType('invisible');
      }
    });
  }

  /**
   * 渲染部队，新增的部队实例需要调用这个方法渲染到地图上，删除的不用
   * @param {Object} force 部队对象
   * @private
   */
  _renderForceInstance(force) {
    const forceInstance = this.forceInstanceMap.get(force.forceId);
    if (!forceInstance || !forceInstance.unitInstanceMap) return;
    
    // 遍历所有兵种实例，设置位置并添加到场景中
    forceInstance.unitInstanceMap.forEach(unitInstance => {
      const currentModel = unitInstance.currentModel;
      
      // 检查模型是否已经在场景中
      if (!this.viewer.scene.primitives.contains(currentModel)) {
        // 设置兵种模型位置和姿态
        currentModel.modelMatrix = this.poseCalculator.computeUnitModelMatrix(
          forceInstance.pose.position,
          forceInstance.pose.heading || 0
        );
        currentModel.allowPicking = true;
        
        // 添加到场景中
        this.viewer.scene.primitives.add(currentModel);
      }
    });
  }

  /**
   * 更新模型LOD（用于静止部队）
   * @private
   */
  _updateModelLOD(forceInstance) {
    const cameraPos = this.viewer.scene.camera.positionWC;

    forceInstance.unitInstanceMap.forEach(unitInstance => {
      // 获取当前模型位置用于计算与相机的距离
      const modelPos = Cesium.Matrix4.getTranslation(
        unitInstance.currentModel.modelMatrix,
        new Cesium.Cartesian3()
      );
      const distance = Cesium.Cartesian3.distance(cameraPos, modelPos);
      
      // 选择合适的 LOD 级别
      let targetLOD = 0;
      unitInstance.modelTemplate.lodModels.forEach((level, index) => {
        if (distance >= level.distance) {
          targetLOD = index;
        }
      });
      
      // 如果需要切换 LOD，并更新模型重新载入 primitives
      if (targetLOD !== unitInstance.currentLOD) {
        const targetModel = unitInstance.modelTemplate.lodModels[targetLOD].model.clone();
        // 保持原有位置
        targetModel.modelMatrix = unitInstance.currentModel.modelMatrix;
        targetModel.allowPicking = true;
        
        this.viewer.scene.primitives.remove(unitInstance.currentModel);
        this.viewer.scene.primitives.add(targetModel);
        
        unitInstance.currentModel = targetModel;
        unitInstance.currentLOD = targetLOD;
      }
    });
  }

  /**
   * 清理所有实例
   */
  dispose() {
    if (this._updateHandle) {
      this.viewer.scene.postUpdate.removeEventListener(this._updateHandle);
      this._updateHandle = null;
    }
    
    // 清理移动控制器
    this.movementController.dispose();
    
    // 清理单例
    MilitaryInstanceRenderer.#instance = null;
  }
}