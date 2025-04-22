// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
import { MilitaryModelLoader } from './components/MilitaryModelLoader';
import { MilitaryModelRenderer } from './components/MilitaryModelRenderer';
import { MilitaryPanelManager } from '@/layers/interaction-layer/MilitaryPanelManager';
import { HexForceMapper } from '@/utils/HexForceMapper';
import { API } from "@/services/api";

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

    this.loader = new MilitaryModelLoader(this.viewer);
    await this.loader.preloadAll(onProgress);

    this.renderer = new MilitaryModelRenderer(this.viewer, this.loader);
    this.renderer.renderAllForces();

    // 监听部队变化，同步渲染器和 HexForceMapper
    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newIds, oldIds) => {
        this.renderer.syncForces(newIds, oldIds);
        this._syncHexForceMapper();
      }
    );

    // 监听六角格变化，同步 HexForceMapper
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

  _bindPanelCommands() {
    this.militaryPanelManager.onMoveCommand = async ({ forceId, path }) => {
      const res = await API.move(forceId, path);
      if (res.status === "success") {
        // 更新部队位置
        const force = this.store.getForceById(forceId);
        if (force && res.data.final_path.length > 0) {
          const finalHexId = res.data.final_path[res.data.final_path.length - 1];
          force.hexId = finalHexId;
          HexForceMapper.moveForceToHex(forceId, finalHexId);
        }
      } else {
        console.error('[MilitaryManager] 移动失败:', res.message);
      }
    };

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

    this.militaryPanelManager.onCreateForce = async ({ hexId, faction, composition }) => {
      const res = await API.createForce(hexId, faction, composition);
      if (res.status === "success") {
        // 添加新部队到 Store
        const newForce = res.data.force;
        this.store.addForce(newForce);
        // 更新 HexForceMapper
        HexForceMapper.addForceById(newForce.force_id, hexId);
      } else {
        console.error('[MilitaryManager] 创建部队失败:', res.message);
      }
    };

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
