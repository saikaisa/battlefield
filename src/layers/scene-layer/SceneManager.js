// src\layers\scene-layer\SceneManager.js
import * as Cesium from "cesium";
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { CesiumConfig } from "@/config/GameConfig";
import { openGameStore } from '@/store';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
import { HexGridGenerator } from '@/layers/scene-layer/components/HexGridGenerator';
import { HexGridRenderer } from '@/layers/scene-layer/components/HexGridRenderer';
import { HexHeightCache } from '@/layers/scene-layer/components/HexHeightCache';
import { SceneInteractor } from '@/layers/interaction-layer/SceneInteractor';

/**
 * 场景管理器（单例模式）
 * 
 * 加载场景、六角格、相机视角等的总管理器
 */
export class SceneManager {
  static #instance = null;

  /**
   * 获取 SceneManager 的单例实例
   * @param {string} containerId - 容器ID（仅首次调用时需要）
   * @returns {SceneManager} 单例实例
   */
  static getInstance(containerId) {
    if (!SceneManager.#instance) {
      if (!containerId) {
        throw new Error('首次创建 SceneManager 实例时必须提供 containerId');
      }
      SceneManager.#instance = new SceneManager(containerId);
    }
    return SceneManager.#instance;
  }

  /**
   * 私有构造函数
   * @param {string} containerId - 容器ID
   * @private
   */
  constructor(containerId) {
    if (SceneManager.#instance) {
      throw new Error('SceneManager 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.containerId = containerId;
    this.viewer = null;
    this.store = openGameStore();
    
    // 各个管理器实例
    this.hexHeightCache = null;
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
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        shadows: true,
        shouldAnimate: true,
        scene3DOnly: true,
        requestRenderMode: true,  // 只在需要时渲染
        maximumRenderTimeChange: 0.0, // 不做额外渲染
      });
      // 隐藏版权信息区域
      this.viewer._cesiumWidget._creditContainer.style.display = 'none';
      // 禁用默认双击事件
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );

      this.viewer.extend(Cesium.viewerCesiumInspectorMixin);

      // ---------------- 底图加载开始 ----------------
      await this.loadAssets(
        this.viewer, 
        CesiumConfig.terrainAssetId, 
        CesiumConfig.imageryAssetId
      );
      // ---------------- 底图加载结束 ----------------
      
      // ---------------- 地形高度缓存系统初始化开始 ----------------
      this.hexHeightCache = HexHeightCache.getInstance(this.viewer);
      // ---------------- 地形高度缓存系统初始化结束 ----------------
      
      // ---------------- 六角网格加载开始 ----------------
      this.hexGridGenerator = HexGridGenerator.getInstance(this.viewer);
      let hexCells = await this.hexGridGenerator.generateGrid();
      this.store.setHexCells(hexCells);
      // ---------------- 六角网格加载结束 ----------------

      // ---------------- 六角网格渲染开始 ----------------
      this.hexGridRenderer = HexGridRenderer.getInstance(this.viewer);
      this.hexGridRenderer.renderBaseGrid();
      // ---------------- 六角网格渲染结束 ----------------

      // ---------------- 屏幕交互器加载开始 ----------------
      this.screenInteractor = SceneInteractor.getInstance(this.viewer, {
        enabled: true,
        multiSelect: false
      });
      // ---------------- 屏幕交互器加载结束 ----------------
      
      // ---------------- 相机系统加载开始 ----------------
      this.cameraViewController = CameraViewController.getInstance(this.viewer);
      this.cameraViewController.initialize();
      // ---------------- 相机系统加载结束 ----------------

      return this.viewer;
    } catch (error) {
      console.error("SceneManager: 初始化地图失败", error);
      throw error;
    }
  }

  /**
   * 为指定 viewer 加载底图数据。
   * 如果传入的 terrainInput 是数字，则视为 Cesium Ion 的 asset ID；
   * 如果是字符串，则视为底图数据 URL。
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {number|string} terrainInput - 底图数据的 Ion asset ID 或 URL
   * @param {number|string} imageryInput - 影像数据的 Ion asset ID 或 URL
   */
  async loadAssets(viewer, terrainInput, imageryInput) {
    try {
      // 加载地形数据
      let terrainProvider = null;
      if (typeof terrainInput === 'number') {
        console.log(`正在加载地形数据，Asset ID: ${terrainInput}`);
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(terrainInput);
      } else if (typeof terrainInput === 'string') {
        terrainProvider = new Cesium.CesiumTerrainProvider({
          url: terrainInput
        });
      }
      viewer.terrainProvider = terrainProvider;
      console.log("地形数据加载成功");

      // 加载影像数据
      try {
        console.log(`正在加载影像数据，Asset ID: ${imageryInput}`);
        const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(imageryInput);
        const layer = new Cesium.ImageryLayer(imageryProvider);
        viewer.imageryLayers.add(layer);
      } catch (imgError) {
        console.error("加载影像数据失败：", imgError);
      }
      console.log("影像数据加载成功");

      // 加载 OSM Buildings
      if (CesiumConfig.genOsmBuildings) {
        try {
          const tileset = await Cesium.createOsmBuildingsAsync();
          this.viewer.scene.primitives.add(tileset);
        } catch (err) {
          console.error("加载 OSM Buildings 失败：", err);
        }
      }
      console.log("OSM Buildings 加载成功");
    } catch (error) {
      console.error("加载底图数据失败：", error);
    }
  }
}
