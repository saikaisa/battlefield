// src\models\HexCell.js
import { HexConfig } from '@/config/GameConfig';
import { HexVisualStyles } from '@/config/HexVisualStyles';
import { HexForceMapper } from '@/layers/interaction-layer/HexForceMapper';

export class HexCell {
  /**
   * 构造函数
   * @param {Object} options - 六角格相关数据
   */
  constructor({
    hexId,
    position,
    terrainAttributes,
    battlefieldState,
    visibility,
    additionalInfo,
  } = {}) {
    // 基础标识
    this.hexId = hexId ?? '';

    // 空间位置：保证 points、row、col 三个字段都已初始化
    this.position = {
      points: Array.isArray(position?.points) ? position.points : [],
      row:    position?.row    ?? 0,
      col:    position?.col    ?? 0,
    };

    // 地形属性：保证每个子字段都有默认值
    this.terrainAttributes = {
      terrainType:        terrainAttributes?.terrainType        ?? 'default',
      terrainComposition: terrainAttributes?.terrainComposition ?? {},
      elevation:          terrainAttributes?.elevation          ?? 0,
      passability:        terrainAttributes?.passability        ?? { land: true, naval: false, air: true },
    };

    // 战场状态：controlFaction 必须有默认
    this.battlefieldState = {
      // this.forceIds = updated from HexForceMapper;
      controlFaction: battlefieldState?.controlFaction ?? 'neutral',
    };

    // 可视状态：visualStyles 和 visibleTo 都要初始化
    this.visibility = {
      visualStyles: Array.isArray(visibility?.visualStyles) ? visibility.visualStyles : [],
      visibleTo: visibility?.visibleTo ?? { blue: true, red: true },
    };

    // 附加信息：isObjectivePoint、resource
    this.additionalInfo = {
      isObjectivePoint: additionalInfo?.isObjectivePoint ?? false,
      resource:         additionalInfo?.resource         ?? null,
    };
  }

  // 六角格包含部队
  get forcesIds() { return HexForceMapper.getForcesByHexId(this.hexId); }

  // 部队添加和移除
  addForceById(id) { HexForceMapper.addForceById(id, this.hexId); }
  removeForceById(id) { HexForceMapper.removeForceById(id); }

  /**
   * 获取中心点
   * @returns {Object} 中心点对象
   */
  getCenter() {
    return this.position.points[0];
  }

  /**
   * 获取六个顶点
   * @returns {Array} 顶点数组
   */
  getVertices() {
    return this.position.points.slice(1);
  }

  /**
   * 计算加权平均高度并更新
   * @returns {number} 新高度
   */
  updateElevation() {
    const centerHeight = this.getCenter().height;
    const vertices = this.getVertices();
    const centerWeight = HexConfig.heightSamplingWeights.center;
    const vertexWeight = HexConfig.heightSamplingWeights.vertex;
    const verticesHeightSum = vertices.reduce((sum, pt) => sum + pt.height, 0);
    const weightedElevation =
      centerWeight * centerHeight + vertexWeight * verticesHeightSum;
    this.terrainAttributes.elevation = weightedElevation;
    // console.log(`高度 = ${weightedElevation}`)
    return weightedElevation;
  }

  /**
   * 添加一个新的可视样式。同一层中，同一优先级的样式只能存在一个。
   * @param {Object} visualStyle - 来自 HexVisualStyles 的对象(含 layer, type, priority等)
   */
  addVisualStyle(visualStyle) {
    if (!visualStyle) return;

    // 如果没有 visualStyles，初始化一下
    if (!this.visibility.visualStyles) {
      this.visibility.visualStyles = [];
    }

    this.visibility.visualStyles = this.visibility.visualStyles.filter(style => {
      // 若同层且同优先级，则去掉
      return !(style.layer === visualStyle.layer && style.priority === visualStyle.priority);
    });

    this.visibility.visualStyles.push(visualStyle);
  }

  /**
   * 根据 type 移除某个可视样式
   */
  removeVisualStyleByType(type) {
    if (!this.visibility.visualStyles) return;
    this.visibility.visualStyles = this.visibility.visualStyles.filter(s => s.type !== type);
  }

  /**
   * 获取指定 layer 下优先级最高的样式
   * @param {string} layer - 'base' 或 'interaction' 等
   * @returns {Object|undefined} 样式对象（如 fillColor, borderColor, priority等）
   */
  getTopVisualStyle(layer) {
    if (!this.visibility.visualStyles) return undefined;
    const layerStyles = this.visibility.visualStyles.filter(s => s.layer === layer);
    if (layerStyles.length === 0) return undefined;
    // 按优先级从大到小排序
    layerStyles.sort((a, b) => b.priority - a.priority);
    return layerStyles[0]; // 第一个就是最高优先级
  }

  /**
   * 将六角格显示样式更新为地形标记
   */
  addVisualStyleByElevation() {
    let style = null;
    // 低海拔用 plain；中等海拔用 hill；高海拔用 mountain
    if (this.terrainAttributes.elevation < 100) {
      style = HexVisualStyles.plain;
    } else if (this.terrainAttributes.elevation < 200) {
      style = HexVisualStyles.hill;
    } else {
      style = HexVisualStyles.mountain;
    }
    this.terrainAttributes.terrainType = style.type || 'default';
    this.addVisualStyle(style);
  }

  /**
   * 将实例转换成原始对象
   * @returns {HexCell} 实例
   */
  toPlainObject() {
    return {
      hexId: this.hexId,
      position: this.position,
      terrainAttributes: this.terrainAttributes,
      battlefieldState: this.battlefieldState,
      visibility: this.visibility,
      additionalInfo: this.additionalInfo,
    };
  }

  /**
   * 从原始数据构造实例
   * @param {Object} obj - 数据对象
   * @returns {HexCell} 实例
   */
  static fromPlainObject(obj) {
    return new HexCell({
      hexId: obj.hexId,
      position: obj.position,
      terrainAttributes: obj.terrainAttributes,
      battlefieldState: obj.battlefieldState,
      visibility: obj.visibility,
      additionalInfo: obj.additionalInfo,
    });
  }
}
