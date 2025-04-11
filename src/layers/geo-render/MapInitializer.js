import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { HexGridGenerator } from './HexGridGenerator';
import { HexGridRenderer } from './HexGridRenderer';

export class MapInitializer {
  constructor(containerId) {
    this.containerId = containerId;
    this.viewer = null;
    this.hexGridGenerator = null;
    this.hexGridRenderer = null;
  }

  /**
   * 异步初始化地图，并在测试区域生成六角网格
   */
  async init() {
    try {
      // 初始化 Cesium Viewer
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

      // 隐藏版权信息区域
      this.viewer._cesiumWidget._creditContainer.style.display = 'none';

      // 异步加载地形数据（使用 Cesium Ion assetId 3957）
      await this.loadTerrain(this.viewer, 3957);
      
      // 异步加载 OSM Buildings（加载失败不阻塞地图显示）
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
      
      // 设置初始视角（例如定位到宾夕法尼亚州 The Pinnacle）
      this.setDefaultView(this.viewer);
      
      // ----- 六角网格生成与渲染测试 -----
      // 定义一个测试区域边界（单位：度），可根据实际需要调整
      const testBounds = { 
        minLon: -75.95, 
        maxLon: -75.85, 
        minLat: 40.57, 
        maxLat: 40.67 
      };
      const hexRadius = 500; // 500 米（从中心到顶点的距离）
      
      // 生成六角网格数据
      const hexGridGenerator = new HexGridGenerator(testBounds, hexRadius, this.viewer);
      let hexCells = await hexGridGenerator.generateGrid();
      
      // 创建 HexGridRenderer 实例并将六角网格渲染到地图上
      this.hexGridRenderer = new HexGridRenderer(this.viewer);
      this.hexGridRenderer.renderGrid(hexCells);
      // ----- 六角网格渲染结束 -----
      
      return this.viewer;
    } catch (error) {
      console.error("MapInitializer: 初始化地图失败", error);
      throw error;
    }
  }

  /**
   * 为指定 viewer 加载地形数据。
   * 如果传入的 terrainInput 是数字，则视为 Cesium Ion 的 asset ID；
   * 如果是字符串，则视为地形数据 URL。
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {number|string} terrainInput - 地形数据的 Ion asset ID 或 URL
   */
  async loadTerrain(viewer, terrainInput) {
    try {
      let terrainProvider = null;
      if (typeof terrainInput === 'number') {
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(terrainInput);
      } else if (typeof terrainInput === 'string') {
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
      destination: Cesium.Cartesian3.fromDegrees(-75.91139, 40.61278, 10000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      },
      duration: 3
    });
  }
}
