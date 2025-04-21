import * as Cesium from "cesium";
import { reactive } from 'vue';
import { openGameStore } from '@/store';
import { HexConfig } from '@/config/GameConfig';

/**
 * 军事模型渲染器 (实例层)
 *
 * 主要职责：
 *  - 接收模板 (loader.templateCache)
 *  - 根据 Pinia 中 forceMap 动态增删实例
 *  - 同步部队位置、LOD 切换、偏移排布
 *  - 提供 dispose() 清理所有实例
 */
export class MilitaryModelRenderer {
  constructor(viewer, loader) {
    this.viewer = viewer;
    this.loader = loader;
    this.store = openGameStore();

    // Map<forceId, InstanceEntry>
    this.instanceCache = reactive(new Map());
    this._postUpdateHandle = null;

    // 可配置参数
    this.opts = {
      ringThreshold: 6,               // <=6 使用环形排布
      ringRadiusFactor: 0.4,          // 环形半径 = HexConfig.radius * factor
      gridMax: 9,                     // <=9 使用网格排布
      gridScale: 0.7,                 // 网格整体缩放比例
      heightOffset: 2,                // 相对地表抬高
    };
  }

  renderAllForces() {
    this.store.getForces().forEach(f => this._addInstance(f));
    this._startUpdateLoop();
  }

  syncForces(newIds, oldIds) {
    newIds.forEach(id => {
      if (!this.instanceCache.has(id)) {
        const force = this.store.getForceById(id);
        if (force) this._addInstance(force);
      }
    });
    oldIds.forEach(id => {
      if (!newIds.includes(id) && this.instanceCache.has(id)) {
        this._removeInstance(id);
      }
    });
  }

  async _addInstance(force) {
    try {
      const tpl = await this.loader.getTemplate(force.renderingKey);
      const base = tpl.lod[0];
      const inst = base.model.clone();
      inst.modelMatrix = this._calcMatrix(force);
      inst.allowPicking = true;
      this.viewer.scene.primitives.add(inst);
      this.instanceCache.set(force.forceId, {
        forceRef: force,
        model: inst,
        currentLOD: 0,
        tplEntry: tpl
      });
    } catch (e) {
      console.error(`[Renderer] 添加实例失败: ${force.forceId}`, e);
    }
  }

  _removeInstance(forceId) {
    const entry = this.instanceCache.get(forceId);
    if (entry) {
      this.viewer.scene.primitives.remove(entry.model);
      this.instanceCache.delete(forceId);
    }
  }

  _startUpdateLoop() {
    if (this._postUpdateHandle) return;
    this._postUpdateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      this.instanceCache.forEach(entry => this._updateInstance(entry));
    });
  }

  _updateInstance(entry) {
    const { forceRef, model, tplEntry } = entry;
    // 位置 & 偏移
    model.modelMatrix = this._calcMatrix(forceRef);
    // LOD 切换
    const cameraPos = this.viewer.scene.camera.positionWC;
    const modelPos = Cesium.Matrix4.getTranslation(model.modelMatrix, new Cesium.Cartesian3());
    const dist = Cesium.Cartesian3.distance(cameraPos, modelPos);
    let desired = 0;
    tplEntry.lod.forEach((lvl, idx) => {
      if (dist >= lvl.distance) desired = idx;
    });
    if (desired !== entry.currentLOD) {
      // 切换实例
      this.viewer.scene.primitives.remove(entry.model);
      const newTpl = tplEntry.lod[desired].model;
      const newInst = newTpl.clone();
      newInst.modelMatrix = model.modelMatrix;
      this.viewer.scene.primitives.add(newInst);
      entry.model = newInst;
      entry.currentLOD = desired;
    }
  }

  /**
   * 计算载入部队的位置矩阵
   * - 中心点基础经纬度
   * - 偏移排布：环形 / 网格 / 聚合
   */
  _calcMatrix(force) {
    const hex = this.store.getHexCellById(force.hexId);
    if (!hex) return Cesium.Matrix4.IDENTITY;
    const center = hex.getCenter();
    const forces = this.store.getForcesByHexId(force.hexId);
    const idx = forces.indexOf(force.forceId);
    const N = forces.length;
    // 配置解构
    const { ringThreshold, ringRadiusFactor, gridMax, gridScale, heightOffset } = this.opts;
    // 辅助函数：米→度
    const toDegLat = m => m / 111320;
    const toDegLon = (m, lat) => m / (111320 * Math.cos(lat));
    // 计算基础地理坐标
    const carto = Cesium.Cartographic.fromDegrees(center.longitude, center.latitude, center.height);
    // 计算偏移
    let dx = 0, dy = 0;
    if (N <= ringThreshold) {
      // 环形排布
      const r = HexConfig.radius * ringRadiusFactor;
      const ang = 2 * Math.PI * idx / N;
      dx = r * Math.cos(ang);
      dy = r * Math.sin(ang);
    } else if (N <= gridMax) {
      // 网格排布
      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);
      const spanX = (HexConfig.radius * 2 * gridScale) / cols;
      const spanY = (HexConfig.radius * 2 * gridScale) / rows;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      dx = (col - (cols - 1) / 2) * spanX;
      dy = (row - (rows - 1) / 2) * spanY;
    } else {
      // 聚合：中心不偏移，可额外加微扰
      dx = 0;
      dy = 0;
    }
    // 米偏移转经纬度
    const lon = carto.longitude + toDegLon(dx, carto.latitude);
    const lat = carto.latitude  + toDegLat(dy);
    // 构建 Cartesian3 并生成矩阵
    const pos = Cesium.Cartesian3.fromDegrees(lon, lat, carto.height + heightOffset);
    return Cesium.Transforms.eastNorthUpToFixedFrame(pos);
  }

  dispose() {
    if (this._postUpdateHandle) {
      this.viewer.scene.postUpdate.removeEventListener(this._postUpdateHandle);
      this._postUpdateHandle = null;
    }
    this.instanceCache.forEach(entry => {
      this.viewer.scene.primitives.remove(entry.model);
    });
    this.instanceCache.clear();
  }
}
