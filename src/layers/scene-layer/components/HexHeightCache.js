import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { CesiumConfig, HexConfig, HexRendererConfig } from "@/config/GameConfig";
// eslint-disable-next-line no-unused-vars
import { HexCell } from "@/models/HexCell.js";

/**
 * 地形高度缓存系统
 * 
 * 主要职责：
 * 1. 提供六角格地形高度采样（粗采样）
 * 2. 管理高度缓存，避免重复采样
 * 3. 计算并缓存考虑地形陡峭程度的表面高度
 * 4. 提供表面高度查询功能
 */
export class HexHeightCache {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {HexHeightCache} 单例实例
   */
  static getInstance(viewer) {
    if (!HexHeightCache.#instance) {
      HexHeightCache.#instance = new HexHeightCache(viewer);
    }
    return HexHeightCache.#instance;
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
     *   center: {longitude, latitude, height}, // 六角格中心点
     *   vertices: [{longitude, latitude, height}, ...], // 6个顶点
     *   triangles: [ // 六角格内的6个三角形分区
     *     {
     *       index: 0, // 三角形索引
     *       points: [{longitude, latitude, height}, ...], // 3个顶点
     *     }
     *   ],
     *   heightOffset: number, // 当前六角格的高度偏移量，用于计算上表面高度（顶点高度 + 高度偏移）
     *   steepness: number, // 当前六角格的陡峭程度，即最高顶点和最低顶点的高度差
     * }>
     */
    this.hexHeightCache = new Map();

