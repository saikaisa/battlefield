// src\layers\scene-layer\SceneManager.js
import * as Cesium from "cesium";
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { CesiumConfig } from "@/config/GameConfig";
import { openGameStore } from '@/store';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
import { HexGridGenerator } from '@/layers/scene-layer/components/HexGridGenerator';
import { HexGridRenderer } from '@/layers/scene-layer/components/HexGridRenderer';
import { ScreenInteractor } from '@/layers/interaction-layer/ScreenInteractor';
// eslint-disable-next-line no-unused-vars
import { ScenePanelManager } from '@/layers/interaction-layer/ScenePanelManager';

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
    this.hexGridGenerator = null;
    this.hexGridRenderer = null;
    this.cameraViewController = null;
    this.screenInteractor = null;
    this.panelManager = null;
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
      await this._loadTerrain(this.viewer, CesiumConfig.terrainAssetId);
      // ---------------- 地形加载结束 ----------------
      
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
      this.screenInteractor = ScreenInteractor.getInstance(this.viewer, {
        enabled: true,
        multiSelect: false,
        allowCancelSingle: true,
        allowCancelMulti: false
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
   * 将 ScenePanelManager 挂载进来，以后从 this.panelManager 调用
   * @param {ScenePanelManager} pm
   */
  setPanelManager(pm) {
    this.panelManager = pm;
    this._bindPanelManager();
  }

  /**
   * 绑定 ScenePanelManager 上的回调到 Cesium 控制器
   * （必须先通过 setPanelManager() 挂载）
   */
  _bindPanelManager() {
    const pm = this.panelManager;
    if (!pm) {
      console.warn("SceneManager: no panelManager set, skipping bindPanelManager()");
      return;
    }

    // 视角控制：切换 Orbit 模式
    pm.onOrbitModeChange = (enabled) => {
      this.cameraViewController.setOrbitMode(enabled);
    };

    // 重置到默认视角
    pm.onResetCamera = () => {
      this.cameraViewController.resetToDefaultView();
    };

    // 聚焦到选中的部队
    pm.onFocusForce = () => {
      const selectedForceIds = this.store.getSelectedForceIds();
      if (selectedForceIds.size === 0) {
        console.warn("没有选中任何单位");
        return;
      }

      const selectedForce = this.store.getForceById(selectedForceIds.values().next().value);
      const hexCells = this.store.getHexCells();
      const targetHex = hexCells.find(hex => hex.hexId === selectedForce.hexId);
      if (targetHex) {
        const center = targetHex.position.points[0];
        this.cameraViewController.focusOnLocation(center.longitude, center.latitude);
      } else {
        console.warn("未找到目标六角格");
      }
    };

    // 切换图层
    pm.onLayerChange = () => {
      this.hexGridRenderer.renderBaseGrid();
      this.hexGridRenderer.renderInteractGrid();
    };

    // 切换多选模式
    pm.onSelectionModeChange = (isMultiSelect) => {
      this.screenInteractor.multiSelect = isMultiSelect;
    };
  }

  /**
   * 为指定 viewer 加载地形数据。
   * 如果传入的 terrainInput 是数字，则视为 Cesium Ion 的 asset ID；
   * 如果是字符串，则视为地形数据 URL。
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {number|string} terrainInput - 地形数据的 Ion asset ID 或 URL
   * @private
   */
  async _loadTerrain(viewer, terrainInput) {
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
