import { Cartesian3, HeightReference, Color, Math as CesiumMath } from 'cesium';

/**
 * 单位放置器类
 * 负责将部队模型放置到正确的六角格位置
 */
export class UnitPlacer {
  /**
   * 构造函数
   * @param {Object} viewer - Cesium Viewer实例
   * @param {Object} hexGridGenerator - 六角网格生成器实例
   * @param {Object} modelOptimizer - 模型优化器实例
   * @param {Object} lodManager - LOD管理器实例
   */
  constructor(viewer, hexGridGenerator, modelOptimizer, lodManager) {
    this.viewer = viewer;
    this.hexGridGenerator = hexGridGenerator;
    this.modelOptimizer = modelOptimizer;
    this.lodManager = lodManager;
    this.unitEntities = new Map();
  }

  /**
   * 放置部队
   * @param {Object} force - 部队数据
   * @returns {Entity} 创建的实体
   */
  placeUnit(force) {
    // 检查部队是否已存在
    if (this.unitEntities.has(force.force_id)) {
      return this.updateUnitPosition(force);
    }

    // 获取六角格数据
    const hexData = this.hexGridGenerator.getHexData(force.hex_id);
    if (!hexData) {
      console.error(`找不到六角格: ${force.hex_id}`);
      return null;
    }

    // 获取部队主要兵种
    const mainUnitType = this.getMainUnitType(force);
    if (!mainUnitType) {
      console.error(`部队没有兵种组成: ${force.force_id}`);
      return null;
    }

    // 获取模型路径
    const modelPath = mainUnitType.rendering_attributes.model_path;

    // 计算放置位置（在六角格内随机偏移，避免重叠）
    const position = this.calculateUnitPosition(hexData, force);

    // 创建部队实体
    const entity = this.viewer.entities.add({
      id: `force_${force.force_id}`,
      name: force.force_name,
      position: position,
      model: {
        uri: modelPath,
        minimumPixelSize: 64,
        maximumScale: 20000,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        distanceDisplayCondition: {
          near: 0,
          far: 20000.0
        },
        color: this.getFactionColor(force.faction)
      },
      label: {
        text: force.force_name,
        font: '14px sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        distanceDisplayCondition: {
          near: 0,
          far: 10000.0
        }
      },
      properties: {
        forceData: force
      }
    });

    // 注册LOD
    if (mainUnitType.rendering_attributes.lod_levels) {
      this.lodManager.registerEntityLOD(entity, mainUnitType.rendering_attributes.lod_levels);
    }

    // 存储实体引用
    this.unitEntities.set(force.force_id, entity);

    return entity;
  }

  /**
   * 更新部队位置
   * @param {Object} force - 部队数据
   * @returns {Entity} 更新的实体
   */
  updateUnitPosition(force) {
    const entity = this.unitEntities.get(force.force_id);
    if (!entity) return null;

    // 获取六角格数据
    const hexData = this.hexGridGenerator.getHexData(force.hex_id);
    if (!hexData) {
      console.error(`找不到六角格: ${force.hex_id}`);
      return entity;
    }

    // 计算新位置
    const position = this.calculateUnitPosition(hexData, force);
    entity.position = position;

    // 更新属性
    entity.properties.forceData = force;

    return entity;
  }

  /**
   * 计算部队放置位置
   * @param {Object} hexData - 六角格数据
   * @param {Object} force - 部队数据
   * @returns {Cartesian3} 放置位置
   */
  calculateUnitPosition(hexData, force) {
    const { longitude, latitude, height } = hexData.position;

    // 在六角格内随机偏移，避免重叠
    // 偏移范围为六角格半径的30%
    const offsetRange = 0.0015; // 约150米
    const offsetX = (Math.random() - 0.5) * offsetRange;
    const offsetY = (Math.random() - 0.5) * offsetRange;

    // 考虑部队ID作为随机种子，使同一部队的偏移保持一致
    const forceId = force.force_id;
    const pseudoRandom = Math.sin(forceId * 12345.6789) * 0.5 + 0.5;
    const offsetX2 = (pseudoRandom - 0.5) * offsetRange;
    const offsetY2 = (Math.sin(pseudoRandom * Math.PI * 2) - 0.5) * offsetRange;

    // 最终偏移
    const finalOffsetX = (offsetX + offsetX2) / 2;
    const finalOffsetY = (offsetY + offsetY2) / 2;

    // 计算最终位置
    const finalLongitude = longitude + finalOffsetX;
    const finalLatitude = latitude + finalOffsetY;
    const finalHeight = height + 10; // 稍微抬高，避免陷入地面

    return Cartesian3.fromDegrees(finalLongitude, finalLatitude, finalHeight);
  }

  /**
   * 获取部队主要兵种
   * @param {Object} force - 部队数据
   * @returns {Object} 主要兵种数据
   */
  getMainUnitType(force) {
    // 简化版：假设部队的第一个兵种为主要兵种
    // 实际项目中应根据兵种基数或其他规则确定
    if (force.composition && force.composition.length > 0) {
      return force.composition[0].unit_ref;
    }
    return null;
  }

  /**
   * 获取阵营颜色
   * @param {string} faction - 阵营
   * @returns {Color} 颜色
   */
  getFactionColor(faction) {
    switch (faction) {
      case 'blue':
        return Color.BLUE;
      case 'red':
        return Color.RED;
      default:
        return Color.WHITE;
    }
  }

  /**
   * 更新部队可见性
   * @param {number} forceId - 部队ID
   * @param {boolean} visible - 是否可见
   */
  updateUnitVisibility(forceId, visible) {
    const entity = this.unitEntities.get(forceId);
    if (entity) {
      entity.show = visible;
    }
  }

  /**
   * 根据六角格可见性更新部队可见性
   * @param {string} currentFaction - 当前阵营
   */
  updateUnitsVisibilityByHex(currentFaction) {
    this.unitEntities.forEach((entity, forceId) => {
      const force = entity.properties.forceData;
      const hexId = force.hex_id;
      const hexData = this.hexGridGenerator.getHexData(hexId);

      if (hexData) {
        const isVisible = hexData.visibility.visible_to[currentFaction];
        entity.show = isVisible;
      }
    });
  }

  /**
   * 移除部队
   * @param {number} forceId - 部队ID
   */
  removeUnit(forceId) {
    const entity = this.unitEntities.get(forceId);
    if (entity) {
      // 移除LOD注册
      this.lodManager.unregisterEntityLOD(entity.id);
      // 移除实体
      this.viewer.entities.remove(entity);
      // 移除引用
      this.unitEntities.delete(forceId);
    }
  }

  /**
   * 清除所有部队
   */
  clearAllUnits() {
    this.unitEntities.forEach((entity, forceId) => {
      this.removeUnit(forceId);
    });
  }

  /**
   * 高亮显示部队
   * @param {number} forceId - 部队ID
   * @param {boolean} highlight - 是否高亮
   */
  highlightUnit(forceId, highlight = true) {
    const entity = this.unitEntities.get(forceId);
    if (entity && entity.model) {
      if (highlight) {
        entity.model.color = Color.YELLOW;
        entity.label.fillColor = Color.YELLOW;
      } else {
        const force = entity.properties.forceData;
        entity.model.color = this.getFactionColor(force.faction);
        entity.label.fillColor = Color.WHITE;
      }
    }
  }
}
