import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';

export class HexGridRenderer {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();

    this.layerIndex = 1;
    this.fillPrimitives = null;
    this.borderPrimitives = null;
    this.baseGridPrimitives = null; // 底层
    this.interactGridPrimitives = null; // 交互层
    this.selectedHexIds = this.store.getSelectedHexIds(); // 鼠标选中的六角格，保存至全局状态

    // // 添加交互事件绑定
    // this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // // 悬停事件：设置 hover 高亮
    // this.handler.setInputAction((movement) => {
    //   const picked = this.viewer.scene.pick(movement.endPosition);
    //   if (picked && picked.id) {
    //     this.setHoveredHex(picked.id);
    //   } else {
    //     this.clearHoveredHex();
    //   }
    // }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // // 点击事件：添加为选中高亮
    // this.handler.setInputAction((click) => {
    //   const picked = this.viewer.scene.pick(click.position);
    //   if (picked && picked.id) {
    //     this.highlightHex(picked.id);
    //   }
    // }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // clearGrid() {
  //   if (this.baseLayerPrimitive) {
  //     this.viewer.scene.primitives.remove(this.baseLayerPrimitive);
  //     this.baseLayerPrimitive = null;
  //   }
  //   if (this.interactionLayerPrimitive) {
  //     this.viewer.scene.primitives.remove(this.interactionLayerPrimitive);
  //     this.interactionLayerPrimitive = null;
  //   }
  //   this.primitiveMap = {};
  //   this.store.clearSelectedHexIds();
  //   this.hoveredHexId = null;
  // }

  clearGrid() {
    console.log(`进入 clearGrid() `)
    if (this.baseGridPrimitives) {
      this.viewer.scene.primitives.remove(this.baseGridPrimitives);
      this.baseGridPrimitives = null;
      this.borderPrimitives = null;
      this.fillPrimitives = null;
    }
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }
  }

  /**
   * 渲染六角格基础图层
   * 
   * 边框采用一个Primitive对应多个Geometry的方式渲染，
   * 填充采用一个Primitive对应一个Geometry的方式渲染(灰块/高亮块同理)。
   * @param {number} layerIndex = 1: 基本图层  2: 地形图层  3: 无六角格
   */
  renderBaseGrid(layerIndex = 1) {
    this.clearGrid();
    if (layerIndex === 3) return;

    const hexCells = this.store.getHexCells();
    const borderInstances = [];
    this.baseGridPrimitives = new Cesium.PrimitiveCollection();
    this.borderPrimitives = new Cesium.PrimitiveCollection();
    this.fillPrimitives = new Cesium.PrimitiveCollection();

    hexCells.forEach((hexCell) => {
      let visual = {};
      if (layerIndex === 1) {
        visual = HexVisualStyles.default;
      } else if (layerIndex === 2) {
        visual = hexCell.getTopVisualStyle('base') || HexVisualStyles.default;
      }
      console.log(`六角格样式:  ${visual.fillColor}`)

      const showFill = visual.showFill === undefined ? false : visual.showFill;
      const showBorder = visual.showBorder === undefined ? true : visual.showBorder;
      console.log(`正在处理渲染六角格:  ${hexCell.hexId}`);

      if (showFill) {
        const fillInstance = new Cesium.GeometryInstance({
          geometry: HexGridRenderer.createHexCellGeometry(hexCell),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.fillColor || Cesium.Color.WHITE.withAlpha(0.1))
          },
          id: hexCell.hexId + "_fill",
        });
        const fillPrimitive = new Cesium.GroundPrimitive({
          geometryInstances: fillInstance,
          asynchronous: false
        });
        this.fillPrimitives.add(fillPrimitive);
      }

      if (showBorder) {
        const borderInstance = new Cesium.GeometryInstance({
          geometry: HexGridRenderer.createHexCellBorderGeometry(hexCell),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.borderColor || Cesium.Color.RED.withAlpha(0.1))
          },
          id: hexCell.hexId + "_border",
        });
        borderInstances.push(borderInstance);
      }
    });

    this.borderPrimitives = new Cesium.GroundPolylinePrimitive({
      geometryInstances: borderInstances,
      appearance: new Cesium.PolylineColorAppearance(),
      allowPicking: false
    });
    
    this.baseGridPrimitives.add(this.fillPrimitives);
    this.baseGridPrimitives.add(this.borderPrimitives);
    this.viewer.scene.primitives.add(this.baseGridPrimitives);
    this.layerIndex = layerIndex;
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
    if (this.layerIndex === 3) return; // layerIndex=3时，不渲染

    this.interactGridPrimitives = new Cesium.PrimitiveCollection();
    const hexCells = this.store.getHexCells();

    hexCells.forEach((hexCell) => {
      // 获取 interaction 层内 优先级最高的样式
      const style = hexCell.getTopVisualStyle('interaction');
      if (!style) {
        return; // 该 hexCell 在交互层没有样式，不渲染
      }

      // 取 fillColor
      const color = style.fillColor || Cesium.Color.WHITE.withAlpha(0.1);
      const interactInstance = new Cesium.GeometryInstance({
        geometry: HexGridRenderer.createHexCellGeometry(hexCell),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
        },
        id: hexCell.hexId + "_interact",
      });
      const interactPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: interactInstance,
        asynchronous: false,
      });
      this.interactGridPrimitives.add(interactPrimitive);
    });

    this.viewer.scene.primitives.add(this.interactGridPrimitives);
  }

  // highlightHex(hexId, multi=false) {
  //   if (this.store.getSelectedHexIds().size > 0 && !multi) {
  //     this.store.clearSelectedHexIds();
  //   }
  //   this.store.addSelectedHexId(hexId);
  //   this.renderInteractionLayer();
  // }

  // unhighlightHex(hexId) {
  //   this.store.removeSelectedHexId(hexId);
  //   this.renderInteractionLayer();
  // }

  // clearHighlights() {
  //   this.store.clearSelectedHexIds();
  //   this.renderInteractionLayer();
  // }

  // setHoveredHex(hexId) {
  //   if (this.hoveredHexId !== hexId) {
  //     this.hoveredHexId = hexId;
  //     this.renderInteractionLayer();
  //   }
  // }

  // clearHoveredHex() {
  //   if (this.hoveredHexId !== null) {
  //     this.hoveredHexId = null;
  //     this.renderInteractionLayer();
  //   }
  // }

  /**
   * 根据 hexCell 对象创建 Cesium.PolygonGeometry 用于渲染
   * 注意：此函数只使用 position.points 中的顶点（第 1 至第 6 个元素）来创建多边形边界，中
   * 心点不参与边界绘制。
   * @param {HexCell} hexCell 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.PolygonGeometry}
   */
  static createHexCellGeometry(hexCell) {
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
  static createHexCellBorderGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const posArr = vertices.map((pt) => [pt.longitude, pt.latitude]).flat();
    return new Cesium.GroundPolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(posArr),
      loop: true,
      width: 4.0,
    });
  }
}