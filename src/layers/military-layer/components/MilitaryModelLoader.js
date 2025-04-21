// src\layers\military-layer\components\MilitaryModelLoader.js
import * as Cesium from "cesium";
import { reactive } from 'vue';
import { MilitaryConfig } from "@/config/GameConfig";

/**
 * 军事模型加载器 (模板层)
 *
 * • templateCache: Map<renderingKey, TemplateEntry>
 *
 * TemplateEntry {
 *   lod: Array<{ level: number; distance: number; model: Cesium.Model }>;
 *   animations: string[];
 * }
 *
 * 主要职责：
 *  1) 读取 MilitaryConfig.models，逐个加载各兵种的 LOD 模型到 templateCache
 *  2) 提供 getTemplate(key) 方法，按需懒加载
 *  3) 支持 preloadAll(onProgress) 批量预加载，并回调进度
 *  4) dispose() 清理所有缓存模型
 */
export class MilitaryModelLoader {
  constructor(viewer) {
    this.viewer = viewer;
    // 所有已加载的模板：renderingKey -> TemplateEntry
    this.templateCache = reactive(new Map());
  }

  /**
   * 批量预加载所有配置的兵种模型
   * @param {Function} onProgress(done: number, total: number)
   */
  async preloadAll(onProgress = () => {}) {
    const keys = Object.keys(MilitaryConfig.models);
    const total = keys.length;
    for (let i = 0; i < total; i++) {
      const key = keys[i];
      await this._ensureTemplate(key);
      onProgress(i + 1, total);
    }
  }

  /**
   * 根据渲染键获取模板，若未加载则触发加载
   * @param {string} key
   * @returns {Promise<TemplateEntry>}
   */
  async getTemplate(key) {
    return this._ensureTemplate(key);
  }

  /**
   * 清空缓存并销毁模型
   */
  dispose() {
    for (const tpl of this.templateCache.values()) {
      tpl.lod.forEach(item => {
        if (item.model && item.model.destroy) {
          item.model.destroy();
        }
      });
    }
    this.templateCache.clear();
  }

  /* ------------------ 私有方法 ------------------ */
  /**
   * 确保指定 key 的模板已加载
   * @private
   */
  async _ensureTemplate(key) {
    if (this.templateCache.has(key)) {
      return this.templateCache.get(key);
    }

    const config = MilitaryConfig.models[key];
    if (!config) {
      throw new Error(`MilitaryModelLoader: 未找到模板配置 '${key}'`);
    }

    // 按 level 升序加载各 LOD 模型
    const lodArr = [];
    const sorted = [...config.lod_levels].sort((a, b) => a.level - b.level);
    for (const lvl of sorted) {
      const model = await Cesium.Model.fromGltfAsync({
        url: lvl.url,
        modelMatrix: Cesium.Matrix4.IDENTITY, // 模板不放入场景
        scale: config.scale || 1.0,
        allowPicking: false,
        shadows: Cesium.ShadowMode.ENABLED
      });
      lodArr.push({ level: lvl.level, distance: lvl.distance, model });
    }

    const entry = {
      lod: lodArr,
      animations: config.animations || []
    };
    this.templateCache.set(key, entry);
    return entry;
  }
}
