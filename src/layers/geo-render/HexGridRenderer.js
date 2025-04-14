import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexVisualStyles } from "@/config/HexVisualStyles";

export class HexGridRenderer {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.fillPrimitives = [];
    this.borderPrimitives = [];
  }

  clearGrid() {
    this.fillPrimitives.forEach((primitive) => {
      this.viewer.scene.primitives.remove(primitive);
    });
    this.borderPrimitives.forEach((primitive) => {
      this.viewer.scene.primitives.remove(primitive);
    });
    this.fillPrimitives = [];
    this.borderPrimitives = [];
  }

  /**
   * 将所有六角格样式设置为默认
   */
  setHexesToDefaultVisual() {
    const hexCells = this.store.getHexCells();
    hexCells.forEach((hexCell) => {
      hexCell.updateVisualStyle(HexVisualStyles.default);
    });
    this.store.setHexCells(hexCells); // 回写更新后的副本
    this.renderGrid();
  }

  renderGrid() {
    this.clearGrid();
    const hexCells = this.store.getHexCells();

    hexCells.forEach((hexCell) => {
      const visual = hexCell.visibility.visualStyle || {};
      console.log(`visual = ${visual.fillColor}`)
      const showFill = visual.showFill === undefined ? false : visual.showFill;
      const showBorder = visual.showBorder === undefined ? true : visual.showBorder;
      console.log(`正在处理渲染六角格:  ${hexCell.hexId}`);

      if (showFill) {
        const fillGeometry = HexGridRenderer.createHexagonGeometry(hexCell);
        const fillInstance = new Cesium.GeometryInstance({
          geometry: fillGeometry,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.fillColor || Cesium.Color.WHITE.withAlpha(0.3)),
          },
          id: hexCell.hexId + "_fill",
        });

        const fillPrimitive = new Cesium.GroundPrimitive({
          geometryInstances: fillInstance,
          appearance: new Cesium.EllipsoidSurfaceAppearance({
            material: Cesium.Material.fromType("Color", {
              color: visual.fillColor || Cesium.Color.WHITE.withAlpha(0.3),
            }),
          }),
          asynchronous: false,
        });
        this.viewer.scene.primitives.add(fillPrimitive);
        this.fillPrimitives.push(fillPrimitive);
      }

      if (showBorder) {
        const borderGeometry = HexGridRenderer.createHexagonBorderGeometry(hexCell);
        const borderInstance = new Cesium.GeometryInstance({
          geometry: borderGeometry,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.borderColor || Cesium.Color.BLUE.withAlpha(0.3)),
          },
          id: hexCell.hexId + "_border",
        });

        const borderPrimitive = new Cesium.GroundPolylinePrimitive({
          geometryInstances: borderInstance,
          appearance: new Cesium.PolylineColorAppearance({
            material: Cesium.Material.fromType("Color", {
              color: visual.borderColor || Cesium.Color.BLUE.withAlpha(0.3),
            }),
          }),
        });
        this.viewer.scene.primitives.add(borderPrimitive);
        this.borderPrimitives.push(borderPrimitive);
      }
    });
  }

  // // 简单高亮：更新填充和边框颜色
  // highlightHex(hexId, highlightFillColor, highlightBorderColor) {
  //   this.fillPrimitives.forEach((primitive) => {
  //     if (primitive.geometryInstances && primitive.geometryInstances[0].id === hexId + "_fill") {
  //       primitive.appearance.material = Cesium.Material.fromType("Color", {
  //         color: highlightFillColor,
  //       });
  //     }
  //   });
  //   this.borderPrimitives.forEach((primitive) => {
  //     if (primitive.geometryInstances && primitive.geometryInstances[0].id === hexId + "_border") {
  //       primitive.appearance.material = Cesium.Material.fromType("Color", {
  //         color: highlightBorderColor,
  //       });
  //     }
  //   });
  // }
  /**
   * 静态方法：根据 hexCell 对象创建 Cesium.PolygonGeometry 用于渲染
   * 注意：此函数只使用 position.points 中的顶点（第 1 至第 6 个元素）来创建多边形边界，中
   * 心点不参与边界绘制。
   * @param {Object} hexCell 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.PolygonGeometry}
   */
  static createHexagonGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const pos = vertices.concat(vertices[0]);
    const posArr = pos.flatMap((pt) => [pt.longitude, pt.latitude, pt.height]);

    return Cesium.PolygonGeometry.fromPositions({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(posArr),
      vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
    });
  }

  /**
   * 根据 hexCell 对象生成边框的 PolylineGeometry
   * 只使用 position.points 中的顶点（第 1 至第 6 个元素），然后重复第一个顶点闭合
   * @param {Object} hexCell - 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.PolylineGeometry}
   */
  static createHexagonBorderGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const posArr = vertices.map((pt) => [pt.longitude, pt.latitude]).flat();

    return new Cesium.GroundPolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(posArr),
      loop: true,
      width: 4.0,
    });
  }
}
