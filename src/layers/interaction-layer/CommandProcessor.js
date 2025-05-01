// src\layers\interaction-layer\CommandProcessor.js
import { GameMode } from '@/config/GameModeConfig';
import { openGameStore } from '@/store';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';
import { CommandStatus } from '@/config/CommandConfig';
import { gameModeService } from './GameModeManager';

/**
 * 命令错误类 - 用于统一处理命令执行过程中的错误
 */
export class CommandError extends Error {
  constructor(message, type = 'general', data = null) {
    super(message);
    this.name = 'CommandError';
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
    this.militaryManager = null; // 延迟初始化
  }

  /**
   * 初始化军事管理器引用
   */
  initMilitaryManager() {
    if (!this.militaryManager) {
      this.militaryManager = MilitaryManager.getInstance(this.viewer);
    }
  }

  // ================ 场景控制命令 ================

  /**
   * 切换环绕模式
   * @param {boolean} enabled 是否启用环绕模式
   * @returns {Object} 命令执行结果
   */
  async toggleOrbitMode(enabled) {
    try {
      // 切换相机控制
      this.cameraController.setOrbitMode(enabled);
      
      // 切换到对应的游戏模式
      gameModeService.setMode(enabled ? GameMode.ORBIT : GameMode.FREE);
      
      return { 
        status: CommandStatus.FINISHED, 
        message: `环绕模式已${enabled ? '启用' : '禁用'}` 
      };
    } catch (error) {
      throw new CommandError(`切换环绕模式失败: ${error.message}`, 'orbit');
    }
  }

  /**
   * 切换俯瞰模式
   * @param {boolean} enabled 是否启用俯瞰模式
   * @returns {Object} 命令执行结果
   */
  async setPanoramaMode(enabled) {
    try {
      // 设置相机俯瞰视角
      if (enabled) {
        this.cameraController.setTopDownView();
      }
      
      // 切换到对应的游戏模式
      gameModeService.setMode(enabled ? GameMode.PANORAMA : GameMode.FREE);
      
      return { 
        status: CommandStatus.FINISHED, 
        message: `俯瞰模式已${enabled ? '启用' : '禁用'}` 
      };
    } catch (error) {
      throw new CommandError(`切换俯瞰模式失败: ${error.message}`, 'panorama');
    }
  }

  /**
   * 重置相机位置
   * @returns {Object} 命令执行结果
   */
  async resetCamera() {
    try {
      this.cameraController.resetCamera();
      return { 
        status: CommandStatus.FINISHED, 
        message: '相机已重置' 
      };
    } catch (error) {
      throw new CommandError(`重置相机失败: ${error.message}`, 'camera');
    }
  }

  /**
   * 聚焦到指定部队
   * @param {string} forceId 部队ID
   * @returns {Object} 命令执行结果
   */
  async focusOnForce(forceId) {
    try {
      // 如果没有指定部队ID，则使用当前选中的部队
      if (!forceId && this.store.selectedForceIds.size > 0) {
        forceId = Array.from(this.store.selectedForceIds)[0];
      }

      const force = this.store.getForceById(forceId);
      if (!force || !force.hexId) {
        throw new CommandError('无法定位部队', 'validation');
      }

      const hexCell = this.store.getHexCellById(force.hexId);
      if (!hexCell) {
        throw new CommandError('无法获取部队所在的六角格', 'validation');
      }

      const center = hexCell.getCenter();
      this.cameraController.focusOnLocation(center.longitude, center.latitude);
      
      return { 
        status: CommandStatus.FINISHED, 
        message: '已聚焦到部队' 
      };
    } catch (error) {
      throw new CommandError(`聚焦部队失败: ${error.message}`, 'focus');
    }
  }

  /**
   * 切换图层
   * @param {number} layerIndex 图层索引
   * @returns {Object} 命令执行结果
   */
  async changeLayer(layerIndex) {
    try {
      this.store.setLayerIndex(layerIndex);
      this.sceneManager.refreshHexGrid();
      return { 
        status: CommandStatus.FINISHED, 
        message: `已切换到图层 ${layerIndex}` 
      };
    } catch (error) {
      throw new CommandError(`切换图层失败: ${error.message}`, 'layer');
    }
  }

  /**
   * 切换到下一个阵营/回合
   * @returns {Object} 命令执行结果
   */
  async switchToNextFaction() {
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
        forces.forEach(force => {
          force.resetActionPoints();
          force.refreshCombatChance();
          force.recoverTroopStrength();
        });
      }

      // 重新计算部队可见性
      if (this.militaryManager && this.militaryManager.renderer) {
        this.militaryManager.renderer.updateForceInstanceVisibility();
      }

