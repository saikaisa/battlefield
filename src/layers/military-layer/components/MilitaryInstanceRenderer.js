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
  async regenerateAllForceInstances() {
    const forces = this.store.getForces();
    console.log(`重新生成所有部队实例，共${forces.length}个部队`);
    
    // 按顺序处理每个部队，减少并行操作
    for (const force of forces) {
      // 移除部队实例
      this.generator.removeForceInstanceById(force.forceId);
      
      // 创建新的部队实例
      const forceInstance = await this.generator.createForceInstance(force);
      
      // 检查实例是否创建成功且已就绪
      if (forceInstance && forceInstance.isReady) {
        // 渲染部队实例
        await this._renderForceInstance(force);
      } else {
        console.error(`部队实例创建失败或未就绪: ${force.forceId}`);
      }
    }
    
    // 启动更新循环
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
  async updateForceInstance(newForceIds, removedForceIds) {
    console.log(`开始更新部队实例渲染`);
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
      for (const force of allForces) {
        console.log(`检查部队实例: ${force.forceId}`);
        
        // 检查部队是否已有实例
        if (!this.forceInstanceMap.has(force.forceId)) {
          // 对于没有实例的部队，创建实例
          console.log(`创建新部队实例: ${force.forceId}`);
          const forceInstance = await this.generator.createForceInstance(force);
          
          // 检查实例是否创建成功且已就绪
          if (forceInstance && forceInstance.isReady) {
            // 渲染部队实例
            await this._renderForceInstance(force);
          } else {
            console.error(`部队实例创建失败或未就绪: ${force.forceId}`);
          }
        } else {
          // 对于已有实例的部队，检查是否需要渲染
          const forceInstance = this.forceInstanceMap.get(force.forceId);
          
          if (forceInstance.isReady) {
            // 检查是否所有的兵种实例都已经有激活的模型
            const needsRendering = this._needsRendering(forceInstance);
            
            if (needsRendering) {
              // 如果需要渲染，则调用渲染方法
              console.log(`部队实例需要渲染: ${force.forceId}`);
              await this._renderForceInstance(force);
            }
          } else {
            console.log(`部队实例尚未就绪，跳过渲染: ${force.forceId}`);
          }
        }
      }
      return;
    }
    
    // 移除已删除部队的渲染实例
    if (removedForceIds && removedForceIds.length > 0) {
      for (const forceId of removedForceIds) {
        this.generator.removeForceInstanceById(forceId);
      }
    }
    
    // 为新的部队ID列表中不在forceInstanceMap里的部队创建渲染实例并渲染
    if (newForceIds && newForceIds.length > 0) {
      for (const forceId of newForceIds) {
        if (!this.forceInstanceMap.has(forceId)) {
          const force = this.store.getForceById(forceId);
          if (force) {
            // 创建并渲染部队实例
            const forceInstance = await this.generator.createForceInstance(force);
            
            // 检查实例是否创建成功且已就绪
            if (forceInstance && forceInstance.isReady) {
              // 渲染部队实例
              await this._renderForceInstance(force);
            } else {
              console.error(`部队实例创建失败或未就绪: ${forceId}`);
            }
          }
        }
      }
    }
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
        // 首先检查部队是否就绪
        if (!forceInstance.isReady) return;
        
        // 检查部队是否在移动中
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
      // 检查部队实例是否就绪
      if (!forceInstance.isReady) return;
      
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
   * 检查部队实例是否需要渲染
   * @private
   * @param {Object} forceInstance 部队实例
   * @returns {boolean} 是否需要渲染
   */
  _needsRendering(forceInstance) {
    if (!forceInstance || !forceInstance.unitInstanceMap || forceInstance.unitInstanceMap.size === 0) {
      return false;
    }
    
    // 检查是否有任何兵种实例缺少激活的模型
    for (const unitInstance of forceInstance.unitInstanceMap.values()) {
      if (!unitInstance.activeModel) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 渲染部队，新增的部队实例需要调用这个方法渲染到地图上，删除的不用
   * @param {Object} force 部队对象
   * @private
   */
  async _renderForceInstance(force) {
    const forceInstance = this.forceInstanceMap.get(force.forceId);
    if (!forceInstance) {
      console.error(`渲染失败: 找不到部队实例 ${force.forceId}`);
      return;
    }
    
    if (!forceInstance.isReady) {
      console.log(`部队实例尚未就绪，无法渲染: ${force.forceId}`);
      return;
    }
    
    if (!forceInstance.unitInstanceMap || forceInstance.unitInstanceMap.size === 0) {
      console.log(`部队 ${force.forceId} 没有兵种实例可渲染`);
      return;
    }
    
    console.log(`开始渲染部队实例: ${force.forceId}, 兵种数量: ${forceInstance.unitInstanceMap.size}`);
    
    // 为每个兵种实例初始化选择LOD级别并添加到场景
    // 逐个渲染模型，不使用Promise.all并行渲染
    for (const [unitInstanceId, unitInstance] of forceInstance.unitInstanceMap.entries()) {
      try {
        // 如果已经有激活的模型，跳过
        if (unitInstance.activeModel) {
          console.log(`跳过已渲染的兵种实例: ${unitInstanceId}`);
          continue;
        }
        
        // 选择初始LOD（默认最低级别）
        const initialLOD = 0;
        
        if (!unitInstance.lodModels || unitInstance.lodModels.length === 0) {
          console.error(`找不到LOD模型列表: ${unitInstanceId}`);
          continue;
        }
        
        if (!unitInstance.lodModels[initialLOD]) {
          console.error(`找不到初始LOD模型: ${unitInstanceId}, level=${initialLOD}`);
          continue;
        }
        
        // 获取当前LOD模型
        const lodModel = unitInstance.lodModels[initialLOD];
        
        // 检查模型对象是否存在
        if (!lodModel.model) {
          console.error(`LOD模型对象不存在: ${unitInstanceId}, level=${initialLOD}`);
          continue;
        }

        // 应该先计算每个兵种相对于部队位置的偏移
        const unitPos = await this.poseCalculator.computeUnitPosition({
          forcePose: forceInstance.pose,
          localOffset: unitInstance.localOffset,
          hexId: force.hexId
        });

        // 检查计算的位置是否有效
        if (!unitPos || typeof unitPos.longitude !== 'number' || typeof unitPos.latitude !== 'number') {
          console.error(`单位位置计算无效: ${unitInstanceId}，经度=${unitPos?.longitude}，纬度=${unitPos?.latitude}`);
          continue;
        }

        // 然后计算兵种对应的每个模型加上偏移后在地球上的位置
        const modelMatrix = this.poseCalculator.computeModelMatrix(
          unitPos,
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

        console.log(`渲染兵种实例成功: ${unitInstanceId}`);
      } catch (error) {
        console.error(`渲染兵种实例失败: ${unitInstanceId}`, error);
        // 继续处理下一个，不中断整个流程
      }
    }
    
    console.log(`部队 ${force.forceId} 所有兵种实例渲染完成`);
  }

  /**
   * 更新模型LOD（用于静止部队）
   * @private
   */
  async _updateModelLOD(forceInstance) {
    // 获取相机位置，用于计算距离
    const cameraPos = this.viewer.scene.camera.positionWC;
    
    // 逐个更新兵种实例的LOD，而不是并行
    for (const [unitInstanceId, unitInstance] of forceInstance.unitInstanceMap.entries()) {
      try {
        // 忽略没有激活模型的实例
        if (!unitInstance.activeModel || unitInstance.activeLOD < 0) continue;
        
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
            console.warn(`找不到LOD模型: ${unitInstanceId}, level=${targetLOD}`);
            continue;
          }
          
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
        console.error(`更新LOD失败: ${unitInstanceId}`, error);
      }
    }
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