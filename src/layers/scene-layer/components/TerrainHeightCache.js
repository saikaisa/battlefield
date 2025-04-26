import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { CesiumConfig, HexConfig } from "@/config/GameConfig";
// eslint-disable-next-line no-unused-vars
import { HexCell } from "@/models/HexCell.js";

/**
 * 地形高度缓存系统
 * 
 * 主要职责：
 * 1. 提供六角格地形高度采样（粗采样）
 * 2. 管理高度缓存，避免重复采样
 * 3. 提供两种高度查询方式：快速查询和精确查询
 */
export class TerrainHeightCache {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {TerrainHeightCache} 单例实例
   */
  static getInstance(viewer) {
    if (!TerrainHeightCache.#instance) {
      TerrainHeightCache.#instance = new TerrainHeightCache(viewer);
    }
    return TerrainHeightCache.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    /**
     * 六角格高度缓存
     * Map<hexId, {
     *   center: {longitude, latitude, height},
     *   vertices: [{longitude, latitude, height}, ...], // 6个顶点
     *   triangles: [
     *     {
     *       index: 0, // 三角形索引
     *       points: [{longitude, latitude, height}, ...], // 3个顶点
     *     }
     *   ]
     * }>
     */
    this.hexHeightCache = new Map();

  }

  /**
   * 采样六角格高度（用于初始化六角格网格）
   * @param {Array<HexCell>} hexCells 需要采样的六角格数组
   * @returns {Promise<Array<HexCell>>} 更新高度后的六角格数组
   */
  async sampleHexCellsHeight(hexCells) {
    console.log(`[TerrainHeightCache] 开始采样 ${hexCells.length} 个六角格高度`);
    
    // 收集所有需要采样的点
    const samplePositions = [];
    hexCells.forEach(cell => {
      cell.position.points.forEach(pt => {
        samplePositions.push(Cesium.Cartographic.fromDegrees(pt.longitude, pt.latitude, pt.height));
      });
    });
    
    try {
      // 分批采样：将 samplePositions 分批进行采样
      const updatedPositions = await this._sampleTerrainInBatches(samplePositions);
      
      // 更新六角格高度并缓存
      hexCells.forEach((cell, cellIndex) => {
        const base = cellIndex * 7; // 每个六角格7个点
        
        // 创建缓存对象
        const hexCache = {
          center: {
            longitude: cell.position.points[0].longitude,
            latitude: cell.position.points[0].latitude,
            height: updatedPositions[base].height
          },
          vertices: [],
          triangles: []
        };
        
        // 更新所有 7 个点的高度
        for (let j = 0; j < 7; j++) {
          const point = cell.position.points[j];
          point.height = updatedPositions[base + j].height;
          
          // 如果是顶点（不是中心点），添加到顶点缓存
          if (j > 0) {
            hexCache.vertices.push({
              longitude: point.longitude,
              latitude: point.latitude,
              height: point.height
            });
          }
        }
        
        // 计算六个三角形信息
        for (let j = 0; j < 6; j++) {
          const nextJ = (j + 1) % 6;
          // 三角形：中心点 + 两个相邻顶点
          const triangle = {
            index: j,
            points: [
              {
                longitude: hexCache.center.longitude, 
                latitude: hexCache.center.latitude,
                height: hexCache.center.height
              },
              {
                longitude: hexCache.vertices[j].longitude, 
                latitude: hexCache.vertices[j].latitude,
                height: hexCache.vertices[j].height
              },
              {
                longitude: hexCache.vertices[nextJ].longitude, 
                latitude: hexCache.vertices[nextJ].latitude,
                height: hexCache.vertices[nextJ].height
              }
            ]
          };
          hexCache.triangles.push(triangle);
        }
        
        // 缓存六角格高度信息
        this.hexHeightCache.set(cell.hexId, hexCache);
        
        // 计算加权平均高度，赋值给 terrainAttributes.elevation
        const centerHeight = updatedPositions[base].height;
        let verticesSum = 0;
        for (let j = 1; j < 7; j++) {
          verticesSum += updatedPositions[base + j].height;
        }
        
        const weights = HexConfig.heightSamplingWeights;
        cell.terrainAttributes.elevation = weights.center * centerHeight + weights.vertex * verticesSum;
        
        // 更新地形类型和视觉样式
        cell.addVisualStyleByElevation();
        console.log(`[TerrainHeightCache] Cell ${cell.hexId} 更新高度：center=${centerHeight.toFixed(2)}, elevation=${cell.terrainAttributes.elevation.toFixed(2)}`);
      });
      
      return hexCells;
    } catch (err) {
      console.error('[TerrainHeightCache] 更新六角格高度失败:', err);
      throw err;
    }
  }

