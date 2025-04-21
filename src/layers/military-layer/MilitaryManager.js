// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
import { MilitaryModelLoader } from './components/MilitaryModelLoader';
import { MilitaryModelRenderer } from './components/MilitaryModelRenderer';
import { MilitaryPanelManager } from '@/layers/interaction-layer/MilitaryPanelManager';
import { API } from "@/services/api";

/**
 * 军事单位管理器
 *
 * 主要职责：
 *  1. 模板预加载 (Loader)
 *  2. 模型实例化渲染 (Renderer)
 *  3. Pinia forceMap 数据同步
 *  4. 交互面板 (PanelManager) 命令回调对接
 */
export class MilitaryManager {
  constructor(viewer, geoPanelManager) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.loader = null;
    this.renderer = null;
    this.geoPanelManager = geoPanelManager;

    // 初始化面板管理器
    this.panelManager = new MilitaryPanelManager(viewer, geoPanelManager);
    this._stopForceWatch = null;
  }

  async init(onProgress) {
    this.loader = new MilitaryModelLoader(this.viewer);
    await this.loader.preloadAll(onProgress);

    this.renderer = new MilitaryModelRenderer(this.viewer, this.loader);
    this.renderer.renderAllForces();

    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newIds, oldIds) => this.renderer.syncForces(newIds, oldIds)
    );

    this._bindPanelCommands();
    return true;
  }

  _bindPanelCommands() {
    this.panelManager.onMoveCommand = async ({ forceId, path }) => {
      const res = await API.move(forceId, path);
      console.log('[MilitaryManager] move result:', res);
    };

    this.panelManager.onAttackCommand = async ({ commandForceId, targetHex, supportForceIds }) => {
      const res = await API.attack(commandForceId, targetHex, supportForceIds);
      console.log('[MilitaryManager] attack result:', res);
    };

    this.panelManager.onCreateForce = async ({ hexId, faction, composition }) => {
      const res = await API.createForce(hexId, faction, composition);
      console.log('[MilitaryManager] createForce result:', res);
    };

    this.panelManager.onMergeForces = async ({ hexId, forceIds }) => {
      const res = await API.mergeForces(hexId, forceIds);
      console.log('[MilitaryManager] mergeForces result:', res);
    };

    this.panelManager.onSplitForce = async ({ forceId, splitDetails }) => {
      const res = await API.splitForce(forceId, splitDetails);
      console.log('[MilitaryManager] splitForce result:', res);
    };
  }

  destroy() {
    if (this._stopForceWatch) {
      this._stopForceWatch();
      this._stopForceWatch = null;
    }
    this.renderer?.dispose();
    this.loader?.dispose();
    this.panelManager?.destroy?.();
  }
}
