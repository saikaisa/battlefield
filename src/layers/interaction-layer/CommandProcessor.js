/* eslint-disable no-unused-vars */
// src\layers\interaction-layer\CommandProcessor.js
import { GameMode } from '@/config/GameModeConfig';
import { openGameStore } from '@/store';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';
import { CommandStatus } from '@/config/CommandConfig';
import { gameModeService } from './GameModeManager';
import { Unit, Force, Battlegroup, Formation } from '@/models/MilitaryUnit';
import { HexCell } from '@/models/HexCell';
import { MilitaryInstanceRenderer } from '@/layers/military-layer/components/MilitaryInstanceRenderer';
import { MovementController } from '@/layers/military-layer/components/MovementController';
import { BattleController } from '@/layers/military-layer/components/BattleController';
import { MilitaryInstanceGenerator } from '@/layers/military-layer/components/MilitaryInstanceGenerator';
import { MilitaryConfig } from '@/config/GameConfig';
import { HexVisualStyles } from '@/config/HexVisualStyles';
import { showInfo } from './utils/MessageBox';
import { OverviewConsole } from './utils/OverviewConsole';
import { StatisticsHelper } from './utils/OverviewConsole';
import { watch } from 'vue';
import { showSuccess } from './utils/MessageBox';
import { SelectValidator } from './utils/HexSelectValidator';

/**
 * 命令错误类 - 用于统一处理命令执行过程中的错误
 */
export class CommandError extends Error {
  constructor(message, type = "general", data = null) {
    super(message);
    this.name = "CommandError";
    this.type = type; // 例如: 'validation', 'network', 'permission'
    this.data = data; // 可以携带额外数据
  }
}

/**
 * 命令处理模块 - 调用其他各模块的方法执行命令
 * 该模块的方法为命令，被CommandDispatcher调用
 */
