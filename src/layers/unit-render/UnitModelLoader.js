// layers/unit-render/UnitModelLoader.js

import * as Cesium from "cesium";

/**
 * UnitModelLoader 负责对作战单位的3D模型进行预处理和优化，
 * 包括 LOD 模型加载等，目前实现了基于 fromGltfAsync 的模型加载
 * 并支持通过 scale 参数设置模型大小，使其与六角格尺寸保持相对一致。
 */
export class UnitModelLoader {
  /**
   * 构造函数接收 Cesium Viewer 实例，用于后续模型在场景中的渲染
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  constructor(viewer) {
    this.viewer = viewer;
  }

  /**
   * 异步加载部队模型，不包含 LOD 处理
   * @param {Object} renderingAttributes - 渲染属性，包含：
   *   - model_path: 基础模型文件路径
   *   - scale: （可选）模型缩放因子，单位为真实世界单位
   * @param {Cesium.Cartesian3} position - 模型放置位置
   * @returns {Promise<Cesium.Model>} 返回加载完成后的 Cesium.Model 实例
   */
  async loadUnitModel(renderingAttributes, position) {
    const modelPath = renderingAttributes.model_path;
    const scale = renderingAttributes.scale || 100.0; // 通过外部传入调整模型大小
    const model = await Cesium.Model.fromGltfAsync({
      url: modelPath,
      modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
      scale: scale,
      // 取消 minimumPixelSize，保证模型基于真实单位缩放
      // minimumPixelSize: 64,
      maximumScale: 2000,
      shadows: Cesium.ShadowMode.ENABLED,
    });
    this.viewer.scene.primitives.add(model);
    return model;
  }

  /**
   * 加载带有 LOD 支持的部队模型，通过动态监控摄像机与模型的距离，
   * 自动根据预先设定的 LOD 切换阈值加载不同细节层次的模型。
   * 
   * 渲染属性中必须包含 lod_levels 数组，每个元素格式为：
   * { level: number, distance: number, model_path: string }
   * 同时建议定义 scale 参数确保模型与六角格比例一致。
   * 
   * @param {Object} renderingAttributes - 渲染属性信息，包括 lod_levels 数组和 scale（可选）
   * @param {Cesium.Cartesian3} position - 模型放置位置
   * @returns {Object} 返回一个对象，包含当前模型 getter 和 dispose 方法
   */
  loadUnitModelWithLOD(renderingAttributes, position) {
    if (!renderingAttributes.lod_levels || renderingAttributes.lod_levels.length === 0) {
      // 若无 lod_levels，则直接调用基本加载方法
      return {
        model: null,
        dispose: () => {},
      };
    }

    const lodLevels = renderingAttributes.lod_levels.sort((a, b) => a.distance - b.distance);
    const scale = renderingAttributes.scale || 100.0;
    let currentLODIndex = -1;
    let currentModel = null;
    let loadingPromise = null;

    const loadModelForLOD = async (lod) => {
      if (currentModel) {
        this.viewer.scene.primitives.remove(currentModel);
        currentModel = null;
      }
      const newModel = await Cesium.Model.fromGltfAsync({
        url: lod.model_path,
        modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
        scale: scale,
        // 不使用 minimumPixelSize，确保模型缩放以真实单位为准
        // minimumPixelSize: 64,
        maximumScale: 2000,
        shadows: Cesium.ShadowMode.ENABLED,
        allowPicking: false,
      });
      this.viewer.scene.primitives.add(newModel);
      return newModel;
    };

    const updateLOD = () => {
      const cameraPosition = this.viewer.scene.camera.positionWC;
      const distance = Cesium.Cartesian3.distance(cameraPosition, position);
      let desiredLODIndex = 0;
      for (let i = 0; i < lodLevels.length; i++) {
        if (distance >= lodLevels[i].distance) {
          desiredLODIndex = i;
        } else {
          break;
        }
      }
      if (desiredLODIndex !== currentLODIndex) {
        currentLODIndex = desiredLODIndex;
        if (!loadingPromise) {
          loadingPromise = loadModelForLOD(lodLevels[currentLODIndex])
            .then((model) => {
              currentModel = model;
              loadingPromise = null;
            })
            .catch((err) => {
              console.error("加载 LOD 模型失败：", err);
              loadingPromise = null;
            });
        }
      }
    };

    updateLOD();
    const removeListener = this.viewer.scene.postUpdate.addEventListener(updateLOD);

    return {
      get model() {
        return currentModel;
      },
      dispose: () => {
        if (currentModel) {
          this.viewer.scene.primitives.remove(currentModel);
          currentModel = null;
        }
        removeListener();
      },
    };
  }
}
