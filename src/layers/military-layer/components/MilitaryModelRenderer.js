import * as Cesium from "cesium";
import { reactive } from 'vue';
import { openGameStore } from '@/store';
import { HexConfig } from '@/config/GameConfig';
import { HexForceMapper } from '@/utils/HexForceMapper';

/**
 * 军事模型渲染器
 * 
 * 主要职责：
 * 1. 管理部队模型的实例化和渲染（一个部队包含多个兵种模型）
 * 2. 处理部队位置更新和 LOD 切换
 * 3. 维护部队在六角格内的排布
 */
export class MilitaryModelRenderer {
  constructor(viewer, loader) {
    this.viewer = viewer;
    this.loader = loader;
    this.store = openGameStore();
    
    // forceInstanceMap: Map<forceId, forceInstance>
    // forceInstance: {
    //   force: Force, —— 部队
    //   unitInstanceMap: Map<unitInstanceId, unitInstance>, —— 兵种实例集合
    //   position: { longitude, latitude, height } —— 部队位置
    // }
    // unitInstanceId: `${forceId}_${unitId}_${index}`
    // unitInstance: {
    //   currentModel: Cesium.Model, —— 当前显示的模型实例
    //   currentLOD: number, —— 当前 LOD 级别
    //   modelTemplate: modelTemplate, —— 兵种模型模版
    //   localOffset: { x, y } —— 兵种在部队内的相对偏移
    // }
    this.forceInstanceMap = reactive(new Map());
    
    // 记录正在移动中的部队
    // movingForces: Map<forceId, movementData>
    // movementData: {
    //   path: string[], —— 路径（六角格ID数组）
    //   currentPathIndex: number, —— 当前所在路径索引
    //   targetPosition: { longitude, latitude, height }, —— 目标位置
    //   currentPosition: { longitude, latitude, height }, —— 当前位置
    //   startTime: number, —— 开始移动时间
    //   duration: number, —— 当前段移动持续时间（毫秒）
    //   isMoving: boolean —— 是否在移动中
    // }
    this.movingForces = reactive(new Map());
    
    this._updateHandle = null;

    // 部队排布配置
    this.layoutConfig = {
      // 环形布局（少量部队）
      ringLayout: {
        maxCount: 6,          // 最大使用环形的部队数
        radiusScale: 0.4      // 环半径 = 六角格半径 * 此系数
      },
      // 网格布局（中等数量）
      gridLayout: {
        maxCount: 9,          // 最大使用网格的部队数
        scale: 0.7           // 网格整体缩放系数
      },
      // 部队内兵种布局
      unitLayout: {
        spacing: 5,          // 兵种间距（米）
        maxRow: 3           // 每行最多放置的兵种数
      },
      // 通用配置
      heightOffset: 2,        // 模型离地高度
      // 移动相关配置
      movement: {
        segmentDuration: 1500,  // 每段路径移动时间（毫秒）
        randomOffset: 10,      // 路径随机偏移范围（米）
        easing: (t) => {       // 缓动函数
          return t<0.5 ? 2*t*t : -1+(4-2*t)*t
        }
      }
    };
  }

  /**
   * 强制重新渲染所有部队的模型
   */
  renderAllForces() {
    this.store.getForces().forEach(force => {
      // 先移除所有部队实例
      this._removeForceInstanceById(force.forceId);
      // 再创建新的部队实例
      this._createForceInstance(force);
    });
    this._startUpdateLoop();
  }

  /**
   * 处理部队数量变化（新增或删除部队）
   */
  handleForcesChange(newForceIds, oldForceIds) {
    // 添加新部队
    newForceIds.forEach(id => {
      if (!this.forceInstanceMap.has(id)) {
        const force = this.store.getForceById(id);
        if (force) this._createForceInstance(force);
      }
    });

    // 移除旧部队
    oldForceIds.forEach(id => {
      if (!newForceIds.includes(id)) {
        this._removeForceInstanceById(id);
      }
    });
  }

