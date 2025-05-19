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

/** 战场区域相关配置 */ 
export const BattlefieldConfig = {
  locationName: LocationConfig.greatRiftValley.name,
  center: {
    lon: LocationConfig.greatRiftValley.lon,
    lat: LocationConfig.greatRiftValley.lat,
    offset: 0.1
  },
};

/** 六角格相关配置 */ 
export const HexConfig = {
  radius: 500, // 六角格半径（单位：米，从中心到顶点的距离）
  // 战场边界
  bounds: {
    minLon: BattlefieldConfig.center.lon - BattlefieldConfig.center.offset,
    maxLon: BattlefieldConfig.center.lon + BattlefieldConfig.center.offset,
    minLat: BattlefieldConfig.center.lat - BattlefieldConfig.center.offset,
    maxLat: BattlefieldConfig.center.lat + BattlefieldConfig.center.offset,
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
    minMorale: 5, // 最低士气值
    maxActionPoints: 100, // 最大行动力
    combatChance: {
      max: 1,
      min: -4,
      gain: 1  // 每回合增加的战斗机会
    },
  },

  // 移动配置
  movementConfig: {
    defaultTurnDuration: 200, // 默认转向时间(毫秒)
    baseSpeed: HexConfig.radius, // 基础移动速度（米/秒）
    baseTurnRate: 20,  // 基础转向速率(弧度/秒)，角度越小越快
    minTurnDuration: 0, // 最小转向时间(毫秒)
    maxTurnDuration: 500, // 最大转向时间(毫秒)
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
        scale: 1.5,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      bullet: 'none',
      priority: 2
    },
    helicopter1: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/helicopter1_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/helicopter1_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/helicopter1_lod2.glb" }
      ],
      transform: {
        scale: 1.5,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [ { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT } ],
      bullet: 'missile',
      priority: 2
    },
    helicopter2: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/helicopter2_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/helicopter2_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/helicopter2_lod2.glb" }
      ],  
      transform: {
        scale: 1.5,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [ { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT } ],
      bullet: 'missile',
      priority: 2
    },
    jet: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/jet_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/jet_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/jet_lod2.glb" }
      ],
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 80 }
      },
      animationList: [],
      bullet: 'shell',
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
      bullet: 'missile',
      priority: 2
    },
    sailboat: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/sailboat_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/sailboat_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/sailboat_lod2.glb" }
      ],
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      bullet: 'shell',
      priority: 1
    },
    soldier: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/soldier_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/soldier_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/soldier_lod2.glb" }
      ],
      transform: {
        scale: 0.8,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [ 
        { name: 'Idle', loop: Cesium.ModelAnimationLoop.REPEAT },
        { name: 'Move', loop: Cesium.ModelAnimationLoop.REPEAT }
      ],
      bullet: 'plainBullet',
      priority: 1
    },
    spydrone: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/spydrone_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/spydrone_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/spydrone_lod2.glb" }
      ],
      transform: {
        scale: 1.5,
        offset: { x: 0, y: 0, z: 100 }
      },
      animationList: [],
      bullet: 'none',
      priority: 2
    },
    tank: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/tank_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/tank_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/tank_lod2.glb" }
      ],
      transform: {
        scale: 1.2,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      bullet: 'shell',
      priority: 2
    },
    vehicle: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/vehicle_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/vehicle_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/vehicle_lod2.glb" }
      ],
      transform: {
        scale: 1.0,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      bullet: 'shell',
      priority: 2
    },
    warship: {
      lod: [
        { level: 0, distance: 0, path: "/assets/models/warship_lod0.glb" },
        { level: 1, distance: 2000, path: "/assets/models/warship_lod1.glb" },
        { level: 2, distance: 4000, path: "/assets/models/warship_lod2.glb" }
      ],
      transform: {
        scale: 1.5,
        offset: { x: 0, y: 0, z: 0 }
      },
      animationList: [],
      bullet: 'missile',
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

/** 战斗相关配置 */
export const BattleConfig = {
  /** 战力比 (进攻/防御) 区间 */
  powerRatioRanges: [
    { name: '防守方碾压', min: 0,     max: 0.01 },      // A FP≈0
    { name: '1:5',       min: 0.01,  max: 0.20 },
    { name: '1:4',       min: 0.20,  max: 0.30 },
    { name: '1:3',       min: 0.30,  max: 0.40 },
    { name: '1:2.5',     min: 0.40,  max: 0.50 },
    { name: '1:2',       min: 0.50,  max: 0.67 },
    { name: '2:3',       min: 0.67,  max: 0.90 },
    { name: '1:1',       min: 0.90,  max: 1.10 },
    { name: '3:2',       min: 1.10,  max: 1.50 },
    { name: '2:1',       min: 1.50,  max: 2.00 },
    { name: '5:2',       min: 2.00,  max: 2.50 },
    { name: '3:1',       min: 2.50,  max: 3.50 },
    { name: '7:2',       min: 3.50,  max: 4.50 },
    { name: '4:1',       min: 4.50,  max: 6.00 },
    { name: '5:1',       min: 6.00,  max: 8.00 },
    { name: '8:1',       min: 8.00,  max: 10.00 },
    { name: '进攻方碾压', min: 10.00, max: Infinity }   // D FP≈0
  ],

  /** 裁决表 —— 行=骰点(1~6)，列=倍率档 */
  battleTable: [
  /*      防守碾压    1:5    1:4     1:3    1:2.5     1:2     2:3     1:1     3:2     2:1     5:2     3:1     7:2     4:1      5:1      8:1    进攻碾压 */
  /*骰1*/['A10/D0','A9/D0','A9/D0','A8/D1','A8/D1','A7/D2','A6/D3','A5/D4','A4/D6','A3/D7','A2/D8','A1/D9','A1/D9','A0/D10','A0/D10','A0/D10','A0/D10'],
  /*骰2*/['A10/D0','A9/D0','A8/D0','A8/D1','A7/D2','A6/D3','A5/D3','A4/D5','A3/D6','A2/D7','A2/D7','A1/D8','A0/D8','A0/D9' ,'A0/D9' ,'A0/D10','A0/D10'],
  /*骰3*/['A10/D0','A9/D0','A8/D1','A7/D2','A7/D2','A6/D2','A5/D3','A4/D4','A3/D5','A2/D6','A1/D7','A1/D7','A0/D8','A0/D8' ,'A0/D9' ,'A0/D9' ,'A0/D10'],
  /*骰4*/['A10/D0','A8/D1','A7/D2','A7/D2','A6/D2','A5/D2','A4/D3','A3/D3','A2/D4','A1/D5','A1/D6','A0/D6','A0/D7','A0/D8' ,'A0/D8' ,'A0/D9' ,'A0/D10'],
  /*骰5*/['A10/D0','A8/D1','A7/D2','A6/D2','A5/D2','A4/D2','A3/D2','A2/D3','A2/D3','A1/D4','A0/D5','A0/D5','A0/D6','A0/D6' ,'A0/D7' ,'A0/D8' ,'A0/D10' ],
  /*骰6*/['A10/D0','A7/D2','A6/D2','A5/D2','A5/D2','A4/D2','A3/D2','A2/D2','A1/D3','A0/D4','A0/D4','A0/D4','A0/D5','A0/D5' ,'A0/D6' ,'A0/D6' ,'A0/D10' ]
  ],

  /** 损失等级对应兵力扣减（最大兵力固定为 100） */
  strengthLossMap: {
    A0: 0, A1: 10, A2: 20, A3: 30, A4: 40, A5: 50, A6: 60, A7: 70, A8: 80, A9: 90, A10: 100,
    D0: 0, D1: 10, D2: 20, D3: 30, D4: 40, D5: 50, D6: 60, D7: 70, D8: 80, D9: 90, D10: 100
  },
  
  // 战斗动画配置
  animation: {
    bulletEffectCount: 20,     // 默认生成的射击特效数量
    bulletSpeed: 300,          // 子弹飞行速度(米/秒)
    shellSpeed: 500,          // 炮弹飞行速度(米/秒)
    missileSpeed: 1000,         // 导弹飞行速度(米/秒)
    effectDelay: {             // 特效延迟范围(毫秒)
      min: 100,
      max: 2000
    },
    minBulletsPerAttacker: 2,  // 每名进攻方最少发射的子弹数量
    explosionDuration: 1000,   // 爆炸效果持续时间(毫秒)
    battleMinDuration: 3000,   // 战斗最短持续时间(毫秒)
    battleMaxDuration: 8000    // 战斗最长持续时间(毫秒)
  }
};
