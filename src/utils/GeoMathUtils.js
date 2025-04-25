import * as Cesium from "cesium";

/**
 * 地理数学工具类
 * 
 * 主要职责：
 * 1. 提供地理坐标计算的通用方法
 * 2. 处理经纬度、距离、角度等转换计算
 * 3. 支持各种地理空间转换操作
 */
export class GeoMathUtils {
  // 地球常量
  static EARTH_RADIUS = 6378137.0; // WGS84椭球体的平均半径（米）
  static METERS_PER_DEGREE_LAT = 111320; // 每纬度1度大约对应的米数

  /**
   * 将米转换为纬度差（度）
   * @param {number} meters 米
   * @returns {number} 纬度差（度）
   */
  static metersToDegreesLat(meters) {
    return meters / GeoMathUtils.METERS_PER_DEGREE_LAT;
  }

  /**
   * 将米转换为经度差（度），需要根据当前纬度进行校正
   * @param {number} meters 米
   * @param {number} latDegrees 当前纬度（度）
   * @returns {number} 经度差（度）
   */
  static metersToDegreesLon(meters, latDegrees) {
    const latRadians = Cesium.Math.toRadians(latDegrees);
    return meters / (GeoMathUtils.METERS_PER_DEGREE_LAT * Math.cos(latRadians));
  }

  /**
   * 将经纬度偏移转换为米偏移
   * @param {Object} center 中心点 {longitude, latitude}
   * @param {Object} point 目标点 {longitude, latitude}
   * @returns {Object} 米偏移 {x, y}
   */
  static latLonToMeters(center, point) {
    const latRadians = center.latitude * Math.PI / 180;
    const metersPerDegreeLon = GeoMathUtils.METERS_PER_DEGREE_LAT * Math.cos(latRadians);
    
    return {
      x: (point.longitude - center.longitude) * metersPerDegreeLon,
      y: (point.latitude - center.latitude) * GeoMathUtils.METERS_PER_DEGREE_LAT
    };
  }

  /**
   * 将米偏移转换为经纬度坐标
   * @param {Object} center 中心点 {longitude, latitude}
   * @param {Object} offset 米偏移 {x, y}
   * @returns {Object} 经纬度坐标 {longitude, latitude}
   */
  static metersToLatLon(center, offset) {
    const latRadians = center.latitude * Math.PI / 180;
    const lonOffset = offset.x / (GeoMathUtils.METERS_PER_DEGREE_LAT * Math.cos(latRadians));
    const latOffset = offset.y / GeoMathUtils.METERS_PER_DEGREE_LAT;

    return {
      longitude: center.longitude + lonOffset,
      latitude: center.latitude + latOffset
    };
  }

  /**
   * 按指定角度旋转二维坐标
   * @param {Object} offset 原始偏移 {x, y}
   * @param {number} angleRadians 旋转角度（弧度）
   * @returns {Object} 旋转后的偏移 {x, y}
   */
  static rotateOffset(offset, angleRadians) {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return {
      x: offset.x * cos - offset.y * sin,
      y: offset.x * sin + offset.y * cos
    };
  }

  /**
   * 计算两点之间的大圆距离（米）
   * @param {Object} point1 第一个点 {longitude, latitude}
   * @param {Object} point2 第二个点 {longitude, latitude}
   * @returns {number} 距离（米）
   */
  static calculateDistance(point1, point2) {
    const p1 = Cesium.Cartesian3.fromDegrees(
      point1.longitude,
      point1.latitude,
      0
    );
    const p2 = Cesium.Cartesian3.fromDegrees(
      point2.longitude,
      point2.latitude,
      0
    );
    return Cesium.Cartesian3.distance(p1, p2);
  }

  /**
   * 计算两点之间的方向（弧度）
   * @param {Object} startPosition 起点 {longitude, latitude}
   * @param {Object} endPosition 终点 {longitude, latitude}
   * @returns {number} 方向（弧度，0-2π）
   */
  static calculateHeading(startPosition, endPosition) {
    // 将经纬度转换为弧度计算
    const startLon = startPosition.longitude * Math.PI / 180;
    const startLat = startPosition.latitude * Math.PI / 180;
    const endLon = endPosition.longitude * Math.PI / 180;
    const endLat = endPosition.latitude * Math.PI / 180;
    
    // 计算方位角（heading，弧度）- 使用大圆航线公式计算
    const y = Math.sin(endLon - startLon) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * 
              Math.cos(endLon - startLon);
    let heading = Math.atan2(y, x);
    
    // 确保heading在[0, 2π)范围内
    if (heading < 0) {
      heading += 2 * Math.PI;
    }
    
    return heading;
  }

  /**
   * 创建东北天(ENU)坐标系到ECEF的变换矩阵
   * @param {Object} position 位置 {longitude, latitude, height}
   * @param {Object} direction 方向 {heading, pitch, roll}
   * @returns {Cesium.Matrix4} 变换矩阵
   */
  static createTransformMatrix(position, direction = {}) {
    if (!position) return Cesium.Matrix4.IDENTITY;

    // 创建位置点
    const cartesian = Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.height || 0
    );

    // 创建基础ENU矩阵
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);
    
    // 如果有方向，应用旋转
    if (direction && direction.heading !== undefined) {
      // 创建绕Z轴旋转的矩阵
      const headingRotation = Cesium.Matrix3.fromRotationZ(direction.heading || 0);
      
      if (direction.pitch !== undefined && direction.pitch !== 0) {
        // 如果有俯仰角，围绕X轴旋转
        const pitchRotation = Cesium.Matrix3.fromRotationX(direction.pitch);
        Cesium.Matrix3.multiply(headingRotation, pitchRotation, headingRotation);
      }
      
      if (direction.roll !== undefined && direction.roll !== 0) {
        // 如果有翻滚角，围绕Y轴旋转
        const rollRotation = Cesium.Matrix3.fromRotationY(direction.roll);
        Cesium.Matrix3.multiply(headingRotation, rollRotation, headingRotation);
      }
      
      // 创建旋转矩阵
      const rotationMatrix = Cesium.Matrix4.fromRotationTranslation(
        headingRotation,
        Cesium.Cartesian3.ZERO
      );
      
      // 将旋转应用到ENU矩阵
      Cesium.Matrix4.multiply(enuMatrix, rotationMatrix, enuMatrix);
    }

    return enuMatrix;
  }
} 