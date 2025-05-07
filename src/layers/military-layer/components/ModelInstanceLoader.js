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

    // 逐一加载所有LOD级别模型，不使用Promise.all并行加载
    for (const lod of sortedLevels) {
      try {
        console.log(`开始加载模型: ${renderingKey}, LOD ${lod.level}, 路径: ${lod.path}`);
        
        // 准备模型变换矩阵
        const modelMatrix = Cesium.Matrix4.IDENTITY.clone();
        
        // 应用偏移
        const translation = new Cesium.Cartesian3(offset.x, offset.y, offset.z);
        Cesium.Matrix4.multiplyByTranslation(modelMatrix, translation, modelMatrix);
        
        // 等待模型加载完成
        const model = await Cesium.Model.fromGltfAsync({
          url: lod.path,
          modelMatrix: modelMatrix,
          scale: scale,
          allowPicking: false, 
          shadows: Cesium.ShadowMode.ENABLED
        });
        
        // 添加到LOD数组
        modelInstance.lodModels.push({
          level: lod.level,
          distance: lod.distance,
          model: model
        });
        
        console.log(`成功加载模型: ${renderingKey}, LOD ${lod.level}`);
      } catch (error) {
        console.error(`加载模型失败: ${lod.path}`, error);
        // 记录错误但继续加载其他LOD级别
      }
    }
    
    // 检查是否至少加载了一个LOD级别
    if (modelInstance.lodModels.length === 0) {
      throw new Error(`所有LOD级别加载失败: ${renderingKey}`);
    }
    
    // 确保LOD级别按level排序
    modelInstance.lodModels.sort((a, b) => a.level - b.level);
    
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
