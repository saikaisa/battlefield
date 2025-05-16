// src\config\GameConfig.js
import * as Cesium from "cesium";

function computeDefaultCameraView() {
  return Cesium.Cartographic.fromDegrees(
    (HexConfig.bounds.maxLon + HexConfig.bounds.minLon) / 2,
    (HexConfig.bounds.maxLat + HexConfig.bounds.minLat) / 2,
    0
  )
}

/** 规则相关配置 */
export const RuleConfig = {
  // 起始回合
  startRound: 1,
  // 先手阵营
  firstFaction: 'blue',
  // 阵营显示名称
  factionNames: {
    blue: '蓝方',
    red: '红方'
  }
}

/** Cesium基础配置 */ 
export const CesiumConfig = {
  terrainAssetId: 1, // Cesium Ion地形数据的Asset ID
  imageryAssetId: 3, // Cesium Ion影像数据的Asset ID
  genOsmBuildings: true, // 是否加载Cesium OSM Buildings
  sampleBatchSize: 500,
  decimalAccuracy: 7, // 去重时判断为同一位置的精确程度
  timeout: 2000
};

/** 一些地点的经纬度坐标 */
export const LocationConfig = {
  // 珠穆朗玛峰
  mountEverest: {
    name: '珠穆朗玛峰',
    lon: 86.9250,
    lat: 27.9881,
  },
  // 乞力马扎罗山
  kilimanjaro: {
    name: '乞力马扎罗山',
    lon: 37.3506,
    lat: -3.0769,
  },
  // 东非大裂谷
  greatRiftValley: {
    name: '东非大裂谷',
    lon: 36.8065,
    lat: -3.9372,
  },
  // 青县
  qingXian: {
    name: '青县',
    lon: 116.80,
    lat: 38.58,
  }
};

/** 战场相关配置 */ 
export const BattleConfig = {
  locationName: LocationConfig.greatRiftValley.name,
  center: {
    lon: LocationConfig.greatRiftValley.lon,
    lat: LocationConfig.greatRiftValley.lat,
    offset: 0.1
  },
};

/** 六角格相关配置 */ 
export const HexConfig = {
  radius: 300, // 六角格半径（单位：米，从中心到顶点的距离）
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
  // 六角格额外挤压高度 - 除了heightOffset外，额外向下挤压的高度，确保没有缝隙
  extrusionHeight: -50.0,
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
  defaultRange: 12000,
  defaultHeading: Cesium.Math.toRadians(45),
  defaultPitch: Cesium.Math.toRadians(-45),
  closeUpRange: 3000,
  minZoomDistance: 0,
  maxZoomDistance: 15000,
  enableTilt: false,
  enableRotate: true,
  enableZoom: true,
  enableTranslate: true,
  enableLook: true,
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
      min: -2,
      gain: 2  // 每回合增加的战斗机会
    },
    fatigueFactor: {
      levelOne: 0.9,
      levelTwo: 0.8,
    },
  },

  // 移动配置
  movementConfig: {
    defaultTurnDuration: 200, // 默认转向时间(毫秒)
    baseSpeed: HexConfig.radius / 2, // 基础移动速度（米/秒），应该为六角格半径的1/2
    baseTurnRate: 3,  // 基础转向速率(弧度/秒)，角度越小越快
    minTurnDuration: 100, // 最小转向时间(毫秒)
    maxTurnDuration: 800, // 最大转向时间(毫秒)
  },

  // 部队排布配置
  layoutConfig: {
    // 部队布局（随机散列）
    forceLayout: {
      disperseRadius: 0.4,    // 部队分散半径 = 六角格半径 * 此系数
    },
    // 部队内兵种布局（环形排列）
    unitLayout: {
      maxCount: 6,           // 部队内最多渲染的兵种实例数（六边形布局） 
      radius: 200,             // 环形布局半径（米）
      heightOffset: 20,       // 模型离地高度（米）
    },
  },

  // 兵种模型资源路径与LOD配置
  models: {
    // 兵种模型
    ambulance: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/ambulance_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/ambulance_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/ambulance_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 2
    },
    helicopter1: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/helicopter1_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/helicopter1_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/helicopter1_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [ { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT } ],
      priority: 2
    },
    helicopter2: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/helicopter2_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/helicopter2_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/helicopter2_lod2.glb" }
      ],  
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [ { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT } ],
      priority: 2
    },
    jet: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/jet_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/jet_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/jet_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 80 }
      },
      animationList: [],
      priority: 2
    },
    missiletank: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/missiletank_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/missiletank_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/missiletank_lod2.glb" }
      ],
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 2
    },
    sailboat: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/sailboat_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/sailboat_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/sailboat_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 1
    },
    soldier: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/soldier_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/soldier_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/soldier_lod2.glb" }
      ],
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [ 
        { name: 'Idle', loop: Cesium.ModelAnimationLoop.REPEAT },
        { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT }
       ],
       priority: 1
    },
    spydrone: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/spydrone_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/spydrone_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/spydrone_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [],
      priority: 2
    },
    tank: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/tank_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/tank_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/tank_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 2
    },
    vehicle: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/vehicle_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/vehicle_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/vehicle_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 2
    },
    warship: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/warship_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/warship_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/warship_lod2.glb" }
      ],
      transform: {
        scale: 2.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      priority: 3
    },
  },
  // 子弹模型资源路径与LOD配置
  bullets: {
    // 子弹模型
    missile: {
      path: "/assets/models/missile.glb",
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      }
    },
    shell: {
      path: "/assets/models/shell.glb",
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      }
    }
  }
};
