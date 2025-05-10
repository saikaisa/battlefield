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
import { HexRenderer } from "@/layers/scene-layer/components/HexGridRenderer";

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
    // LOD上次更新的时间
    this._lastLodUpdateTime = 0;
    // LOD更新间隔(毫秒) - 避免每帧都更新LOD
    this._lodUpdateInterval = 500;
    // 记录正在创建中的部队ID，避免重复创建
    this._creatingForceInstQueue = new Set();
    
    // 💡新增: 场景更新请求
    this._needsRender = false;
    
    // 💡新增: 启用requestRenderMode并添加场景更新监听
    if (this.viewer.scene.requestRenderMode) {
      // 添加场景渲染后回调，用于控制下一帧是否需要渲染
      this.viewer.scene.postRender.addEventListener(() => {
        if (this._needsRender) {
          // 如果需要再次渲染，请求下一帧渲染
          this.viewer.scene.requestRender();
          this._needsRender = false;
        }
      });
    }
  }

  /**
   * 请求渲染下一帧 - 当场景需要更新时调用
   * @private
   */
  _requestRender() {
    if (this.viewer.scene.requestRenderMode) {
      this._needsRender = true;
      this.viewer.scene.requestRender();
    }
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
    
    // 将LOD更新间隔增加到1000毫秒，减少更新频率
    this._lodUpdateInterval = 1000;
    
    // 添加: 动画更新控制
    this._animUpdateInterval = 200; // 动画更新间隔(毫秒)
    this._lastAnimUpdateTime = 0;
    this._animationUpdateCounter = 0; // 用于控制轮流更新动画
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 更新所有部队
      const now = Date.now();
      const shouldUpdateLOD = !this._lastLodUpdateTime || (now - this._lastLodUpdateTime) >= this._lodUpdateInterval;
      const shouldUpdateAnim = !this._lastAnimUpdateTime || (now - this._lastAnimUpdateTime) >= this._animUpdateInterval;
      
      // 优化: 仅在必要时更新LOD和动画
      if (shouldUpdateLOD) {
        // 降低动画处理频率
        this._lastLodUpdateTime = now;
        
        this.forceInstanceMap.forEach((forceInstance, forceId) => {
          const isMoving = this.movementController.movingForces.has(forceId);
          
          if (isMoving) {
            // 移动中的部队：计算新位置并更新
            this.movementController.updateMovingForces(forceId);
          } else {
            // 静止部队：更新LOD
            this._updateModelLOD(forceInstance);
          }
        });
      } else if (shouldUpdateAnim) {
        // 更新动画计数器
        this._lastAnimUpdateTime = now;
        
        // 动画更新 - 每次只更新部分部队的动画（轮流制）
        // 获取所有正在移动的部队
        const movingForceIds = Array.from(this.movementController.movingForces.keys());
        
        if (movingForceIds.length > 0) {
          // 只更新一小部分部队的动画，每次循环更新不同的部队
          const updateCount = Math.max(1, Math.ceil(movingForceIds.length / 4));
          const startIndex = this._animationUpdateCounter % movingForceIds.length;
          
          for (let i = 0; i < updateCount; i++) {
            const index = (startIndex + i) % movingForceIds.length;
            const forceId = movingForceIds[index];
            
            const forceInstance = this.forceInstanceMap.get(forceId);
            if (forceInstance) {
              this.movementController.updateMovingForces(forceId);
            }
          }
          
          // 更新计数器
          this._animationUpdateCounter++;
        }
      }
      
      // 清理已完成移动的部队
      this.movementController.cleanupFinishedMovements();
      
      // 在上面update方法的批量部队更新后调用（位置约在 this._animationUpdateCounter++ 后）
      this._requestRender();
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
          console.log(`成功创建部队实例: ${force.forceId}`);
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

          console.log(`[MilitaryInstanceRenderer] 渲染实例: ${unitInstanceId}, 初始LOD=${initialLOD}`);
          
          // 为特定兵种添加默认idle动画 - 使用非异步方法
          if (unitInstance.renderingKey === 'soldier' || 
              unitInstance.renderingKey === 'helicopter1' || 
              unitInstance.renderingKey === 'helicopter2') {
            this._addAnimationNonAsync(unitInstance, 'idle');
          }
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
   * 为模型添加动画
   * @param {Object} unitInstance 兵种实例
   * @param {string} status 动画状态 - 'idle': 静止, 'moving': 移动
   * @returns {Promise} 添加动画完成的Promise
   */
  async addAnimation(unitInstance, status) {
    // 如果无效参数，立即返回已解决的Promise
    if (!unitInstance || !unitInstance.activeModel) {
      return Promise.resolve();
    }
    
    try {
      // 首先移除当前动画（如果存在）
      if (unitInstance.activeAnimation) {
        unitInstance.activeModel.activeAnimations.remove(unitInstance.activeAnimation);
        unitInstance.activeAnimation = null;
      }
      
      // 检查模型是否支持动画
      const modelConfig = MilitaryConfig.models[unitInstance.renderingKey];
      const hasAnimations = modelConfig && modelConfig.animationList && modelConfig.animationList.length > 0;
      if (!hasAnimations) {
        return Promise.resolve(); // 不支持动画的模型直接返回
      }
      
      // 加载模型动画配置
      let animConfig;
      
      // 根据模型类型和状态选择合适的动画
      if (unitInstance.renderingKey === 'soldier') {
        // 士兵有idle和moving两种状态
        const animationIndex = status === 'moving' ? 1 : 0; // 0是idle, 1是moving
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[animationIndex];
      } 
      else if (unitInstance.renderingKey === 'helicopter1' || unitInstance.renderingKey === 'helicopter2') {
        // 直升机只有一种动画（旋翼旋转），无论什么状态
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[0];
      }
      
      // 如果找到了动画配置，添加动画
      if (animConfig) {
        unitInstance.activeAnimation = unitInstance.activeModel.activeAnimations.add({
          name: animConfig.name,
          loop: animConfig.loop,
          // 只使用安全的动画参数
          multiplier: 1.0,
          delay: 0.0
        });
        console.log(`成功添加${status}动画到模型: ${unitInstance.renderingKey}`);
      }
      
      return Promise.resolve();
    } catch (e) {
      console.warn(`添加动画失败: ${unitInstance.renderingKey}，状态: ${status}`, e);
      return Promise.reject(e);
    }
  }

  /**
   * 非异步添加动画方法，减少Promise开销
   * @param {Object} unitInstance 兵种实例
   * @param {string} status 动画状态 - 'idle': 静止, 'moving': 移动
   */
  _addAnimationNonAsync(unitInstance, status) {
    if (!unitInstance || !unitInstance.activeModel) return;
    
    try {
      // 首先移除当前动画（如果存在）
      if (unitInstance.activeAnimation) {
        unitInstance.activeModel.activeAnimations.remove(unitInstance.activeAnimation);
        unitInstance.activeAnimation = null;
      }
      
      // 检查模型是否支持动画
      const modelConfig = MilitaryConfig.models[unitInstance.renderingKey];
      const hasAnimations = modelConfig && modelConfig.animationList && modelConfig.animationList.length > 0;
      if (!hasAnimations) return; // 不支持动画的模型直接返回
      
      // 加载模型动画配置
      let animConfig;
      
      // 根据模型类型和状态选择合适的动画
      if (unitInstance.renderingKey === 'soldier') {
        // 士兵有idle和moving两种状态
        const animationIndex = status === 'moving' ? 1 : 0; // 0是idle, 1是moving
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[animationIndex];
      } 
      else if (unitInstance.renderingKey === 'helicopter1' || unitInstance.renderingKey === 'helicopter2') {
        // 直升机只有一种动画（旋翼旋转），无论什么状态
        animConfig = MilitaryConfig.models[unitInstance.renderingKey].animationList[0];
      }
      
      // 如果找到了动画配置，添加动画
      if (animConfig) {
        unitInstance.activeAnimation = unitInstance.activeModel.activeAnimations.add({
          name: animConfig.name,
          loop: animConfig.loop,
          // 只使用安全的动画参数
          multiplier: 1.0,
          delay: 0.0
        });
      }
    } catch (e) {
      console.warn(`添加动画失败: ${unitInstance.renderingKey}，状态: ${status}`, e);
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
    
    // 批量处理而不是创建单独的Promise
    const unitsToUpdate = [];
    
    // 收集需要LOD更新的单元
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      // 保存forceId到unitInstance，确保动画状态检测正确
      if (forceInstance.force && forceInstance.force.forceId) {
        unitInstance.forceId = forceInstance.force.forceId;
      }
      
      // 忽略没有显示模型或无效实例的单元
      if (!unitInstance.activeModel || unitInstance.activeLOD < 0) return;
      
      // 获取当前模型位置
      const modelPos = new Cesium.Cartesian3();
      try {
        Cesium.Matrix4.getTranslation(unitInstance.activeModel.modelMatrix, modelPos);
        
        // 计算与相机的距离
        const distance = Cesium.Cartesian3.distance(cameraPos, modelPos);
        
        // 💡 新增: 动画距离控制 - 仅在2000米以内播放动画
        const ANIMATION_DISTANCE_THRESHOLD = 2000;
        const shouldPlayAnimation = distance <= ANIMATION_DISTANCE_THRESHOLD;
        
        // 如果超过动画距离且当前有动画在播放，停止动画
        if (!shouldPlayAnimation && unitInstance.activeAnimation) {
          unitInstance.activeModel.activeAnimations.removeAll();
          unitInstance.activeAnimation = null;
        }
        
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
          
          // 扩大LOD切换阈值，避免频繁切换
          // 距离界限的±15%范围内不进行LOD切换，减少震荡
          const boundary = Math.max(oldDistance, newDistance);
          if (distance >= boundary * 0.85 && distance <= boundary * 1.15) {
            return; // 在阈值内不切换LOD
          }
          
          // 收集需要更新的单元，并携带动画控制信息
          unitsToUpdate.push({
            unitInstance,
            unitInstanceId,
            targetLOD,
            currentLodModel,
            targetLodModel,
            shouldPlayAnimation
          });
        } else if (shouldPlayAnimation) {
          // 💡 新增：如果在动画阈值内，但没有动画在播放，且不需要LOD切换，添加动画
          const isMoving = unitInstance.forceId ? 
            this.movementController.movingForces.has(unitInstance.forceId) : false;

          // 只为特定兵种添加动画
          if (!unitInstance.activeAnimation && 
              (unitInstance.renderingKey === 'soldier' || 
               unitInstance.renderingKey === 'helicopter1' || 
               unitInstance.renderingKey === 'helicopter2')) {
            this._addAnimationNonAsync(unitInstance, isMoving ? 'moving' : 'idle');
          }
        }
      } catch (e) {
        console.warn(`[MilitaryInstanceRenderer] 获取模型位置失败: ${unitInstanceId}`, e);
      }
    });
    
    // 如果没有需要更新的单元，直接返回
    if (unitsToUpdate.length === 0) return;
    
    // 批量处理所有需要更新的单元
    for (const {unitInstance, unitInstanceId, targetLOD, currentLodModel, targetLodModel, shouldPlayAnimation} of unitsToUpdate) {
      try {
        // 先停止旧模型上的动画
        if (unitInstance.activeAnimation) {
          unitInstance.activeModel.activeAnimations.remove(unitInstance.activeAnimation);
          unitInstance.activeAnimation = null;
        } 
        
        // 复制当前模型的位置矩阵到目标模型，并更新可见性
        if (currentLodModel.model !== targetLodModel.model) {
          // 新模型可见性等于上个模型，因为可能上个模型处于视野范围外，是隐藏的
          Cesium.Matrix4.clone(currentLodModel.model.modelMatrix, targetLodModel.model.modelMatrix);
          targetLodModel.model.show = currentLodModel.model.show;
          unitInstance.activeLOD = targetLOD;
          unitInstance.activeModel = targetLodModel.model;
          currentLodModel.model.show = false;
        }
        
        // 检查当前的移动状态
        const isMoving = unitInstance.forceId ? 
          this.movementController.movingForces.has(unitInstance.forceId) : false;
        
        // 💡修改：仅在距离阈值内且为特定兵种添加动画
        if (shouldPlayAnimation && (unitInstance.renderingKey === 'soldier' || 
            unitInstance.renderingKey === 'helicopter1' || 
            unitInstance.renderingKey === 'helicopter2')) {
          const animStatus = isMoving ? 'moving' : 'idle';
          this._addAnimationNonAsync(unitInstance, animStatus);
        }
      } catch (error) {
        console.error(`[MilitaryInstanceRenderer] LOD切换失败: ${unitInstanceId}`, error);
      }
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