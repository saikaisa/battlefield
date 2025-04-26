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
   * 获取部队在六角格内的随机散列位置
   * @param {Object} force 部队对象 
   * @param {string} [hexId] 六角格ID，如不提供则使用force.hexId
   * @returns {Object} 计算后的位置 {longitude, latitude, height}
   */
  computeForcePosition(force, hexId) {
    // 确保hexId有值
    const hexIdToUse = hexId || (force && force.hexId);
    if (!hexIdToUse) {
      console.warn('无法计算位置：缺少六角格ID');
      return null;
    }
    
    // 获取hex对象
    const hex = this.store.getHexCellById(hexIdToUse);
    if (!hex) {
      console.warn(`无法计算位置：找不到六角格(${hexIdToUse})`);
      return null;
    }

    const center = hex.getCenter();
    
    // 生成随机散列位置
    const config = MilitaryConfig.layoutConfig;
    const angle = Math.random() * 2 * Math.PI; // 随机角度
    const radius = Math.random() * HexConfig.radius * config.forceLayout.disperseRadius; // 随机半径
    
    // 计算偏移
    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);

    // 使用GeoMathUtils将米偏移转换为经纬度坐标
    const offsetPos = GeoMathUtils.metersToLatLon(center, { x: offsetX, y: offsetY });
    
    // 使用地形高度缓存获取实际地形高度（使用六角格ID直接查询）
    const height = this.terrainCache.getPreciseHeight(
      hexIdToUse, 
      offsetPos.longitude, 
      offsetPos.latitude
    );

    return {
      longitude: offsetPos.longitude,
      latitude: offsetPos.latitude,
      height: height
    };
  }

  /**
   * 计算兵种模型的位置
   * @param {Object} forcePose 部队位置和朝向 {position: {longitude, latitude, height}, heading}
   * @param {Object} localOffset 兵种局部偏移 {x, y}
   * @returns {Cesium.Matrix4} 最终变换矩阵
   */
  computeUnitPosition(forcePose, localOffset, hexId) {
    if (!forcePose?.position) return Cesium.Matrix4.IDENTITY;

    // 首先将局部偏移根据部队朝向进行旋转
    const rotatedOffset = GeoMathUtils.rotateOffset(localOffset, forcePose.heading || 0);
    
    // 将旋转后的局部偏移转换为经纬度偏移
    const forcePosition = forcePose.position;
    const worldPos = GeoMathUtils.metersToLatLon(forcePosition, rotatedOffset);
    
    // 查询高度
    const height = this.terrainCache.getPreciseHeight(
      hexId, 
      worldPos.longitude, 
      worldPos.latitude
    );

    // 计算最终的经纬度坐标（确保模型在地球上的位置）
    const finalPosition = Cesium.Cartesian3.fromDegrees(
      worldPos.longitude,
      worldPos.latitude,
      height + MilitaryConfig.layoutConfig.unitLayout.heightOffset
    );

    return finalPosition;
  }

  /**
   * 计算兵种模型的变换矩阵，即除了位置还有姿态信息（朝向和站立角度）
   * @param {Object} position 位置 {longitude, latitude, height}
   * @param {Object} heading 朝向
   * @returns {Cesium.Matrix4} 最终变换矩阵
   */
  computeUnitModelMatrix(position, heading) {
    // 创建基础的东北天(ENU)坐标系矩阵（确保模型垂直站在地面上）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
    
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