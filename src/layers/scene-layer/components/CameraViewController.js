// src\layers\geo-layer\components\CameraViewController.js
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { CameraConfig, HexConfig } from "@/config/GameConfig";
import { CameraView } from "@/layers/scene-layer/utils/CameraView";
// eslint-disable-next-line no-unused-vars
import { HexCell } from "@/models/HexCell";
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
    // 跟踪相机是否正在飞行中
    this._isFlying = false;
    // 当前活跃的飞行ID，用于追踪最近的飞行请求
    this._currentFlightId = 0;
    // 防抖定时器ID
    this._focusDebounceTimer = null;
    // 飞行安全计时器ID（确保飞行能在超时后恢复输入控制）
    this._flightSafetyTimer = null;
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
          // 恢复用户输入
          this._restoreUserInputs();
        } else {
          // 暂时解除高度上限
          this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = Infinity;
          // 禁用用户输入
          this._disableUserInputs();
        }
      }
    );
  }

  /**
   * 重置相机视角到默认视角（看向地图中心）
   * @returns {Promise} 返回一个Promise，在飞行完成后resolve
   */
  resetToDefaultView() {
    return this.focusOnLocation(new CameraView(), 1.0);
  }

  /**
   * 恢复正常视角（相机看向的中心位置不变）
   * @returns {Promise} 返回一个Promise，在飞行完成后resolve
   */
  resetView() {
    const cameraView = CameraView.fromCurrentView(this.viewer);
    return this.focusOnLocation(cameraView, 0.5);
  }

  /**
   * 取消当前进行中的相机飞行
   * @private
   */
  _cancelCurrentFlight() {
    if (this._isFlying) {
      this.viewer.camera.cancelFlight();
      // 确保手动调用恢复输入
      this._restoreUserInputs();
      this._isFlying = false;
    }
    
    // 清除所有相关计时器
    if (this._flightSafetyTimer) {
      clearTimeout(this._flightSafetyTimer);
      this._flightSafetyTimer = null;
    }
  }

  /**
   * 聚焦到指定六角格
   * @param {string} hexId 六角格ID
   * @param {number} duration 动画持续时间
   * @returns {Promise} 返回一个Promise，在飞行完成后resolve
   */
  focusOnHex(hexId, duration = 0.7) {
    return new Promise((resolve, reject) => {
      // 防抖处理：如果短时间内多次调用，只执行最后一次
      if (this._focusDebounceTimer) {
        clearTimeout(this._focusDebounceTimer);
      }
      
      this._focusDebounceTimer = setTimeout(() => {
        try {
          const hexCell = this.store.getHexCellById(hexId);
          if (!hexCell) {
            console.warn(`无法找到六角格: ${hexId}`);
            return reject(new Error(`无法找到六角格: ${hexId}`));
          } 
          const center = hexCell.getCenter();
          const cameraView = CameraView.closeUpView(this.viewer,
            Cesium.Cartographic.fromDegrees(center.longitude, center.latitude, center.height)
          );
          this.focusOnLocation(cameraView, duration)
            .then(resolve)
            .catch(reject);
        } catch (error) {
          console.error("聚焦六角格发生错误:", error);
          // 确保恢复输入控制
          this._restoreUserInputs();
          this._isFlying = false;
          reject(error);
        }
      }, 100); // 100ms防抖延迟
    });
  }

  /**
   * 定点居中显示：以45度倾斜角观察一个指定经纬度的地表上的点并居中显示
   * @param {CameraView} [cameraView] 当前相机视角对象
   * @param {number} [duration] 动画持续时间
   * @param {boolean} [save] 是否保存当前视角到历史记录
   * @returns {Promise} 返回一个Promise，在飞行完成后resolve
   */
  focusOnLocation(cameraView, duration = 0.7, save = true) {
    // 返回Promise，在飞行完成后resolve
    return new Promise((resolve, reject) => {
      try {
        // 取消之前正在进行的飞行
        this._cancelCurrentFlight();
        
        // 如果没有传入cameraView，则恢复上一次的视角
        if (!cameraView) {
          const lastView = this._getLatestView();
          if (lastView) {
            cameraView = lastView;
            // console.log(`恢复上一次的视角: ${cameraView.position.latitude}, ${cameraView.position.longitude}, ${cameraView.position.height}`);
          } else {
            // 如果没有历史视角，则使用默认视角
            cameraView = new CameraView();
            // console.log(`没有历史视角，使用默认视角: ${cameraView.position.latitude}, ${cameraView.position.longitude}, ${cameraView.position.height}`);
          }
        }

        // 创建本次飞行的ID
        const flightId = ++this._currentFlightId;
        if (save) {
          this._addViewHistory(cameraView); // 移动视角前存储当前视角位置
        }
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        
        // 标记飞行状态并禁用用户输入
        this._isFlying = true;
        this._disableUserInputs();
        
        // 设置安全计时器，确保即使飞行回调未触发，也能在一定时间后恢复输入
        if (this._flightSafetyTimer) {
          clearTimeout(this._flightSafetyTimer);
        }
        this._flightSafetyTimer = setTimeout(() => {
          if (this._isFlying && this._currentFlightId === flightId) {
            console.warn("相机飞行安全超时，强制恢复输入控制");
            this._restoreUserInputs();
            this._isFlying = false;
            resolve(); // 超时也要resolve Promise
          }
        }, (duration * 1000) + 2000); // 飞行时间 + 2秒安全边界
        
        // 平滑飞行，以pivot为中心，恢复高度和角度，保证 pivot 在屏幕中心
        this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(cameraView.getCartesianPos(), 0), {
          offset: new Cesium.HeadingPitchRange(cameraView.heading, cameraView.pitch, cameraView.range),
          duration: duration,
          complete: () => {
            // 只有当这是最近的飞行请求时，才恢复输入
            if (this._currentFlightId === flightId) {
              // 飞行完成后恢复用户输入
              this._isFlying = false;
              if (this.store.cameraControlEnabled) {
                this._restoreUserInputs();
              }
              resolve(); // 飞行完成时resolve Promise
            }
          },
          cancel: () => {
            // 只有当这是最近的飞行请求时，才恢复输入
            if (this._currentFlightId === flightId) {
              // 飞行被取消时也要恢复用户输入
              this._isFlying = false;
              if (this.store.cameraControlEnabled) {
                this._restoreUserInputs();
              }
              resolve(); // 飞行取消时也resolve Promise
            }
          }
        });
      } catch (error) {
        console.error("聚焦位置发生错误:", error);
        // 确保恢复输入控制
        this._restoreUserInputs();
        this._isFlying = false;
        reject(error); // 发生错误时reject Promise
      }
    });
  }

  /**
   * 设置顶视图俯瞰模式，可以看到整个战场区域
   * @returns {Promise} 返回一个Promise，在飞行完成后resolve
   */
  setTopDownView() {
    // 在切换到俯瞰视角前保存当前视角，以便后续恢复
    const currentView = CameraView.fromCurrentView(this.viewer);
    this._addViewHistory(currentView);
    
    // 计算地图中心点和合适的距离
    const bounds = HexConfig.bounds;
    const centerLon = (bounds.maxLon + bounds.minLon) / 2;
    const centerLat = (bounds.maxLat + bounds.minLat) / 2;
    
    // 计算地图对角线长度，以确定合适的相机高度
    const diagonalDistance = Cesium.Cartesian3.distance(
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(bounds.minLon, bounds.minLat)),
      Cesium.Cartographic.toCartesian(Cesium.Cartographic.fromDegrees(bounds.maxLon, bounds.maxLat))
    );
    
    // 设置适当的高度，确保可以看到整个区域
    const range = diagonalDistance * 1.6;
    
    // 创建俯瞰视角
    const panoramaView = new CameraView();
    panoramaView.position = Cesium.Cartographic.fromDegrees(centerLon, centerLat, 0);
    panoramaView.range = range;
    panoramaView.heading = 0; // 正北方向
    panoramaView.pitch = Cesium.Math.toRadians(-90); // 垂直向下俯瞰
    // console.log(`设置俯瞰视角: ${panoramaView.position.latitude}, ${panoramaView.position.longitude}, ${panoramaView.position.height}`);
    
    // 飞行到俯瞰位置，并返回Promise
    return this.focusOnLocation(panoramaView, 2.0, false);
  }

  /**
   * 根据传入的布尔值设置 orbit 模式。
   * enable 为 true 时进入 orbit 模式：以屏幕中心作为 pivot，记录状态并调用 lookAt。
   * enable 为 false 时退出 orbit 模式：解除 lookAt，并平滑恢复到以 pivot 为中心的视角。
   * @param {boolean} enable 是否启用环绕模式
   * @returns {Promise} 返回一个Promise，在操作完成后resolve
   */
  setOrbitMode(enable) {
    // 进入 orbit 模式
    if (enable) {
      console.log(`-----------------Orbit Enable--------------`);
      const cameraView = CameraView.fromCurrentView(this.viewer);
      if (!cameraView) {
        console.error("无法获取当前视角，无法进入环绕模式");
        return Promise.reject(new Error("无法获取当前视角"));
      }
      
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
      return Promise.resolve(); // 立即完成
    } else {
      // 退出 orbit 模式：解除 lookAt，并平滑飞行恢复
      console.log(`-----------------Orbit Disable--------------`);
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      let oldCameraView = this._getLatestView();
      
      // 如果无法获取历史视角，则使用默认视角
      if (!oldCameraView) {
        console.error("无法获取历史视角！");
        return this.resetView();
      }

      const pivot = oldCameraView.getCartesianPos();
      const range = Math.max(Cesium.Cartesian3.distance(this.viewer.camera.position, pivot), CameraConfig.minZoomDistance * 1.5);
      const heading = this.viewer.camera.heading;
      const pitch = CameraConfig.defaultPitch;
      const cameraView = CameraView.create(oldCameraView.position, range, heading, pitch);
      return this.focusOnLocation(cameraView, 0.7);
    }
  }

  /**
   * 禁用用户输入控制
   * @private
   */
  _disableUserInputs() {
    const controller = this.viewer.scene.screenSpaceCameraController;
    
    // 保存当前输入状态（如果尚未保存）
    if (!this._savedInputState) {
      this._savedInputState = {
        enableRotate: controller.enableRotate,
        enableTranslate: controller.enableTranslate,
        enableZoom: controller.enableZoom,
        enableTilt: controller.enableTilt,
        enableLook: controller.enableLook
      };
    }
    
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
    } else {
      // 如果没有保存的状态，则默认全部启用
      controller.enableRotate = CameraConfig.enableRotate;
      controller.enableTranslate = CameraConfig.enableTranslate;
      controller.enableZoom = CameraConfig.enableZoom;
      controller.enableTilt = CameraConfig.enableTilt;
      controller.enableLook = CameraConfig.enableLook;
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
