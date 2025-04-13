const hexBounds = {
  minLon: -75.95,
  maxLon: -75.85,
  minLat: 40.57,
  maxLat: 40.67
};
  
function computeDefaultCameraView(bounds) {
  return {
    longitude: (bounds.maxLon + bounds.minLon) / 2,
    latitude: (bounds.maxLat + bounds.minLat) / 2,
    height: 12000,
    heading: 45,
    pitch: -45,
    roll: 0
  };
}

const GameConfig = {
    // Cesium配置
    cesium: {
      terrainAssetId: 3957,  // Cesium Ion地形数据的Asset ID
      osmBuildings: true,    // 是否加载Cesium OSM Buildings
    },
  
    // 六角格网格生成参数
    hexGrid: {
      hexRadius: 500, // 六角格半径（单位：米，从中心到顶点的距离）
      bounds: hexBounds,
      // 高度采样权重
      heightSamplingWeights: {
        center: 0.4,
        vertex: 0.1
      }
    },

    // 地图默认视角配置
    defaultCameraView: computeDefaultCameraView(hexBounds),

    // 摄像机视角限定参数
    cameraControl: {
      minZoomDistance: 4000,
      maxZoomDistance: 15000,
      enableTilt: false
    },
  
    // 后端API的URL (便于前端统一调用)
    backendApi: {
      baseUrl: "http://localhost:8080/api", // 后续根据实际部署环境更改
      endpoints: {
        move: "/command/move",
        attack: "/command/attack",
        createForce: "/command/create-force",
        mergeForces: "/command/merge-forces",
        splitForce: "/command/split-force",
        queryHex: "/query/hex",
        queryForces: "/query/forces",
        queryUnitTypes: "/query/unit-types"
      }
    }
  };
  
  export default GameConfig;
  