export class CommandProcessor {
  static #instance = null;

  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {CommandProcessor} 单例实例
   */
  static getInstance(viewer) {
    if (!CommandProcessor.#instance) {
      CommandProcessor.#instance = new CommandProcessor(viewer);
    }
    return CommandProcessor.#instance;
  }

  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.sceneManager = SceneManager.getInstance(viewer);
    this.cameraController = CameraViewController.getInstance(viewer);
    this.militaryManager = MilitaryManager.getInstance(viewer);
    this.militaryRenderer = MilitaryInstanceRenderer.getInstance(viewer);
    this.movementController = MovementController.getInstance(viewer);
    this.battleController = BattleController.getInstance(viewer);
    this.forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap();
  }

  // ================ 场景控制命令 ================
  /**
   * 切换俯瞰模式
   * - 初始模式：自由模式/俯瞰模式
   * - 目标模式：自由模式/俯瞰模式
   * - Fallback模式：自由模式
   * @param {boolean} enabled 是否启用俯瞰模式
   * @returns {Object} 命令执行结果
   */
  async setPanoramaMode(enabled) {
    // 仅能在自由模式或俯瞰模式下切换俯瞰模式
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE && currentMode !== GameMode.PANORAMA) {
      throw new CommandError("仅能在自由模式或俯瞰模式下切换俯瞰模式", "panorama");
    }
    // 如果要进入的模式与当前模式相同，直接返回
    if ((enabled && currentMode === GameMode.PANORAMA) || (!enabled && currentMode === GameMode.FREE)) {
      return {
        status: CommandStatus.FINISHED,
        message: `已处于${enabled ? "俯瞰" : "自由"}模式`,
      };
    }

    // 切换到对应的游戏模式
    gameModeService.setMode(enabled ? GameMode.PANORAMA : GameMode.FREE);

    try {
      // 设置相机俯瞰视角
      if (enabled) {
        // 启用俯瞰模式
        await this.cameraController.setTopDownView();
      } else {
        // 禁用俯瞰模式，并恢复上次视角
        await this.cameraController.focusOnLocation(null, 2.0, false);
      }  

      return {
        status: CommandStatus.FINISHED,
        message: `俯瞰模式已${enabled ? "启用" : "禁用"}`,
      };
    } catch (error) {
      gameModeService.setMode(GameMode.FREE);
      this.resetCamera();
      throw new CommandError(`切换俯瞰模式失败: ${error.message}`, "panorama");
    }
  }

  /**
   * 切换环绕模式
   * - 初始模式：自由模式/环绕模式
   * - 目标模式：自由模式/环绕模式
   * - Fallback模式：自由模式
   * @param {boolean} enabled 是否启用环绕模式
   * @returns {Object} 命令执行结果
   */
  async toggleOrbitMode(enabled) {
    // 仅能在自由模式或环绕模式下切换环绕模式
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE && currentMode !== GameMode.ORBIT) {
      throw new CommandError("仅能在自由模式或环绕模式下切换环绕模式", "orbit");
    }
    
    // 如果要进入的模式与当前模式相同，直接返回
    if ((enabled && currentMode === GameMode.ORBIT) || (!enabled && currentMode === GameMode.FREE)) {
      return {
        status: CommandStatus.FINISHED,
        message: `已处于${enabled ? "环绕" : "自由"}模式`,
      };
    }

    // 切换到对应的游戏模式
    gameModeService.setMode(enabled ? GameMode.ORBIT : GameMode.FREE);

    try {
      // 切换相机控制
      await this.cameraController.setOrbitMode(enabled);

      return {
        status: CommandStatus.FINISHED,
        message: `环绕模式已${enabled ? "启用" : "禁用"}`,
      };
    } catch (error) {
      gameModeService.setMode(GameMode.FREE);
      this.resetCamera();
      throw new CommandError(`切换环绕模式失败: ${error.message}`, "orbit");
    }
  }

  /**
   * 复位
   * - 初始模式：任意
   * - 目标模式：自由模式
   * - Fallback模式：无
   * @returns {Object} 命令执行结果
   */
  async resetCamera() {
    // 切换到自由模式
    gameModeService.setMode(GameMode.FREE);

    try {
      await this.cameraController.resetToDefaultView();
      return {
        status: CommandStatus.FINISHED,
        message: "相机已重置",
      };
    } catch (error) {
      throw new CommandError(`重置相机失败: ${error.message}`, "camera");
    }
  }

  /**
   * 聚焦到指定部队，如果未指定部队ID，则使用当前选中的部队
   * - 初始模式：任意
   * - 目标模式：无。但如果处于俯瞰模式/环绕模式，则恢复到自由模式
   * - Fallback模式：无
   * @param {string} [forceId] 部队ID
   * @returns {Object} 命令执行结果
   */
  async focusOnForce(forceId = null) {
    // 如果处于俯瞰模式或环绕模式则先回到自由模式
    // 不直接调用切换俯瞰模式或切换环绕模式方法，因为它们在切换模式的同时会移动视角，
    // 导致聚焦部队前还要进行不必要的视角移动
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode === GameMode.PANORAMA || currentMode === GameMode.ORBIT) {
      gameModeService.setMode(GameMode.FREE);
    }

    try {
      // 如果没有指定部队ID，则使用当前选中的最后一个部队
      if (!forceId && this.store.selectedForceIds.size > 0) {
        forceId = Array.from(this.store.selectedForceIds)[this.store.selectedForceIds.size - 1];
      }

      const force = this.store.getForceById(forceId);
      if (!force || !force.hexId) {
        throw new CommandError("无法定位部队", "validation");
      }

      const hexCell = this.store.getHexCellById(force.hexId);
      if (!hexCell) {
        throw new CommandError("无法获取部队所在的六角格", "validation");
      }

      // 聚焦到部队所在的六角格
      await this.cameraController.focusOnHex(force.hexId);

      return {
        status: CommandStatus.FINISHED,
        message: "已聚焦到部队",
      };
    } catch (error) {
      throw new CommandError(`聚焦部队失败: ${error.message}`, "focus");
    }
  }

  /**
   * 切换图层
   * - 不影响游戏模式
   * @param {number} layerIndex 图层索引
   * @returns {Object} 命令执行结果
   */
  async changeLayer(layerIndex) {
    try {
      this.store.setLayerIndex(layerIndex);
      return {
        status: CommandStatus.FINISHED,
        message: `已切换到图层 ${layerIndex}`,
      };
    } catch (error) {
      throw new CommandError(`切换图层失败: ${error.message}`, "layer");
    }
  }

  /**
   * 切换到下一个阵营/回合
   * - 初始模式：自由模式
   * - 目标模式：无
   * - Fallback模式：无
   * @returns {Object} 命令执行结果
   */
  async switchToNextFaction() {
    // 仅能在自由模式下切换阵营
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE) {
      throw new CommandError("仅能在自由模式下切换阵营", "faction");
    }

    try {
      // 记录切换前的回合数
      const prevRound = this.store.currentRound;

      // 清空所有选中状态
      this.store.clearSelectedHexIds();
      this.store.clearSelectedForceIds();

      // 切换到下一个阵营
      this.store.switchToNextFaction();

      // 如果回合数发生变化，说明进入新回合，需要重置所有部队状态
      if (this.store.currentRound > prevRound) {
        // 重置所有部队的行动力和战斗机会
        const forces = this.store.getForces();
        forces.forEach((force) => {
          force.resetActionPoints(); // 重置行动力
          force.refreshCombatChance(); // 刷新战斗机会
          force.recoverTroopStrength(); // 恢复兵力
        });
      }

      // 重新计算部队可见性
      if (this.militaryManager && this.militaryManager.renderer) {
        this.militaryManager.renderer.updateHexObjectVisibility();
      }

      return {
        status: CommandStatus.FINISHED,
        message: `已切换到${this.store.currentFaction}方，当前回合: ${this.store.currentRound}`,
        data: {
          faction: this.store.currentFaction,
          round: this.store.currentRound,
        },
      };
    } catch (error) {
      throw new CommandError(`切换阵营失败: ${error.message}`, "faction");
    }
  }

  /**
   * 切换统计模式
   * - 初始模式：自由模式/统计模式
   * - 目标模式：自由模式/统计模式
   * - Fallback模式：自由模式
   * @param {boolean} enabled 是否启用统计模式
   * @returns {Object} 命令执行结果
   */
  async toggleStatMode(enabled) {
    // 仅能在自由模式和统计模式下切换统计模式
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE && currentMode !== GameMode.STATISTICS) {
      throw new CommandError("仅能在自由模式和统计模式下切换统计模式", "statistics");
    }
    
    // 如果要进入的模式与当前模式相同，直接返回
    if ((enabled && currentMode === GameMode.STATISTICS) || (!enabled && currentMode === GameMode.FREE)) {
      return {
        status: CommandStatus.FINISHED,
        message: `已处于${enabled ? "统计" : "自由"}模式`,
      };
    }

    try {
      if (enabled) {
        gameModeService.saveSelectedHexIds()
          .saveConsoleContent()
          .setMode(GameMode.STATISTICS);
        StatisticsHelper.initStatisticsConsole();
        
        // 监听选中的六角格
        this.unwatchHexSelection = watch(
          () => this.store.selectedHexIds,
          () => {
            StatisticsHelper.updateStatistics();
          },
          { deep: true }
        );
        
        // 立即执行一次统计更新
        StatisticsHelper.updateStatistics();
      } else {
        // 结束监听
        if (this.unwatchHexSelection) {
          this.unwatchHexSelection();
          this.unwatchHexSelection = null;
        }
        
        // 切回自由模式
        gameModeService.setMode(GameMode.FREE)
          .restoreConsoleContent()
          .restoreSelectedHexIds();
        OverviewConsole.log(`\n===== 从统计模式返回 =====\n`);
      }

      return {
        status: CommandStatus.FINISHED,
        message: `统计模式已${enabled ? "启用" : "禁用"}`,
      };
    } catch (error) {
      // 发生错误时恢复状态
      gameModeService.setMode(GameMode.FREE)
        .restoreConsoleContent()
        .restoreSelectedHexIds();
      throw new CommandError(`切换统计模式失败: ${error.message}`, "statistics");
    }
  }

  // ================ 移动命令 ================
  /**
   * 移动准备
   * - 初始模式：自由模式
   * - 目标模式：移动准备模式
   * - Fallback模式：自由模式
   * @returns {Object} 命令执行结果
   */
  async movePrepare() {
    // 仅能在自由模式或移动准备模式下切换移动准备
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE && currentMode !== GameMode.MOVE_PREPARE) {
      throw new CommandError("仅能在自由模式或移动准备模式下切换移动准备", "move");
    }

    // 如果当前处于移动准备模式，则回到自由模式
    if (currentMode === GameMode.MOVE_PREPARE) {
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreConsoleContent()
        .restoreSelectedHexIds();
      OverviewConsole.log(`\n===== 取消移动准备 =====\n`);
      return {
        status: CommandStatus.FINISHED,
        message: "从移动准备模式回到自由模式",
      };
    }

    try {
      gameModeService.saveSelectedHexIds()
        .saveConsoleContent()
        .clearConsole()
        .setLockedSelection(this.store.selectedHexIds, this.store.selectedForceIds)
        .setMode(GameMode.MOVE_PREPARE);

      OverviewConsole.stat(`===== 进入移动准备模式 =====`);
      OverviewConsole.log(`请选取连续的六角格作为移动路径，此处会实时显示走过当前路径需要的行动力消耗。`);
      OverviewConsole.log(`如果行动力不足/无法通行/选取路径不连续，本次选择会被拒绝。`);
      OverviewConsole.warning(`当前待移动部队：${this.store.getForceById(Array.from(this.store.selectedForceIds)[0]).forceName}`);

      return {
        status: CommandStatus.FINISHED,
        message: "已进入移动准备模式",
      };
    } catch (error) {
      // 发生错误时恢复状态
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreConsoleContent()
        .restoreSelectedHexIds();
      throw new CommandError(`切换移动准备模式失败: ${error.message}`, "move");
    }
  }

  /**
   * 执行移动
   * - 初始模式：自由模式(JSON指令)或移动准备模式(UI)
   * - 目标模式：移动执行模式
   * - Fallback模式：自由模式(JSON指令)或移动准备模式(UI)
   * @param {string} forceId 部队ID
   * @param {string[]} path 移动路径（六角格ID数组）
   * @returns {Object} 命令执行结果
   */
  async move(forceId, path) {
    // 仅能在自由模式或移动准备模式下执行移动
    const lastMode = gameModeService.getCurrentMode();
    if (lastMode !== GameMode.FREE && lastMode !== GameMode.MOVE_PREPARE) {
      throw new CommandError("仅能在自由模式或移动准备模式下执行移动", "move");
    }

    const forceInstance = this.forceInstanceMap.get(forceId);
    if (!forceInstance) {
      console.error(`未找到部队实例: ${forceId}`);
      throw new CommandError(`未找到部队实例: ${forceId}`, "validation");
    }

    const force = this.store.getForceById(forceId);
    if (!force) {
      throw new CommandError(`无法获取部队: ${forceId}`, "validation");
    }

    gameModeService.saveSelectedHexIds().setMode(GameMode.MOVE_EXECUTE);

    try {
      this.store.setSelectedHexIds(path);
      this.store.setSelectedForceIds([forceId]);
      
      OverviewConsole.success(`命令已发送，将在2秒后开始移动...`);
      // 等待2秒
      await new Promise(resolve => setTimeout(() => {
        showInfo(`开始移动`);
        resolve();
      }, 2000));
      
      // 向移动控制器发起开始移动的请求
      const prepareResult = await this.movementController.prepareMove(forceId, path);
      if (!prepareResult) {
        console.error(`部队 ${forceId} 准备移动失败`);
        throw new CommandError(`部队 ${forceId} 准备移动失败`, "move");
      }

      // 确保更新循环已启动
      this.militaryRenderer.update();

      // 播放移动动画
      if (forceInstance && forceInstance.unitInstanceMap) {
        forceInstance.unitInstanceMap.forEach(unitInstance => {
          this.militaryRenderer.addMoveAnimation(unitInstance);
        });
      }

      // 等待移动结束，通过监听movingForces的状态来判断移动是否结束
      // 创建一个Promise来等待移动完成
      await new Promise((resolve, reject) => {
        // 设置检查定时器
        const checkInterval = setInterval(() => {
          // 获取移动状态
          const movementState = this.movementController.movingForces.get(forceId);
          
          // 检查是否完成
          if (!movementState || movementState.isComplete) {
            clearInterval(checkInterval);
            // 移除移动动画
            if (forceInstance && forceInstance.unitInstanceMap) {
              forceInstance.unitInstanceMap.forEach(unitInstance => {
                this.militaryRenderer.removeMoveAnimation(unitInstance);
              });
            }

            // 完成后恢复自由模式
            gameModeService.setMode(GameMode.FREE)
              .clearLockedSelection()
              .restoreConsoleContent();

            // 更新部队状态
            force.hexId = path[path.length - 1]; // 更新部队所在六角格
            force.consumeActionPoints(force.computeActionPointsForPath(path));
            // this.store.setSelectedHexIds([path[path.length - 1]]);
            this.store.setSelectedForceIds([forceId]);
            
            OverviewConsole.success(`\n===== ${force.forceName}移动完成 =====`);
            OverviewConsole.success(`路径: ${path[0]} -> ${path[path.length - 1]}`);
            OverviewConsole.success(`消耗了${force.computeActionPointsForPath(path)}点行动力，当前行动力: ${force.actionPoints}`);
            showSuccess(`移动完成`);
            // 清理已完成的移动记录
            this.movementController.cleanupFinishedMovements();
            resolve();
          }
        }, 100); // 每100毫秒检查一次
      });

      return {
        status: CommandStatus.FINISHED,
        message: "移动完成",
      };
    } catch (error) {
      gameModeService.setMode(lastMode).restoreSelectedHexIds();
      throw new CommandError(`移动失败: ${error.message}`, "move");
    }
  }

  // ================ 攻击命令 ================
  /**
   * 攻击准备切换
   * - 初始模式：自由模式
   * - 目标模式：攻击准备模式
   * - Fallback模式：自由模式
   * @param {string} forceId 部队ID
   * @returns {Object} 命令执行结果
   */
  async attackPrepare() {
    // 仅能在自由模式或攻击准备模式下切换攻击准备
    const currentMode = gameModeService.getCurrentMode();
    if (currentMode !== GameMode.FREE && currentMode !== GameMode.ATTACK_PREPARE) {
      throw new CommandError("仅能在自由模式或攻击准备模式下切换攻击准备", "attack");
    }

    if (currentMode === GameMode.ATTACK_PREPARE) {
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreConsoleContent()
        .restoreSelectedHexIds();
      OverviewConsole.log(`\n===== 取消攻击准备 =====\n`);
      // 清除攻击状态
      this.store.clearAttackState();
      return {
        status: CommandStatus.FINISHED,
        message: "从攻击准备模式回到自由模式",
      };
    }

    try {
      // 检查是否有选中的部队作为指挥部队
      if (this.store.selectedForceIds.size === 0) {
        throw new CommandError("请先选择一个部队作为指挥部队", "validation");
      }
      
      const commandForceId = Array.from(this.store.selectedForceIds)[0];
      const commandForce = this.store.getForceById(commandForceId);
      
      if (!commandForce) {
        throw new CommandError("无法获取指挥部队信息", "validation");
      }
      
      // 检查部队是否属于当前阵营的回合
      if (commandForce.faction !== this.store.currentFaction) {
        throw new CommandError(`当前是${this.store.currentFaction}方的回合，无法使用${commandForce.faction}方部队`, "validation");
      }
      
      // 检查部队是否有战斗机会
      if (commandForce.combatChance <= 0) {
        throw new CommandError(`${commandForce.forceName}已无战斗机会`, "validation");
      }
      
      // 检查指挥范围内是否有敌方隶属权六角格
      const commandRange = commandForce.commandRange;
      const commandHexId = commandForce.hexId;
      const commandHex = this.store.getHexCellById(commandHexId);
      
      if (!commandHex) {
        throw new CommandError("无法获取指挥部队所在的六角格", "validation");
      }
      
      // 检查指挥范围内是否有敌方控制的六角格
      const hexesInRange = commandHex.getHexCellInRange(commandRange);
      const hasEnemyHex = hexesInRange.some(hex => 
        hex && hex.battlefieldState.controlFaction !== 'neutral' && 
        hex.battlefieldState.controlFaction !== commandForce.faction
      );
      
      if (!hasEnemyHex) {
        throw new CommandError("该部队指挥范围内没有敌方控制的六角格，无法发起攻击", "validation");
      }
      
      // 保存当前选中状态并设置模式
      gameModeService.saveSelectedHexIds()
        .saveConsoleContent()
        .clearConsole()
        .setMode(GameMode.ATTACK_PREPARE);

      // 清除选中的六角格和部队
      this.store.clearSelectedHexIds();
      this.store.clearSelectedForceIds();
      
      // 初始化攻击状态
      this.store.initAttackState(commandForceId);
      
      // 初始化阶段提示
      OverviewConsole.stat(`===== 攻击准备模式：选择攻击目标 =====`, 'current_stage');
      OverviewConsole.warning(`请在指挥范围内选取需要打击的敌方六角格。`, 'prepare_attack_info');
      
      // 初始化战斗信息表格
      SelectValidator.previewBattlegroups();

      return {
        status: CommandStatus.FINISHED,
        message: "已进入攻击准备模式",
      };
    } catch (error) {
      // 发生错误时恢复状态
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreConsoleContent()
        .restoreSelectedHexIds();
      // 清除攻击状态
      this.store.clearAttackState();
      throw new CommandError(`切换攻击准备模式失败: ${error.message}`, "attack");
    }
  }

  /**
   * 执行攻击
   * - 初始模式：自由模式(JSON指令)或攻击准备模式(UI)
   * - 目标模式：攻击执行模式
   * - Fallback模式：自由模式(JSON指令)或攻击准备模式(UI)
   * @param {string} commandForceId 指挥部队ID
   * @param {string} targetHex 目标六角格ID
   * @param {Array<string>} [supportForceIds] 支援部队ID数组 (如果为null则由commandForceId计算)
   * @param {string} [enemyCommandForceId] 敌方指挥部队ID (如果为null则由targetHex计算)
   * @param {Array<string>} [enemySupportForceIds] 敌方支援部队ID数组 (如果为null则由targetHex计算)
   * @returns {Object} 命令执行结果
   */
  async attack(commandForceId, targetHex, supportForceIds = [], enemyCommandForceId = null, enemySupportForceIds = []) {
    // 仅能在自由模式或攻击准备模式下执行攻击
    const lastMode = gameModeService.getCurrentMode();
    if (lastMode === GameMode.ATTACK_PREPARE) {
      gameModeService.clearLockedSelection()
        .clearConsole()
        .setMode(GameMode.ATTACK_PREPARE);
    } else if (lastMode === GameMode.FREE) {
      gameModeService.clearLockedSelection()
        .saveSelectedHexIds()
        .saveConsoleContent()
        .clearConsole()
        .setMode(GameMode.ATTACK_PREPARE);
    } else {
      throw new CommandError("仅能在自由模式或攻击准备模式下执行攻击", "attack");
    }

    try {

      // 参数验证和处理
      const commandForce = this.store.getForceById(commandForceId);
      if (!commandForce) {
        throw new CommandError("找不到指挥部队", "validation");
      }

      // 指挥部队必须要有战斗机会
      if (commandForce.combatChance <= 0) {
        throw new CommandError(`${commandForce.forceName}已无战斗机会`, "validation");
      }

      // 验证指挥部队和目标六角格属于相反阵营(blue vs red)
      if (commandForce.faction === targetHex.battlefieldState.controlFaction || 
          commandForce.faction === 'neutral' || 
          targetHex.battlefieldState.controlFaction === 'neutral') {
        throw new CommandError("指挥部队和目标六角格必须属于不同阵营(蓝方vs红方)", "validation");
      }

      // 如果没有指定敌方指挥部队，从目标六角格中寻找最佳指挥部队
      let enemyCommand = null;
      if (!enemyCommandForceId) {
        const targetHexCell = this.store.getHexCellById(targetHex);
        if (!targetHexCell) {
          throw new CommandError("找不到目标六角格", "validation");
        }

        // 寻找目标六角格中敌方阵营的最佳防御指挥部队
        const enemyFaction = commandForce.faction === 'blue' ? 'red' : 'blue';
        enemyCommand = this.battleController.findBestCommandForce(targetHex, 'bestDefense', enemyFaction);
        
        if (!enemyCommand) {
          throw new CommandError(`在目标六角格中找不到${enemyFaction === 'blue' ? '蓝方' : '红方'}部队`, "validation");
        }
        
        enemyCommandForceId = enemyCommand.forceId;
      } else {
        enemyCommand = this.store.getForceById(enemyCommandForceId);
        if (!enemyCommand) {
          throw new CommandError("找不到敌方指挥部队", "validation");
        }
      }

      // 如果没有指定支援部队，自动获取指挥部队指挥范围内的同阵营部队
      if (!supportForceIds || supportForceIds.length === 0) {
        supportForceIds = this.battleController.getForcesInCommandRange(commandForce, commandForce.faction);
      } else {
        // 如果指定了支援部队，则验证攻击方支援部队是否在指挥范围内
        const isValid = this.battleController.validateSupportForcesInRange(commandForceId, supportForceIds);
        if (!isValid) {
          throw new CommandError("部分支援部队不在指挥范围内", "validation");
        }
      }

      // 如果没有指定敌方支援部队，自动获取敌方指挥部队指挥范围内的同阵营部队
      if (!enemySupportForceIds || enemySupportForceIds.length === 0) {
        enemySupportForceIds = this.battleController.getForcesInCommandRange(enemyCommand, enemyCommand.faction);
      } else {
        // 如果指定了敌方支援部队，则验证敌方支援部队是否在指挥范围内
        const isValid = this.battleController.validateSupportForcesInRange(enemyCommandForceId, enemySupportForceIds);
        if (!isValid) {
          throw new CommandError("部分敌方支援部队不在指挥范围内", "validation");
        }
      }

      // 执行战斗
      const battleResult = await this.battleController.executeBattle(
        commandForceId,
        supportForceIds,
        enemyCommandForceId,
        enemySupportForceIds
      );

      if (!battleResult.success) {
        throw new CommandError(`战斗失败: ${battleResult.error}`, "battle");
      }

      // 完成后回到自由模式
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreSelectedHexIds()
        .restoreConsoleContent();
      
      // 在总览控制台显示战斗报告
      this.battleController.printBattleReportSummary(battleResult);

      return {
        status: CommandStatus.FINISHED,
        message: "攻击完成",
        data: battleResult
      };
    } catch (error) {
      // 发生错误时回到自由模式
      gameModeService.setMode(GameMode.FREE)
        .clearLockedSelection()
        .restoreSelectedHexIds()
        .restoreConsoleContent();
      throw new CommandError(`攻击失败: ${error.message}`, "attack");
    }
  }

  // ================ 部队和兵种管理命令 ================
  // 这些命令在自由模式下执行

  /**
   * 编辑兵种
   * @param {Object} unitData 兵种数据(id==null时创建，id!=null时更新，不能更新renderingKey)
   * @returns {Object} 命令执行结果
   */
  async editUnit(unitData) {
    // 仅能在自由模式下编辑兵种
    if (gameModeService.getCurrentMode() !== GameMode.FREE) {
      throw new CommandError("仅能在自由模式下编辑兵种", "unit");
    }

    try {
      // 判断是修改还是创建操作
      const isUpdate = !!unitData.unitId && this.store.getUnitById(unitData.unitId);
      
      // 使用Unit.create方法创建或更新兵种
      const unit = await Unit.create(unitData);

      // TODO: 如果界面上含有该兵种的部队数据未自动更新，则需要手动更新
      
      return {
        status: CommandStatus.FINISHED,
        message: isUpdate 
          ? `兵种已更新: ${unit.unitId}: ${unit.unitName}` 
          : `兵种已创建: ${unit.unitId}: ${unit.unitName}`,
        data: { 
          unitId: unit.unitId,
          isUpdate: isUpdate 
        }
      };
    } catch (error) {
      throw new CommandError(`编辑兵种失败: ${error.message}`, "unit");
    }
  }

  /**
   * 删除兵种
   * @param {string} unitId 兵种ID
   * @returns {Object} 命令执行结果
   */
  async deleteUnit(unitId) {
    // 仅能在自由模式下删除兵种
    if (gameModeService.getCurrentMode() !== GameMode.FREE) {
      throw new CommandError("仅能在自由模式下删除兵种", "unit");
    }

    try {
      // 检查兵种是否存在
      const unit = this.store.getUnitById(unitId);
      if (!unit) {
        throw new CommandError(`未找到兵种: ${unitId}`, "notFound");
      }
      
      // 检查是否有部队正在使用该兵种
      const forces = this.store.getForces();
      const usingForces = forces.filter(force => 
        force.composition.some(comp => comp.unitId === unitId)
      );
      
      if (usingForces.length > 0) {
        throw new CommandError(`无法删除兵种: 有${usingForces.length}个部队正在使用该兵种`, "inUse");
      }
      
      // 从store中移除兵种
      this.store.removeUnitById(unitId);
      
      return {
        status: CommandStatus.FINISHED,
        message: "兵种已删除"
      };
    } catch (error) {
      throw new CommandError(`删除兵种失败: ${error.message}`, "unit");
    }
  }

  /**
   * 创建部队
   * @param {Object} forceData 部队数据，id需为null
   * @param {string} [formationId] 编队ID，可选，未指定则加入默认编队
   * @returns {Object} 命令执行结果
   */
  async createForce(forceData, formationId = null) {
    // 仅能在自由模式下创建部队
    if (gameModeService.getCurrentMode() !== GameMode.FREE) {
      throw new CommandError("仅能在自由模式下创建部队", "force");
    }

    try {
      if (forceData.forceId || !forceData || !forceData.hexId || !forceData.composition || forceData.composition.length === 0) {
        throw new CommandError("部队数据无效", "validation");
      }
      
      // 检查部署六角格是否存在
      const hexCell = this.store.getHexCellById(forceData.hexId);
      if (!hexCell) {
        throw new CommandError(`未找到部队待部署的六角格: ${forceData.hexId}`, "validation");
      }

      // // 检查部队是否在不可见六角格部署
      // if (!hexCell.visibility.visibleTo[forceData.faction]) {
      //   throw new CommandError(`部队不能在不可见六角格部署`, "validation");
      // }

      // 检查部队是否在敌方六角格部署
      if (hexCell.battlefieldState.controlFaction !== 'neutral' 
          && hexCell.battlefieldState.controlFaction !== forceData.faction) {
        throw new CommandError(`部队不能在敌方六角格部署`, "validation");
      }

      // 检查部队部署的六角格地形是否符合军种要求
      if (forceData.service === 'sea') {
        if (hexCell.terrainAttributes.terrainType !== 'water') {
          throw new CommandError(`部队不能在非水域上部署`, "validation");
        }
      } else if (forceData.service === 'land') {
        const landTypes = ['plain', 'hill', 'mountain'];
        if (!landTypes.includes(hexCell.terrainAttributes.terrainType)) {
          throw new CommandError(`部队不能在非陆地上部署`, "validation");
        }
      }

      // 检查兵种是否可用于该部队
      for (const comp of forceData.composition) {
        const unit = this.store.getUnitById(comp.unitId);
        if (!unit) {
          throw new CommandError(`未找到兵种: ${comp.unitId}`, "validation");
        }
        // 检查阵营可用性
        if (!unit.factionAvailability.includes(forceData.faction)) {
          throw new CommandError(`兵种 ${unit.unitName} 不可用于${forceData.faction}阵营`, "validation");
        }
        // 检查兵种是否属于同一军种
        if (!unit.service.includes(forceData.service)) {
          throw new CommandError(`兵种 ${unit.unitName} 不属于${forceData.service}军种`, "validation");
        }
      }
      
      // 创建部队实例
      const newForce = new Force(forceData);
      
      // 将部队添加到store
      this.store.addForce(newForce);
      
      // 如果指定了编队ID，则将部队添加到指定编队中
      if (formationId) {
        this.addForceToFormation(newForce.forceId, formationId);
      } else {
        // 如果未指定编队ID，则将部队添加到阵营默认编队中
        this.addForceToFormation(newForce.forceId, `FM_${newForce.faction}_default`);
      }
      
      return {
        status: CommandStatus.FINISHED,
        message: "部队已创建",
        data: { forceId: newForce.forceId }
      };
    } catch (error) {
      throw new CommandError(`创建部队失败: ${error.message}`, "force");
    }
  }

  /**
   * 合并部队
   * @param {string} newForceName 新部队名称
   * @param {Array<string>} forceIds 要合并的部队ID数组，每个部队的兵力值需要是满的
   * @param {string} [formationId] 编队ID，可选，未指定则加入默认编队
   * @returns {Object} 命令执行结果
   */
  async mergeForces(newForceName, forceIds, formationId = null) {
    try {    
      // 获取所有要合并的部队
      const forces = [];
      for (const forceId of forceIds) {
        const force = this.store.getForceById(forceId);
        if (!force) {
          throw new CommandError(`未找到部队: ${forceId}`, "validation");
        }
        forces.push(force);
      }
      
      // 检查所有部队是否属于同一阵营、军种、六角格
      const faction = forces[0].faction;
      const service = forces[0].service;
      const hexId = forces[0].hexId;
      for (let i = 1; i < forces.length; i++) {
        if (forces[i].faction !== faction) {
          throw new CommandError("无法合并不同阵营的部队", "validation");
        }
        if (forces[i].service !== service) {
          throw new CommandError("无法合并不同军种的部队", "validation");
        }
        if (forces[i].hexId !== hexId) {
          throw new CommandError("无法合并不同六角格的部队", "validation");
        }
      }
      
      // 检查所有部队是否兵力值为满
      for (const force of forces) {
        if (force.troopStrength !== MilitaryConfig.limit.maxTroopStrength) {
          throw new CommandError(`无法合并部队: ${force.forceName} 兵力值未满`, "validation");
        }
      }
      
      // 合并部队组成 composition
      const mergedComposition = [];
      
      // 遍历所有部队的组成，合并相同兵种
      for (const force of forces) {
        for (const comp of force.composition) {
          const existingComp = mergedComposition.find(c => c.unitId === comp.unitId);
          if (existingComp) {
            existingComp.unitCount += comp.unitCount;
          } else {
            mergedComposition.push({...comp});
          }
        }
      }
      
      // 准备新部队数据
      const mergedForceData = {
        forceName: newForceName,
        faction: faction,
        service: service,
        hexId: hexId,
        composition: mergedComposition,
        // 设置为最大兵力值
        troopStrength: MilitaryConfig.limit.maxTroopStrength,
        // 使用最低的combat chance
        combatChance: Math.min(...forces.map(f => f.combatChance)),
        // 使用最低的action points
        actionPoints: Math.min(...forces.map(f => f.actionPoints))
      };

      // 使用createForce创建新部队并加入编队
      const result = await this.createForce(mergedForceData, formationId);
      
      // 移除原有部队
      for (const forceId of forceIds) {
        // 从store中移除
        this.store.removeForceById(forceId);
      }
      
      return {
        status: CommandStatus.FINISHED,
        message: "部队已合并",
        data: { forceId: result.data.forceId }
      };
  } catch (error) {
      throw new CommandError(`合并部队失败: ${error.message}`, "force");
    }
  }

  /**
   * 拆分部队
   * @param {string} forceId 要拆分的部队ID
   * @param {Array<Object>} splitDetails 拆分详情，格式为[{forceName(可选), composition, formationId(可选)}]
   * @returns {Object} 命令执行结果
   */
  async splitForce(forceId, splitDetails) {
    try {
      // 获取原始部队
      const originalForce = this.store.getForceById(forceId);
      if (!originalForce) {
        throw new CommandError(`未找到部队: ${forceId}`, "validation");
      }
      
      // 检查拆分详情的有效性
      for (const detail of splitDetails) {
        if (!detail.composition || !detail.composition.length) {
          throw new CommandError("拆分详情数据无效", "validation");
        }
        
        // 检查兵种数量是否合法
        for (const comp of detail.composition) {
          const originalComp = originalForce.composition.find(c => c.unitId === comp.unitId);
          if (!originalComp) {
            throw new CommandError(`原部队中不存在兵种: ${comp.unitId}`, "validation");
          }
          if (comp.unitCount > originalComp.unitCount) {
            throw new CommandError(`拆分数量超过原部队拥有的兵种数量`, "validation");
          }
        }
      }
      
      // 计算拆分后原部队剩余的组成
      const remainingComposition = [...originalForce.composition];
      
      // 从原部队减去拆分出去的兵种数量
      for (const detail of splitDetails) {
        for (const comp of detail.composition) {
          const remainingComp = remainingComposition.find(c => c.unitId === comp.unitId);
          if (remainingComp) {
            remainingComp.unitCount -= comp.unitCount;
            if (remainingComp.unitCount === 0) {
              // 移除剩余数量为0的兵种
              const index = remainingComposition.indexOf(remainingComp);
              remainingComposition.splice(index, 1);
            } else if (remainingComp.unitCount < 0) {
              throw new CommandError(`拆分数量超过原部队拥有的兵种数量`, "validation");
            }
          } else {
            throw new CommandError(`拆分数量超过原部队拥有的兵种数量`, "validation");
          }
        }
      }
      
      // 检查是否完全拆分（原部队所有兵种都被分配完）
      if (remainingComposition.length > 0) {
        throw new CommandError(`原部队所有兵种未分配完毕`, "validation");
      }
      
      // 创建新部队实例数组
      const newForcesId = [];
      // 创建拆分后的新部队
      for (let i = 0; i < splitDetails.length; i++) {
        const detail = splitDetails[i];
        const newForceData = {
          forceName: detail.forceName || `${originalForce.forceName}第${i+1}分队`,
          faction: originalForce.faction,
          service: originalForce.service,
          hexId: originalForce.hexId,
          composition: [...detail.composition],
          troopStrength: originalForce.troopStrength,
          combatChance: originalForce.combatChance,
          actionPoints: originalForce.actionPoints
        };
        
        // 使用createForce创建新部队并加入指定编队
        const result = await this.createForce(newForceData, detail.formationId);
        newForcesId.push(result.data.forceId);
      }
      // 移除原部队
      this.store.removeForceById(forceId);
      
      return {
        status: CommandStatus.FINISHED,
        message: "部队已拆分",
        data: { forceIds: newForcesId }
      };
    } catch (error) {
      throw new CommandError(`拆分部队失败: ${error.message}`, "force");
    }
  }

  // ================ 编队管理命令 ================

  /**
   * 创建编队
   * @param {string} name 编队名称
   * @param {string} faction 所属阵营
   * @returns {Object} 命令执行结果
   */
  async createFormation(name, faction) {
    try {
      // 检查阵营是否有效
      if (faction !== 'blue' && faction !== 'red') {
        throw new CommandError(`无效的阵营: ${faction}`, "validation");
      }
      
      // 创建编队实例
      const formation = new Formation({
        formationName: name,
        faction: faction,
        forceIdList: []
      });
      
      // 将编队添加到store
      this.store.addFormation(formation);
      
      return {
        status: CommandStatus.FINISHED,
        message: "编队已创建",
        data: { formationId: formation.formationId }
      };
    } catch (error) {
      throw new CommandError(`创建编队失败: ${error.message}`, "formation");
    }
  }

  /**
   * 添加部队到编队，或将部队转移到另一个编队
   * @param {string} forceId 部队ID
   * @param {string} formationId 目标编队ID
   * @returns {Object} 命令执行结果
   */
  async addForceToFormation(forceId, formationId) {
    try { 
      // 检查编队是否存在
      const formation = this.store.getFormationById(formationId);
      if (!formation) {
        throw new CommandError(`未找到编队: ${formationId}`, "validation");
      }
      
      // 检查部队是否存在
      const force = this.store.getForceById(forceId);
      if (!force) {
        throw new CommandError(`未找到部队: ${forceId}`, "validation");
      }
      
      // 检查阵营是否匹配
      if (force.faction !== formation.faction) {
        throw new CommandError(`部队阵营与编队阵营不匹配`, "validation");
      }
      
      // 添加部队到编队
      this.store.addForceToFormation(forceId, formationId);
      
      return {
        status: CommandStatus.FINISHED,
        message: "部队已添加到编队"
      };
    } catch (error) {
      throw new CommandError(`添加部队到编队失败: ${error.message}`, "formation");
    }
  }

  /**
   * 删除编队
   * @param {string} formationId 编队ID
   * @returns {Object} 命令执行结果
   */
  async deleteFormation(formationId) {
    try {
      // 检查编队是否存在
      const formation = this.store.getFormationById(formationId);
      if (!formation) {
        throw new CommandError(`未找到编队: ${formationId}`, "validation");
      }
      
      // 如果是默认编队，不允许删除
      if (formationId.endsWith('_default')) {
        throw new CommandError(`默认编队不能删除`, "validation");
      }
      
      // 处理编队中的部队，将它们添加到阵营默认编队中
      if (formation.forceIdList && formation.forceIdList.length > 0) {
        // 将部队转移到默认编队
        for (const forceId of formation.forceIdList) {
          const force = this.store.getForceById(forceId);
          if (force) {
            this.addForceToFormation(forceId, `FM_${force.faction}_default`);
          }
        }
      }
      
      // 从store中移除编队
      this.store.removeFormationById(formationId);
      
      return {
        status: CommandStatus.FINISHED,
        message: "编队已删除，包含的部队已转移到默认编队"
      };
    } catch (error) {
      throw new CommandError(`删除编队失败: ${error.message}`, "formation");
    }
  }

  /**
   * 销毁实例
   */
  destroy() {
    CommandProcessor.#instance = null;
  }

  /**
   * 格式化数字，使用k表示千级，m表示百万级，b表示十亿级等
   * @private
   */
  _formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    
    // 转为数字确保格式化正确
    num = Number(num);
    
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(3) + 'b';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(3) + 'm';
    } else {
      // 百万以下数字精确显示
      return String(Math.round(num));
    }
  }
}
