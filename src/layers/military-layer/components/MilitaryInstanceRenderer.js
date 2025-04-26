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
      this.renderForceInstance(force);
    });
    this.update();
  }

  /**
   * 渲染部队
   * @param {Object} force 部队对象
   */
  renderForceInstance(force) {
    const forceInstance = this.forceInstanceMap.get(force.forceId);
    if (!forceInstance || !forceInstance.unitInstanceMap) return;

    // 遍历所有兵种实例，设置位置并添加到场景中
    forceInstance.unitInstanceMap.forEach(unitInstance => {
      const currentModel = unitInstance.currentModel;
      
      // 检查模型是否已经在场景中
      if (!this.viewer.scene.primitives.contains(currentModel)) {
        // 设置兵种模型位置和姿态
        currentModel.modelMatrix = this.poseCalculator.computeUnitModelMatrix(
          forceInstance.pose,
          unitInstance.localOffset,
          forceInstance.force.hexId
        );
        currentModel.allowPicking = true;
        
        // 添加到场景中
        this.viewer.scene.primitives.add(currentModel);
      } else {
        console.warn(`禁止重复渲染兵种模型！`);
      }
    });
  }

  /**
   * 处理部队数量变化（新增或删除部队）
   */
  syncForcesChange(newForceIds, oldForceIds) {
    // 添加新部队
    newForceIds.forEach(id => {
      if (!this.forceInstanceMap.has(id)) {
        const force = this.store.getForceById(id);
        if (force) this.generator.createForceInstance(force);
      }
    });

    // 移除旧部队
    oldForceIds.forEach(id => {
      if (!newForceIds.includes(id)) {
        this.generator.removeForceInstanceById(id);
      }
    });
  }

  /**
   * 控制部队沿着路径移动
   * @param {string} forceId 部队ID
   * @param {string[]} path 路径（六角格ID数组）
   */
  moveForceAlongPath(forceId, path) {
    if (!path || path.length < 2) {
      console.warn("路径过短，无法进行移动");
      return;
    }
    
    const forceInstance = this.forceInstanceMap.get(forceId);
    if (!forceInstance) {
      console.error(`未找到部队实例: ${forceId}`);
      return;
    }
    
    // 向移动控制器发起开始移动的请求
    this.movementController.startMove(forceId, path);
    
    // 确保更新循环已启动
    this.update();
    
    // 返回移动操作已开始的标志，可用于UI反馈
    return true;
  }

  /**
   * 启动更新循环，每帧执行一次
   */
  update() {
    if (this._updateHandle) return;
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 更新所有部队
      this.forceInstanceMap.forEach((forceInstance, forceId) => {
        // 首先检查部队是否在移动中（不计算位置，只检查状态）
        const isMoving = this.movementController.movingForces.has(forceId);
        
        if (isMoving) {
          // 移动中的部队：计算新位置并更新
          this._updateMovingModels(forceInstance);
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
   * 清理所有实例
   */
  dispose() {
    if (this._updateHandle) {
      this.viewer.scene.postUpdate.removeEventListener(this._updateHandle);
      this._updateHandle = null;
    }
    
    this.forceInstanceMap.forEach(forceInstance => {
      forceInstance.unitInstanceMap.forEach(unitInstance => {
        this.viewer.scene.primitives.remove(unitInstance.currentModel);
      });
    });
    this.forceInstanceMap.clear();
    
    // 清理移动控制器
    this.movementController.dispose();
    
    // 清理单例
    MilitaryInstanceRenderer.#instance = null;
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
   * 更新移动中的模型位置和朝向
   * @private
   */
  _updateMovingModels(forceInstance) {
    if (!forceInstance || !forceInstance.pose) return;
    
    // TODO:在这里利用movecontroller每帧更新部队模型位置
    // ...
  }
}
