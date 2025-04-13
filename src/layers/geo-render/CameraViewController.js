import * as Cesium from 'cesium';
import GameConfig from "../../config/GameConfig.js";

class CameraViewController {
  /**
   * 构造函数，接收 Cesium.Viewer 实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.orbitMode = false;    // 当前 orbit 模式标识
    this.orbitCenter = null;   // 固定的旋转中心（屏幕中心对应椭球点）
    this._orbitHandler = null; // 保存事件处理器，便于后续销毁
    this.preOrbitState = null; // 保存进入 orbit 模式前的相机状态（主要保存positionWC）
  }

  /**
   * 初始化视角设置：
   *  - 限定缩放范围，
   *  - 禁用 tilt 操作，
   *  - 初始视角固定为斜视，
   *  - 飞行结束后自动绑定中键点击以切换 orbit 模式。
   */
  initialize() {
    // 限制缩放范围和角度
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = GameConfig.cameraControl.minZoomDistance;
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = GameConfig.cameraControl.maxZoomDistance;
    this.viewer.scene.screenSpaceCameraController.enableTilt = GameConfig.cameraControl.enableTilt;

    // 初始视角：固定斜视角
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(GameConfig.defaultCameraView.longitude, GameConfig.defaultCameraView.latitude, GameConfig.defaultCameraView.height),
      orientation: {
        heading: Cesium.Math.toRadians(GameConfig.defaultCameraView.heading),
        pitch: Cesium.Math.toRadians(GameConfig.defaultCameraView.pitch),
        roll: 0.0
      }
    });
    this.bindOrbitToggle();
  }

  /**
   * 绑定中键点击事件，切换 orbit 模式：
   * 按下中键时：
   *  - 若当前未处于 orbit 模式，则获取屏幕中心对应的椭球点作为 pivot，
   *    并进入 orbit 模式；记录相机的 world 坐标用于退出后恢复位置（但不恢复 heading、roll）。
   *  - 再次点击中键退出 orbit 模式，平滑飞行恢复到记录的相机位置，但使用当前 heading（朝向不恢复），以及固定的 pitch。
   */
  bindOrbitToggle() {
    const canvas = this.viewer.canvas;
    const handler = new Cesium.ScreenSpaceEventHandler(canvas);
    handler.setInputAction(() => {
      this.orbitMode = !this.orbitMode;
  
      const centerScreen = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const pivot = this.viewer.camera.pickEllipsoid(centerScreen, this.viewer.scene.globe.ellipsoid);
      if (!Cesium.defined(pivot)) {
        console.warn("无法获取屏幕中心的 pivot，orbit 操作失败。");
        return;
      }
      this.orbitCenter = pivot;
      const range = Cesium.Cartesian3.distance(this.viewer.camera.position, pivot);
  
      if (this.orbitMode) {
        // 进入 orbit 模式时记录 pivot 的经纬度和高度、range
        const pivotCartographic = Cesium.Cartographic.fromCartesian(pivot);
        this.preOrbitState = {
          pivotLongitude: pivotCartographic.longitude,
          pivotLatitude: pivotCartographic.latitude,
          pivotHeight: pivotCartographic.height,
          range: range
        };
        // 进入 orbit 模式
        this.viewer.camera.lookAt(this.orbitCenter, new Cesium.HeadingPitchRange(
          this.viewer.camera.heading,
          Cesium.Math.toRadians(GameConfig.defaultCameraView.pitch),
          range
        ));
      } else {
        // 退出 orbit 模式
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        if (this.preOrbitState) {
          const pivotCartesian = Cesium.Cartesian3.fromRadians(
            this.preOrbitState.pivotLongitude,
            this.preOrbitState.pivotLatitude,
            this.preOrbitState.pivotHeight
          );
          // 平滑飞行，以pivot为中心，恢复高度和角度，保证 pivot 在屏幕中心
          this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(pivotCartesian, 0), {
            offset: new Cesium.HeadingPitchRange(
              this.viewer.camera.heading,   // 保留当前heading
              Cesium.Math.toRadians(GameConfig.defaultCameraView.pitch),   // pitch固定
              Cesium.Cartesian3.distance(this.viewer.camera.position, pivot)      // 恢复之前记录的range（高度）
            ),
            duration: 0.7  // 飞行动画时长
          });
  
          this.preOrbitState = null;
          this.orbitCenter = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.MIDDLE_CLICK);
    this._orbitHandler = handler;
  }
  

  /**
   * 销毁控制器，解除事件绑定
   */
  destroy() {
    if (this._orbitHandler) {
      this._orbitHandler.destroy();
      this._orbitHandler = null;
    }
  }
}

export { CameraViewController };