      return { 
        status: CommandStatus.FINISHED, 
        message: `已切换到${this.store.currentFaction}方，当前回合: ${this.store.currentRound}`,
        data: {
          faction: this.store.currentFaction,
          round: this.store.currentRound
        }
      };
    } catch (error) {
      throw new CommandError(`切换阵营失败: ${error.message}`, 'faction');
    }
  }

  /**
   * 切换统计模式
   * @param {boolean} enabled 是否启用统计模式
   * @returns {Object} 命令执行结果
   */
  async toggleStatMode(enabled) {
    try {
      if (enabled) {
        // 进入统计模式前保存当前选择状态
        gameModeService.saveSelectedHexIds();
        gameModeService.setMode(GameMode.STATISTICS);
      } else {
        // 退出统计模式时恢复之前的选择状态
        gameModeService.setMode(GameMode.FREE);
        gameModeService.restoreSelectedHexIds();
      }
      
      return {
        status: CommandStatus.FINISHED,
        message: `统计模式已${enabled ? '启用' : '禁用'}`
      };
    } catch (error) {
      throw new CommandError(`切换统计模式失败: ${error.message}`, 'statistics');
    }
  }

  // ================ 移动命令 ================

  /**
   * 移动准备
   * @param {string} forceId 部队ID
   * @returns {Object} 命令执行结果
   */
  async movePrepare(forceId) {
    try {
      // 先保存当前选择状态
      gameModeService.saveSelectedHexIds();
      
      // 如果提供了部队ID，选中该部队
      if (forceId) {
        this.store.setSelectedForceIds([forceId]);
        const force = this.store.getForceById(forceId);
        if (force && force.hexId) {
          this.store.setSelectedHexIds([force.hexId]);
        }
      }
      
      // 切换到移动准备模式
      gameModeService.setMode(GameMode.MOVE_PREPARE);
      
      return {
        status: CommandStatus.FINISHED,
        message: '已进入移动准备模式'
      };
    } catch (error) {
      throw new CommandError(`进入移动准备模式失败: ${error.message}`, 'move');
    }
  }

  /**
   * 执行移动
   * @param {string} forceId 部队ID
   * @param {Array<string>} path 移动路径(六角格ID数组)
   * @returns {Object} 命令执行结果
   */
  async move(forceId, path) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!forceId || !path || path.length < 2) {
        throw new CommandError('移动参数无效', 'validation');
      }
      
      // 切换到移动执行模式
      gameModeService.setMode(GameMode.MOVE_EXECUTE);
      
      // 调用军事管理器执行移动
      await this.militaryManager.moveForce(forceId, path);
      
      // 完成后恢复自由模式
      gameModeService.setMode(GameMode.FREE);
      
      return {
        status: CommandStatus.FINISHED,
        message: '移动完成'
      };
    } catch (error) {
      // 发生错误时恢复自由模式
      gameModeService.setMode(GameMode.FREE);
      throw new CommandError(`移动失败: ${error.message}`, 'move');
    }
  }

  // ================ 攻击命令 ================

  /**
   * 攻击准备
   * @param {string} forceId 部队ID
   * @returns {Object} 命令执行结果
   */
  async attackPrepare(forceId) {
    try {
      // 先保存当前选择状态
      gameModeService.saveSelectedHexIds();
      
      // 如果提供了部队ID，选中该部队
      if (forceId) {
        this.store.setSelectedForceIds([forceId]);
        const force = this.store.getForceById(forceId);
        if (force && force.hexId) {
          this.store.setSelectedHexIds([force.hexId]);
        }
      }
      
      // 切换到攻击准备模式
      gameModeService.setMode(GameMode.ATTACK_PREPARE);
      
      return {
        status: CommandStatus.FINISHED,
        message: '已进入攻击准备模式'
      };
    } catch (error) {
      throw new CommandError(`进入攻击准备模式失败: ${error.message}`, 'attack');
    }
  }

  /**
   * 执行攻击
   * @param {string} commandForceId 指挥部队ID
   * @param {string} targetHex 目标六角格ID
   * @param {Array<string>} supportForceIds 支援部队ID数组
   * @returns {Object} 命令执行结果
   */
  async attack(commandForceId, targetHex, supportForceIds = []) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!commandForceId || !targetHex) {
        throw new CommandError('攻击参数无效', 'validation');
      }
      
      // 切换到攻击执行模式
      gameModeService.setMode(GameMode.ATTACK_EXECUTE);
      
      // 调用军事管理器执行攻击
      await this.militaryManager.attack(commandForceId, targetHex, supportForceIds);
      
      // 完成后恢复自由模式
      gameModeService.setMode(GameMode.FREE);
      
      return {
        status: CommandStatus.FINISHED,
        message: '攻击完成'
      };
    } catch (error) {
      // 发生错误时恢复自由模式
      gameModeService.setMode(GameMode.FREE);
      throw new CommandError(`攻击失败: ${error.message}`, 'attack');
    }
  }

  // ================ 部队和兵种管理命令 ================

  /**
   * 编辑兵种
   * @param {Object} unitData 兵种数据
   * @returns {Object} 命令执行结果
   */
  async editUnit(unitData) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!unitData) {
        throw new CommandError('兵种数据无效', 'validation');
      }
      
      // 调用军事管理器更新或创建兵种
      await this.militaryManager.editUnit(unitData);
      
      return {
        status: CommandStatus.FINISHED,
        message: unitData.unitId ? '兵种已更新' : '兵种已创建'
      };
    } catch (error) {
      throw new CommandError(`编辑兵种失败: ${error.message}`, 'unit');
    }
  }

  /**
   * 删除兵种
   * @param {string} unitId 兵种ID
   * @returns {Object} 命令执行结果
   */
  async deleteUnit(unitId) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!unitId) {
        throw new CommandError('兵种ID无效', 'validation');
      }
      
      // 调用军事管理器删除兵种
      await this.militaryManager.deleteUnit(unitId);
      
      return {
        status: CommandStatus.FINISHED,
        message: '兵种已删除'
      };
    } catch (error) {
      throw new CommandError(`删除兵种失败: ${error.message}`, 'unit');
    }
  }

  /**
   * 创建部队
   * @param {Object} forceData 部队数据
   * @returns {Object} 命令执行结果
   */
  async createForce(forceData) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!forceData || !forceData.hexId || !forceData.unitId) {
        throw new CommandError('部队数据无效', 'validation');
      }
      
      // 调用军事管理器创建部队
      const newForce = await this.militaryManager.createForce(forceData);
      
      return {
        status: CommandStatus.FINISHED,
        message: '部队已创建',
        data: { forceId: newForce.forceId }
      };
    } catch (error) {
      throw new CommandError(`创建部队失败: ${error.message}`, 'force');
    }
  }

  /**
   * 合并部队
   * @param {string} hexId 目标六角格ID
   * @param {Array<string>} forceIds 要合并的部队ID数组
   * @returns {Object} 命令执行结果
   */
  async mergeForces(hexId, forceIds) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!hexId || !forceIds || forceIds.length < 2) {
        throw new CommandError('合并部队参数无效', 'validation');
      }
      
      // 调用军事管理器合并部队
      const mergedForce = await this.militaryManager.mergeForces(hexId, forceIds);
      
      return {
        status: CommandStatus.FINISHED,
        message: '部队已合并',
        data: { forceId: mergedForce.forceId }
      };
    } catch (error) {
      throw new CommandError(`合并部队失败: ${error.message}`, 'force');
    }
  }

  /**
   * 拆分部队
   * @param {string} forceId 要拆分的部队ID
   * @param {Array<Object>} splitDetails 拆分详情
   * @returns {Object} 命令执行结果
   */
  async splitForce(forceId, splitDetails) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!forceId || !splitDetails || !splitDetails.length) {
        throw new CommandError('拆分部队参数无效', 'validation');
      }
      
      // 调用军事管理器拆分部队
      const newForces = await this.militaryManager.splitForce(forceId, splitDetails);
      
      return {
        status: CommandStatus.FINISHED,
        message: '部队已拆分',
        data: { forceIds: newForces.map(f => f.forceId) }
      };
    } catch (error) {
      throw new CommandError(`拆分部队失败: ${error.message}`, 'force');
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
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!name || !faction) {
        throw new CommandError('创建编队参数无效', 'validation');
      }
      
      // 调用军事管理器创建编队
      const formation = await this.militaryManager.createFormation(name, faction);
      
      return {
        status: CommandStatus.FINISHED,
        message: '编队已创建',
        data: { formationId: formation.formationId }
      };
    } catch (error) {
      throw new CommandError(`创建编队失败: ${error.message}`, 'formation');
    }
  }

  /**
   * 添加部队到编队
   * @param {string} formationId 编队ID
   * @param {string} forceId 部队ID
   * @returns {Object} 命令执行结果
   */
  async addForceToFormation(formationId, forceId) {
    try {
      if (!formationId || !forceId) {
        throw new CommandError('添加部队到编队参数无效', 'validation');
      }
      
      // 调用商店方法添加部队到编队
      this.store.addForceToFormation(forceId, formationId);
      
      return {
        status: CommandStatus.FINISHED,
        message: '部队已添加到编队'
      };
    } catch (error) {
      throw new CommandError(`添加部队到编队失败: ${error.message}`, 'formation');
    }
  }

  /**
   * 删除编队
   * @param {string} formationId 编队ID
   * @returns {Object} 命令执行结果
   */
  async deleteFormation(formationId) {
    try {
      if (!this.militaryManager) {
        this.initMilitaryManager();
      }
      
      if (!formationId) {
        throw new CommandError('删除编队参数无效', 'validation');
      }
      
      // 调用军事管理器删除编队
      await this.militaryManager.deleteFormation(formationId);
      
      return {
        status: CommandStatus.FINISHED,
        message: '编队已删除'
      };
    } catch (error) {
      throw new CommandError(`删除编队失败: ${error.message}`, 'formation');
    }
  }

  /**
   * 销毁实例
   */
  destroy() {
    CommandProcessor.#instance = null;
  }
}
