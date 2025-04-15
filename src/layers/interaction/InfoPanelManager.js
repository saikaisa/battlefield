import { CameraViewController } from '@/layers/geo-render/CameraViewController';
import { HexGridRenderer } from '@/layers/geo-render/HexGridRenderer';
// import { openGameStore } from '@/store';

export class InfoPanelManager {
  constructor(viewer, hexCells) {
    this.viewer = viewer;
    this.hexCells = hexCells;
    this.cameraController = new CameraViewController(viewer);
    this.hexRenderer = new HexGridRenderer(viewer);
  }

  /**
   * 设置 orbit 模式（true 进入，false 退出）
   */
  setOrbitMode(enable) {
    this.cameraController.setOrbitMode(enable);
  }

  // 视角居中（默认范围）
  resetCameraView() {
    this.cameraController.resetToDefaultView();
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
      this.cameraController.focusOnLocation(center.longitude, center.latitude);
    } else {
      console.warn("未找到目标六角格");
    }
  }

  // 地形标记隐藏开关
  toggleTerrainVisual(layerIndex) {
    if (layerIndex === 1) {
      this.hexRenderer.renderDefaultGrid();
    } else if (layerIndex === 2) {
      this.hexRenderer.renderGrid();
    } else if (layerIndex === 3) {
      this.hexRenderer.clearGrid();
    } else {
      console.warn("未知图层编号", layerIndex);
    }
  }

  // 六角格隐藏开关
  toggleHexGridVisibility(isHexGridHidden) {
    if (isHexGridHidden) {
      this.hexRenderer.clearGrid();
    } else {
      this.hexRenderer.renderGrid(this.hexCells);
    }
  }
}
