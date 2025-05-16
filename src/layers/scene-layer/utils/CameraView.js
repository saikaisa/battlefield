// src\models\CameraView.js
import * as Cesium from 'cesium';
import { CameraConfig } from "@/config/GameConfig.js";

export class CameraView {
  /**
   * 构造函数
   * @param {Cesium.Cartographic} position - 聚焦中心位置
   * @param {number} range - 相机距离
   * @param {number} heading - 相机水平朝向角度
   * @param {number} pitch - 相机垂直倾斜角度
   */
  constructor() {
    this.position = CameraConfig.defaultPosition;
    this.range = CameraConfig.defaultRange;
    this.heading = CameraConfig.defaultHeading;
    this.pitch = CameraConfig.defaultPitch;
  }

  /**
   * 使用详细信息创建视角
   * @param {Cesium.Cartographic} position - 聚焦中心位置
   * @param {number} range - 相机距离
   * @param {number} heading - 相机水平朝向角度
   * @param {number} pitch - 相机垂直倾斜角度
   * @returns {CameraView|null}
   */
  static create(position, range, heading, pitch) {
    const cam = new CameraView();
    cam.position = position;
    cam.range = range;
    cam.heading = heading;
    cam.pitch = pitch;
    return cam;
  }

  /**
   * 获取当前视角
   * @param {Cesium.Viewer} viewer - Cesium 实例
   * @returns {CameraView|null}
   */
  static fromCurrentView(viewer) {
    const cam = new CameraView();
    const canvas = viewer.canvas;
    const centerScreen = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    
    // 使用ray picking获取包含地形高度的点，而不是pickEllipsoid
    const ray = viewer.camera.getPickRay(centerScreen);
    const pivot = viewer.scene.globe.pick(ray, viewer.scene);
    
    // 如果没有找到地形表面的交点，则回退到椭球表面
    let ellipsoidPivot;
    if (!Cesium.defined(pivot)) {
      ellipsoidPivot = viewer.camera.pickEllipsoid(centerScreen, viewer.scene.globe.ellipsoid);
      if (!Cesium.defined(ellipsoidPivot)) {
        console.error("无法获取 pivot");
        return null;
      }
      cam.position = Cesium.Cartographic.fromCartesian(ellipsoidPivot);
    } else {
      cam.position = Cesium.Cartographic.fromCartesian(pivot);
    }
    
    // 若旋转视角时，将视角放大到垂直地表往下看，那么此时 range = 最小限高（想象出一个等腰直角三角形就知道了）
    // 恢复到45度倾斜角时相当于围绕定点往地面方向旋转了45度，此时相机高度一定会小于最小限高，
    // 导致视角强制复位带来卡顿，视觉效果不流畅，所以这里判断 range < 最小限高的 tan45度（约等于1.5）时，
    // 将 range 设为1.5倍避免强制视角复位带来的卡顿
    const pivotPoint = Cesium.defined(pivot) ? pivot : ellipsoidPivot;
    const range = Cesium.Cartesian3.distance(viewer.camera.position, pivotPoint);
    const fixedRange = Math.max(range, CameraConfig.minZoomDistance * 1.5);
    cam.range = fixedRange;
    cam.heading = viewer.camera.heading;
    cam.pitch = viewer.camera.pitch;
    return cam;
  }

  /**
   * 视角凑近某一位置，用于特写
   * @param {Cesium.Viewer} viewer - Cesium 实例
   * @param {Cesium.Cartographic} position - 聚焦中心位置
   * @returns {CameraView|null}
   */
  static closeUpView(viewer, position) {
    const cam = new CameraView();
    cam.position = position;
    cam.range = CameraConfig.closeUpRange;
    cam.heading = viewer.camera.heading;
    cam.pitch = CameraConfig.defaultPitch;
    return cam;
  }

  /**
   * 视角拉远，用于总览
   * @param {Cesium.Viewer} viewer - Cesium 实例
   * @param {Cesium.Cartographic} position - 聚焦中心位置
   * @returns {CameraView|null}
   */
  static panoramicView(viewer, position) {
    const cam = new CameraView();
    cam.position = position;
    cam.range = CameraConfig.maxZoomDistance;
    cam.heading = viewer.camera.heading;
    cam.pitch = CameraConfig.defaultPitch;
    return cam;
  }

  /**
   * 得到坐标的 Cartesian3 形式（笛卡尔坐标）
   * @returns {Cesium.Cartesian3}
   */
  getCartesianPos() {
    return Cesium.Ellipsoid.WGS84.cartographicToCartesian(this.position);
  }

  /**
   * 得到坐标的 Cartographic 形式（经纬度弧度）
   * @returns {Cesium.Cartographic}
   */
  getCartographicPos() {
    return this.position;
  }

  /**
   * 返回纯数据对象（用于存入 store）
   */
  toPlainObject() {
    return {
      position: {
        longitude: this.position.longitude,
        latitude: this.position.latitude,
        height: this.position.height
      },
      range: this.range,
      heading: this.heading,
      pitch: this.pitch
    };
  }

  /**
   * 从纯数据对象还原为 CameraView 实例（静态方法）
   */
  static fromPlainObject(plainObj) {
    if (!plainObj) {
      return null;
    }
    const cam = new CameraView();
    cam.position = new Cesium.Cartographic(
      plainObj.position.longitude,
      plainObj.position.latitude,
      plainObj.position.height
    );
    cam.range = plainObj.range;
    cam.heading = plainObj.heading;
    cam.pitch = plainObj.pitch;
    return cam;
  }
}