  /**
   * 移动部队沿着路径前进
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
    
    // 计算起始位置
    const startPosition = forceInstance.position;
    
    // 创建移动数据
    const movementData = {
      path: path, // 路径（六角格ID数组）
      currentPathIndex: 0, // 当前所在路径索引
      startPosition: startPosition, // 起始位置
      currentPosition: { ...startPosition }, // 当前位置
      targetPosition: this._getHexCenterPosition(path[1]), // 下一个路径点
      startTime: Date.now(), // 开始移动时间
      duration: this.layoutConfig.movement.segmentDuration, // 当前段移动持续时间（毫秒）
      isMoving: true, // 是否在移动中
      // 为每段路径生成随机偏移，使移动看起来更自然
      pathOffsets: path.map(() => ({
        x: (Math.random() - 0.5) * this.layoutConfig.movement.randomOffset,
        y: (Math.random() - 0.5) * this.layoutConfig.movement.randomOffset
      }))
    };
    
    // 记录到移动中的部队
    this.movingForces.set(forceId, movementData);
    
    // 确保更新循环已启动
    this._startUpdateLoop();
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
    this.movingForces.clear();
  }

  /**
   * 创建部队实例（包含多个兵种模型）
   * @private
   */
  async _createForceInstance(force) {
    try {
      const forceInstance = {
        force: force,
        unitInstanceMap: new Map(),
        position: this._computeForcePosition(force)
      };

      // 为每个兵种创建实例
      for (const comp of force.composition) {
        const unit = this.store.getUnitById(comp.unitId);
        if (!unit || !unit.renderingKey) continue;

        const modelTemplate = await this.loader.getModelTemplate(unit.renderingKey);
        const baseModel = modelTemplate.lodModels[0].model;
        
        // 计算该兵种在部队内的相对位置
        const localOffset = this._computeUnitLocalOffset(
          force.composition.indexOf(comp),
          force.composition.length
        );

        // 创建实例
        for (let i = 0; i < comp.unitCount; i++) {
          const currentModel = baseModel.clone();
          const unitInstance = {
            currentModel: currentModel, // 当前显示的模型实例
            currentLOD: 0,
            modelTemplate: modelTemplate, // 兵种模型模版
            localOffset: {
              x: localOffset.x + (Math.random() - 0.5) * 2, // 添加随机微偏移
              y: localOffset.y + (Math.random() - 0.5) * 2
            }
          };

          // 设置初始位置
          currentModel.modelMatrix = this._computeUnitModelMatrix(
            forceInstance.position,
            unitInstance.localOffset
          );
          currentModel.allowPicking = true;
          
          this.viewer.scene.primitives.add(currentModel);
          
          // 使用 forceId_unitId_index 作为 key
          const unitInstanceId = `${force.forceId}_${comp.unitId}_${i}`;
          forceInstance.unitInstanceMap.set(unitInstanceId, unitInstance);
        }
      }

      this.forceInstanceMap.set(force.forceId, forceInstance);
    } catch (error) {
      console.error(`创建部队实例失败: ${force.forceId}`, error);
    }
  }

  /**
   * 移除部队实例
   * @private
   */
  _removeForceInstanceById(forceId) {
    const forceInstance = this.forceInstanceMap.get(forceId);
    if (forceInstance) {
      forceInstance.unitInstanceMap.forEach(unitInstance => {
        this.viewer.scene.primitives.remove(unitInstance.currentModel);
      });
      this.forceInstanceMap.delete(forceId);
    }
    
    // 同时清除移动状态
    this.movingForces.delete(forceId);
  }