  /**
   * 轻量查询：根据六角格ID和经纬度获取插值高度
   * 基于三角形内插值计算，性能高，适合频繁调用
   * 
   * @param {string} hexId 六角格ID
   * @param {number} longitude 经度
   * @param {number} latitude 纬度
   * @returns {number} 估计高度，如果缓存未命中则返回0
   */
  getApproxiHeight(hexId, longitude, latitude) {
    // 检查缓存中是否有该六角格
    const hexCache = this.hexHeightCache.get(hexId);
    if (!hexCache) {
      console.warn(`[TerrainHeightCache] 六角格 ${hexId} 没有高度缓存，返回0`);
      return 0;
    }
    
    // 查找点所在的三角形
    const triangle = this._findContainingTriangle(hexCache, longitude, latitude);
    if (!triangle) {
      // 点不在任何三角形内，返回中心点高度
      return hexCache.center.height;
    }
    
    // 使用重心坐标插值计算高度
    return this._calcInterpolatedHeight(
      {longitude, latitude},
      triangle.points[0],
      triangle.points[1],
      triangle.points[2]
    );
  }
  
  /**
   * 完整查询：直接采样地形获取精确高度
   * 性能开销大，适合批量调用
   * 
   * @param {Array<Object>} points 点位数组，每个点包含 {hexId, longitude, latitude}
   * @param {number} [timeout=CesiumConfig.timeout] 超时时间（毫秒）
   * @returns {Promise<Array<number>>} 精确高度数组
   */
  async getPreciseHeight(points, timeout = CesiumConfig.timeout) {
    try {
      // 转换为Cesium的Cartographic对象数组
      const positions = points.map(point => 
        Cesium.Cartographic.fromDegrees(point.longitude, point.latitude)
      );
      
      // 创建一个带超时的Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('地形采样超时')), timeout);
      });
      
      // 创建地形采样Promise
      const samplingPromise = Cesium.sampleTerrainMostDetailed(
        this.viewer.terrainProvider, 
        positions
      );
      
      // 使用Promise.race竞争，谁先完成就用谁的结果
      const updatedPositions = await Promise.race([
        samplingPromise,
        timeoutPromise
      ]);
      
