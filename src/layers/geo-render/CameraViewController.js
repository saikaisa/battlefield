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
    this.resetToDefaultView();
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
        // 进入 orbit 模式：记录当前 pivot 经纬度和 range
        const pivotCarto = Cesium.Cartographic.fromCartesian(pivot);
        this.preOrbitState = {
          pivotLongitude: pivotCarto.longitude,
          pivotLatitude: pivotCarto.latitude,
          pivotHeight: pivotCarto.height,
          range: range
        };
  
        this.viewer.camera.lookAt(
          this.orbitCenter,
          new Cesium.HeadingPitchRange(
            this.viewer.camera.heading,
            GameConfig.defaultCameraView.pitch,
            range
          )
        );
      } else {
        // 退出 orbit 模式
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        if (this.preOrbitState) {
          const pivotCartesian = Cesium.Cartesian3.fromRadians(
            this.preOrbitState.pivotLongitude,
            this.preOrbitState.pivotLatitude,
            this.preOrbitState.pivotHeight
          );
  
          // 以 preOrbitState 记录的 pivot 恢复视角
          this.focusOnLocation(pivotCartesian, 0.7, true, this.viewer.camera.heading);
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

  /**
   * 重置相机视角到默认视角
   */
  resetToDefaultView() {
    this.focusOnLocation(Cesium.Cartesian3.fromDegrees(
      GameConfig.defaultCameraView.longitude,
      GameConfig.defaultCameraView.latitude,
      0
    ), 1.0);
  }
    
  /**
   * 定点居中显示：以45度倾斜角观察一个指定经纬度的地表上的点并居中显示
   * @param {Cesium.Cartesian3} pivot 目标点的世界坐标系形式
   * @param {number} duration 动画持续时间
   * @param {boolean} keepRange true为保持当前相机距离，false为默认距离
   * @param {number} heading 摄像机朝向（输入必须是弧度）
   * @param {number} pitch 摄像机倾斜角（输入必须是弧度）
   */
  focusOnLocation(pivot, duration=0.7, keepRange=false, heading=GameConfig.defaultCameraView.heading, pitch=GameConfig.defaultCameraView.pitch) {
    // 若旋转视角时，将视角放大到垂直地表往下看，那么此时 range = 最小限高（想象出一个等腰直角三角形就知道了）
    // 恢复到45度倾斜角时相当于围绕定点往地面方向旋转了45度，此时相机高度一定会小于最小限高，
    // 导致视角强制复位带来卡顿，视觉效果不流畅，所以这里判断 range < 最小限高的 tan45度（约等于1.5）时，
    // 将 range 设为1.5倍避免强制视角复位带来的卡顿
    const range = keepRange ? 
                  Math.max(Cesium.Cartesian3.distance(this.viewer.camera.position, pivot), 
                           GameConfig.cameraControl.minZoomDistance * 1.5) : 
                  GameConfig.defaultCameraView.range;
    console.log(`pitch = ${pitch}`);
    // 平滑飞行，以pivot为中心，恢复高度和角度，保证 pivot 在屏幕中心
    this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(pivot, 0), {
      offset: new Cesium.HeadingPitchRange(heading, pitch, range),
      duration: duration
    });
  }
}

export { CameraViewController };