  /**
   * 启动更新循环，每帧执行一次
   * @private
   */
  _startUpdateLoop() {
    if (this._updateHandle) return;
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 更新所有部队
      this.forceInstanceMap.forEach((forceInstance, forceId) => {
        // 移动部队：更新部队位置
        if (this.movingForces.has(forceId)) {
          // 计算移动中的部队实例下一帧的位置
          this._computeMovingForcePosition(forceId);
          // 更新部队实例中各兵种实例模型的位置 (以部队实例位置为基准进行偏移)
          this._updateModelPositions(forceInstance);
        } 
        else {
          // 静止部队：更新LOD
          this._updateModelLOD(forceInstance);
        }
      });
      
      // 清理已完成移动的部队
      this._cleanupFinishedMovements();
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
   * 更新兵种实例模型位置
   * @private
   */
  _updateModelPositions(forceInstance) {
    forceInstance.unitInstanceMap.forEach(unitInstance => {
      // 只更新位置，不更新LOD
      unitInstance.currentModel.modelMatrix = this._computeUnitModelMatrix(
        forceInstance.position,
        unitInstance.localOffset
      );
    });
  }

  /**
   * 计算移动中的部队实例下一帧的位置
   * @private
   */
  _computeMovingForcePosition(forceId) {
    const movementData = this.movingForces.get(forceId);
    const forceInstance = this.forceInstanceMap.get(forceId);
    
    if (!movementData || !forceInstance || !movementData.isMoving) return;
    
    const now = Date.now();
    const elapsed = now - movementData.startTime;
    
    // 计算当前段的移动进度
    let progress = Math.min(1, elapsed / movementData.duration);
    progress = this.layoutConfig.movement.easing(progress);
    
    // 插值计算当前位置
    const start = movementData.startPosition;
    const target = movementData.targetPosition;
    const current = {
      longitude: start.longitude + (target.longitude - start.longitude) * progress,
      latitude: start.latitude + (target.latitude - start.latitude) * progress,
      height: start.height + (target.height - start.height) * progress
    };
    
    // 更新部队当前位置
    forceInstance.position = current;
    movementData.currentPosition = current;
    
    // 如果当前段移动完成，准备下一段移动
    if (progress >= 1) {
      movementData.currentPathIndex++;
      
      // 检查是否到达终点
      if (movementData.currentPathIndex >= movementData.path.length - 1) {
        // 最后一段移动，更新部队的六角格位置
        const force = forceInstance.force;
        const finalHexId = movementData.path[movementData.path.length - 1];
        
        // 更新Store中的位置
        force.hexId = finalHexId;
        
        // 同时更新HexForceMapper中的映射关系
        HexForceMapper.moveForceToHex(forceId, finalHexId);
        
        // 计算终点六角格中的准确位置（考虑部队在六角格内的精确布局）
        forceInstance.position = this._computeForcePosition(force);
        
        // 最后更新一次位置，确保最终位置准确
        this._updateModelPositions(forceInstance);
        
        // 标记移动完成
        movementData.isMoving = false;
      } 
      else {
        // 准备下一段移动
        const nextIndex = movementData.currentPathIndex + 1;
        const nextHexId = movementData.path[nextIndex];
        
        // 取下一个点的位置，并加入随机偏移
        const nextBasePosition = this._getHexCenterPosition(nextHexId);
        const offset = movementData.pathOffsets[nextIndex];
        
        // 应用随机偏移
        const nextPosition = {
          longitude: nextBasePosition.longitude + offset.x / (111320 * Math.cos(nextBasePosition.latitude * Math.PI / 180)),
          latitude: nextBasePosition.latitude + offset.y / 111320,
          height: nextBasePosition.height
        };
        
        // 更新移动状态
        movementData.startPosition = { ...movementData.currentPosition };
        movementData.targetPosition = nextPosition;
        movementData.startTime = now;
      }
    }
  }

  /**
   * 清理已完成移动的部队
   * @private
   */
  _cleanupFinishedMovements() {
    this.movingForces.forEach((data, forceId) => {
      if (!data.isMoving) {
        this.movingForces.delete(forceId);
      }
    });
  }

  /**
   * 获取六角格中心位置
   * @private
   */
  _getHexCenterPosition(hexId) {
    const hex = this.store.getHexCellById(hexId);
    if (!hex) return null;
    
    const center = hex.getCenter();
    return {
      longitude: center.longitude,
      latitude: center.latitude,
      height: center.height + this.layoutConfig.heightOffset
    };
  }

  /**
   * 计算部队在六角格内的位置
   * @private
   */
  _computeForcePosition(force) {
    const hex = this.store.getHexCellById(force.hexId);
    if (!hex) return null;

    const center = hex.getCenter();
    // 从 HexForceMapper 获取部队列表
    const forces = HexForceMapper.getForcesByHexId(force.hexId);
    const index = forces.indexOf(force.forceId);
    const count = forces.length;

    // 计算部队在六角格内的偏移
    let offsetX = 0, offsetY = 0;
    const config = this.layoutConfig;

    if (count <= config.ringLayout.maxCount) {
      // 环形布局
      const radius = HexConfig.radius * config.ringLayout.radiusScale;
      const angle = (2 * Math.PI * index) / count;
      offsetX = radius * Math.cos(angle);
      offsetY = radius * Math.sin(angle);
    } 
    else if (count <= config.gridLayout.maxCount) {
      // 网格布局
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const size = (HexConfig.radius * 2 * config.gridLayout.scale) / Math.max(rows, cols);
      
      const row = Math.floor(index / cols);
      const col = index % cols;
      offsetX = (col - (cols - 1) / 2) * size;
      offsetY = (row - (rows - 1) / 2) * size;
    }

    // 将米偏移转换为经纬度偏移
    const metersPerDegree = 111320;
    const lonOffset = offsetX / (metersPerDegree * Math.cos(center.latitude * Math.PI / 180));
    const latOffset = offsetY / metersPerDegree;

    return {
      longitude: center.longitude + lonOffset,
      latitude: center.latitude + latOffset,
      height: center.height + this.layoutConfig.heightOffset
    };
  }

  /**
   * 计算兵种在部队内的相对偏移
   * @private
   */
  _computeUnitLocalOffset(index, total) {
    const { spacing, maxRow } = this.layoutConfig.unitLayout;
    const cols = Math.min(maxRow, total);
    const rows = Math.ceil(total / cols);
    
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: (col - (cols - 1) / 2) * spacing,
      y: (row - (rows - 1) / 2) * spacing
    };
  }

  /**
   * 计算兵种模型的最终变换矩阵
   * @private
   */
  _computeUnitModelMatrix(forcePosition, localOffset) {
    if (!forcePosition) return Cesium.Matrix4.IDENTITY;

    // 将局部偏移转换为经纬度偏移
    const metersPerDegree = 111320;
    const lonOffset = localOffset.x / (metersPerDegree * Math.cos(forcePosition.latitude * Math.PI / 180));
    const latOffset = localOffset.y / metersPerDegree;

    // 构建最终位置
    const position = Cesium.Cartesian3.fromDegrees(
      forcePosition.longitude + lonOffset,
      forcePosition.latitude + latOffset,
      forcePosition.height
    );

    return Cesium.Transforms.eastNorthUpToFixedFrame(position);
  }
}