      // 返回高度数组
      return updatedPositions.map((pos, index) => {
        if (pos.height !== undefined) {
          return pos.height;
        } else {
          // fallback: 个别采样失败的点，使用近似高度
          const point = points[index];
          console.warn(`[TerrainHeightCache] 点 (${point.longitude.toFixed(6)}, ${point.latitude.toFixed(6)}) 精确采样失败，使用近似高度`);
          return this.getApproxiHeight(point.hexId, point.longitude, point.latitude);
        }
      });
    } catch (err) {
      console.warn(`[TerrainHeightCache] 批量精确采样高度失败或超时: ${err.message}`);
      // fallback: 采样失败或超时，全部使用近似高度
      return points.map(point => 
        this.getApproxiHeight(point.hexId, point.longitude, point.latitude)
      );
    }
  }
  
  /**
   * 在三角形内插值计算高度
   * @private
   * @param {Object} p 点 {longitude, latitude}
   * @param {Object} a 三角形顶点1 {longitude, latitude, height}
   * @param {Object} b 三角形顶点2 {longitude, latitude, height}
   * @param {Object} c 三角形顶点3 {longitude, latitude, height}
   * @returns {number} 插值计算的高度
   */
  _calcInterpolatedHeight(p, a, b, c) {    
    // 重心坐标计算
    const v0x = c.longitude - a.longitude;
    const v0y = c.latitude - a.latitude;
    const v1x = b.longitude - a.longitude;
    const v1y = b.latitude - a.latitude;
    const v2x = p.longitude - a.longitude;
    const v2y = p.latitude - a.latitude;

    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const d20 = v2x * v0x + v2y * v0y;
    const d21 = v2x * v1x + v2y * v1y;

    const denom = d00 * d11 - d01 * d01;

    let u, v, w;
    // 确保分母不为0，避免除以0的情况
    if (Math.abs(denom) < 1e-9) {
      u = v = w = 1/3; // 特殊情况，返回等权重
    }
    // 计算出每个点的权重 { v, w, u }
    v = (d11 * d20 - d01 * d21) / denom;
    w = (d00 * d21 - d01 * d20) / denom;
    u = 1.0 - v - w;

    // 基于重心坐标插值计算高度
    return a.height * u + b.height * v + c.height * w;
  }
  
  /**
   * 查找指定点所处的三角形分区
   * @private
   * @param {Object} hexCache 六角格缓存
   * @param {number} longitude 经度
   * @param {number} latitude 纬度
   * @returns {Object|null} 包含该点的三角形
   */
  _findContainingTriangle(hexCache, longitude, latitude) {
    for (const triangle of hexCache.triangles) {
      // 判断点是否在三角形内
      if (this._isPointInTriangle(
        {longitude, latitude},
        triangle.points[0],
        triangle.points[1],
        triangle.points[2]
      )) {
        return triangle;
      }
    }
    return null;
  }
  
  /**
   * 判断点是否在三角形内
   * @private
   * @param {Object} p 点 {longitude, latitude}
   * @param {Object} a 三角形顶点1
   * @param {Object} b 三角形顶点2
   * @param {Object} c 三角形顶点3
   * @returns {boolean} 是否在三角形内
   */
  _isPointInTriangle(p, a, b, c) {
    // 计算重心坐标
    const {u, v, w} = this._calculateBarycentricCoords(p, a, b, c);
    
    // 如果u,v,w都大于等于0，且和接近1，则点在三角形内
    return u >= 0 && v >= 0 && w >= 0 && Math.abs(u + v + w - 1.0) < 1e-6;
  }

  /**
   * 分批采样 DEM 高度信息，避免一次采样点过多造成堆栈溢出
   * @param {Array} positions 需要采样的 Cartographic 数组
   * @param {number} batchSize 每个批次采样的数量
   * @returns {Promise<Array>} 返回采样完成的 Cartographic 数组
   */
  async _sampleTerrainInBatches(positions, batchSize = CesiumConfig.sampleBatchSize) {
    console.log(`[TerrainHeightCache] 原始采样点数量: ${positions.length}`);
    
    // 1. 对采样点进行去重，减少重复采样
    const uniquePositions = [];
    const uniqueKeys = new Map(); // 存储点的唯一键及其在uniquePositions中的索引
    const originalToUniqueIndices = []; // 映射原始索引到去重后索引
    
    // 使用经纬度（精确到小数点后acc位）作为唯一键
    const acc = CesiumConfig.decimalAccuracy;
    const getPosKey = (pos) => `${pos.longitude.toFixed(acc)},${pos.latitude.toFixed(acc)}`;
    
    // 去重逻辑
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const key = getPosKey(pos);
      
      if (uniqueKeys.has(key)) {
        // 重复点，记录映射关系
        originalToUniqueIndices[i] = uniqueKeys.get(key);
      } else {
        // 新点，添加到唯一点数组
        const uniqueIndex = uniquePositions.length;
        uniquePositions.push(pos);
        uniqueKeys.set(key, uniqueIndex);
        originalToUniqueIndices[i] = uniqueIndex;
      }
    }
    
    console.log(`[TerrainHeightCache] 去重后采样点数量: ${uniquePositions.length}，节省: ${positions.length - uniquePositions.length} 个点`);
    
    // 2. 分批采样去重后的点
    let updatedUniquePositions = [];
    for (let i = 0; i < uniquePositions.length; i += batchSize) {
      const batch = uniquePositions.slice(i, i + batchSize);
      // 等待当前批次采样完成
      const updatedBatch = await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, batch);
      updatedUniquePositions = updatedUniquePositions.concat(updatedBatch);
    }
    
    // 3. 根据映射关系，构建完整的采样结果
    const updatedOriginalPositions = [];
    for (let i = 0; i < positions.length; i++) {
      const uniqueIndex = originalToUniqueIndices[i];
      updatedOriginalPositions[i] = updatedUniquePositions[uniqueIndex];
    }
    
    return updatedOriginalPositions;
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.hexHeightCache.clear();
    
    // 清理单例
    TerrainHeightCache.#instance = null;
  }
} 