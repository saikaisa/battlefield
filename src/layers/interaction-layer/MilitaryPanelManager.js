// src\layers\interaction-layer\MilitaryPanelManager.js
import { watch, computed } from 'vue';
import { openGameStore } from '@/store';
// eslint-disable-next-line no-unused-vars
import { GeoPanelManager } from '@/layers/interaction-layer/GeoPanelManager';

/**
 * 军事单位/命令操作相关面板管理器
 * 
 * - 编队列表
 * - 部队详细信息栏
 * - 命令下达区
 * - 战斗群列表
 * - 统计列表
 * - 部队管理面板（默认隐藏）
 * - 兵种管理面板（默认隐藏）
 */
export class MilitaryPanelManager {
  constructor(viewer, geoPanelManager) {
    this.store = openGameStore();
    this.geoPanelManager = geoPanelManager;

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
      const force   = this.store.getForceById(forceId);
      if (force) {
        const hex   = this.store.getHexCellById(force.hexId);
        if (hex) {
          const center = hex.getCenter();
          this.geoPanelManager.cameraViewController.focusOnLocation(center.longitude, center.latitude);
        }
      }
    });
  }

  /** 点击编队标题 => 高亮所有部队所在格 */
  onFormationClick(formation) {
    // 清空再批量添加选中的格子
    this.store.clearSelectedHexIds();
    formation.forceIdList.forEach(fid => {
      const f = this.store.getForceById(fid);
      if (f) this.store.addSelectedHexId(f.hexId);
    });
    // 渲染器会监听 selectedHexIds 自动高亮
  }

  /** 点击部队名称 => 选中并定位一个部队 */
  onForceClick(force) {
    this.store.clearSelectedHexIds();
    this.store.clearSelectedForceIds();
    this.store.addSelectedForceId(force.forceId);
    this.store.addSelectedHexId(force.hexId);
  }
}
