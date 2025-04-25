// src\layers\military-layer\components\ModelTemplateLoader.js
import * as Cesium from "cesium";
import { reactive } from 'vue';
import { MilitaryConfig } from "@/config/GameConfig";

/**
 * 军事模型加载器
 * 
 * 主要职责：
 * 1. 加载和缓存各兵种的 3D 模型
 * 2. 支持 LOD (Level of Detail) 分级加载
 * 3. 提供模型模板 (modelTemplate) 获取接口
 */
export class ModelTemplateLoader {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {ModelTemplateLoader} 单例实例
   */
  static getInstance(viewer) {
    if (!ModelTemplateLoader.#instance) {
      ModelTemplateLoader.#instance = new ModelTemplateLoader(viewer);
    }
    return ModelTemplateLoader.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    /**
     * modelTemplateMap: Map<renderingKey, modelTemplate>
     * modelTemplate: {
     *   lodModels: Array<{ level: number, distance: number, model: Cesium.Model }>,
     *   animations: string[]
     * }
     */
    this.modelTemplateMap = reactive(new Map());
  }

  /**
   * 预加载所有配置的兵种模型模板
   * @param {Function} onProgress 加载进度回调 (当前进度, 总数)
   */
  async preloadModelTemplates(onProgress = () => {}) {
    const modelKeys = Object.keys(MilitaryConfig.models);
    const total = modelKeys.length;
    
    for (let i = 0; i < total; i++) {
      await this._loadModelTemplate(modelKeys[i]);
      onProgress(i + 1, total);
    }
  }

  /**
   * 获取指定兵种的模型模板
   * @param {string} renderingKey 渲染键名
   * @returns 模型模板 modelTemplate
   */
  async getModelTemplate(renderingKey) {
    if (!this.modelTemplateMap.has(renderingKey)) {
      await this._loadModelTemplate(renderingKey);
    }
    return this.modelTemplateMap.get(renderingKey);
  }

  /**
   * 清理所有已加载的模型
   */
  dispose() {
    for (const template of this.modelTemplateMap.values()) {
      template.lodModels.forEach(item => {
        if (item.model?.isDestroyed?.()) {
          item.model.destroy();
        }
      });
    }
    this.modelTemplateMap.clear();
    
    // 清理单例
    ModelTemplateLoader.#instance = null;
  }

  /**
   * 加载指定兵种的模型模板
   * @private
   * @param {string} renderingKey 渲染键名
   */
  async _loadModelTemplate(renderingKey) {
    const modelConfig = MilitaryConfig.models[renderingKey];
    if (!modelConfig) {
      throw new Error(`未找到模型配置: ${renderingKey}`);
    }

    // 按 LOD 等级排序加载
    const lodModels = [];
    const sortedLevels = [...modelConfig.lodLevels].sort((a, b) => a.level - b.level);
    
    for (const level of sortedLevels) {
      const model = await Cesium.Model.fromGltfAsync({
        url: level.url,
        modelMatrix: Cesium.Matrix4.IDENTITY,
        scale: modelConfig.scale || 1.0,
        allowPicking: false,
        shadows: Cesium.ShadowMode.ENABLED
      });

      lodModels.push({
        level: level.level,
        distance: level.distance,
        model: model
      });
    }

    // 保存到模型模板
    this.modelTemplateMap.set(renderingKey, {
      lodModels: lodModels,
      animations: modelConfig.animations || []
    });
  }
}
