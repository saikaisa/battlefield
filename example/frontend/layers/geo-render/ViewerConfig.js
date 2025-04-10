import * as Cesium from 'cesium';

/**
 * ViewerConfig 模块：配置视图参数及初始视角
 */
export class ViewerConfig {
  /**
   * 设置初始视角
   * 此处示例定位到宾夕法尼亚州的 The Pinnacle（蓝山脉），如有需要可修改坐标
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  static setDefaultView(viewer) {
    // 推荐使用 flyTo() 命令，使视图平滑飞行
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-75.91139, 40.61278, 10000), // The Pinnacle 坐标（经度、纬度、视图高度）
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      },
      duration: 3
    });
  }
}
