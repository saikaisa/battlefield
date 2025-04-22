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
    
    // 实例缓存: forceId -> ForceInstanceEntry
    // ForceInstanceEntry: {
    //   force: Force,
    //   unitInstances: Map<unitId, UnitInstanceEntry>,
    //   position: { longitude, latitude, height }
    // }
    // UnitInstanceEntry: {
    //   model: Cesium.Model,
    //   currentLOD: number,
    //   template: TemplateEntry,
    //   localOffset: { x, y }  // 兵种在部队内的相对偏移
    // }
    this.instanceCache = reactive(new Map());
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
      heightOffset: 2         // 模型离地高度
    };
  }

  /**
   * 渲染所有部队的模型
   */
  renderAllForces() {
    this.store.getForces().forEach(force => {
      this._createForceInstance(force);
    });
    this._startUpdateLoop();
  }

  /**
   * 同步部队变化（增删）
   */
  syncForces(newForceIds, oldForceIds) {
    // 添加新部队
    newForceIds.forEach(id => {
      if (!this.instanceCache.has(id)) {
        const force = this.store.getForceById(id);
        if (force) this._createForceInstance(force);
      }
    });

    // 移除旧部队
    oldForceIds.forEach(id => {
      if (!newForceIds.includes(id)) {
        this._removeForceInstance(id);
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
    
    this.instanceCache.forEach(entry => {
      entry.unitInstances.forEach(unitInstance => {
        this.viewer.scene.primitives.remove(unitInstance.model);
      });
    });
    this.instanceCache.clear();
  }

  /**
   * 创建部队实例（包含多个兵种模型）
   * @private
   */
  async _createForceInstance(force) {
    try {
      const forceEntry = {
        force: force,
        unitInstances: new Map(),
        position: this._computeForcePosition(force)
      };

      // 为每个兵种创建实例
      for (const comp of force.composition) {
        const unit = this.store.getUnitById(comp.unitId);
        if (!unit || !unit.renderingKey) continue;

        const template = await this.loader.getTemplate(unit.renderingKey);
        const baseModel = template.lod[0].model;
        
        // 计算该兵种在部队内的相对位置
        const localOffset = this._computeUnitLocalOffset(
          force.composition.indexOf(comp),
          force.composition.length
        );

        // 创建实例
        for (let i = 0; i < comp.unitCount; i++) {
          const instance = baseModel.clone();
          const unitInstance = {
            model: instance,
            currentLOD: 0,
            template: template,
            localOffset: {
              x: localOffset.x + (Math.random() - 0.5) * 2, // 添加随机微偏移
              y: localOffset.y + (Math.random() - 0.5) * 2
            }
          };

          // 设置初始位置
          instance.modelMatrix = this._computeUnitModelMatrix(
            forceEntry.position,
            unitInstance.localOffset
          );
          instance.allowPicking = true;
          
          this.viewer.scene.primitives.add(instance);
          
          // 使用 unitId_index 作为 key
          const instanceId = `${comp.unitId}_${i}`;
          forceEntry.unitInstances.set(instanceId, unitInstance);
        }
      }

      this.instanceCache.set(force.forceId, forceEntry);
    } catch (error) {
      console.error(`创建部队实例失败: ${force.forceId}`, error);
    }
  }

  /**
   * 移除部队实例
   * @private
   */
  _removeForceInstance(forceId) {
    const forceEntry = this.instanceCache.get(forceId);
    if (forceEntry) {
      forceEntry.unitInstances.forEach(unitInstance => {
        this.viewer.scene.primitives.remove(unitInstance.model);
      });
      this.instanceCache.delete(forceId);
    }
  }

  /**
   * 启动更新循环
   * @private
   */
  _startUpdateLoop() {
    if (this._updateHandle) return;
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      this.instanceCache.forEach(forceEntry => {
        this._updateForceInstance(forceEntry);
      });
    });
  }

  /**
   * 更新部队实例（位置和 LOD）
   * @private
   */
  _updateForceInstance(forceEntry) {
    // 更新部队位置
    forceEntry.position = this._computeForcePosition(forceEntry.force);
    
    // 获取相机位置用于 LOD 判断
    const cameraPos = this.viewer.scene.camera.positionWC;
    
    // 更新每个兵种实例
    forceEntry.unitInstances.forEach(unitInstance => {
      // 更新位置
      unitInstance.model.modelMatrix = this._computeUnitModelMatrix(
        forceEntry.position,
        unitInstance.localOffset
      );
      
      // 处理 LOD 切换
      const modelPos = Cesium.Matrix4.getTranslation(
        unitInstance.model.modelMatrix,
        new Cesium.Cartesian3()
      );
      const distance = Cesium.Cartesian3.distance(cameraPos, modelPos);
      
      // 选择合适的 LOD 级别
      let targetLOD = 0;
      unitInstance.template.lod.forEach((level, index) => {
        if (distance >= level.distance) {
          targetLOD = index;
        }
      });
      
      // 如果需要切换 LOD
      if (targetLOD !== unitInstance.currentLOD) {
        const newModel = unitInstance.template.lod[targetLOD].model.clone();
        newModel.modelMatrix = unitInstance.model.modelMatrix;
        newModel.allowPicking = true;
        
        this.viewer.scene.primitives.remove(unitInstance.model);
        this.viewer.scene.primitives.add(newModel);
        
        unitInstance.model = newModel;
        unitInstance.currentLOD = targetLOD;
      }
    });
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
