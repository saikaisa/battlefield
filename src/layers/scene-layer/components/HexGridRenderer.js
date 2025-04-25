// src\layers\scene-layer\components\HexGridRenderer.js
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';
import { computed } from "vue";

// 缓存：每个六角格几何 (fillGeom, borderGeom)
const geometryCache = new Map();
// 缓存：按 layerIndex 存放 PrimitiveCollection，Map<layerIndex , PrimitiveCollection>
const baseLayerCache = new Map();

export class HexGridRenderer {
  static #instance = null;

  /**
   * 获取 HexGridRenderer 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {HexGridRenderer} 单例实例
   */
  static getInstance(viewer) {
    if (!HexGridRenderer.#instance) {
      if (!viewer) {
        throw new Error('首次创建 HexGridRenderer 实例时必须提供 viewer 参数');
      }
      HexGridRenderer.#instance = new HexGridRenderer(viewer);
    }
    return HexGridRenderer.#instance;
  }

  /**
   * 私有构造函数，接收 Cesium.Viewer 实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @private
   */
  constructor(viewer) {
    if (HexGridRenderer.#instance) {
      throw new Error('HexGridRenderer 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.viewer = viewer;
    this.store = openGameStore();

    this.layerIndex = computed(() => this.store.layerIndex);
    // console.log(`layerIndex: ${this.layerIndex.value}`)
    this.interactGridPrimitives = null; // 交互层
    this.selectedHexIds = this.store.getSelectedHexIds(); // 鼠标选中的六角格，保存至全局状态
  }

  /**
   * 渲染六角格基础图层
   * 
   * 边框采用一个Primitive对应多个Geometry的方式渲染，
   * 填充采用一个Primitive对应一个Geometry的方式渲染(灰块/高亮块同理)。
   * @param {number} refresh 是否强制刷新
   */
  renderBaseGrid(refresh = false) {
    // 隐藏所有 (layerIndex===3)
    if (this.layerIndex.value === 3) {
      baseLayerCache.forEach(collection => collection.show = false);
      return;
    }

    // 首次或强制：清除旧缓存并重建所有层
    if (refresh || baseLayerCache.size === 0) {
      // 从场景移除并销毁旧集合
      baseLayerCache.forEach(collection => {
        this.viewer.scene.primitives.remove(collection);
      });
      baseLayerCache.clear();

      const hexCells = this.store.getHexCells();

      // 构建 layer 1 & 2 两套 PrimitiveCollection
      [1, 2].forEach(idx => {
        const borderInstances = [];
        const primCollection = new Cesium.PrimitiveCollection();
        hexCells.forEach((hexCell) => {
          // 选择对应样式
          let visual = idx === 1
            ? HexVisualStyles.default
            : hexCell.getTopVisualStyle('base') || HexVisualStyles.default;
          const { fillGeometry, borderGeometry } = HexGridRenderer.getOrCreateGeometry(hexCell);
          
          if (visual.showFill) {
            const fillInstance = new Cesium.GeometryInstance({
              geometry: fillGeometry,
              attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.fillColor || Cesium.Color.WHITE.withAlpha(0.1))
              },
              id: hexCell.hexId + "_fill",
            });
            const fillPrimitive = new Cesium.GroundPrimitive({
              geometryInstances: fillInstance,
              asynchronous: false
            });
            primCollection.add(fillPrimitive);
          }
          if (visual.showBorder) {
            const borderInstance = new Cesium.GeometryInstance({
              geometry: borderGeometry,
              attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.borderColor || Cesium.Color.RED.withAlpha(0.1))
              },
              id: hexCell.hexId + "_border",
            });
            console.log(`borderColor : ${visual.borderColor}`)
            borderInstances.push(borderInstance);
          }
        });

        primCollection.add(new Cesium.GroundPolylinePrimitive({
          geometryInstances: borderInstances,
          appearance: new Cesium.PolylineColorAppearance(),
          allowPicking: false
        }));
        // 显隐控制
        primCollection.show = (this.layerIndex.value === idx);
        // 加入场景 & 缓存
        this.viewer.scene.primitives.add(primCollection);
        baseLayerCache.set(idx, primCollection);
      });
    } else {
      // 仅切换显隐
      baseLayerCache.forEach((collection, idx) => {
        collection.show = (this.layerIndex.value === idx);
      });
    }

  }

  /**
   * 渲染六角格交互图层
   *  - 鼠标划过 / 选中 / 其他交互标记
   */
  renderInteractGrid() {
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }
    if (this.layerIndex.value === 3) return; // layerIndex=3时，不渲染

    this.interactGridPrimitives = new Cesium.PrimitiveCollection();
    const hexCells = this.store.getHexCells();

    hexCells.forEach((hexCell) => {
      // 获取 interaction 层内 优先级最高的样式
      const style = hexCell.getTopVisualStyle('interaction');
      if (!style) {
        return; // 该 hexCell 在交互层没有样式，不渲染
      }
      const { fillGeometry } = HexGridRenderer.getOrCreateGeometry(hexCell);

      // 取 fillColor
      const color = style.fillColor || Cesium.Color.WHITE.withAlpha(0.1);
      const interactInstance = new Cesium.GeometryInstance({
        geometry: fillGeometry,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
        },
        id: hexCell.hexId + "_fill",
      });
      const interactPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: interactInstance,
        asynchronous: false,
      });
      this.interactGridPrimitives.add(interactPrimitive);
    });

    this.viewer.scene.primitives.add(this.interactGridPrimitives);
  }

  /**
   * 获取或创建六角格几何
   */
  static getOrCreateGeometry(hexCell) {
    let geom = geometryCache.get(hexCell.hexId);
    if (!geom) {
      geom = {
        fillGeometry: HexGridRenderer._createHexCellGeometry(hexCell),
        borderGeometry: HexGridRenderer._createHexCellBorderGeometry(hexCell)
      };
      geometryCache.set(hexCell.hexId, geom);
    }
    return geom;
  }

  /**
   * 根据 hexCell 对象创建 Cesium.PolygonGeometry 用于渲染
   * 注意：此函数只使用 position.points 中的顶点（第 1 至第 6 个元素）来创建多边形边界，中
   * 心点不参与边界绘制。
   * @param {HexCell} hexCell 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.PolygonGeometry}
   */
  static _createHexCellGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const pos = vertices.concat(vertices[0]);
    const posArr = pos.flatMap((pt) => [pt.longitude, pt.latitude, pt.height]);
    return Cesium.PolygonGeometry.fromPositions({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(posArr),
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
    });
  }

  /**
   * 根据 hexCell 对象生成边框的 PolylineGeometry
   * 只使用 position.points 中的顶点（第 1 至第 6 个元素），然后重复第一个顶点闭合
   * @param {HexCell} hexCell - 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.GroundPolylineGeometry}
   */
  static _createHexCellBorderGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const posArr = vertices.map((pt) => [pt.longitude, pt.latitude]).flat();
    return new Cesium.GroundPolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(posArr),
      loop: true,
      width: 4.0,
    });
  }
}