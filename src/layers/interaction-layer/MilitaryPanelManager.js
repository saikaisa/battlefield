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
  constructor(viewer) {
    this.store = openGameStore();
    this.cameraViewController = CameraViewController.getInstance(viewer);

    // 命令回调占位符，由 MilitaryManager 绑定实现
    this.onMoveCommand = null;
    this.onAttackCommand = null;
    this.onCreateForce = null;
    this.onMergeForces = null;
    this.onSplitForce = null;

    /* ========= 只读派生 =========== */
    this.selectedFormation = computed(() => {
      const [fid] = Array.from(this.store.selectedForceIds);
      if (!fid) return null;
      return this.store.getFormations().find(fm => fm.forceIdList.includes(fid));
    });

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
    this.store.clearSelectedHexIds();
    this.store.clearSelectedForceIds();
    this.store.addSelectedForceId(force.forceId);
    this.store.addSelectedHexId(force.hexId);
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
  createForce(hexId, faction, composition) {
    if (typeof this.onCreateForce === 'function') {
      this.onCreateForce({ hexId, faction, composition });
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

  // 可在此处添加更多命令接口...
}
