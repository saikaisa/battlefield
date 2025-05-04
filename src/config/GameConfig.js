// src\config\GameConfig.js
import * as Cesium from "cesium";

function computeDefaultCameraView() {
  return Cesium.Cartographic.fromDegrees(
    (HexConfig.bounds.maxLon + HexConfig.bounds.minLon) / 2,
    (HexConfig.bounds.maxLat + HexConfig.bounds.minLat) / 2,
    0
  )
}

/** Cesium基础配置 */ 
export const CesiumConfig = {
  terrainAssetId: 1, // Cesium Ion地形数据的Asset ID
  imageryAssetId: 3, // Cesium Ion影像数据的Asset ID
  genOsmBuildings: true, // 是否加载Cesium OSM Buildings
};

/** 一些地点的经纬度坐标 */
export const LocationConfig = {
  // 珠穆朗玛峰
  mountEverest: {
    lon: 86.9250,
    lat: 27.9881,
  },
  // 乞力马扎罗山
  kilimanjaro: {
    lon: 37.3506,
    lat: -3.0769,
  },
  // 东非大裂谷
  greatRiftValley: {
    lon: 36.8065,
    lat: -3.9372,
  },
};

/** 战场相关配置 */ 
export const BattleConfig = {
  center: {
    lon: LocationConfig.kilimanjaro.lon,
    lat: LocationConfig.kilimanjaro.lat,
    offset: 0.1
  },
};

/** 六角格相关配置 */ 
export const HexConfig = {
  radius: 200, // 六角格半径（单位：米，从中心到顶点的距离）
  // 战场边界
  bounds: {
    minLon: BattleConfig.center.lon - BattleConfig.center.offset,
    maxLon: BattleConfig.center.lon + BattleConfig.center.offset,
    minLat: BattleConfig.center.lat - BattleConfig.center.offset,
    maxLat: BattleConfig.center.lat + BattleConfig.center.offset,
  },
  // 高度采样权重
  heightSamplingWeights: {
    center: 0.4,
    vertex: 0.1,
  },
};

/** 六角格渲染配置 */
export const HexRendererConfig = {
  // 六角格边缘到地面的基础高度偏移
  heightOffset: 50.0,
  // 边界偏移额外增加量
  borderExtraOffset: 0.0,
  // 地形变化系数，控制地形复杂区域高度偏移增加程度
  terrainFactor: 0.8,
  // 六角格挤压高度 - 向下挤压确保没有缝隙
  extrusionHeight: -100.0,
  // 地形陡峭性分级 - 调整不同地形下的高度偏移
  terrainSteepness: {
    flat: { maxRange: 10, extraOffset: 0 },     // 平缓地形 (0-10米高差)
    gentle: { maxRange: 20, extraOffset: 0 },  // 轻微起伏 (10-20米高差)
    moderate: { maxRange: 50, extraOffset: 0 }, // 中等陡峭 (20-50米高差)
    steep: { maxRange: 100, extraOffset: 0 },   // 显著陡峭 (50-100米高差)
    verysteep: { maxRange: 200, extraOffset: 20 }, // 非常陡峭 (100-200米高差)
    extreme: { maxRange: 500, extraOffset: 20 }, // 极端陡峭 (200-500米高差)
    mountain: { extraOffset: 20 }              // 高山额外偏移量
  },
  // 山顶/山脊额外偏移
  mountainPeakExtraOffset: 0.0,
  // 优化配置
  optimization: {
    // 地形采样精度，值越大性能越好但质量越低
    terrainSamplingError: 4.0
  }
};

/** 相机视角相关配置 */ 
export const CameraConfig = {
  defaultPosition: computeDefaultCameraView(),
  defaultRange: 800,
  defaultHeading: Cesium.Math.toRadians(45),
  defaultPitch: Cesium.Math.toRadians(-45),
  closeUpRange: 2000,
  minZoomDistance: 300,
  maxZoomDistance: Infinity,
  enableTilt: false
};

/** 军事单位相关配置 */ 
export const MilitaryConfig = {
  // 限制参数（作为前端参考或限制条件）
  limit: {
    maxTroopStrength: 100, // 最大兵力值
    minMorale: 50, // 最低士气值
    maxActionPoints: 100, // 最大行动力
    combatChance: {
      max: 1,
      min: -2
    },
    fatigueFactor: {
      levelOne: 0.9,
      levelTwo: 0.8,
    }
  },

  // 兵种模型资源路径与LOD配置
  // ...
};

/** API配置 */ 
export const ApiConfig = {
  baseUrl: "http://localhost:8080/api", // 后续根据实际部署环境更改
  endpoints: {
    move: "/command/move",
    attack: "/command/attack",
    createForce: "/command/create-force",
    mergeForces: "/command/merge-forces",
    splitForce: "/command/split-force",
    queryHex: "/query/hex",
    queryForces: "/query/forces",
    queryUnitTypes: "/query/unit-types",
  },
};
