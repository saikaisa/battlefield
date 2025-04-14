import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { CesiumConfig } from "@/config/GameConfig";
import { openGameStore } from '@/store';
import { CameraViewController } from './CameraViewController';
import { HexGridGenerator } from './HexGridGenerator';
import { HexGridRenderer } from './HexGridRenderer';
import { UnitModelLoader } from "@/layers/unit-render/UnitModelLoader";

export class MapInitializer {
  constructor(containerId) {
    this.containerId = containerId;
    this.viewer = null;
    this.gameStore = openGameStore();
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
      // 禁用默认双击事件
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );

      // ---------------- 地形加载开始 ----------------
      await this.loadTerrain(this.viewer, CesiumConfig.terrainAssetId);
      // ---------------- 地形加载结束 ----------------
      

      // ---------------- 六角网格加载开始 ----------------
      // 生成六角网格数据
      const hexGridGenerator = new HexGridGenerator(this.viewer);
      let hexCells = await hexGridGenerator.generateGrid();
      this.gameStore.setHexCells(hexCells);
      
      // 创建 HexGridRenderer 实例并将六角网格渲染到地图上
      const hexGridRenderer = new HexGridRenderer(this.viewer);
      hexGridRenderer.renderGrid(hexCells);
      // ---------------- 六角网格加载结束 ----------------

      
      // ---------------- 相机系统加载开始 ----------------
      const cameraViewController = new CameraViewController(this.viewer);
      cameraViewController.initialize();
      // ---------------- 相机系统加载结束 ----------------


      // ---------------- 兵种系统加载开始 ----------------
      // 假设 hexCells 为生成的六角格数组（见 HexGridGenerator.js 中 generateGrid 方法返回的数据）
      // 此处取第一个六角格的中心点作为部队单位的放置位置
      const firstHex = hexCells[0];
      const centerPoint = firstHex.position.points[0];  // 第一个点为中心点

      // 将中心点（包含经纬度、高度）转换为 Cartesian3 坐标
      const unitPosition = Cesium.Cartesian3.fromDegrees(centerPoint.longitude, centerPoint.latitude, centerPoint.height+500);

      // 创建模型优化实例，传入当前 Viewer 对象
      const unitModelLoader = new UnitModelLoader(this.viewer);

      // 定义用于加载 GLB 单位模型的渲染属性，其中 lod_levels 可定义不同细节级别的模型路径
      const renderingAttributes = {
        // 当未启用 LOD 动态切换时，可直接指定基础模型路径
        model_path: "../../assets/plane.gltf",
        // 定义 LOD 方案：距离越远加载越低细节的模型
        lod_levels: [
          { level: 0, distance: 0, model_path: "/assets/plane.gltf" },
          { level: 1, distance: 800, model_path: "/assets/plane.gltf" },
          { level: 2, distance: 1500, model_path: "/assets/plane.gltf" }
        ]
      };

      // 加载并渲染 GLB 模型到指定位置，返回对象包含当前模型和 dispose 方法
      const unitModelHandle = unitModelLoader.loadUnitModelWithLOD(renderingAttributes, unitPosition);

      // 此处，你可以在控制台输出 unitModelHandle 或在调试时检查是否正确加载
      console.log("单位模型加载成功：", unitModelHandle);
      // ---------------- 兵种系统加载结束 ----------------
      

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
      // 异步加载地形数据
      let terrainProvider = null;
      if (typeof terrainInput === 'number') {
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(terrainInput);
      } else if (typeof terrainInput === 'string') {
        terrainProvider = new Cesium.CesiumTerrainProvider({
          url: terrainInput
        });
      }
      viewer.terrainProvider = terrainProvider;

      // 异步加载 OSM Buildings（加载失败不阻塞地图显示）
      if (CesiumConfig.genOsmBuildings) {
        try {
          const tileset = await Cesium.createOsmBuildingsAsync();
          this.viewer.scene.primitives.add(tileset);
        } catch (err) {
          console.error("加载 OSM Buildings 失败：", err);
        }
      }
    } catch (error) {
      console.error("加载地形失败：", error);
    }
  }
}
