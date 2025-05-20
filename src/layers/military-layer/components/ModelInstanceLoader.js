// src\layers\military-layer\components\ModelInstanceLoader.js
import * as Cesium from "cesium";
import { MilitaryConfig } from "@/config/GameConfig";

/**
 * 军事模型实例加载器
 * 
 * 主要职责：
 * 1. 按需加载各兵种的3D模型
 * 2. 支持LOD (Level of Detail) 分级加载
 * 3. 为每个兵种实例提供完整的模型实例集合
 */
export class ModelInstanceLoader {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {ModelInstanceLoader} 单例实例
   */
  static getInstance(viewer) {
    if (!ModelInstanceLoader.#instance) {
      ModelInstanceLoader.#instance = new ModelInstanceLoader(viewer);
    }
    return ModelInstanceLoader.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
  }

  /**
   * 加载一个完整的模型实例（包含所有LOD级别）
   * @param {string} renderingKey 渲染键名
   * @returns {Promise<Object>} 包含所有LOD级别模型的对象
   */
  async loadModelInstance(renderingKey) {
    const modelConfig = MilitaryConfig.models[renderingKey];
    if (!modelConfig) {
      throw new Error(`未找到模型配置: ${renderingKey}`);
    }

    // 按LOD等级排序
    const sortedLevels = [...modelConfig.lod].sort((a, b) => a.level - b.level);
    
    // 获取模型变换信息
    const offset = modelConfig.transform?.offset || { x: 0, y: 0, z: 0 };
    const scale = modelConfig.transform?.scale || 1.0;
    
    // 创建模型实例对象
    const modelInstance = {
      // 各LOD级别的模型数组
      lodModels: [],
      // 模型偏移
      offset: offset,
      // 动画列表
      animationList: modelConfig.animationList || []
    };

    // 并行加载所有LOD级别模型
    const loadPromises = sortedLevels.map(async (lod) => {
      try {
        // 加载模型
        const model = await Cesium.Model.fromGltfAsync({
          url: lod.path,
          modelMatrix: Cesium.Matrix4.IDENTITY.clone(),
          scale: scale,
          allowPicking: false, 
          shadows: Cesium.ShadowMode.ENABLED,
          imageBasedLightingFactor: new Cesium.Cartesian2(1.0, 1.0),
          color: Cesium.Color.WHITE.withAlpha(1.0),
          lightColor: new Cesium.Color(1.0, 1.0, 1.0, 1.0),
          luminanceAtZenith: 1,
        });
        
        // 添加到LOD数组
        return {
          level: lod.level,
          distance: lod.distance,
          model: model
        };
      } catch (error) {
        console.error(`加载模型失败: ${lod.path}`, error);
        throw error;
      }
    });
    
    // 等待所有LOD模型加载完成
    const lodResults = await Promise.all(loadPromises);
    modelInstance.lodModels = lodResults;
    
    return modelInstance;
  }

  /**
   * 清理所有已加载的模型和缓存
   */
  dispose() {
    // 清理单例
    ModelInstanceLoader.#instance = null;
  }
}
