// src\layers\military-layer\components\MilitaryModelLoader.js
import * as Cesium from "cesium";
import { reactive } from 'vue';
import { MilitaryConfig } from "@/config/GameConfig";

/**
 * 军事模型加载器
 * 
 * 主要职责：
 * 1. 加载和缓存各兵种的 3D 模型
 * 2. 支持 LOD (Level of Detail) 分级加载
 * 3. 提供模型模板获取接口
 */
export class MilitaryModelLoader {
  constructor(viewer) {
    this.viewer = viewer;
    // 模型模板缓存: renderingKey -> TemplateEntry
    this.templateCache = reactive(new Map());
  }

  /**
   * 预加载所有配置的兵种模型
   * @param {Function} onProgress 加载进度回调 (当前进度, 总数)
   */
  async preloadAll(onProgress = () => {}) {
    const modelKeys = Object.keys(MilitaryConfig.models);
    const total = modelKeys.length;
    
    for (let i = 0; i < total; i++) {
      await this._loadTemplate(modelKeys[i]);
      onProgress(i + 1, total);
    }
  }

  /**
   * 获取指定兵种的模型模板
   * @param {string} renderingKey 渲染键名
   * @returns {Promise<TemplateEntry>} 模型模板
   */
  async getTemplate(renderingKey) {
    if (!this.templateCache.has(renderingKey)) {
      await this._loadTemplate(renderingKey);
    }
    return this.templateCache.get(renderingKey);
  }

  /**
   * 清理所有已加载的模型
   */
  dispose() {
    for (const template of this.templateCache.values()) {
      template.lod.forEach(item => {
        if (item.model?.isDestroyed?.()) {
          item.model.destroy();
        }
      });
    }
    this.templateCache.clear();
  }

  /**
   * 加载指定兵种的模型模板
   * @private
   * @param {string} renderingKey 渲染键名
   */
  async _loadTemplate(renderingKey) {
    const config = MilitaryConfig.models[renderingKey];
    if (!config) {
      throw new Error(`未找到模型配置: ${renderingKey}`);
    }

    // 按 LOD 等级排序加载
    const lodModels = [];
    const sortedLevels = [...config.lod_levels].sort((a, b) => a.level - b.level);
    
    for (const level of sortedLevels) {
      const model = await Cesium.Model.fromGltfAsync({
        url: level.url,
        modelMatrix: Cesium.Matrix4.IDENTITY,
        scale: config.scale || 1.0,
        allowPicking: false,
        shadows: Cesium.ShadowMode.ENABLED
      });

      lodModels.push({
        level: level.level,
        distance: level.distance,
        model: model
      });
    }

    // 保存到缓存
    this.templateCache.set(renderingKey, {
      lod: lodModels,
      animations: config.animations || []
    });
  }
}
