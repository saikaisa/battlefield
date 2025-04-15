import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { ViewerConfig } from './ViewerConfig';
// TerrainLoader 在 DEM 数据加载需要时调用，可在后续扩展时使用
import { TerrainLoader } from './TerrainLoader';

export class SceneManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.viewer = null;
  }

  /**
   * 异步初始化地图
   */
  async init() {
    try {
      // 使用官方 API 异步获取世界地形（示例资产ID 3957，你可以按需要更改）
      const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(3957);
      this.viewer = new Cesium.Viewer(this.containerId, {
        terrainProvider: terrainProvider,
        baseLayerPicker: true,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: true,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: true,
        shouldAnimate: true
      });
      
      // 异步加载 OSM 建筑（若加载失败不会阻塞地图显示）
      try {
        const tileset = await Cesium.createOsmBuildingsAsync();
        this.viewer.scene.primitives.add(tileset);
      } catch (err) {
        console.error("加载 OSM Buildings 失败：", err);
      }
      
      // 禁用默认双击事件
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
      
      // 调用视图配置模块，设置初始视角与分辨率
      ViewerConfig.setDefaultView(this.viewer);
      
      return this.viewer;
    } catch (error) {
      console.error("SceneManager: 初始化地图失败", error);
      throw error;
    }
  }
}
