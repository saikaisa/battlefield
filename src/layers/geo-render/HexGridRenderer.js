import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';

export class HexGridRenderer {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.baseLayerPrimitive = null; // 底层
    this.interactionLayerPrimitive = null; // 交互层
    this.hoveredHexId = null; // 鼠标悬浮的六角格
    this.selectedHexIds = this.store.getSelectedHexIds(); // 鼠标选中的六角格，保存至全局状态
    this.primitiveMap = {}; // hexId -> GeometryInstance

    // 添加交互事件绑定
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 悬停事件：设置 hover 高亮
    this.handler.setInputAction((movement) => {
      const picked = this.viewer.scene.pick(movement.endPosition);
      if (picked && picked.id) {
        this.setHoveredHex(picked.id);
      } else {
        this.clearHoveredHex();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 点击事件：添加为选中高亮
    this.handler.setInputAction((click) => {
      const picked = this.viewer.scene.pick(click.position);
      if (picked && picked.id) {
        this.highlightHex(picked.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  clearGrid() {
    if (this.baseLayerPrimitive) {
      this.viewer.scene.primitives.remove(this.baseLayerPrimitive);
      this.baseLayerPrimitive = null;
    }
    if (this.interactionLayerPrimitive) {
      this.viewer.scene.primitives.remove(this.interactionLayerPrimitive);
      this.interactionLayerPrimitive = null;
    }
    this.primitiveMap = {};
    this.store.clearSelectedHexIds();
    this.hoveredHexId = null;
  }

  renderGrid(layerIndex = 1) {
    if (this.baseLayerPrimitive) this.viewer.scene.primitives.remove(this.baseLayerPrimitive);
    const hexCells = this.store.getHexCells();
    if (layerIndex === 3) return;

    const fillInstances = [];
    const borderInstances = [];

    hexCells.forEach((hexCell) => {
      let visual = {};
      if (layerIndex === 1) {
        visual = HexVisualStyles.default;
      } else if (layerIndex === 2) {
        visual = hexCell.visibility.visualStyle || HexVisualStyles.default;
      }

      const fillGeometry = HexGridRenderer.createHexCellGeometry(hexCell);
      const fillInstance = new Cesium.GeometryInstance({
        geometry: fillGeometry,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            visual.fillColor || Cesium.Color.WHITE.withAlpha(0.3)
          ),
        },
        id: hexCell.hexId + '_fill',
      });
      fillInstances.push(fillInstance);

      const borderGeometry = HexGridRenderer.createHexCellBorderGeometry(hexCell);
      const borderInstance = new Cesium.GeometryInstance({
        geometry: borderGeometry,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            visual.borderColor || Cesium.Color.BLUE.withAlpha(0.3)
          ),
        },
        id: hexCell.hexId + '_border',
      });
      borderInstances.push(borderInstance);

      this.primitiveMap[hexCell.hexId] = fillInstance;
    });

    const fillPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: fillInstances,
      appearance: new Cesium.PerInstanceColorAppearance({ translucent: true }),
      asynchronous: false,
    });

    const borderPrimitive = new Cesium.GroundPolylinePrimitive({
      geometryInstances: borderInstances,
      appearance: new Cesium.PolylineColorAppearance(),
    });

    this.baseLayerPrimitive = new Cesium.PrimitiveCollection();
    this.baseLayerPrimitive.add(fillPrimitive);
    this.baseLayerPrimitive.add(borderPrimitive);

    this.viewer.scene.primitives.add(this.baseLayerPrimitive);
  }

  renderInteractionLayer() {
    if (this.interactionLayerPrimitive) this.viewer.scene.primitives.remove(this.interactionLayerPrimitive);
    const hexCells = this.store.getHexCells();
    this.selectedHexIds = this.store.getSelectedHexIds();

    const interactionInstances = hexCells.map((hexCell) => {
      let color = Cesium.Color.TRANSPARENT;
      if (this.selectedHexIds.has(hexCell.hexId)) {
        color = Cesium.Color.YELLOW.withAlpha(0.6);
      } else if (this.hoveredHexId === hexCell.hexId) {
        color = Cesium.Color.GRAY.withAlpha(0.5);
      }
      return new Cesium.GeometryInstance({
        geometry: HexGridRenderer.createHexCellGeometry(hexCell),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
        id: hexCell.hexId,
      });
    });

    this.interactionLayerPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: interactionInstances,
      appearance: new Cesium.PerInstanceColorAppearance({ translucent: true }),
      asynchronous: false,
    });
    this.viewer.scene.primitives.add(this.interactionLayerPrimitive);
  }

  highlightHex(hexId, multi=false) {
    if (this.store.getSelectedHexIds().size > 0 && !multi) {
      this.store.clearSelectedHexIds();
    }
    this.store.addSelectedHexId(hexId);
    this.renderInteractionLayer();
  }

  unhighlightHex(hexId) {
    this.store.removeSelectedHexId(hexId);
    this.renderInteractionLayer();
  }

  clearHighlights() {
    this.store.clearSelectedHexIds();
    this.renderInteractionLayer();
  }

  setHoveredHex(hexId) {
    if (this.hoveredHexId !== hexId) {
      this.hoveredHexId = hexId;
      this.renderInteractionLayer();
    }
  }

  clearHoveredHex() {
    if (this.hoveredHexId !== null) {
      this.hoveredHexId = null;
      this.renderInteractionLayer();
    }
  }

  static createHexCellGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const pos = vertices.concat(vertices[0]);
    const posArr = pos.flatMap((pt) => [pt.longitude, pt.latitude, pt.height]);
    return Cesium.PolygonGeometry.fromPositions({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(posArr),
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
    });
  }

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