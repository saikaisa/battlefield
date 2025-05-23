/**
 * GameModeManager.js - 游戏模式管理器
 * 
 * 负责管理游戏的不同模式（自由模式、移动模式、攻击模式等）
 * 以及模式间的切换和状态维护
 */
import { GameMode, ModesConfig, GameModeNames, GamePanels } from '@/config/GameModeConfig';
import { openGameStore } from '@/store';
import { OverviewConsole } from './utils/OverviewConsole';

/**
 * 游戏模式管理器
 */
export class GameModeManager {
  static #instance = null;
  
  /**
   * 获取单例实例
   * @returns {GameModeManager} 单例实例
   */
  static getInstance() {
    if (!GameModeManager.#instance) {
      GameModeManager.#instance = new GameModeManager();
    }
    return GameModeManager.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   */
  constructor() {
    this.store = openGameStore();

    // 保存选中六角格和部队id
    this._lastSelectedHexIds = [];
    this._lastSelectedForceIds = [];
    
    // 保存总览控制台内容
    this._lastConsoleContent = null;

    // 初始化为自由模式
    this.setMode(GameMode.FREE);
  }
  
  /**
   * 获取当前游戏模式
   * @returns {string} 当前模式
   */
  getCurrentMode() {
    return this.store.gameMode;
  }
  
  /**
   * 设置游戏模式
   * @param {string} mode 模式名称
   * @returns {GameModeManager} 链式调用
   */
  setMode(mode) {
    const prevMode = this.getCurrentMode();
    let config = null;

    // 更新Store中的模式状态
    this.store.setGameMode(mode);

    // 如果模式是自动模式，则应用自动模式配置
    if (this.store.autoMode) {
      config = ModesConfig[GameMode.AUTO];
    } else {
      config = ModesConfig[mode] || ModesConfig[GameMode.FREE];
    }

    // 应用UI限制和交互设置
    this._applyUIRestrictions(config);
    this._applyInteractionSettings(config);
    
    // 显示模式变更提示
    if (prevMode !== mode) {
      console.log(`游戏模式切换: ${GameModeNames[prevMode] || prevMode} -> ${GameModeNames[mode] || mode}`);
    }
    
    return this;
  }
  
  /**
   * 保存选中六角格和部队id
   */
  saveSelectedHexIds() {
    this._lastSelectedHexIds = Array.from(this.store.getSelectedHexIds());
    this._lastSelectedForceIds = Array.from(this.store.getSelectedForceIds());
    return this;
  }

  /**
   * 恢复选中六角格和部队id
   */
  restoreSelectedHexIds() {
    this.store.setSelectedHexIds(this._lastSelectedHexIds);
    this.store.setSelectedForceIds(this._lastSelectedForceIds);
    return this;
  }

  /**
   * 设置锁定选中
   */
  setLockedSelection(hexIds, forceIds) {
    this.store.setLockedSelection(hexIds, forceIds);
    return this;
  }

  /**
   * 清除锁定选中
   */
  clearLockedSelection() {
    this.store.clearLockedSelection();
    return this;
  }

  /**
   * 保存控制台内容
   */
  saveConsoleContent() {
    this._lastConsoleContent = OverviewConsole.getContent();
    return this;
  }

  /**
   * 恢复控制台内容
   * @returns {boolean} 是否成功恢复
   */
  restoreConsoleContent() {
    OverviewConsole.setContent(this._lastConsoleContent);
    return this;
  }

  /**
   * 清除控制台
   */
  clearConsole() {
    OverviewConsole.clear();
    return this;
  }
  
  // ==================== 私有辅助方法 ====================
  /**
   * 应用UI限制
   * @private
   * @param {Object} config 模式配置
   */
  _applyUIRestrictions(config) {
    // 1. 设置禁用的面板
    const allPanels = Object.values(GamePanels);
    const disabledPanels = allPanels.filter(panel => 
      !config.ui.enabledPanels.includes(panel));
    this.store.setDisabledPanels(disabledPanels);
    
    // 2. 设置禁用的按钮
    this.store.setDisabledButtons(config.ui.disabledButtons || []);
  }
  
  /**
   * 应用交互设置和选择规则
   * @private
   * @param {Object} config 模式配置
   */
  _applyInteractionSettings(config) {
    const inter = config.interaction;
    if (!inter) {
      console.warn('未找到交互设置');
      return;
    }

    // 1. 设置相机控制
    this.store.setCameraControlEnabled(inter.cameraControl !== undefined ? inter.cameraControl : true);
    console.log(`CameraControl IS SET TO : ${inter.cameraControl  }`);

    // 2. 应用选择维护规则
    if (inter.mouseInteract !== undefined) {
      this.store.setMouseInteract(inter.mouseInteract);
      console.log(`MOUSEINTERACT IS SET TO : ${inter.mouseInteract}`);
    }
    if (inter.selectMode) {
      this.store.setSelectMode(inter.selectMode);
    }
    if (inter.linkMode) {
      this.store.setLinkMode(inter.linkMode);
    }
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    GameModeManager.#instance = null;
  }
}

// 导出游戏模式服务
export const gameModeService = {
  setMode(mode) {
    return GameModeManager.getInstance().setMode(mode);
  },
  
  getCurrentMode() {
    return GameModeManager.getInstance().getCurrentMode();
  },

  saveSelectedHexIds() {
    return GameModeManager.getInstance().saveSelectedHexIds();
  },

  restoreSelectedHexIds() {
    return GameModeManager.getInstance().restoreSelectedHexIds();
  },

  setLockedSelection(hexIds, forceIds) {
    return GameModeManager.getInstance().setLockedSelection(hexIds, forceIds);
  },

  clearLockedSelection() {
    return GameModeManager.getInstance().clearLockedSelection();
  },

  saveConsoleContent() {
    return GameModeManager.getInstance().saveConsoleContent();
  },

  restoreConsoleContent() {
    return GameModeManager.getInstance().restoreConsoleContent();
  },

  clearConsole() {
    return GameModeManager.getInstance().clearConsole();
  }
}; 