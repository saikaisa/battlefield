import { Ion, Viewer, createWorldTerrain, createOsmBuildings, Cartesian3, Math as CesiumMath } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// 配置Cesium Ion访问令牌（实际项目中应使用环境变量）
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTg3Y2VmZC0wNGZlLTQyMWEtOTE3Yi0zMjA5ZTI3NTdiZjAiLCJpZCI6MjY1NzI5LCJpYXQiOjE3MzU1NTgyOTB9.5x2ohLt9GlRLXbH2LqoLBzH0olwpOm3XwavbkDNeQSQ';

/**
 * Cesium查看器服务类
 * 负责初始化和管理Cesium地图
 */
export class CesiumViewer {
  /**
   * 构造函数
   * @param {string} containerId - Cesium容器的DOM ID
   */
  constructor(containerId) {
    this.viewer = new Viewer(containerId, {
      terrainProvider: createWorldTerrain(),
      baseLayerPicker: true,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: true,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      shadows: true,
      shouldAnimate: true
    });

    // 添加OSM建筑物
    this.viewer.scene.primitives.add(createOsmBuildings());
    
    // 禁用默认的双击事件
    this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    // 设置初始视角
    this.setDefaultView();
  }

  /**
   * 设置默认视角
   */
  setDefaultView() {
    this.viewer.camera.setView({
      destination: Cartesian3.fromDegrees(116.4074, 39.9042, 10000), // 默认位置（北京）
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0.0
      }
    });
  }

  /**
   * 加载DEM地形数据
   * @param {string} terrainUrl - 地形数据URL
   */
  loadTerrain(terrainUrl) {
    if (terrainUrl) {
      const terrainProvider = new Cesium.CesiumTerrainProvider({
        url: terrainUrl
      });
      this.viewer.terrainProvider = terrainProvider;
    }
  }

  /**
   * 设置光照效果
   * @param {Object} options - 光照选项
   */
  setLighting(options = {}) {
    const { 
      enableShadows = true, 
      enableLighting = true,
      ambientLightIntensity = 0.2
    } = options;
    
    this.viewer.scene.globe.enableLighting = enableLighting;
    this.viewer.shadows = enableShadows;
    this.viewer.scene.light.intensity = ambientLightIntensity;
  }

  /**
   * 销毁Cesium实例，释放资源
   */
  destroy() {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }

  /**
   * 获取Cesium Viewer实例
   * @returns {Viewer} Cesium Viewer实例
   */
  getViewer() {
    return this.viewer;
  }
}

/**
 * 创建Cesium实体
 * @param {Viewer} viewer - Cesium Viewer实例
 * @param {Object} options - 实体选项
 * @returns {Entity} 创建的实体
 */
export function createEntity(viewer, options) {
  return viewer.entities.add(options);
}

/**
 * 移除Cesium实体
 * @param {Viewer} viewer - Cesium Viewer实例
 * @param {Entity} entity - 要移除的实体
 */
export function removeEntity(viewer, entity) {
  viewer.entities.remove(entity);
}

/**
 * 经纬度转Cartesian3
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 * @returns {Cartesian3} Cartesian3坐标
 */
export function lonLatToCartesian3(longitude, latitude, height = 0) {
  return Cartesian3.fromDegrees(longitude, latitude, height);
}
