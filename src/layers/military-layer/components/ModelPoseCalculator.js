/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { HexConfig, MilitaryConfig } from '@/config/GameConfig';
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { openGameStore } from "@/store";
import { GeoMathUtils } from "@/utils/GeoMathUtils";
import { TerrainHeightCache } from "@/layers/scene-layer/components/TerrainHeightCache";

/**
 * 模型姿态计算器 - 工具类
 * 
 * 主要职责：
 * 1. 计算部队和单位模型在地球上的位置和姿态
 * 2. 提供坐标转换和矩阵计算功能
 * 3. 处理模型旋转和偏移计算
 */
export class ModelPoseCalculator {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {ModelPoseCalculator} 单例实例
   */
  static getInstance(viewer) {
    if (!ModelPoseCalculator.#instance) {
      ModelPoseCalculator.#instance = new ModelPoseCalculator(viewer);
    }
    return ModelPoseCalculator.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.store = openGameStore();
    this.viewer = viewer;
    
    // 获取地形高度缓存系统实例
    this.terrainCache = TerrainHeightCache.getInstance(viewer);
  }

  /**
   * 获取部队在六角格内的随机散列位置(支持批量处理)
   * @param {Object} force 部队对象 
   * @param {string|string[]} hexIds 六角格ID或ID数组，如不提供则使用force.hexId
   * @returns {Promise<Object|Array<Object>>} 计算后的位置 { hexId, position: {longitude, latitude, height} }
   */
  async computeForcePosition(force, hexIds) {
    // 标准化为数组形式
    const isArray = Array.isArray(hexIds);
    const hexIdArray = isArray ? hexIds : [hexIds || (force && force.hexId)];
    
    if (hexIdArray.length === 0 || !hexIdArray[0]) {
      console.warn('无法计算位置：缺少六角格ID');
      return isArray ? [] : null;
    }
    
    // 批量获取hex对象和计算位置
    const positions = [];
    const heightQueryPoints = [];
    
    for (const hexId of hexIdArray) {
      // 获取hexCell对象
      const cell = this.store.getHexCellById(hexId);
      if (!cell) return null; // 找不到某六角格，出错

      const center = cell.getCenter();
      
      // 生成随机散列位置
      const config = MilitaryConfig.layoutConfig;
      const angle = Math.random() * 2 * Math.PI; // 随机角度
      const radius = Math.random() * HexConfig.radius * config.forceLayout.disperseRadius; // 随机半径
      
      // 计算偏移
      const offsetX = radius * Math.cos(angle);
      const offsetY = radius * Math.sin(angle);

      // 使用GeoMathUtils将米偏移转换为经纬度坐标
      const offsetPos = GeoMathUtils.metersToLatLon(center, { x: offsetX, y: offsetY });
      
      // 添加到待查询高度的点列表
      heightQueryPoints.push({
        hexId: hexId,
        longitude: offsetPos.longitude,
        latitude: offsetPos.latitude
      });
      
      // 添加到位置列表(高度待查询)
      positions.push({
        hexId: hexId,
        position: {
          longitude: offsetPos.longitude,
          latitude: offsetPos.latitude,
          height: 0
        },
      });
    }
    
    // 批量查询高度
    if (heightQueryPoints.length > 0) {
      const heights = await this.terrainCache.getPreciseHeight(heightQueryPoints);
      // 更新高度
      for (let i = 0; i < positions.length; i++) {
        if (positions[i]) {
          positions[i].position.height = heights[i];
        }
      }
    }
    
    // 根据输入类型返回对应格式
    return isArray ? positions : (positions[0] || null);
  }

  /**
   * 计算兵种模型的位置
   * @param {Array<Object>|Object} params 单个参数对象或参数对象数组，每个对象包含 {forcePose, localOffset, hexId}
   * @param {Object} [params.forcePose] 部队位置和朝向 {position: {longitude, latitude, height}, heading}
   * @param {Object} [params.localOffset] 兵种局部偏移 {x, y}
   * @param {string} [params.hexId] 六角格ID
   * @returns {Object|Array<Object>} 经纬度坐标 {longitude, latitude, height} 或其数组
   */
  async computeUnitPosition(params) {
    // 标准化为数组形式
    const isArray = Array.isArray(params);
    const paramsArray = isArray ? params : [params];
    
    if (paramsArray.length === 0) {
      console.warn('无法计算位置：参数为空');
      return isArray ? [] : null;
    }

    // 批量计算位置并准备高度查询
    const positions = [];
    const heightQueryPoints = [];
    
    for (const param of paramsArray) {
      const {forcePose, localOffset, hexId} = param;
      
      if (!forcePose?.position || !hexId) {
        console.warn('无法计算位置：参数不完整', param);
        positions.push(null);
        continue;
      }
      
      // 首先将局部偏移根据部队朝向进行旋转
      const rotatedOffset = GeoMathUtils.rotateOffset(localOffset, forcePose.heading || 0);
      
      // 将旋转后的局部偏移转换为经纬度偏移
      const forcePos = forcePose.position;
      const unitPos = GeoMathUtils.metersToLatLon(forcePos, rotatedOffset);
      
      // 添加到待查询高度的点列表
      heightQueryPoints.push({
        hexId: hexId,
        longitude: unitPos.longitude,
        latitude: unitPos.latitude
      });
      
      // 添加到位置列表(高度待查询)
      positions.push({
        hexId: hexId,
        position: {
          longitude: unitPos.longitude,
          latitude: unitPos.latitude,
          height: 0
        }
      });
    }
    
    // 批量查询高度
    if (heightQueryPoints.length > 0) {
      const heights = await this.terrainCache.getPreciseHeight(heightQueryPoints);
      
      // 更新高度
      for (let i = 0; i < positions.length; i++) {
        if (positions[i]) {
          positions[i].position.height = heights[i] + MilitaryConfig.layoutConfig.unitLayout.heightOffset;
        }
      }
    }
    
    // 根据输入类型返回对应格式
    return isArray ? positions : (positions[0] || null);
  }

  /**
   * 计算兵种模型的变换矩阵，即除了位置还有姿态信息（朝向和站立角度）
   * @param {Object} position 位置坐标对象 {longitude, latitude, height}
   * @param {number} heading 朝向角度（弧度）
   * @returns {Cesium.Matrix4} 最终变换矩阵
   */
  computeUnitModelMatrix(position, heading) {
    // 将经纬度坐标转化为笛卡尔坐标
    const pos = Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.height || 0
    );

    // 创建基础的东北天(ENU)坐标系矩阵（确保模型垂直站在地面上）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    
    // 创建绕Z轴旋转的矩阵，使模型朝向正确（Z轴是垂直于地面的轴）
    const rotationMatrix = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromRotationZ(heading || 0),
      Cesium.Cartesian3.ZERO
    );

    // 将旋转应用到ENU矩阵
    return Cesium.Matrix4.multiply(enuMatrix, rotationMatrix, new Cesium.Matrix4());
  }

  /**
   * 清理资源
   */
  dispose() {
    ModelPoseCalculator.#instance = null;
  }
}