import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { CameraConfig } from "@/config/GameConfig";
import { CameraView } from "@/models/CameraView";

class CameraViewController {
  /**
   * 构造函数，接收 Cesium.Viewer 实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
  }

  /**
   * 初始化视角设置：
   *  - 限定缩放范围，
   *  - 禁用 tilt 操作，
   *  - 初始视角固定为斜视，
   */
  initialize() {
    // 限制缩放等配置
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = CameraConfig.minZoomDistance;
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = CameraConfig.maxZoomDistance;
    this.viewer.scene.screenSpaceCameraController.enableTilt = CameraConfig.enableTilt;
    // 初始视角重置
    this.resetToDefaultView();
  }

  /**
   * 重置相机视角到默认视角
   */
  resetToDefaultView() {
    this.focusOnLocation(new CameraView(), 1.0);
  }

  /**
   * 定点居中显示：以45度倾斜角观察一个指定经纬度的地表上的点并居中显示
   * @param {Cesium.Cartesian3} cameraView 当前相机视角
   * @param {number} duration 动画持续时间
   * @param {boolean} keepRange true为保持当前相机距离，false为默认距离
   */
  focusOnLocation(cameraView, duration = 0.7) {
    this.store.addViewHistory(cameraView.toPlainObject()); // 移动视角前存储当前视角位置
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    
    // 平滑飞行，以pivot为中心，恢复高度和角度，保证 pivot 在屏幕中心
    this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(cameraView.getCartesianPos(), 0), {
      offset: new Cesium.HeadingPitchRange(cameraView.heading, cameraView.pitch, cameraView.range),
      duration: duration,
    });
  }

  /**
   * 根据传入的布尔值设置 orbit 模式。
   * enable 为 true 时进入 orbit 模式：以屏幕中心作为 pivot，记录状态并调用 lookAt。
   * enable 为 false 时退出 orbit 模式：解除 lookAt，并平滑恢复到以 pivot 为中心的视角。
   */
  setOrbitMode(enable) {
    // 进入 orbit 模式
    if (enable) {
      console.log(`-----------------Orbit Enable--------------`);
      const cameraView = CameraView.fromCurrentView(this.viewer);
      this.store.addViewHistory(cameraView.toPlainObject());

      // 使用当前摄像机 heading，不强制改变朝向，只固定 pivot
      this.viewer.camera.lookAt(
        cameraView.getCartesianPos(),
        new Cesium.HeadingPitchRange(
          this.viewer.camera.heading,
          CameraConfig.defaultPitch, // 固定为默认值
          cameraView.range
        )
      );
    } else {
      // 退出 orbit 模式：解除 lookAt，并平滑飞行恢复
      console.log(`-----------------Orbit Disable--------------`);
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      const oldCameraView = CameraView.fromPlainObject(this.store.getLatestViewPlain());

      const pivot = oldCameraView.getCartesianPos();
      const range = Math.max(Cesium.Cartesian3.distance(this.viewer.camera.position, pivot), CameraConfig.minZoomDistance * 1.5);
      const heading = this.viewer.camera.heading;
      const pitch = CameraConfig.defaultPitch;
      const cameraView = CameraView.create(oldCameraView.position, range, heading, pitch);
      this.focusOnLocation(cameraView, 0.7);
    }
  }
}

export { CameraViewController };
