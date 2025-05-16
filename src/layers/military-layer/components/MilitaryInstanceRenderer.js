/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { ModelInstanceLoader } from "./ModelInstanceLoader";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { MovementController } from "./MovementController";
import { ModelPoseCalculator } from "../utils/ModelPoseCalculator";
import { HexVisualStyles } from "@/config/HexVisualStyles";
import { MilitaryConfig } from "@/config/GameConfig";
import { HexRenderer } from "@/layers/scene-layer/components/HexGridRenderer";

/**
 * 军事单位实例渲染器
 * 
 * 主要职责：
 * 1. 管理部队模型的显示和渲染
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
    this.movementController = MovementController.getInstance(viewer);
    // 获取部队实例映射表
    this.forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap();
    // 更新循环监听器
    this._updateHandle = null;
    // LOD上次更新的时间
    this._lastLodUpdateTime = 0;
    // LOD更新间隔(毫秒) - 避免每帧都更新LOD
    this._lodUpdateInterval = 500;
    // 记录正在创建中的部队ID，避免重复创建
    this._creatingForceInstQueue = new Set();
  }

  /**
   * 重新生成所有部队实例
   */
  regenerateAllForceInstances() {
    // 获取当前存在的所有部队
    const allForces = this.store.getForces();
    
    // 首先清除所有现有实例
    this.forceInstanceMap.forEach((_, forceId) => {
      this.generator.removeForceInstanceById(forceId);
    });
    
    // 然后按顺序重新创建部队实例
    const renderPromises = allForces.map(force => this._renderForceInstance(force));
    
    // 等待所有渲染完成
    Promise.all(renderPromises).then(() => {
      console.log("所有部队实例已重新生成");
      this.update(); // 启动渲染循环
    }).catch(err => {
      console.error("重新生成部队实例时出错:", err);
    });
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
    // 如果未传入参数，则自行根据store中的部队列表，查漏补缺需要新增/删除的部队实例
    if (!newForceIds && !removedForceIds) {
      // 遍历所有存在的部队
      const allForces = this.store.getForces();
      const allForceIds = allForces.map(force => force.forceId);
      
      // 清理那些已从部队数据中删除，但仍然存在于forceInstanceMap中的部队实例
      for (const instanceId of this.forceInstanceMap.keys()) {
        if (!allForceIds.includes(instanceId)) {
          this.generator.removeForceInstanceById(instanceId);
        }
      }
      
      // 对存在于store中，但没有部队实例的部队，创建渲染实例
      allForces.forEach(force => {
        const existingInstance = this.forceInstanceMap.get(force.forceId);
        if (!existingInstance || !existingInstance.unitInstanceMap) {
          this._renderForceInstance(force);
        }
      });
      return;
    }
    
    // 对新的部队列表查漏补缺，确保所有部队都存在部队实例
    newForceIds.forEach(id => {
      // 如果部队实例不存在且不在当前创建队列中，则创建渲染实例
      if (!this.forceInstanceMap.has(id) && !this._creatingForceInstQueue.has(id)) {
        const force = this.store.getForceById(id);
        if (force) {
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
      const now = Date.now();
      const shouldUpdateLOD = !this._lastLodUpdateTime || (now - this._lastLodUpdateTime) >= this._lodUpdateInterval;
      
      this.forceInstanceMap.forEach((forceInstance, forceId) => {
        // 首先检查部队是否在移动中
        const isMoving = this.movementController.movingForces.has(forceId);
        
        if (isMoving) {
          // 移动中的部队：计算新位置并更新
          this.movementController.updateMovingForces(forceId);
        } 
        else if (shouldUpdateLOD) {
          // 静止部队：更新LOD
          this._updateModelLOD(forceInstance);
        }
      });
      
      // 只有当实际执行了LOD更新时才更新时间戳
      if (shouldUpdateLOD) {
        this._lastLodUpdateTime = now;
      }
      
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
    HexRenderer.renderMarkGrid();
  }

  /**
   * 初次渲染部队：
   *  - 计算每个兵种实例的模型位置并设置活跃模型
   *  - 如果实例不存在，则重新创建
   *  - 如果实例存在，则设置活跃模型
   * @param {Object} force 部队对象
   * @private
   */
  async _renderForceInstance(force) {
    // 检查部队ID是否有效
    if (!force || !force.forceId) {
      console.error("尝试渲染不存在的部队");
      return;
    }
    
    // 检查是否已存在该部队实例
    let forceInstance = this.forceInstanceMap.get(force.forceId);
    
    // 如果已在创建中，则直接返回
    if (this._creatingForceInstQueue.has(force.forceId)) {
      console.log(`部队[${force.forceId}]的实例正在创建中，跳过重复渲染`);
      return;
    }
    
    // 检查实例是否存在，如果不存在但在store中有记录，则重新创建
    if (!forceInstance || !forceInstance.unitInstanceMap) {
      // 检查该部队是否在store中存在
      const forceInStore = this.store.getForceById(force.forceId);
      if (forceInStore) {
        try {
          // 标记为正在创建
          this._creatingForceInstQueue.add(force.forceId);
          
          // 调用生成器创建实例
          forceInstance = await this.generator.createForceInstance(forceInStore);

          if (!forceInstance || !forceInstance.unitInstanceMap) {
            this._creatingForceInstQueue.delete(force.forceId);
            console.error(`重新创建部队实例失败: ${force.forceId}`);
            return;
          }
          
          this.forceInstanceMap.set(force.forceId, forceInstance);
          // 创建完成后移除标记
          this._creatingForceInstQueue.delete(force.forceId);
        } catch (error) {
          this._creatingForceInstQueue.delete(force.forceId);
          console.error(`创建部队实例时出错: ${force.forceId}`, error);
          return;
        }
      } else {
        console.error(`渲染部队实例失败: ${force.forceId} 不存在于store中`);
        return;
      }
    }
    
    // 为每个兵种实例初始化选择LOD级别并设置可见性
    const renderPromises = [];
    
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      const renderPromise = (async () => {
        try {
          // 如果已经有活跃模型，则不重复渲染
          if (unitInstance.activeModel) {
            return;
          }

          // 选择初始LOD
          const initialLOD = 2;
          
          if (!unitInstance.lodModels || !unitInstance.lodModels[initialLOD]) {
            console.error(`[MilitaryInstanceRenderer] 找不到LOD模型: ${unitInstanceId}`);
            return;
          }
          
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
          
          // 更新所有LOD模型的位置矩阵
          for (let i = 0; i < unitInstance.lodModels.length; i++) {
            const lodModel = unitInstance.lodModels[i];
            if (lodModel && lodModel.model) {
              // 复制模型矩阵到每个LOD模型
              Cesium.Matrix4.clone(modelMatrix, lodModel.model.modelMatrix);
            }
          }
          
          // 更新活跃模型状态
          unitInstance.activeLOD = initialLOD;
          unitInstance.activeModel = unitInstance.lodModels[initialLOD].model;

          // 更新部队实例的可见性
          this.updateHexObjectVisibility();

        } catch (error) {
          console.error(`[MilitaryInstanceRenderer] 渲染实例失败: ${unitInstanceId}`, error);
        }
      })();
      
      renderPromises.push(renderPromise);
    });
    
    // 等待所有渲染任务完成
    await Promise.all(renderPromises);
  }

  /**
   * 为模型添加移动动画
   * @param {Object} unitInstance 兵种实例
   * @returns {Promise} 添加动画完成的Promise
   */
  async addMoveAnimation(unitInstance) {
    // 如果无效参数，立即返回已解决的Promise
    if (!unitInstance || !unitInstance.activeModel) {
      return Promise.resolve();
    }
    
    try {
      // 首先移除当前动画（如果存在）
      this.removeMoveAnimation(unitInstance);
      
      // 检查模型是否支持动画
      const modelConfig = MilitaryConfig.models[unitInstance.renderingKey];
      const hasAnimations = modelConfig && modelConfig.animationList && modelConfig.animationList.length > 0;
      if (!hasAnimations) {
        return Promise.resolve(); // 不支持动画的模型直接返回
      }
      
      // 加载模型动画配置
      let animConfig;
      
      // 加载移动动画
      if (unitInstance.renderingKey === 'soldier') {
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[1];
      } 
      else if (unitInstance.renderingKey === 'helicopter1' || unitInstance.renderingKey === 'helicopter2') {
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[0];
      }
      
      // 如果找到了动画配置，添加动画
      if (animConfig) {
        unitInstance.activeAnimation = unitInstance.activeModel.activeAnimations.add({
          name: animConfig.name,
          loop: animConfig.loop
        });
        console.log(`成功添加移动动画到模型: ${unitInstance.renderingKey}`);
      }
      
      return Promise.resolve();
    } catch (e) {
      console.warn(`添加移动动画失败: ${unitInstance.renderingKey}`, e);
      return Promise.reject(e);
    }
  }

  /** 
   * 移除移动动画
   * @param {Object} unitInstance 兵种实例
   */
  removeMoveAnimation(unitInstance) {
    if (unitInstance.activeAnimation) {
      unitInstance.activeModel.activeAnimations.remove(unitInstance.activeAnimation);
      unitInstance.activeAnimation = null;
    }
  }

  /**
   * 更新模型LOD
   * @private
   */
  async _updateModelLOD(forceInstance) {
    // 获取相机位置，用于计算距离
    const cameraPos = this.viewer.scene.camera.positionWC;
    
    // 确保forceInstance有效
    if (!forceInstance || !forceInstance.unitInstanceMap || !forceInstance.force) {
      console.warn("无效的forceInstance，跳过LOD更新");
      return;
    }
    
    // 创建LOD更新任务
    const updatePromises = [];
   
    // 为所有兵种实例创建异步更新任务
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      // 保存forceId到unitInstance，确保动画状态检测正确
      if (forceInstance.force && forceInstance.force.forceId) {
        unitInstance.forceId = forceInstance.force.forceId;
      }
      
      const updatePromise = (async () => {
        try {
          // 忽略没有显示模型的实例
          if (!unitInstance.activeModel || unitInstance.activeLOD < 0) {
            return;
          }
          
          // 获取当前模型位置
          const modelPos = new Cesium.Cartesian3();
          try {
            Cesium.Matrix4.getTranslation(unitInstance.activeModel.modelMatrix, modelPos);
          } catch (e) {
            console.warn(`[MilitaryInstanceRenderer] 获取模型位置失败: ${unitInstanceId}`, e);
            return;
          }
          
          // 计算与相机的距离
          const distance = Cesium.Cartesian3.distance(cameraPos, modelPos);
          
          // 选择当前距离对应的的LOD级别
          let targetLOD = 0;
          for (let i = 0; i < unitInstance.lodModels.length; i++) {
            const lod = unitInstance.lodModels[i]; 
            if (distance >= lod.distance) {
              targetLOD = i;
            }
          }
          
          // 如果需要切换LOD且目标LOD有效
          if (targetLOD !== unitInstance.activeLOD) {
            // 获取当前和目标LOD模型配置
            const currentLodModel = unitInstance.lodModels[unitInstance.activeLOD];
            const targetLodModel = unitInstance.lodModels[targetLOD];
            
            // 获取当前和目标LOD的距离
            const oldDistance = currentLodModel.distance;
            const newDistance = targetLodModel.distance;
            // 位于这个分界线前后则不进行LOD切换，防止LOD切换频繁震荡
            const boundary = Math.max(oldDistance, newDistance);
            if (distance >= boundary * 0.9 && distance <= boundary * 1.1) {
              return;
            }
               
            // 先停止旧模型上的动画
            if (unitInstance.activeAnimation) {
              unitInstance.activeModel.activeAnimations.remove(unitInstance.activeAnimation);
              unitInstance.activeAnimation = null;
            } 
            
            // 复制当前模型的位置矩阵到目标模型，并隐藏原来的模型
            if (currentLodModel.model !== targetLodModel.model) {
              // 新模型可见性等于上个模型，因为可能上个模型处于视野范围外，是隐藏的
              Cesium.Matrix4.clone(currentLodModel.model.modelMatrix, targetLodModel.model.modelMatrix);
              targetLodModel.model.show = currentLodModel.model.show;
              unitInstance.activeLOD = targetLOD;
              unitInstance.activeModel = targetLodModel.model;
              currentLodModel.model.show = false;
            }

            // 移除动画
            this.removeMoveAnimation(unitInstance);
          }
        } catch (error) {
          console.error(`[MilitaryInstanceRenderer] 更新LOD处理失败: ${unitInstanceId}`, error);
        }
      })();
      
      updatePromises.push(updatePromise);
    });
    
    // 等待所有LOD更新任务完成
    try {
      await Promise.all(updatePromises);
    } catch (error) {
      console.error(`LOD批量更新失败:`, error);
    }
  }
  
  /**
   * 清理所有实例
   */
  dispose() {
    if (this._updateHandle) {
      try {
        this.viewer.scene.postUpdate.removeEventListener(this._updateHandle);
      } catch (e) {
        console.warn("移除场景更新监听器失败", e);
      }
      this._updateHandle = null;
    }
    
    // 清理移动控制器
    this.movementController.dispose();
    
    // 清理场景中的所有模型
    try {
      this.forceInstanceMap.forEach((forceInstance) => {
        forceInstance.unitInstanceMap.forEach((unitInstance) => {
          // 清理所有LOD模型
          if (unitInstance.lodModels) {
            unitInstance.lodModels.forEach(lodModel => {
              if (lodModel && lodModel.model && !lodModel.model.isDestroyed()) {
                try {
                  this.viewer.scene.primitives.remove(lodModel.model);
                } catch (e) {
                  console.warn(`清理模型失败: ${e.message}`);
                }
              }
            });
          }
        });
      });
    } catch (e) {
      console.error("清理模型资源时出错", e);
    }
    
    // 清理单例
    MilitaryInstanceRenderer.#instance = null;
  }
}