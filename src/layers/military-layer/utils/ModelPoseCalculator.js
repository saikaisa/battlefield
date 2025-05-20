/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { HexConfig, MilitaryConfig } from '@/config/GameConfig';
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { openGameStore } from "@/store";
import { GeoMathUtils } from "@/layers/scene-layer/utils/GeoMathUtils";
import { HexHeightCache } from "@/layers/scene-layer/components/HexHeightCache";

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
    this.terrainCache = HexHeightCache.getInstance(viewer);
  }

  /**
   * 获取部队在六角格内的随机散列位置(支持批量处理)
   * @param {Object} force 部队对象 
   * @param {string|string[]} hexIds 六角格ID或ID数组，如不提供则使用force.hexId
   * @returns {Promise<Object|Array<Object>>} 计算后的位置 { hexId, position: {longitude, latitude, height} }
   */
  computeForcePosition(force, hexIds) {
    // 标准化为数组形式
    const isArray = Array.isArray(hexIds);
    const hexIdArray = isArray ? hexIds : [hexIds || (force && force.hexId)];
    
    if (hexIdArray.length === 0 || !hexIdArray[0]) {
      console.warn('无法计算位置：缺少六角格ID');
      return isArray ? [] : null;
    }
    
    // 批量获取hex对象和计算位置
    const positions = [];
    
    for (const hexId of hexIdArray) {
      // 获取hexCell对象
      const cell = this.store.getHexCellById(hexId);
      if (!cell) {
        console.warn(`[ModelPoseCalculator] 找不到六角格: ${hexId}`);
        positions.push(null);
        continue;
      }

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
      
      // 获取表面高度
      const surfaceHeight = this.terrainCache.getSurfaceHeight(
        hexId, 
        offsetPos.longitude, 
        offsetPos.latitude
      );
      
      // 添加到位置列表
      positions.push({
        hexId: hexId,
        position: {
          longitude: offsetPos.longitude,
          latitude: offsetPos.latitude,
          height: surfaceHeight + (force?.service === 'air' ? MilitaryConfig.layoutConfig.forceLayout.airHeightOffset : 0)
        },
      });
    }
    
    // 根据输入类型返回对应格式
    return isArray ? positions : (positions[0] || null);
  }

  /**
   * 计算兵种实例的位置，包括兵种实例相对于部队实例位置的偏移
   * @param {Array<Object>|Object} params 单个参数对象或参数对象数组，每个对象包含 {forcePose, localOffset, hexId}
   * @param {Object} [params.forcePose] 部队位置和朝向 {position: {longitude, latitude, height}, heading}
   * @param {Object} [params.localOffset] 兵种实例相对于部队位置的偏移 {x, y}
   * @param {string} [params.hexId] 六角格ID
   * @param {string} [params.service] 部队军种
   * @returns {Object|Array<Object>} 经纬度坐标 {longitude, latitude, height} 或其数组
   */
  computeUnitPosition(params) {
    // 标准化为数组形式
    const isArray = Array.isArray(params);
    const paramsArray = isArray ? params : [params];
    
    if (paramsArray.length === 0) {
      console.warn('无法计算位置：参数为空');
      return isArray ? [] : null;
    }

    const positions = [];
    
    for (const param of paramsArray) {
      const {forcePose, localOffset, hexId} = param;
      
      if (!forcePose?.position || !hexId) {
        console.warn('无法计算位置：参数不完整', param);
        positions.push(null);
        continue;
      }
      
      // 首先将兵种实例偏移根据部队朝向进行旋转
      const rotatedOffset = GeoMathUtils.rotateOffset(localOffset, forcePose.heading || 0);
      
      // 将旋转后的兵种实例偏移转换为经纬度偏移
      const forcePos = forcePose.position;
      const unitPos = GeoMathUtils.metersToLatLon(forcePos, rotatedOffset);
      
      // 获取表面高度
      const surfaceHeight = this.terrainCache.getSurfaceHeight(
        hexId,
        unitPos.longitude,
        unitPos.latitude
      );
      
      // 添加到位置列表
      positions.push({
        hexId: hexId,
        position: {
          longitude: unitPos.longitude,
          latitude: unitPos.latitude,
          // 如果获取失败则使用部队高度 + 默认偏移，空军需要额外的高度偏移
          height: (surfaceHeight !== null ? 
            surfaceHeight : 
            forcePos.height) + MilitaryConfig.layoutConfig.unitLayout.heightOffset + 
            (param.service === 'air' ? MilitaryConfig.layoutConfig.forceLayout.airHeightOffset : 0)
        }
      });
    }
    
    // 根据输入类型返回对应格式
    return isArray ? positions : (positions[0] || null);
  }

  /**
   * 计算模型实例的变换矩阵，包括姿态信息和模型相对于兵种实例位置的偏移
   * @param {Object} unitPos 兵种实例位置 {longitude, latitude, height}
   * @param {number} unitHeading 朝向角度（弧度）
   * @param {Object} [offset] 模型偏移 { x, y, z }
   * @returns {Cesium.Matrix4} 最终变换矩阵
   */
  computeModelMatrix(unitPos, unitHeading, offset) {
    // 将经纬度坐标转化为笛卡尔坐标
    const pos = Cesium.Cartesian3.fromDegrees(
      unitPos.longitude,
      unitPos.latitude,
      unitPos.height || 0
    );

    // 创建基础的东北天(ENU)坐标系矩阵（确保模型垂直站在地面上）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    
    // 创建绕Z轴旋转的矩阵，使模型朝向正确（Z轴是垂直于地面的轴）
    const rotationMatrix = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromRotationZ((unitHeading || 0) + Math.PI / 2),
      Cesium.Cartesian3.ZERO
    );

    // 将旋转应用到ENU矩阵
    const positionMatrix = Cesium.Matrix4.multiply(enuMatrix, rotationMatrix, new Cesium.Matrix4());
    
    // 如果有模型偏移信息，应用到最终矩阵
    if (offset) {
      // 创建仅表示相对于兵种实例的偏移的本地变换矩阵
      const localOffsetMatrix = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(offset.x, offset.y, offset.z),
        new Cesium.Matrix4()
      );
      
      // 将模型相对于兵种实例的本地偏移应用到位置矩阵
      return Cesium.Matrix4.multiply(positionMatrix, localOffsetMatrix, new Cesium.Matrix4());
    }
    
    // 如果没有模型变换信息，直接返回位置矩阵
    return positionMatrix;
  }

  /**
   * 清理资源
   */
  dispose() {
    ModelPoseCalculator.#instance = null;
  }
}