import * as Cesium from "cesium";

function computeDefaultCameraView() {
  return Cesium.Cartographic.fromDegrees(
    (HexConfig.bounds.maxLon + HexConfig.bounds.minLon) / 2,
    (HexConfig.bounds.maxLat + HexConfig.bounds.minLat) / 2,
    0
  )
}

export const CesiumConfig = {
  terrainAssetId: 3957, // Cesium Ion地形数据的Asset ID
  genOsmBuildings: true, // 是否加载Cesium OSM Buildings
};

export const HexConfig = {
  radius: 500, // 六角格半径（单位：米，从中心到顶点的距离）
  // 战场边界
  bounds: {
    minLon: -75.95,
    maxLon: -75.85,
    minLat: 40.57,
    maxLat: 40.67,
  },
  // 高度采样权重
  heightSamplingWeights: {
    center: 0.4,
    vertex: 0.1,
  },
};

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
