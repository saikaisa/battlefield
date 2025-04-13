import * as Cesium from 'cesium';

/**
 * InfoPanelManager 用于控制摄像机视角和图层显示，
 * 实现类似 2.5D 游戏的视角：固定斜视角、缩放限制、水平旋转自由。
 */
class InfoPanelManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.is2D = false; // 默认 3D 模式
    this.layerVisible = true; // 图层默认可见
  }

  // 全局显示：通过计算一个包含所有六角格的矩形（这里示例中使用预设的 testBounds）并调用 flyToBoundingSphere 实现
  globalView() {
    // 示例中使用 MapInitializer 中定义的测试区域边界
    const testBounds = Cesium.Rectangle.fromDegrees(-75.95, 40.57, -75.85, 40.67);
    const boundingSphere = Cesium.BoundingSphere.fromRectangle(testBounds);
    this.viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 2.0,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 15000)
    });
  }

  // 视角复位：保持当前屏幕中心位置，但重置高度和固定斜视角（例如 pitch 固定为 -45°）
  resetView() {
    // 获取当前中心点
    const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(this.viewer.camera.position);
    const centerLon = Cesium.Math.toDegrees(carto.longitude);
    const centerLat = Cesium.Math.toDegrees(carto.latitude);
    // 重设为固定高度和方向
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 10000),
      orientation: {
        heading: this.viewer.camera.heading, // 保留当前水平旋转
        pitch: Cesium.Math.toRadians(-45),    // 固定为 -45° 斜视角
        roll: 0.0
      },
      duration: 2.0
    });
  }

  // 切换 2D / 3D 模式
  toggle2D3D() {
    const scene = this.viewer.scene;
    if (scene.mode === Cesium.SceneMode.SCENE3D) {
      scene.morphTo2D(2.0);
      this.is2D = true;
    } else {
      scene.morphTo3D(2.0);
      this.is2D = false;
    }
  }

  // 切换图层可见性（这里为示例，实际可以调用图层或影像切换API）
  toggleLayerVisibility() {
    this.layerVisible = !this.layerVisible;
    // 如果有具体图层可控制，如 viewer.scene.imageryLayers.get(0)
    if(this.viewer.scene.imageryLayers && this.viewer.scene.imageryLayers.length > 0) {
      this.viewer.scene.imageryLayers.get(0).show = this.layerVisible;
    }
    console.log("图层可见性切换为：", this.layerVisible);
  }
}

let managerInstance = null;

/**
 * 设置 InfoPanelManager 的全局实例（在 MapInitializer 完成 viewer 初始化后调用）
 * @param {Cesium.Viewer} viewer 
 */
export function setInfoPanelManager(viewer) {
  managerInstance = new InfoPanelManager(viewer);
}

/**
 * 获取 InfoPanelManager 实例
 * @returns {InfoPanelManager}
 */
export function useInfoPanelManager() {
  return managerInstance;
}
