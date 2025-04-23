// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
import { MilitaryModelLoader } from './components/MilitaryModelLoader';
import { MilitaryModelRenderer } from './components/MilitaryModelRenderer';
import { MilitaryPanelManager } from '@/layers/interaction-layer/MilitaryPanelManager';
import { HexForceMapper } from '@/utils/HexForceMapper';
import { API } from "@/services/api";
import { Formation } from '@/models/Formation';

/**
 * 军事单位管理器
 *
 * 主要职责：
 *  1. 模板预加载 (Loader)
 *  2. 模型实例化渲染 (Renderer)
 *  3. Pinia forceMap 数据同步
 *  4. 交互面板 (PanelManager) 命令回调对接
 *  5. 维护 HexForceMapper 映射关系
 */
export class MilitaryManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.loader = null;
    this.renderer = null;

    // 初始化面板管理器
    this.militaryPanelManager = new MilitaryPanelManager(viewer);
    this._stopForceWatch = null;
    this._stopHexWatch = null;
  }

  async init(onProgress) {
    // 初始化 HexForceMapper
    this._initHexForceMapper();

    // 初始化编队系统
    this._initFormationSystem();

    // 初始化模型加载器
    this.loader = new MilitaryModelLoader(this.viewer);
    await this.loader.preloadModelTemplates(onProgress);

    // 初始化模型渲染器
    this.renderer = new MilitaryModelRenderer(this.viewer, this.loader);
    this.renderer.renderAllForces();

    // 监听部队变化，当部队数量发生变化时，同步渲染器和 HexForceMapper
    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newForceIds, oldForceIds) => {
        this.renderer.handleForcesChange(newForceIds, oldForceIds);
        this._syncHexForceMapper();
      }
    );

    // 监听六角格变化，当六角格数量发生变化时，同步 HexForceMapper
    this._stopHexWatch = watch(
      () => Array.from(this.store.hexCellMap.keys()),
      () => this._syncHexForceMapper()
    );

    this._bindPanelCommands();
    return true;
  }

  /**
   * 初始化 HexForceMapper
   * @private
   */
  _initHexForceMapper() {
    const hexCells = this.store.getHexCells();
    const forces = this.store.getForces();
    HexForceMapper.initMapping(hexCells, forces);
  }

  /**
   * 同步 HexForceMapper 的映射关系
   * @private
   */
  _syncHexForceMapper() {
    const hexCells = this.store.getHexCells();
    const forces = this.store.getForces();
    HexForceMapper.initMapping(hexCells, forces);
  }

  /**
   * 初始化编队系统
   * @private
   */
  _initFormationSystem() {
    // 创建蓝方默认编队
    const blueDefault = new Formation({
      formationId: 'FM_blue_default',  // 特殊ID，不使用自增ID
      formationName: '蓝方预备队',
      faction: 'blue',
      forceIdList: []
    });
    this.store.formationMap.set(blueDefault.formationId, blueDefault);

    // 创建红方默认编队
    const redDefault = new Formation({
      formationId: 'FM_red_default',  // 特殊ID，不使用自增ID
      formationName: '红方预备队',
      faction: 'red',
      forceIdList: []
    });
    this.store.formationMap.set(redDefault.formationId, redDefault);

    // 将现有部队分配到对应阵营的默认编队中
    this.store.forceMap.forEach(force => {
      const defaultFormationId = `FM_${force.faction}_default`;
      const defaultFormation = this.store.formationMap.get(defaultFormationId);
      if (defaultFormation && !defaultFormation.forceIdList.includes(force.forceId)) {
        defaultFormation.forceIdList.push(force.forceId);
      }
    });
  }

  /**
   * 创建新部队时，将其添加到指定编队
   * @param {Force} force 新创建的部队
   * @param {string} formationId 目标编队ID，如果不指定则添加到默认编队
   */
  _addForceToFormation(force, formationId = null) {
    const targetFormationId = formationId || `FM_${force.faction}_default`;
    const formation = this.store.formationMap.get(targetFormationId);
    
    if (formation && formation.faction === force.faction) {
      if (!formation.forceIdList.includes(force.forceId)) {
        formation.forceIdList.push(force.forceId);
      }
    }
  }

  _bindPanelCommands() {
    /**
     * 移动命令
     * @param {string} forceId 部队ID
     * @param {string[]} path 路径（六角格ID数组）
     */
    this.militaryPanelManager.onMoveCommand = async ({ forceId, path }) => {
      const res = await API.move(forceId, path);
      if (res.status === "success") {
        // 获取后端返回的最终路径
        const finalPath = res.data.final_path;
        
        if (finalPath && finalPath.length >= 2) {
          // 启动部队沿路径移动的动画
          this.renderer.moveForceAlongPath(forceId, finalPath);
          
          // 注意：部队最终位置的更新已经在 moveForceAlongPath 方法中完成
          // 它会在移动结束时更新 force.hexId 和 HexForceMapper
        } else {
          console.warn('[MilitaryManager] 移动路径无效:', finalPath);
        }
      } else {
        console.error('[MilitaryManager] 移动失败:', res.message);
      }
    };

    /**
     * 攻击命令
     * @param {string} commandForceId 指挥部队ID
     * @param {string} targetHex 目标六角格ID
     * @param {string[]} supportForceIds 支援部队ID数组
     */
    this.militaryPanelManager.onAttackCommand = async ({ commandForceId, targetHex, supportForceIds }) => {
      const res = await API.attack(commandForceId, targetHex, supportForceIds);
      if (res.status === "success") {
        // 更新部队状态（兵力损失等）
        const { losses } = res.data;
        
        // 更新指挥部队
        const commandForce = this.store.getForceById(commandForceId);
        if (commandForce) {
          commandForce.troopStrength = Math.max(0, commandForce.troopStrength - losses.attacker);
        }

        // 更新支援部队
        supportForceIds.forEach(id => {
          const force = this.store.getForceById(id);
          if (force) {
            force.troopStrength = Math.max(0, force.troopStrength - losses.attacker);
          }
        });

        // TODO: 更新敌方部队状态
      } else {
        console.error('[MilitaryManager] 进攻失败:', res.message);
      }
    };

    /**
     * 创建部队命令
     * @param {string} hexId 六角格ID
     * @param {string} faction 阵营
     * @param {string} composition 部队组成
     * @param {string} formationId 目标编队ID，如果不指定则添加到默认编队
     */
    this.militaryPanelManager.onCreateForce = async ({ hexId, faction, composition, formationId }) => {
      const res = await API.createForce(hexId, faction, composition, formationId);
      if (res.status === "success") {
        // 添加新部队到 Store
        const newForce = res.data.force;
        this.store.addForce(newForce);
        // 更新 HexForceMapper
        HexForceMapper.addForceById(newForce.force_id, hexId);
        // 将新部队添加到指定编队
        this._addForceToFormation(newForce, formationId);
      } else {
        console.error('[MilitaryManager] 创建部队失败:', res.message);
      }
    };

    /**
     * 合并部队命令
     * @param {string} hexId 六角格ID
     * @param {string[]} forceIds 部队ID数组
     */
    this.militaryPanelManager.onMergeForces = async ({ hexId, forceIds }) => {
      const res = await API.mergeForces(hexId, forceIds);
      if (res.status === "success") {
        // 从 Store 中移除原部队
        forceIds.forEach(fid => {
          this.store.forceMap.delete(fid);
          HexForceMapper.removeForceById(fid);
        });

        // 添加新部队到 Store
        const newForce = res.data.new_force;
        this.store.addForce(newForce);
        HexForceMapper.addForceById(newForce.force_id, hexId);
      } else {
        console.error('[MilitaryManager] 合并部队失败:', res.message);
      }
    };

    /**
     * 拆分部队命令
     * @param {string} forceId 部队ID
     * @param {string[]} splitDetails 拆分后的部队
     */
    this.militaryPanelManager.onSplitForce = async ({ forceId, splitDetails }) => {
      const res = await API.splitForce(forceId, splitDetails);
      if (res.status === "success") {
        // 从 Store 中移除原部队
        this.store.forceMap.delete(forceId);
        HexForceMapper.removeForceById(forceId);

        // 添加新部队到 Store
        const hexId = this.store.getForceById(forceId)?.hexId;
        res.data.new_forces.forEach(newForce => {
          this.store.addForce(newForce);
          if (hexId) {
            HexForceMapper.addForceById(newForce.force_id, hexId);
          }
        });
      } else {
        console.error('[MilitaryManager] 拆分部队失败:', res.message);
      }
    };

    /**
     * 删除编队命令
     * @param {string} formationId 编队ID
     */
    this.militaryPanelManager.onDeleteFormation = (formationId) => {
      const formation = this.store.formationMap.get(formationId);
      if (formation) {
        // 将编队中的部队移到该阵营的默认编队
        formation.forceIdList.forEach(forceId => {
          this._addForceToFormation({ forceId, faction: formation.faction });
        });
        this.store.formationMap.delete(formationId);
      }
    };
  }

  destroy() {
    if (this._stopForceWatch) {
      this._stopForceWatch();
      this._stopForceWatch = null;
    }
    if (this._stopHexWatch) {
      this._stopHexWatch();
      this._stopHexWatch = null;
    }
    this.renderer?.dispose();
    this.loader?.dispose();
    this.militaryPanelManager?.destroy?.();
  }
}
