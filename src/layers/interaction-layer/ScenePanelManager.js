// src\layers\interaction-layer\ScenePanelManager.js
// eslint-disable-next-line no-unused-vars
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
// eslint-disable-next-line no-unused-vars
import { HexGridRenderer } from '@/layers/scene-layer/components/HexGridRenderer';
// eslint-disable-next-line no-unused-vars
import { ScreenInteractor } from '@/layers/interaction-layer/ScreenInteractor';
import { openGameStore } from '@/store';

/**
 * 场景控制相关面板管理器
 * 
 * - 视角控制区
 */
export class ScenePanelManager {
  static instance = null;

  /**
   * 获取 ScenePanelManager 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {ScenePanelManager} 单例实例
   */
  static getInstance(viewer) {
    if (!ScenePanelManager.instance) {
      if (!viewer) {
        throw new Error('首次创建 ScenePanelManager 实例时必须提供 viewer 参数');
      }
      ScenePanelManager.instance = new ScenePanelManager(viewer);
    }
    return ScenePanelManager.instance;
  }

  /**
   * 私有构造函数
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @private
   */
  constructor(viewer) {
    if (ScenePanelManager.instance) {
      throw new Error('ScenePanelManager 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.viewer = viewer;
    this.store = openGameStore();

    // 回调函数，由 SceneManager 设置
    this.onOrbitModeChange = null;
    this.onResetCamera = null;
    this.onFocusForce = null;
    this.onLayerChange = null;
    this.onSelectionModeChange = null;
  }

  /**
   * 处理 Orbit 模式切换
   * @param {boolean} enabled - 是否启用 Orbit 模式
   */
  handleOrbitMode(enabled) {
    if (typeof this.onOrbitModeChange === 'function') {
      this.onOrbitModeChange(enabled);
    }
  }

  /**
   * 处理相机重置请求
   */
  handleResetCamera() {
    if (typeof this.onResetCamera === 'function') {
      this.onResetCamera();
    }
  }

  /** 
   * 处理聚焦选中单位请求
   */
  handleFocusForce() {
    if (typeof this.onFocusForce === 'function') {
      this.onFocusForce();
    }
  }

  /**
   * 处理图层切换请求
   */
  handleLayerChange() {
    if (typeof this.onLayerChange === 'function') {
      this.onLayerChange();
    }
  }

  /**
   * 处理选择模式切换
   * @param {boolean} isMultiSelect - 是否为多选模式
   */
  handleSelectionMode(isMultiSelect) {
    if (typeof this.onSelectionModeChange === 'function') {
      this.onSelectionModeChange(isMultiSelect);
    }
  }
}
