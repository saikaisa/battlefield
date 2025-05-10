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
   * 计算两点之间的航向角（heading）
   * @param {Object} from 起点 {longitude, latitude}（十进制度数）
   * @param {Object} to 终点 {longitude, latitude}（十进制度数）
   * @returns {number} 航向角（弧度）
   */
  static calculateHeading(from, to) {
    if (!from || !to) {
      console.error("计算航向角失败：无效的起点或终点");
      return 0;
    }
    
    try {
      // 将经纬度转换为弧度
      const fromRadians = Cesium.Cartographic.fromDegrees(from.longitude, from.latitude);
      const toRadians = Cesium.Cartographic.fromDegrees(to.longitude, to.latitude);
      
      // 使用Cesium的geodesic计算方法获取准确的航向角
      // 这会考虑地球曲率影响，返回更准确的结果
      const geodesic = new Cesium.EllipsoidGeodesic(fromRadians, toRadians);
      
      // 返回相反的航向角，修复角度方向问题
      return -geodesic.startHeading;
    } catch (error) {
      console.error("计算航向角失败:", error);
      // 如果Cesium方法失败，回退到简化的计算
      const dLon = Cesium.Math.toRadians(to.longitude - from.longitude);
      const lat1 = Cesium.Math.toRadians(from.latitude);
      const lat2 = Cesium.Math.toRadians(to.latitude);
      
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      // 返回相反的角度
      return -Math.atan2(y, x);
    }
  }

  /**
   * 计算两点之间的距离（米）
   * @param {Object} from 起点 {longitude, latitude}（十进制度数）
   * @param {Object} to 终点 {longitude, latitude}（十进制度数）
   * @returns {number} 距离（米）
   */
  static calculateDistance(from, to) {
    // 转换为Cesium坐标点
    const fromCartographic = Cesium.Cartographic.fromDegrees(from.longitude, from.latitude);
    const toCartographic = Cesium.Cartographic.fromDegrees(to.longitude, to.latitude);
    
    // 转换为笛卡尔坐标
    const fromCartesian = Cesium.Cartographic.toCartesian(fromCartographic);
    const toCartesian = Cesium.Cartographic.toCartesian(toCartographic);
    
    // 计算距离
    return Cesium.Cartesian3.distance(fromCartesian, toCartesian);
  }

  /**
   * 线性插值两点之间的位置
   * @param {Object} from 起点 {longitude, latitude}（十进制度数）
   * @param {Object} to 终点 {longitude, latitude}（十进制度数）
   * @param {number} t 插值因子 (0-1)
   * @returns {Object} 插值结果 {longitude, latitude}
   */
  static lerpPosition(from, to, t) {
    // 确保t在0-1范围内
    t = Math.max(0, Math.min(1, t));
    
    // 线性插值经纬度
    const longitude = from.longitude + (to.longitude - from.longitude) * t;
    const latitude = from.latitude + (to.latitude - from.latitude) * t;
    
    return { longitude, latitude };
  }

  /**
   * 角度插值（考虑最短路径）
   * @param {number} fromAngle 起始角度（弧度）
   * @param {number} toAngle 目标角度（弧度）
   * @param {number} t 插值因子 (0-1)
   * @returns {number} 插值结果（弧度）
   */
  static lerpAngle(fromAngle, toAngle, t) {
    // 确保t在0-1范围内
    t = Math.max(0, Math.min(1, t));
    
    // 标准化角度到 [-PI, PI] 范围
    const from = Cesium.Math.zeroToTwoPi(fromAngle) % (2 * Math.PI);
    let to = Cesium.Math.zeroToTwoPi(toAngle) % (2 * Math.PI);
    
    // 计算最短角度差
    let diff = to - from;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    
    // 应用插值
    return from + diff * t;
  }

  /**
   * 计算两个角度之间的最短差值
   * @param {number} fromAngle 起始角度（弧度）
   * @param {number} toAngle 目标角度（弧度）
   * @returns {number} 最短角度差（弧度），正值表示顺时针，负值表示逆时针
   */
  static calculateAngleDiff(fromAngle, toAngle) {
    // 标准化角度到 [0, 2PI] 范围
    const from = Cesium.Math.zeroToTwoPi(fromAngle) % (2 * Math.PI);
    let to = Cesium.Math.zeroToTwoPi(toAngle) % (2 * Math.PI);
    
    // 计算最短角度差
    let diff = to - from;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    
    return diff;
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