    /**
     * 直接缓存位置 (用于渲染)
     * Map<'hexId_isBorder_additionalOffset', Array<Cesium.Cartesian3>>
     */
    this.positionsCache = new Map();
  }

  /**
   * 采样六角格高度（用于初始化六角格网格）
   * @param {Array<HexCell>} hexCells 需要采样的六角格数组
   * @returns {Promise<Array<HexCell>>} 更新高度后的六角格数组
   */
  async sampleHexCellsHeight(hexCells) {
    console.log(`[HexHeightCache] 开始采样 ${hexCells.length} 个六角格高度`);
    
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
          triangles: [],
          heightOffset: 0, // 初始化高度偏移
          steepness: 0     // 初始化陡峭程度
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
        console.log(`[HexHeightCache] Cell ${cell.hexId} 更新高度：center=${centerHeight.toFixed(2)}, elevation=${cell.terrainAttributes.elevation.toFixed(2)}`);
        
        // 计算并缓存上表面高度
        this._calculateSurfaceHeight(cell);
      });
      
      return hexCells;
    } catch (err) {
      console.error('[HexHeightCache] 更新六角格高度失败:', err);
      throw err;
    }
  }

  /**
   * 获取六角格表面高度
   * 根据六角格id和经纬度点计算该点在六角格表面的高度
   * 
   * @param {string} hexId 六角格ID
   * @param {number} longitude 经度
   * @param {number} latitude 纬度
   * @returns {number|null} 表面高度，如果找不到则返回null
   */
  getSurfaceHeight(hexId, longitude, latitude) {
    // 首先检查该hexId是否有高度缓存
    let hexCache = this.hexHeightCache.get(hexId);
    if (!hexCache) {
      console.warn(`[HexHeightCache] 六角格 ${hexId} 没有高度缓存，返回0`);
      return 0;
    }
    
    // 查找点是否在当前六角格的三角形内
    const triangle = this._findContainingTriangle(hexCache, longitude, latitude);
    
    // 如果点在当前六角格内
    if (triangle) {
      // 计算该点在地形上的高度
      const terrainHeight = this._calcInterpolatedHeight(
        {longitude, latitude},
        triangle.points[0],
        triangle.points[1],
        triangle.points[2]
      );
      
      // 计算表面高度 = 地形高度 + 高度偏移
      return terrainHeight + hexCache.heightOffset;
    } 
    
    // 如果点不在当前六角格内，尝试查找是否在周围六角格内
    const nearbyHexIds = this._findNearbyHexIds(hexId);
    for (const neighborId of nearbyHexIds) {
      const neighborCache = this.hexHeightCache.get(neighborId);
      if (!neighborCache) continue;
      
      // 检查点是否在邻居六角格的三角形内
      const neighborTriangle = this._findContainingTriangle(neighborCache, longitude, latitude);
      if (neighborTriangle) {
        // 插值计算该点的高度
        const terrainHeight = this._calcInterpolatedHeight(
            {longitude, latitude},
          neighborTriangle.points[0],
          neighborTriangle.points[1],
          neighborTriangle.points[2]
        );
        
        // 计算表面高度 = 地形高度 + 高度偏移
        return terrainHeight + neighborCache.heightOffset;
      }
    }

    console.warn(`[HexHeightCache] 无法为位置 (${longitude.toFixed(6)}, ${latitude.toFixed(6)}) 找到表面高度`);
    return 0;
  }

  /**
   * 获取六角格的3D位置坐标数组，用于渲染
   * @param {HexCell} hexCell 六角格单元
   * @param {boolean} [isBorder=false] 是否为边界线，边界线高度会额外增加
   * @param {number} [additionalOffset=0] 额外高度偏移，用于层叠效果
   * @returns {Array<Cesium.Cartesian3>} 位置数组
   */
  getHex3DPositions(hexCell, isBorder = false, additionalOffset = 0) {
    const hexId = hexCell.hexId;
    const cacheKey = `${hexId}_${isBorder}_${additionalOffset}`;
    
    // 直接查询位置缓存
    if (this.positionsCache.has(cacheKey)) {
      return this.positionsCache.get(cacheKey);
    }
    
    // 若找不到位置缓存，则查询高度缓存
    let hexCache = this.hexHeightCache.get(hexId);
    if (!hexCache) {
      console.warn(`[HexHeightCache] 六角格 ${hexId} 没有高度缓存`);
      return [];
    }
    
    const positions = [];
    
    // 额外增加边界线高度偏移
    const finalOffset = isBorder ? 
      hexCache.heightOffset + HexRendererConfig.borderExtraOffset + additionalOffset : 
      hexCache.heightOffset + additionalOffset;
    
    // 转换六角格顶点坐标
    const vertices = hexCell.getVertices();
    vertices.forEach((vertex, index) => {
      const vertexHeight = hexCache.vertices[index].height;
      const position = Cesium.Cartesian3.fromDegrees(
        vertex.longitude, 
        vertex.latitude, 
        isBorder ? 
          vertex.height + finalOffset : 
          vertexHeight + finalOffset
      );
      positions.push(position);
    });
    
    // 保存到缓存
    this.positionsCache.set(cacheKey, positions);
    
    return positions;
  }

  /**
   * 计算并缓存六角格表面高度(考虑地形陡峭程度)
   * @param {HexCell} hexCell 六角格对象
   * @returns {Object} 表面高度信息
   * @private
   */
  _calculateSurfaceHeight(hexCell) {
    // 检查hexId是否存在
    const hexId = hexCell.hexId;
    let hexCache = this.hexHeightCache.get(hexId);
    
    // 如果没有缓存，则利用当前六角格信息重新计算高度缓存
    if (!hexCache) {
      console.warn(`[HexHeightCache] 六角格 ${hexId} 没有高度缓存`);
      return null;
    }
    
    const center = hexCache.center;
    const vertices = hexCache.vertices;
    
    // 计算地形复杂度和高度偏移
    let maxHeight = center.height;
    let minHeight = center.height;
    let avgHeight = center.height;
    
    // 记录山顶情况 - 中心高于周围顶点平均值说明有可能在山顶/脊
    let isMountainPeak = false;
    
    // 计算顶点的高度统计
    let verticesHeightSum = 0;
    vertices.forEach(vertex => {
      verticesHeightSum += vertex.height;
      if (vertex.height > maxHeight) {
        maxHeight = vertex.height;
      }
      if (vertex.height < minHeight) {
        minHeight = vertex.height;
      }
    });
    
    // 计算平均高度
    avgHeight = (center.height + verticesHeightSum) / (vertices.length + 1);
    
    // 检测地形的陡峭程度 - 高低差越大，地形越陡峭
    const heightRange = maxHeight - minHeight;
    
    // 检测是否为山顶/山脊 - 中心点比平均高度高，很可能在山脊上
    if (center.height > avgHeight) {
      isMountainPeak = true;
    }
    
    // 增加对中心点的考虑，确保覆盖山脊
    const variationFromCenter = Math.abs(center.height - avgHeight);
    
    // 地形变化 - 取最大顶点与平均值差，或中心点与平均值差的较大者
    const heightVariation = Math.max(maxHeight - avgHeight, variationFromCenter);
    
    // 动态计算偏移值 - 地形越复杂，偏移越大
    let dynamicOffset = HexRendererConfig.heightOffset;
    
    // 根据地形变化添加偏移
    let terrainOffset = heightVariation * HexRendererConfig.terrainFactor;
    
    // 山脊/山顶区域需要额外偏移 - 作为地形因素的加成而不是单独叠加
    if (isMountainPeak) {
      // 将山顶额外偏移应用到地形偏移上，而不是直接加到最终偏移
      terrainOffset += terrainOffset * (HexRendererConfig.mountainPeakExtraOffset / 100);
    }
    
    // 将地形偏移添加到基础偏移
    dynamicOffset += terrainOffset;
    
    // 陡峭地形分级处理
    // 根据高度差范围细分地形类型，给予不同的高度偏移
    switch (true) {
      // 平缓地形
      case (heightRange <= HexRendererConfig.terrainSteepness.flat.maxRange):
        // 保持基础偏移
        break;
      // 轻微起伏
      case (heightRange <= HexRendererConfig.terrainSteepness.gentle.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.gentle.extraOffset;
        break;
      // 中等陡峭
      case (heightRange <= HexRendererConfig.terrainSteepness.moderate.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.moderate.extraOffset;
        break;
      // 显著陡峭
      case (heightRange <= HexRendererConfig.terrainSteepness.steep.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.steep.extraOffset;
        break;
      // 非常陡峭
      case (heightRange <= HexRendererConfig.terrainSteepness.verysteep.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.verysteep.extraOffset;
        break;
      // 极端陡峭
      default:
        dynamicOffset += HexRendererConfig.terrainSteepness.extreme.extraOffset;
        
        // 对于特别极端的情况，进一步增加偏移
        if (heightRange > HexRendererConfig.terrainSteepness.extreme.maxRange) {
          dynamicOffset += HexRendererConfig.terrainSteepness.mountain.extraOffset;
        }
        break;
    }
    
    // 更新六角格高度缓存
    hexCache.heightOffset = dynamicOffset;
    hexCache.steepness = heightRange;
    
    return hexCache;
  }

  /**
   * 获取指定六角格周围的六角格ID列表
   * @private
   * @param {string} hexId 六角格ID，格式为"H_row_col"
   * @returns {Array<string>} 周围六角格ID数组
   */
  _findNearbyHexIds(hexId) {
    // 解析hexId提取行列信息
    const parts = hexId.split('_');
    if (parts.length !== 3 || parts[0] !== 'H') {
      console.warn(`[HexHeightCache] 无效的六角格ID格式: ${hexId}`);
      return [];
    }
    
    const row = parseInt(parts[1]);
    const col = parseInt(parts[2]);
    
    // 六角格行列偏移组合 (偶数行和奇数行的偏移不同)
    // 偶数行：左上、右上、左、右、左下、右下
    // 奇数行：左上、右上、左、右、左下、右下
    const evenRowOffsets = [[-1,-1], [-1,0], [0,-1], [0,1], [1,-1], [1,0]];
    const oddRowOffsets = [[-1,0], [-1,1], [0,-1], [0,1], [1,0], [1,1]];
    
    // 根据当前行的奇偶选择对应的偏移数组
    const offsets = row % 2 === 0 ? evenRowOffsets : oddRowOffsets;
    
    // 计算周围6个六角格的ID并检查是否存在
    const neighborIds = [];
    
    for (const [rowOffset, colOffset] of offsets) {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;
      const neighborId = `H_${neighborRow}_${neighborCol}`;
      
      // 如果该邻居在缓存中存在，添加到列表
      if (this.hexHeightCache.has(neighborId)) {
        neighborIds.push(neighborId);
      }
    }
    
    return neighborIds;
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
    
    // 确保分母不为0
    if (Math.abs(denom) < 1e-9) {
      return false;
    }
    
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;
    
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
    console.log(`[HexHeightCache] 原始采样点数量: ${positions.length}`);
    
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
    
    console.log(`[HexHeightCache] 去重后采样点数量: ${uniquePositions.length}，节省: ${positions.length - uniquePositions.length} 个点`);
    
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
   * 清空直接位置缓存
   */
  clearCache() {
    this.positionsCache.clear();
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.hexHeightCache.clear();
    this.positionsCache.clear();
    
    // 清理单例
    HexHeightCache.#instance = null;
  }
} 