import * as Cesium from 'cesium';
import { openGameStore } from '@/store';
import { HexConfig } from "@/config/GameConfig";
import { HexCell } from '@/models/HexCell';

/**
 * 将米转换为纬度差（度），大致 111320 米=1 度
 * @param {number} meters 
 * @returns {number} 差值（度）
 */
function metersToDegreesLat(meters) {
  return meters / 111320;
}

/**
 * 将米转换为经度差（度），需要根据当前纬度进行校正
 * @param {number} meters 
 * @param {number} latDegrees 当前纬度（度）
 * @returns {number} 差值（度）
 */
function metersToDegreesLon(meters, latDegrees) {
  const latRadians = Cesium.Math.toRadians(latDegrees);
  return meters / (111320 * Math.cos(latRadians));
}

/**
 * HexGridGenerator 类用于生成六角网格数据（平顶六角格方案）
 */
export class HexGridGenerator {
  /**
   * 构造函数
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.bounds = HexConfig.bounds;
    this.hexRadius = HexConfig.radius;
    // 计算六角格尺寸
    this.hexWidthMeters = 2 * this.hexRadius;
    this.hexHeightMeters = Math.sqrt(3) * this.hexRadius;
    this.midLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    // 水平间距：注意这里是六角格宽度的 3/4，即 1.5 * hexRadius
    this.dx = metersToDegreesLon(this.hexWidthMeters * 0.75, this.midLat);
    // 垂直间距：六角形高度转换成纬度差
    this.dy = metersToDegreesLat(this.hexHeightMeters);

    console.log('[HexGridGenerator] 初始化：');
    console.log(`  hexRadius = ${this.hexRadius} m`);
    console.log(`  hexWidthMeters = ${this.hexWidthMeters} m, hexHeightMeters = ${this.hexHeightMeters.toFixed(2)} m`);
    console.log(`  midLat = ${this.midLat}`);
    console.log(`  dx (经度差) = ${this.dx.toFixed(6)}°, dy (纬度差) = ${this.dy.toFixed(6)}°`);
  }

  /**
   * 异步生成六角网格数据，并更新每个六角格的高度（采样 DEM）
   * @param {Cesium.TerrainProvider} terrainProvider DEM 地形数据提供者
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
          const deltaLon = metersToDegreesLon(dX, lat);
          const deltaLat = metersToDegreesLat(dY);
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
            forcesList: [],
            controlFaction: "neutral"
          },
          visibility: {
            visualStyle: {}, // 先为空，后续根据采样高度赋值
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
    
    // 采样所有六角格中 7 个点（中心 + 6 个顶点）
    const samplePositions = [];
    hexCells.forEach((cell) => {
      cell.position.points.forEach((pt) => {
        samplePositions.push(Cesium.Cartographic.fromDegrees(pt.longitude, pt.latitude));
      });
    });
    
    try {
      const updated = await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, samplePositions);
      hexCells.forEach((cell, i) => {
        const base = i * 7;
        for (let j = 0; j < 7; j++) {
          cell.position.points[j].height = updated[base + j].height;
        }
        cell.updateElevation();
      });
    } catch (err) {
      console.error('更新六角格高度失败:', err);
    }
    
    // 动态赋值视觉样式：等 DEM 更新完成后，根据更新后的 elevation 自动赋值 terrainType 和 visualStyle
    hexCells.forEach((cell) => {
      cell.updateVisualStyleByElevation();
    });
    
    this.store.setHexCells(hexCells);
    return hexCells;
  }
}
