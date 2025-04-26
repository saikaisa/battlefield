// src\layers\scene-layer\components\HexGridGenerator.js
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexConfig } from "@/config/GameConfig";
import { HexCell } from '@/models/HexCell';
import { GeoMathUtils } from "@/utils/GeoMathUtils";
import { TerrainHeightCache } from './TerrainHeightCache';

/**
 * HexGridGenerator 类用于生成六角网格数据（平顶六角格方案）
 */
export class HexGridGenerator {
  static #instance = null;

  /**
   * 获取 HexGridGenerator 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {HexGridGenerator} 单例实例
   */
  static getInstance(viewer) {
    if (!HexGridGenerator.#instance) {
      if (!viewer) {
        throw new Error('首次创建 HexGridGenerator 实例时必须提供 viewer 参数');
      }
      HexGridGenerator.#instance = new HexGridGenerator(viewer);
    }
    return HexGridGenerator.#instance;
  }

  /**
   * 私有构造函数，接收 Cesium.Viewer 实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @private
   */
  constructor(viewer) {
    if (HexGridGenerator.#instance) {
      throw new Error('HexGridGenerator 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.viewer = viewer;
    this.store = openGameStore();
    this.bounds = HexConfig.bounds;
    this.hexRadius = HexConfig.radius;
    // 计算六角格尺寸
    this.hexWidthMeters = 2 * this.hexRadius;
    this.hexHeightMeters = Math.sqrt(3) * this.hexRadius;
    this.midLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    // 水平间距：注意这里是六角格宽度的 3/4，即 1.5 * hexRadius
    this.dx = GeoMathUtils.metersToDegreesLon(this.hexWidthMeters * 0.75, this.midLat);
    // 垂直间距：六角形高度转换成纬度差
    this.dy = GeoMathUtils.metersToDegreesLat(this.hexHeightMeters);
    
    // 初始化地形高度缓存系统
    this.terrainCache = TerrainHeightCache.getInstance(viewer);

    console.log('[HexGridGenerator] 初始化：');
    console.log(`  hexRadius = ${this.hexRadius} m`);
    console.log(`  hexWidthMeters = ${this.hexWidthMeters} m, hexHeightMeters = ${this.hexHeightMeters.toFixed(2)} m`);
    console.log(`  midLat = ${this.midLat}`);
    console.log(`  dx (经度差) = ${this.dx.toFixed(6)}°, dy (纬度差) = ${this.dy.toFixed(6)}°`);
  }

  /**
   * 异步生成六角网格数据，并更新每个六角格的高度（采样 DEM）
   * @returns {Promise<Array>} 返回包含高度更新后的六角格对象数组
   */
  async generateGrid() {
    const hexCells = [];
    const { minLon, maxLon, minLat, maxLat } = this.bounds;
    let row = 0;
    // 采用行步长为 dy*0.5 实现交错排列
    for (let lat = minLat; lat <= maxLat; lat += this.dy * 0.5) {
      // 根据行号决定水平偏移
      const offset = (row % 2 === 0) ? 0 : this.dx; // 相邻行的六角格在水平方向上因为错开排列，间隔为 1.5倍的六角格半径
      console.log(`[HexGridGenerator] Row ${row}: lat=${lat.toFixed(6)} offset=${offset.toFixed(6)} (经度差)`);
      let col = 0;
      // 同一行的六角格相隔 3倍六角格半径的距离
      for (let lon = minLon + offset; lon <= maxLon; lon += this.dx * 2) {
        const centerPoint = { longitude: lon, latitude: lat, height: 0 };
        console.log(`    [HexGridGenerator] Row ${row}, Col ${col}: center=${lon.toFixed(6)}, ${lat.toFixed(6)}`);
        // 计算六个顶点（平顶六角格：0°、60°、120°、180°、240°、300°）
        const vertices = [];
        for (let i = 0; i < 6; i++) {
          const angleRad = Cesium.Math.toRadians(60 * i);
          const dX = this.hexRadius * Math.cos(angleRad);
          const dY = this.hexRadius * Math.sin(angleRad);
          const deltaLon = GeoMathUtils.metersToDegreesLon(dX, lat);
          const deltaLat = GeoMathUtils.metersToDegreesLat(dY);
          vertices.push({
            longitude: lon + deltaLon,
            latitude: lat + deltaLat,
            height: 0,
          });
        }
        // 将中心点和顶点合并为 points 数组（第 0 元素为中心，后续为顶点）
        const points = [centerPoint, ...vertices];
        // 初步生成 hexCell 数据结构（visual_style 先暂时留空）
        const hexCellData = {
          hexId: `H_${row}_${col}`,
          position: {
            points: points,
            row: row,
            col: col
          },
          terrainAttributes: {
            terrainType: "default",
            terrainComposition: {},
            elevation: 0,
            passability: { land: true, naval: false, air: true }
          },
          battlefieldState: {
            controlFaction: "neutral"
          },
          visibility: {
            visualStyles: [], // 先为空，后续根据采样高度赋值
            visibleTo: {
              "blue": true,
              "red": true
            }
          },
          additionalInfo: {
            isObjectivePoint: false,
            resource: null
          }
        };
        const hexCell = HexCell.fromPlainObject(hexCellData);
        hexCells.push(hexCell);
        console.log(`[HexGridGenerator] Row ${row}, Col ${col}: center=${lon.toFixed(6)}, ${lat.toFixed(6)}`);
        col++;
      }
      row++;
    }
    console.log(`[HexGridGenerator] 初步生成 ${hexCells.length} 个六角格, 开始更新高度...`);
    
    // 使用地形高度缓存系统更新六角格高度
    try {
      const updatedHexCells = await this.terrainCache.sampleHexCellsHeight(hexCells);
      console.log(`[HexGridGenerator] 成功更新 ${updatedHexCells.length} 个六角格的高度`);
      return updatedHexCells;
    } catch (err) {
      console.error('[HexGridGenerator] 更新六角格高度失败:', err);
      return hexCells; // 返回未更新高度的六角格
    }
  }
}
