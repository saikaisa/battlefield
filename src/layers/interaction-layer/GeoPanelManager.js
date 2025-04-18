// src\layers\interaction-layer\GeoPanelManager.js
// eslint-disable-next-line no-unused-vars
import { CameraViewController } from '@/layers/geo-layer/components/CameraViewController';
// eslint-disable-next-line no-unused-vars
import { HexGridRenderer } from '@/layers/geo-layer/components/HexGridRenderer';
// eslint-disable-next-line no-unused-vars
import { ScreenInteractor } from '@/layers/interaction-layer/ScreenInteractor';
import { openGameStore } from '@/store';

/**
 * 六角格/相机视角控制相关面板管理器
 * 
 * - 视角控制区
 * - 六角格信息栏（尚未完成）
 */
export class GeoPanelManager {
  constructor(viewer, sceneManager) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.hexCells = this.store.getHexCells();
    this.cameraViewController = sceneManager.cameraViewController;
    this.hexGridRenderer = sceneManager.hexGridRenderer;
    this.screenInteractor = sceneManager.screenInteractor;
  }

  /**
   * 设置 orbit 模式（true 进入，false 退出）
   */
  setOrbitMode(enable) {
    this.cameraViewController.setOrbitMode(enable);
  }

  // 视角居中（默认范围）
  resetCameraView() {
    this.cameraViewController.resetToDefaultView();
  }

  // 视角定位到选中单位
  focusOnSelectedForce(selected_forces_list) {
    if (selected_forces_list.length === 0) {
      console.warn("没有选中任何单位");
      return;
    }

    const selectedForce = selected_forces_list[0]; // 第一个部队
    const targetHex = this.hexCells.find(hex => hex.hex_id === selectedForce.hex_id);
    if (targetHex) {
      const center = targetHex.position.points[0];
      this.cameraViewController.focusOnLocation(center.longitude, center.latitude);
    } else {
      console.warn("未找到目标六角格");
    }
  }

  // 切换图层
  toggleLayers(layerIndex) {
    this.screenInteractor.clearInteractionStyles();
    this.hexGridRenderer.renderBaseGrid(layerIndex);
  }
}
