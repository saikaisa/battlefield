// src\layers\geo-layer\components\CameraViewController.js
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { CameraConfig } from "@/config/GameConfig";
import { CameraView } from "@/models/CameraView";
import { watch } from "vue";
/**
 * 工具类：相机视角控制（单例模式）
 */
export class CameraViewController {
  static #instance = null;
  
  /**
   * 获取 CameraViewController 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {CameraViewController} 单例实例
   */
  static getInstance(viewer) {
    if (!CameraViewController.#instance) {
      if (!viewer) {
        throw new Error('首次创建 CameraViewController 实例时必须提供 viewer 参数');
      }
      CameraViewController.#instance = new CameraViewController(viewer);
    }
    return CameraViewController.#instance;
  }

  /**
   * 监听相机控制启用状态
   * 当相机控制被禁用时，保存当前输入状态并禁用用户输入
   * 当相机控制被启用时，恢复之前保存的输入状态
   */
  constructor(viewer) {
    if (CameraViewController.#instance) {
      throw new Error('CameraViewController 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.viewer = viewer;
    this.store = openGameStore();
    this._viewHistory = [];
    this._MAX_HISTORY = 10;
    // 用于存储相机飞行前的输入状态
    this._savedInputState = null;
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

    // 监听相机控制启用状态
    watch(
      () => this.store.cameraControlEnabled,
      (enabled) => {
        if (enabled) {
          // 恢复高度上限
          this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = CameraConfig.maxZoomDistance;
          this._restoreUserInputs();
        } else {
          // 暂时解除高度上限
          this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = Infinity;
          this._disableUserInputs();
        }
      }
    );
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
    this._addViewHistory(cameraView); // 移动视角前存储当前视角位置
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    
    // 禁用用户输入
    this._disableUserInputs();
    
    // 平滑飞行，以pivot为中心，恢复高度和角度，保证 pivot 在屏幕中心
    this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(cameraView.getCartesianPos(), 0), {
      offset: new Cesium.HeadingPitchRange(cameraView.heading, cameraView.pitch, cameraView.range),
      duration: duration,
      complete: () => {
        // 飞行完成后恢复用户输入
        if (this.store.cameraControlEnabled) {
          this._restoreUserInputs();
        }
      },
      cancel: () => {
        // 飞行被取消时也要恢复用户输入
        if (this.store.cameraControlEnabled) {
          this._restoreUserInputs();
        }
      }
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
      this._addViewHistory(cameraView);

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
      const oldCameraView = this._getLatestView();

      const pivot = oldCameraView.getCartesianPos();
      const range = Math.max(Cesium.Cartesian3.distance(this.viewer.camera.position, pivot), CameraConfig.minZoomDistance * 1.5);
      const heading = this.viewer.camera.heading;
      const pitch = CameraConfig.defaultPitch;
      const cameraView = CameraView.create(oldCameraView.position, range, heading, pitch);
      this.focusOnLocation(cameraView, 0.7);
    }
  }

  /**
   * 禁用用户输入控制
   * @private
   */
  _disableUserInputs() {
    const controller = this.viewer.scene.screenSpaceCameraController;
    
    // 保存当前输入状态
    this._savedInputState = {
      enableRotate: controller.enableRotate,
      enableTranslate: controller.enableTranslate,
      enableZoom: controller.enableZoom,
      enableTilt: controller.enableTilt,
      enableLook: controller.enableLook
    };
    
    // 禁用所有用户输入
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;
  }

  /**
   * 恢复用户输入控制
   * @private
   */
  _restoreUserInputs() {
    const controller = this.viewer.scene.screenSpaceCameraController;
    
    // 恢复之前保存的输入状态
    if (this._savedInputState) {
      controller.enableRotate = this._savedInputState.enableRotate;
      controller.enableTranslate = this._savedInputState.enableTranslate;
      controller.enableZoom = this._savedInputState.enableZoom;
      controller.enableTilt = this._savedInputState.enableTilt;
      controller.enableLook = this._savedInputState.enableLook;
      
      this._savedInputState = null;
    }
  }

  // ==================== 视角历史记录 ====================
  /**
   * 添加一条视角历史记录
   * @param {CameraView} view - 视角对象
   */
  _addViewHistory(view) {
    if (!(view instanceof CameraView)) {
      throw new Error('视角记录必须是 CameraView 实例');
    }
    this._viewHistory.push(view);
    if (this._viewHistory.length > this._MAX_HISTORY) {
      this._viewHistory.shift();
    }
  }

  /**
   * 获取最近一条视角历史记录
   * @returns {CameraView | null} 最近的视角记录，如果没有则返回 null
   */
  _getLatestView() {
    return this._viewHistory.length > 0 ? 
      this._viewHistory[this._viewHistory.length - 1] : 
      null;
  }

  /**
   * 获取所有视角历史记录
   * @returns {Array} 视角历史记录数组
   */
  _getViewHistory() {
    return this._viewHistory;
  }

  /**
   * 清空视角历史记录
   */
  _clearViewHistory() {
    this._viewHistory = [];
  }
}
