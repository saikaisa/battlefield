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
  AUTO: 'AUTO'                  // 自动模式
};

export const GamePanels = {
  FORMATION_LIST: 'formation-list', // 编队列表
  COMMAND_PANEL: 'command-panel',   // 命令面板
  HEX_DETAIL: 'hex-detail',         // 六角格详细信息
  HEX_FORCE_LIST: 'hex-force-list', // 六角格部队列表
  FORCE_DETAIL: 'force-detail',     // 部队详细信息
  OVERVIEW_PANEL: 'overview-panel'    // 总览面板
};

export const GameButtons = {
  PANORAMA: 'panorama', // 俯瞰全景
  ORBIT: 'orbit', // 环绕按钮
  STATISTICS: 'statistics', // 统计按钮
  TOGGLE_LAYER: 'toggle-layer', // 图层切换按钮
  NEXT_FACTION: 'next-faction', // 下一阵营按钮
  MOVE: 'move',     // 移动按钮
  ATTACK: 'attack', // 攻击按钮
  MANAGE_FORCE: 'manage-force', // 管理部队按钮
  MANAGE_UNIT: 'manage-unit', // 管理单位按钮
  AUTO_MODE: 'auto-mode', // 自动模式按钮
};

/**
 * 模式配置表
 * 
 * 每个模式包含以下配置：
 * - ui: UI界面控制
 *   - visiblePanels: 可见面板列表
 *   - disabledButtons: 禁用的按钮列表，特殊值'all'表示全部禁用
 *   - modalPanel: 当前显示的模态面板ID
 * - interaction: 交互控制
 *   - cameraControl: 是否允许相机控制
 *   - hexSelectMode: 六角格选择模式 ('single'单选, 'multi'多选, 'none'禁止选择)
 *   - forceSelectMode: 部队选择模式 ('linked'关联六角格, 'independent'独立选择)
 *   - validator: 验证器函数名，用于验证当前操作是否有效
 */
export const ModesConfig = {
  // 自由模式
  [GameMode.FREE]: {
    // UI 控制
    ui: {
      visiblePanels: Object.values(GamePanels),
      disabledButtons: [],
    },
    // 交互控制
    interaction: {
      cameraControl: true,
      hexSelectMode: 'single',
      forceSelectMode: 'linked',
      validator: null
    }
  },

  // 俯瞰模式
  [GameMode.PANORAMA]: {
    ui: {
      visiblePanels: [GamePanels.OVERVIEW_PANEL],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.PANORAMA),
    },
    interaction: {
      cameraControl: false,
      hexSelectMode: 'none',
      forceSelectMode: 'linked',
      validator: null
    }
  },

  // 环绕模式
  [GameMode.ORBIT]: {
    ui: {
      visiblePanels: [
        GamePanels.HEX_DETAIL,
        GamePanels.FORCE_DETAIL,
        GamePanels.HEX_FORCE_LIST,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.ORBIT),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'none',
      forceSelectMode: 'linked',
      validator: null
    }
  },
  
  // 移动准备模式
  [GameMode.MOVE_PREPARE]: {
    ui: {
      visiblePanels: [
        GamePanels.HEX_DETAIL,
        GamePanels.FORCE_DETAIL,
        GamePanels.HEX_FORCE_LIST,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'multi',
      forceSelectMode: 'independent',
      validator: 'validateMovePath'
    }
  },
  
  // 移动执行模式
  [GameMode.MOVE_EXECUTE]: {
    ui: {
      visiblePanels: [
        GamePanels.HEX_DETAIL,
        GamePanels.FORCE_DETAIL,
        GamePanels.HEX_FORCE_LIST,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'none',
      forceSelectMode: 'independent',
      validator: null
    }
  },
  
  // 攻击准备模式
  [GameMode.ATTACK_PREPARE]: {
    ui: {
      visiblePanels: [
        GamePanels.HEX_DETAIL,
        GamePanels.FORCE_DETAIL,
        GamePanels.HEX_FORCE_LIST,
        GamePanels.OVERVIEW_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'multi',
      forceSelectMode: 'linked',
      validator: 'validateAttackTarget'
    }
  },
  
  // 攻击执行模式
  [GameMode.ATTACK_EXECUTE]: {
    ui: {
      visiblePanels: [GamePanels.OVERVIEW_PANEL],
      disabledButtons: Object.values(GameButtons),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'none',
      forceSelectMode: 'independent',
      validator: null
    }
  },
  
  // 统计模式
  [GameMode.STATISTICS]: {
    ui: {
      visiblePanels: Object.values(GamePanels).filter(panel => panel !== GamePanels.COMMAND_PANEL),
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.TOGGLE_LAYER),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'multi',
      forceSelectMode: 'linked',
      validator: null
    }
  },
  
  // 自动模式
  [GameMode.AUTO]: {
    ui: {
      visiblePanels: [
        GamePanels.OVERVIEW_PANEL,
        GamePanels.COMMAND_PANEL
      ],
      disabledButtons: Object.values(GameButtons).filter(btn => btn !== GameButtons.AUTO_MODE),
    },
    interaction: {
      cameraControl: true,
      hexSelectMode: 'none',
      forceSelectMode: 'linked',
      validator: null
    }
  }
};

/**
 * 根据命令类型获取相应的执行模式
 */
export function getGameModeForCommand(commandType) {
  switch (commandType) {
    case 'MOVE':
      return GameMode.MOVE_EXECUTE;
    case 'ATTACK':
      return GameMode.ATTACK_EXECUTE;
    case 'ORBIT_MODE':
    case 'RESET_CAMERA':
    case 'FOCUS_FORCE':
      return GameMode.GAZE;
    case 'CHANGE_LAYER':
    case 'SELECTION_MODE':
    case 'NEXT_FACTION':
    case 'AUTO_MODE':
      return GameMode.FREE; // 这些命令在自由模式下执行
    case 'STATISTICS':
      return GameMode.STATISTICS; // 统计模式
    default:
      return null;
  }
}

/**
 * 模式名称中文显示
 */
export const GameModeNames = {
  [GameMode.FREE]: '自由模式',
  [GameMode.GAZE]: '相机控制禁用',
  [GameMode.MOVE_PREPARE]: '移动准备',
  [GameMode.MOVE_EXECUTE]: '移动执行中',
  [GameMode.ATTACK_PREPARE]: '攻击准备',
  [GameMode.ATTACK_EXECUTE]: '战斗执行中',
  [GameMode.STATISTICS]: '统计模式',
  [GameMode.AUTO]: '自动模式'
}; 