/**
 * 游戏模式类型
 */
export const GameMode = {
  FREE: 'FREE',                 // 自由模式
  PANORAMA: 'PANORAMA',         // 俯瞰模式
  ORBIT: 'ORBIT',               // 环绕模式
  MOVE_PREPARE: 'MOVE_PREPARE', // 移动准备模式
  MOVE_EXECUTE: 'MOVE_EXECUTE', // 移动执行模式
  ATTACK_PREPARE: 'ATTACK_PREPARE', // 进攻准备模式
  ATTACK_EXECUTE: 'ATTACK_EXECUTE', // 进攻执行模式
  STATISTICS: 'STATISTICS',     // 统计模式
  AUTO: 'AUTO',                 // 自动模式
};

// 面板名称
export const GamePanels = {
  FORMATION_LIST: 'formation-list', // 编队列表
  COMMAND_PANEL: 'command-panel',   // 命令面板
  DETAIL_INFO_PANEL: 'detail-info-panel', // 详细信息面板
  OVERVIEW_PANEL: 'overview-panel'    // 总览面板
};

// 按钮名称
export const GameButtons = {
  PANORAMA: 'panorama', // 俯瞰全景
  ORBIT: 'orbit', // 环绕按钮
  RESET_CAMERA: 'reset-camera', // 复位按钮
  STATISTICS: 'statistics', // 统计按钮
  TOGGLE_LAYER: 'toggle-layer', // 图层切换按钮
  NEXT_FACTION: 'next-faction', // 下一阵营按钮
  MOVE: 'move',     // 移动按钮
  ATTACK: 'attack', // 攻击按钮
  MANAGE_FORCE: 'manage-force', // 管理部队按钮
  MANAGE_UNIT: 'manage-unit', // 管理兵种按钮
  AUTO_MODE: 'auto-mode', // 自动模式按钮
};

/**
 * 模式配置表
 * 
 * 每个模式包含以下配置：
 * - ui: UI界面控制
 *   - enabledPanels: 可见面板列表
 *   - disabledButtons: 禁用的按钮列表
 * - interaction: 交互控制
 *   - cameraControl: 是否允许相机控制
 *   - mouseInteract: 是否允许鼠标交互
 *   - selectMode: 六角格和部队选择模式 ('single'单选, 'multi'多选)
 *   - linkMode: 部队与六角格的关联模式 ('linked'关联六角格, 'independent'独立选择)
 *   - validator: 验证器函数名，用于验证当前操作是否有效
 */
export const ModesConfig = {
  // 自动模式
  [GameMode.AUTO]: {
    ui: {
      enabledPanels: [GamePanels.OVERVIEW_PANEL, GamePanels.COMMAND_PANEL],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.AUTO_MODE),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: false,
      selectMode: 'multi',
      linkMode: 'independent',
      validator: null
    }
  },
  // 自由模式
  [GameMode.FREE]: {
    // UI 控制
    ui: {
      enabledPanels: Object.values(GamePanels),
      disabledButtons: [],
    },
    // 交互控制
    interaction: {
      cameraControl: true,
      mouseInteract: true,
      selectMode: 'single',
      linkMode: 'linked',
      validator: null
    }
  },

  // 俯瞰模式
  [GameMode.PANORAMA]: {
    ui: {
      enabledPanels: [GamePanels.OVERVIEW_PANEL],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.PANORAMA),
    },
    interaction: {
      cameraControl: false,
      mouseInteract: false,
      selectMode: 'single',
      linkMode: 'linked',
      validator: null
    }
  },

  // 环绕模式
  [GameMode.ORBIT]: {
    ui: {
      enabledPanels: [
        GamePanels.DETAIL_INFO_PANEL,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.ORBIT),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: false,
      selectMode: 'single',
      linkMode: 'linked',
      validator: null
    }
  },
  
  // 移动准备模式
  [GameMode.MOVE_PREPARE]: {
    ui: {
      enabledPanels: [
        GamePanels.DETAIL_INFO_PANEL,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER && btn !== GameButtons.MOVE),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: true,
      selectMode: 'multi',
      linkMode: 'independent',
      validator: 'validateMovePath'
    }
  },
  
  // 移动执行模式
  [GameMode.MOVE_EXECUTE]: {
    ui: {
      enabledPanels: [
        GamePanels.DETAIL_INFO_PANEL,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: false,
      selectMode: 'multi',
      linkMode: 'independent',
      validator: null
    }
  },
  
  // 攻击准备模式
  [GameMode.ATTACK_PREPARE]: {
    ui: {
      enabledPanels: [
        GamePanels.DETAIL_INFO_PANEL,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER && btn !== GameButtons.ATTACK),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: true,
      selectMode: 'multi',
      linkMode: 'linked',
      validator: 'validateAttackTarget'
    }
  },
  
  // 攻击执行模式
  [GameMode.ATTACK_EXECUTE]: {
    ui: {
      enabledPanels: [GamePanels.OVERVIEW_PANEL],
      disabledButtons: Object.values(GameButtons),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: false,
      selectMode: 'multi',
      linkMode: 'independent',
      validator: null
    }
  },
  
  // 统计模式
  [GameMode.STATISTICS]: {
    ui: {
      enabledPanels: Object.values(GamePanels).filter(panel => panel !== GamePanels.COMMAND_PANEL),
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER && btn !== GameButtons.STATISTICS),
    },
    interaction: {
      cameraControl: true,
      mouseInteract: true,
      selectMode: 'multi',
      linkMode: 'linked',
      validator: null
    }
  }
};

/**
 * 模式名称中文显示
 */
export const GameModeNames = {
  [GameMode.FREE]: '自由模式',
  [GameMode.PANORAMA]: '俯瞰模式',
  [GameMode.ORBIT]: '环绕模式',
  [GameMode.MOVE_PREPARE]: '移动准备模式',
  [GameMode.MOVE_EXECUTE]: '移动执行模式',
  [GameMode.ATTACK_PREPARE]: '进攻准备模式',
  [GameMode.ATTACK_EXECUTE]: '进攻执行模式',
  [GameMode.STATISTICS]: '统计模式',
  [GameMode.AUTO]: '自动模式'
}; 