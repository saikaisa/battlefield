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
  terrainAssetId: 3957, // Cesium Ion地形数据的Asset ID
  genOsmBuildings: true, // 是否加载Cesium OSM Buildings
};

/** 六角格相关配置 */ 
export const HexConfig = {
  radius: 500, // 六角格半径（单位：米，从中心到顶点的距离）
  // 战场边界
  bounds: {
    minLon: -75.80,
    maxLon: -75.70,
    minLat: 40.67,
    maxLat: 40.77,
  },
  // 高度采样权重
  heightSamplingWeights: {
    center: 0.4,
    vertex: 0.1,
  },
};

/** 相机视角相关配置 */ 
export const CameraConfig = {
  defaultPosition: computeDefaultCameraView(),
  defaultRange: 12000,
  defaultHeading: Cesium.Math.toRadians(45),
  defaultPitch: Cesium.Math.toRadians(-45),
  closeUpRange: 8000,
  minZoomDistance: 4000,
  maxZoomDistance: 15000,
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
