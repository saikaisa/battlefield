// layers/interaction/HexGridRenderer.js
import * as Cesium from "cesium";
import { HexGridGenerator } from "../geo-render/HexGridGenerator";

export class HexGridRenderer {
  constructor(viewer) {
    this.viewer = viewer;
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

  renderGrid(hexCells) {
    this.clearGrid();
    hexCells.forEach((hexCell) => {
      const visual = hexCell.visual_style || {};
      const showFill = visual.showFill === undefined ? false : visual.showFill;
      const showBorder = visual.showBorder === undefined ? true : visual.showBorder;
      console.log(`正在处理渲染六角格:  ${hexCell.hex_id}`);

      // 渲染填充部分
      if (showFill) {
        const fillGeometry = HexGridGenerator.createHexagonGeometry(hexCell);
        const fillInstance = new Cesium.GeometryInstance({
          geometry: fillGeometry,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.fillColor || Cesium.Color.WHITE.withAlpha(0.3)),
          },
          id: hexCell.hex_id + "_fill",
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

      // 渲染边框部分
      if (showBorder) {
        const borderGeometry = HexGridGenerator.createHexagonBorderGeometry(hexCell);
        const borderInstance = new Cesium.GeometryInstance({
          geometry: borderGeometry,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.borderColor || Cesium.Color.BLUE.withAlpha(0.3)),
          },
          id: hexCell.hex_id + "_border",
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
}
