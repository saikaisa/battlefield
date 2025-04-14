import { HexConfig } from '@/config/GameConfig';

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
  }) {
    this.hexId = hexId;
    this.position = position;
    this.terrainAttributes = terrainAttributes;
    this.battlefieldState = battlefieldState;
    this.visibility = visibility;
    this.additionalInfo = additionalInfo;
  }

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
   * 更新视觉样式
   * @param {Object} newStyle - 样式对象
   */
  updateVisualStyle(newStyle) {
    this.visibility.visualStyle = { ...newStyle };
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
