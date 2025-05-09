// src\models\HexCell.js
import { HexConfig } from '@/config/GameConfig';
import { HexVisualStyles } from '@/config/HexVisualStyles';
import { HexForceMapper } from '@/layers/interaction-layer/utils/HexForceMapper';

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
    /** 六角格ID */
    this.hexId = hexId ?? '';

    /**
     * 位置信息
     * 
     * position: {
     *   points: [{ longitude: number, latitude: number, height: number }], // 点位数组，第一个是中心点，后面6个是顶点
     *   row: number,     // 六角格所在行
     *   col: number      // 六角格所在列
     * }
     */
    this.position = {
      points: Array.isArray(position?.points) ? position.points : [],
      row:    position?.row    ?? 0,
      col:    position?.col    ?? 0,
    };

    /**
     * 地形属性
     * 
     * terrainAttributes: {
     *   terrainType: string,       // 地形类型（平原、山地、水域等）
     *   elevation: number,         // 海拔高度（米）
     *   passability: {             // 通行能力
     *     land: boolean,           // 陆地单位是否可通行
     *     naval: boolean,          // 海军单位是否可通行
     *     air: boolean             // 空军单位是否可通行
     *   }
     * }
     */
    this.terrainAttributes = {
      terrainType:        terrainAttributes?.terrainType        ?? 'default',
      elevation:          terrainAttributes?.elevation          ?? 0,
      passability:        terrainAttributes?.passability        ?? { land: true, naval: false, air: true },
    };

    /**
     * 战场状态
     * 
     * battlefieldState: {
     *   controlFaction: string     // 控制该六角格的阵营（blue、red、neutral）
     * }
     */
    this.battlefieldState = {
      controlFaction: battlefieldState?.controlFaction ?? 'neutral',
    };

    // this.forceIds = updated from HexForceMapper;

    /**
     * 可视状态
     * 
     * visibility: {
     *   visualStyles: HexVisualStyles[],  // 视觉样式列表，属性见HexVisualStyles常量
     *   visibleTo: {               // 对不同阵营的可见性
     *     blue: boolean,           // 蓝方是否可见
     *     red: boolean             // 红方是否可见
     *   }
     * }
     */
    this.visibility = {
      visualStyles: Array.isArray(visibility?.visualStyles) ? visibility.visualStyles : [],
      visibleTo: visibility?.visibleTo ?? { blue: true, red: true },
    };

    // 附加信息(暂时未用)：isObjectivePoint、resource
    /**
     * additionalInfo: {
     *   isObjectivePoint: boolean, // 是否为战略目标点
     *   resource: Object           // 资源信息
     * }
     */
    this.additionalInfo = {
      isObjectivePoint: additionalInfo?.isObjectivePoint ?? false,
      resource:         additionalInfo?.resource         ?? null,
    };
  }

  /** 六角格包含部队 */
  get forcesIds() { return HexForceMapper.getForcesByHexId(this.hexId); }

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
   * 获取六角格的行和列
   * @returns {Object} 行和列
   */
  getRowCol() {
    return {
      row: this.position.row,
      col: this.position.col,
    };
  }

  /** 设置六角格对双方可见性 */

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
