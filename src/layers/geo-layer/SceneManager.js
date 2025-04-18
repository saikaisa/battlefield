// src\layers\geo-layer\SceneManager.js
import * as Cesium from "cesium";
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { CesiumConfig } from "@/config/GameConfig";
import { openGameStore } from '@/store';
import { CameraViewController } from '@/layers/geo-layer/components/CameraViewController';
import { HexGridGenerator } from '@/layers/geo-layer/components/HexGridGenerator';
import { HexGridRenderer } from '@/layers/geo-layer/components/HexGridRenderer';
import { ScreenInteractor } from '@/layers/interaction-layer/ScreenInteractor';

/**
 * 场景管理器
 * 
 * 加载场景、六角格、相机视角等的总管理器
 */
export class SceneManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.viewer = null;
    this.store = openGameStore();
    this.hexGridGenerator = null;
    this.hexGridRenderer = null;
    this.cameraViewController = null;
    this.screenInteractor = null;
  }

  /**
   * 异步初始化地图，并在划定区域生成六角网格
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
      this.hexGridGenerator = new HexGridGenerator(this.viewer);
      let hexCells = await this.hexGridGenerator.generateGrid();
      this.store.setHexCells(hexCells);
      // ---------------- 六角网格加载结束 ----------------

      // ---------------- 六角网格渲染开始 ----------------
      this.hexGridRenderer = new HexGridRenderer(this.viewer);
      this.hexGridRenderer.renderBaseGrid();
      // ---------------- 六角网格渲染结束 ----------------

      // ---------------- 屏幕交互器加载开始 ----------------
      this.screenInteractor = new ScreenInteractor(this.viewer, this.hexGridRenderer, { enabled: true, multiSelect: false });
      // ---------------- 屏幕交互器加载开始 ----------------
      
      // ---------------- 相机系统加载开始 ----------------
      this.cameraViewController = new CameraViewController(this.viewer);
      this.cameraViewController.initialize();
      // ---------------- 相机系统加载结束 ----------------

      return this.viewer;

    } catch (error) {
      console.error("SceneManager: 初始化地图失败", error);
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
