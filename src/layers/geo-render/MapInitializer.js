import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export class MapInitializer {
  constructor(containerId) {
    this.containerId = containerId;
    this.viewer = null;
  }

  /**
   * 异步初始化地图
   */
  async init() {
    try {
      this.viewer = new Cesium.Viewer(this.containerId, {
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

      this.viewer._cesiumWidget._creditContainer.style.display = 'none';

      // 异步加载地形数据
      await this.loadTerrain(this.viewer, 3957);
      
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
      this.setDefaultView(this.viewer);
      
      return this.viewer;
    } catch (error) {
      console.error("MapInitializer: 初始化地图失败", error);
      throw error;
    }
  }

  /**
   * 为指定 viewer 加载地形数据。
   * 如果传入的 terrainInput 是数字，则视为 Cesium Ion 的 asset ID，
   * 如果是字符串，则视为地形数据 URL。
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {number|string} terrainInput - 地形数据的 Ion asset ID 或 URL
   */
  async loadTerrain(viewer, terrainInput) {
    try {
      let terrainProvider = null;
      if (typeof terrainInput === 'number') {
        // 使用 Cesium Ion asset ID 获取地形数据
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(terrainInput);
      } else if (typeof terrainInput === 'string') {
        // 按 URL 方式加载地形数据
        terrainProvider = new Cesium.CesiumTerrainProvider({
          url: terrainInput
        });
      }
      viewer.terrainProvider = terrainProvider;
    } catch (error) {
      console.error("加载地形失败：", error);
    }
  }

  /**
   * 设置初始视角
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  setDefaultView(viewer) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-75.91139, 40.61278, 10000), // The Pinnacle 坐标（经度、纬度、视图高度）
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      },
      duration: 3
    });
  }
}
