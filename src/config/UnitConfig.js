const UnitConfig = {
  // 限制参数（作为前端参考或限制条件）
  limit: {
    maxTroopStrength: 100,
    defaultMorale: 100,
    minMorale: 50,
    actionPointsPerTurn: 100,
    fatigueFactor: {
      levelOne: 0.9,
      levelTwo: 0.8,
    }
  },

  // 兵种模型资源路径与LOD配置
  unitModels: {
    infantry: {
      modelPath: "/assets/models/infantry.glb",
      lodLevels: [
        { level: 0, distance: 0, modelPath: "/assets/models/infantry_high.glb" },
        { level: 1, distance: 1000, modelPath: "/assets/models/infantry_mid.glb" },
        { level: 2, distance: 3000, modelPath: "/assets/models/infantry_low.glb" }
      ],
      animations: {
        walk: "/assets/animations/infantry_walk.glb",
        attack: "/assets/animations/infantry_attack.glb",
        hit: "/assets/animations/infantry_hit.glb",
        die: "/assets/animations/infantry_die.glb"
      }
    },
    artillery: {
      modelPath: "/assets/models/artillery.glb",
      lodLevels: [
        { level: 0, distance: 0, modelPath: "/assets/models/artillery_high.glb" },
        { level: 1, distance: 1000, modelPath: "/assets/models/artillery_mid.glb" },
        { level: 2, distance: 3000, modelPath: "/assets/models/artillery_low.glb" }
      ],
      animations: {
        move: "/assets/animations/artillery_move.glb",
        attack: "/assets/animations/artillery_attack.glb",
        hit: "/assets/animations/artillery_hit.glb",
        destroy: "/assets/animations/artillery_destroy.glb"
      }
    },
    tankHeavy: {
      modelPath: "/assets/models/tank_heavy.glb",
      lodLevels: [
        { level: 0, distance: 0, modelPath: "/assets/models/tank_heavy_high.glb" },
        { level: 1, distance: 800, modelPath: "/assets/models/tank_heavy_mid.glb" },
        { level: 2, distance: 2000, modelPath: "/assets/models/tank_heavy_low.glb" }
      ],
      animations: {
        move: "/assets/animations/tank_move.glb",
        attack: "/assets/animations/tank_attack.glb",
        hit: "/assets/animations/tank_hit.glb",
        destroy: "/assets/animations/tank_destroy.glb"
      }
    },
    plane: {
      modelPath: "/assets/plane.gltf",
      lodLevels: [
        { level: 0, distance: 0, modelPath: "/assets/plane.gltf" },
        { level: 1, distance: 800, modelPath: "/assets/plane.gltf" },
        { level: 2, distance: 1500, modelPath: "/assets/plane.gltf" }
      ],
      animations: {}  // 根据需要补充动画
    }
  }
};

export default UnitConfig;