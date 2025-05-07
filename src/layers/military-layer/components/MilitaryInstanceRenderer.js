/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
// import { HexForceMapper } from '@/utils/HexForceMapper';
import { ModelInstanceLoader } from "./ModelInstanceLoader";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { MilitaryMovementController } from "./MilitaryMovementController";
import { ModelPoseCalculator } from "./ModelPoseCalculator";
import { HexForceMapper } from "@/layers/interaction-layer/utils/HexForceMapper";
import { HexVisualStyles } from "@/config/HexVisualStyles";
import { MilitaryConfig } from "@/config/GameConfig";

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
    // LOD更新累积时间计数器
    this._lodUpdateTime = 0;
    // LOD更新间隔(毫秒) - 避免每帧都更新LOD
    this._lodUpdateInterval = 500;
  }

  /**
   * 重新生成所有部队实例
   */
  regenerateAllForceInstances() {
    this.store.getForces().forEach(force => {
      // 移除部队实例
      this.generator.removeForceInstanceById(force.forceId);
      // 创建新的部队实例
      this.generator.createForceInstance(force)
        .then(() => {
          // 将新的部队实例渲染到地图上
          this._renderForceInstance(force);
        })
        .catch(console.error);
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
    console.log(`进入渲染所有部队实例`);
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
        console.log(`渲染部队实例: ${force.forceId}`);
        // 检查部队是否已有实例
        if (!this.forceInstanceMap.has(force.forceId)) {
          // 对于没有实例的部队，创建实例
          this.generator.createForceInstance(force)
            .then(() => {
              // 将新的部队实例渲染到地图上
              this._renderForceInstance(force);
            })
            .catch(console.error);
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
          this.generator.createForceInstance(force)
            .then(() => {
              // 将新的部队实例渲染到地图上
              this._renderForceInstance(force);
            })
            .catch(console.error);
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
          // 静止部队：间隔性更新LOD
          const deltaTime = this.viewer.clock.delta * 1000; // 转换为毫秒
          this._lodUpdateTime += deltaTime;
          if (this._lodUpdateTime >= this._lodUpdateInterval) {
            // 到达更新间隔，进行LOD更新
            this._updateModelLOD(forceInstance);
            
            // 重置计时器
            this._lodUpdateTime = 0;
          }
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
        if (unitInstance.activeModel) {
          unitInstance.activeModel.show = isVisible;
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
  async _renderForceInstance(force) {
    const forceInstance = this.forceInstanceMap.get(force.forceId);
    if (!forceInstance || !forceInstance.unitInstanceMap) {
      console.log(`渲染部队实例失败: ${forceInstance}`);
      return;
    }
    
    // 为每个兵种实例初始化选择LOD级别并添加到场景
    const renderPromises = [];
    
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      const renderPromise = (async () => {
        try {
          // 如果已经有激活的模型，跳过
          if (unitInstance.activeModel) return;
          
          // 选择初始LOD（默认最低级别）
          const initialLOD = 0;
          
          if (!unitInstance.lodModels || !unitInstance.lodModels[initialLOD]) {
            console.error(`[MilitaryInstanceRenderer] 找不到LOD模型: ${unitInstanceId}`);
            return;
          }
          
          // 获取当前LOD模型
          const lodModel = unitInstance.lodModels[initialLOD];

          // 应该先计算每个兵种相对于部队位置的偏移
          const unitPos = this.poseCalculator.computeUnitPosition({
            forcePose: forceInstance.pose,
            localOffset: unitInstance.localOffset,
            hexId: force.hexId
          });

          // 然后计算兵种对应的每个模型加上偏移后在地球上的位置
          const modelMatrix = this.poseCalculator.computeModelMatrix(
            unitPos.position,
            forceInstance.pose.heading || 0,
            unitInstance.offset
          );
          
          // 复制模型矩阵到模型
          Cesium.Matrix4.clone(modelMatrix, lodModel.model.modelMatrix);
         
          // 添加到场景
          this.viewer.scene.primitives.add(lodModel.model);
          
          // 更新实例状态
          unitInstance.activeLOD = initialLOD;
          unitInstance.activeModel = lodModel.model;

          console.log(`[MilitaryInstanceRenderer] 渲染实例: ${unitInstanceId}`, unitInstance.activeModel);
        } catch (error) {
          console.error(`[MilitaryInstanceRenderer] 渲染实例失败: ${unitInstanceId}`, error);
        }
      })();
      
      renderPromises.push(renderPromise);
    });
    
    // 等待所有渲染任务完成
    await Promise.all(renderPromises);

    // 等2秒后更新动画
    await new Promise(resolve => setTimeout(resolve, 10000));
    await this.updateAnimation(forceInstance, 'still');
  }

  /**
   * 更新动画
   * @param {Object} forceInstance 部队实例
   * @param {string} status 动画状态 - still: 静止, move: 移动
   * @private
   */
  async updateAnimation(forceInstance, animationName) {
    forceInstance.unitInstanceMap.forEach(unitInstance => {
      if (!unitInstance.activeModel) return;
      if (unitInstance.renderingKey === 'soldier') {
        if (animationName === 'still') {
          unitInstance.activeModel.activeAnimations.add(
            MilitaryConfig.models[unitInstance.renderingKey].animationList[0]
          );
        }
        else if (animationName === 'move') {
          unitInstance.activeModel.activeAnimations.add(
            MilitaryConfig.models[unitInstance.renderingKey].animationList[1]
          );
        }
      }
      if (unitInstance.renderingKey === 'helicopter1' || unitInstance.renderingKey === 'helicopter2') {
        unitInstance.activeModel.activeAnimations.add(
          MilitaryConfig.models[unitInstance.renderingKey].animationList[0]
        );
      }
    });
  }

  /**
   * 更新模型LOD（用于静止部队）
   * @private
   */
  async _updateModelLOD(forceInstance) {
    // 获取相机位置，用于计算距离
    const cameraPos = this.viewer.scene.camera.positionWC;
    
    // 为所有兵种实例更新LOD
    const updatePromises = [];
    
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      // 创建异步更新任务
      const updatePromise = (async () => {
        try {
          // 忽略没有激活模型的实例
          if (!unitInstance.activeModel || unitInstance.activeLOD < 0) return;
          
          // 获取当前模型位置
          const modelPos = Cesium.Matrix4.getTranslation(
            unitInstance.activeModel.modelMatrix,
            new Cesium.Cartesian3()
          );
          
          // 计算与相机的距离
          const distance = Cesium.Cartesian3.distance(cameraPos, modelPos);
          
          // 选择合适的LOD级别
          let targetLOD = 0;
          for (let i = 0; i < unitInstance.lodModels.length; i++) {
            const lod = unitInstance.lodModels[i];
            if (distance >= lod.distance) {
              targetLOD = i;
            }
          }
          
          // 如果需要切换LOD
          if (targetLOD !== unitInstance.activeLOD) {
            // 获取目标LOD模型
            const nextLodModel = unitInstance.lodModels[targetLOD];
            if (!nextLodModel || !nextLodModel.model) {
              console.warn(`[MilitaryInstanceRenderer] 找不到LOD模型: ${unitInstanceId}, level=${targetLOD}`);
              return;
            }

            // 切换lod
            console.log(`[MilitaryInstanceRenderer] 切换LOD: ${unitInstanceId}`, targetLOD);
            
            // 保存当前模型矩阵
            const modelMatrix = Cesium.Matrix4.clone(unitInstance.activeModel.modelMatrix);
            
            // 从场景中移除当前模型
            this.viewer.scene.primitives.remove(unitInstance.activeModel);
            
            // 应用原始模型矩阵到新模型
            Cesium.Matrix4.clone(modelMatrix, nextLodModel.model.modelMatrix);
            
            // 添加新LOD模型到场景
            this.viewer.scene.primitives.add(nextLodModel.model);
            
            // 更新实例状态
            unitInstance.activeLOD = targetLOD;
            unitInstance.activeModel = nextLodModel.model;
          }
        } catch (error) {
          console.error(`[MilitaryInstanceRenderer] 更新LOD失败: ${unitInstanceId}`, error);
        }
      })();
      
      updatePromises.push(updatePromise);
    });
    
    // 等待所有更新任务完成
    await Promise.all(updatePromises);
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