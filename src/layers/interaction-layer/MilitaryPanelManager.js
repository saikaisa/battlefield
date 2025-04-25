import { watch, computed } from 'vue';
import { openGameStore } from '@/store';
import { CameraViewController } from '@/layers/scene-layer/components/CameraViewController';
// eslint-disable-next-line no-unused-vars
import { ScenePanelManager } from '@/layers/interaction-layer/ScenePanelManager';

/**
 * 军事单位/命令操作相关面板管理器
 *
 * - 编队列表
 * - 六角格信息栏
 * - 部队详细信息栏
 * - 命令下达区
 * - 战斗群列表
 * - 统计列表
 * - 部队管理面板（默认隐藏）
 * - 兵种管理面板（默认隐藏）
 */
export class MilitaryPanelManager {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MilitaryPanelManager} 单例实例
   */
  static getInstance(viewer) {
    if (!MilitaryPanelManager.#instance) {
      MilitaryPanelManager.#instance = new MilitaryPanelManager(viewer);
    }
    return MilitaryPanelManager.#instance;
  }

  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.store = openGameStore();
    this.cameraViewController = CameraViewController.getInstance(viewer);

    // 命令回调占位符，由 MilitaryManager 绑定实现
    this.onMoveCommand = null;
    this.onAttackCommand = null;
    this.onCreateForce = null;
    this.onMergeForces = null;
    this.onSplitForce = null;
    this.onDeleteFormation = null;

    /* ========= 只读派生 =========== */
    // 当前选中的编队
    this.selectedFormation = computed(() => {
      const [fid] = Array.from(this.store.selectedForceIds);
      if (!fid) return null;
      return this.store.getFormations().find(fm => fm.forceIdList.includes(fid));
    });

    // 当前操作阵营的编队列表（不包括空的默认编队）
    this.formationList = computed(() => {
      const currentFaction = this.store.currentFaction;
      const formations = Array.from(this.store.formationMap.values())
        .filter(formation => formation.faction === currentFaction);

      return formations.map(formation => {
        // 如果是默认编队且为空，则跳过
        if (formation.formationId.includes('_default') && formation.forceIdList.length === 0) {
          return null;
        }

        return {
          ...formation,
          // 是否可删除：非默认编队且无部队
          canDelete: !formation.formationId.includes('_default') && formation.forceIdList.length === 0,
          // 获取部队名称列表
          forces: formation.forceIdList.map(fid => {
            const force = this.store.getForceById(fid);
            return {
              id: fid,
              name: force?.forceName || fid
            };
          })
        };
      }).filter(Boolean); // 移除空值
    });

    // 当前回合信息
    this.roundInfo = computed(() => this.store.getRoundInfo());

    /* ========= 监听器 =========== */
    // 当选中编队变化 => 聚焦地图
    watch(() => this.store.selectedForceIds, (set) => {
      if (set.size === 0) return;
      const forceId = Array.from(set)[0];
      const force = this.store.getForceById(forceId);
      if (force) {
        const hex = this.store.getHexCellById(force.hexId);
        if (hex) {
          const center = hex.getCenter();
          this.scenePanelManager.cameraViewController.focusOnLocation(center.longitude, center.latitude);
        }
      }
    });
  }

  /** 获取编队的可删除状态 */
  canDeleteFormation(formationId) {
    const formation = this.store.formationMap.get(formationId);
    if (!formation) return false;
    return !formation.formationId.includes('_default') && formation.forceIdList.length === 0;
  }

  /** 点击编队标题 => 高亮所有部队所在格 */
  onFormationClick(formation) {
    this.store.clearSelectedHexIds();
    formation.forceIdList.forEach(fid => {
      const f = this.store.getForceById(fid);
      if (f) this.store.addSelectedHexId(f.hexId);
    });
  }

  /** 点击部队名称 => 选中并定位一个部队 */
  onForceClick(force) {
    if (!force) return;
    this.store.clearSelectedHexIds();
    this.store.clearSelectedForceIds();
    this.store.addSelectedForceId(force.forceId);
    this.store.addSelectedHexId(force.hexId);
  }

  /** 删除编队 */
  deleteFormation(formationId) {
    if (!this.canDeleteFormation(formationId)) return;
    if (typeof this.onDeleteFormation === 'function') {
      this.onDeleteFormation(formationId);
    }
  }

  /** 发起移动命令 */
  move(forceId, path) {
    if (typeof this.onMoveCommand === 'function') {
      this.onMoveCommand({ forceId, path });
    }
  }

  /** 发起进攻命令 */
  attack(commandForceId, targetHex, supportForceIds) {
    if (typeof this.onAttackCommand === 'function') {
      this.onAttackCommand({ commandForceId, targetHex, supportForceIds });
    }
  }

  /** 发起创建部队命令 */
  createForce(hexId, faction, composition, formationId = null) {
    if (typeof this.onCreateForce === 'function') {
      this.onCreateForce({ hexId, faction, composition, formationId });
    }
  }

  /** 发起合并部队命令 */
  mergeForces(hexId, forceIds) {
    if (typeof this.onMergeForces === 'function') {
      this.onMergeForces({ hexId, forceIds });
    }
  }

  /** 发起拆分部队命令 */
  splitForce(forceId, splitDetails) {
    if (typeof this.onSplitForce === 'function') {
      this.onSplitForce({ forceId, splitDetails });
    }
  }

  /**
   * 销毁管理器及所有相关资源
   */
  destroy() {
    // 清理单例
    MilitaryPanelManager.#instance = null;
  }
}
