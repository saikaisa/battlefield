// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { reactive } from "vue";
import { openGameStore } from "@/store";
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
// eslint-disable-next-line no-unused-vars
import { ModelTemplateLoader } from "./ModelTemplateLoader";
import { MilitaryConfig } from "@/config/GameConfig";
import { ModelPoseCalculator } from "./ModelPoseCalculator";

/**
 * 军事单位实例生成器
 *
 * 主要职责：
 * 1. 管理部队、兵种实例的生成
 * 2. 处理部队位置更新和 LOD 切换
 * 3. 维护部队在六角格内的排布
 */
export class MilitaryInstanceGenerator {
  // 单例实例
  static #instance = null;

  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MilitaryInstanceGenerator} 单例实例
   */
  static getInstance(viewer) {
    if (!MilitaryInstanceGenerator.#instance) {
      MilitaryInstanceGenerator.#instance = new MilitaryInstanceGenerator(viewer);
    }
    return MilitaryInstanceGenerator.#instance;
  }

  /**
   * 获取部队实例Map
   * @returns forceInstanceMap
   */
  static getforceInstanceMap() {
    // 获取部队实例映射表，供其他模块访问
    if (!MilitaryInstanceGenerator.#instance) {
      console.warn("尚未初始化MilitaryInstanceGenerator实例，无法获取forceInstanceMap");
      return new Map();
    }
    return MilitaryInstanceGenerator.#instance.forceInstanceMap;
  }

  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    // 初始化模型姿态计算器
    this.poseCalculator = ModelPoseCalculator.getInstance();
    // 获取模型加载器
    this.loader = ModelTemplateLoader.getInstance(viewer);

    // forceInstanceMap: Map<forceId, forceInstance>
    // forceInstance: {
    //   force: Force, —— 部队
    //   unitInstanceMap: Map<unitInstanceId, unitInstance>, —— 兵种实例集合
    //   pose: { position: { longitude, latitude, height }, heading: number } —— 部队位置和朝向
    // }
    // unitInstanceId: `${forceId}_${renderingKey}_${index}`
    // unitInstance: {
    //   currentModel: Cesium.Model, —— 当前显示的模型实例
    //   currentLOD: number, —— 当前 LOD 级别
    //   modelTemplate: modelTemplate, —— 兵种模型模版
    //   localOffset: { x, y } —— 兵种在部队内的相对偏移
    // }
    this.forceInstanceMap = reactive(new Map());
  }

  /**
   * 创建部队实例（包含多个兵种模型）并将其渲染在地图上
   */
  async createForceInstance(force) {
    try {
      const forceInstance = {
        force: force,
        unitInstanceMap: this.createUnitInstances(force),
        pose: {
          position: this.poseCalculator.computeForcePosition(force),
          heading: 0, // 初始朝向为0
        },
      };
      this.forceInstanceMap.set(force.forceId, forceInstance);

      return forceInstance;
    } catch (error) {
      console.error(`创建部队实例失败: ${force.forceId}`, error);
    }
  }

  /**
   * 移除部队实例
   */
  removeForceInstanceById(forceId) {
    const forceInstance = this.forceInstanceMap.get(forceId);
    if (forceInstance) {
      forceInstance.unitInstanceMap.forEach((unitInstance) => {
        this.viewer.scene.primitives.remove(unitInstance.currentModel);
      });
      this.forceInstanceMap.delete(forceId);
    }
  }

  /**
   * 创建兵种实例
   * @param {string} force 部队对象
   * @returns {Map<string, Object>} 兵种实例集合
   */
  async createUnitInstances(force) {
    // 计算渲染组
    const renderingGroups = this._calculateRenderingGroups(force);
    const unitInstanceMap = new Map();

    // 兵种实例总数
    let maxUnitInstCount = 0;
    renderingGroups.forEach((group) => {
      maxUnitInstCount += group.renderCount;
    });

    // 兵种实例索引
    let unitInstIndex = 0;

    for (const [renderingKey, group] of renderingGroups.entries()) {
      const modelTemplate = await this.loader.getModelTemplate(renderingKey);
      const baseModel = modelTemplate.lodModels[0].model;

      // 按环形布局创建兵种实例
      for (let i = 0; i < group.renderCount; i++) {
        // 计算环形布局位置
        const angle = (2 * Math.PI * unitInstIndex) / maxUnitInstCount;
        const radius = MilitaryConfig.layoutConfig.unitLayout.radius;
        const localOffset = {
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
        };

        const currentModel = baseModel.clone();

        // 创建兵种实例
        const unitInstance = {
          currentModel: currentModel,
          currentLOD: 0,
          modelTemplate: modelTemplate,
          localOffset: localOffset,
        };
        // 使用 forceId_renderingKey_index 作为 key
        const unitInstanceId = `${force.forceId}_${renderingKey}_${i}`;
        unitInstanceMap.set(unitInstanceId, unitInstance);
        unitInstIndex++;
      }
    }
    return unitInstanceMap;
  }

  /**
   * 计算渲染组信息
   * @private
   * @param {Object} force 部队对象
   * @returns {Map<string, Object>} 渲染组信息
   */
  _calculateRenderingGroups(force) {
    // 按renderingKey分组兵种，Map<renderingKey, { unitId, totalCount, renderCount }>
    const renderingGroups = new Map();

    for (const comp of force.composition) {
      const unit = this.store.getUnitById(comp.unitId);
      if (!unit || !unit.renderingKey) continue;

      if (!renderingGroups.has(unit.renderingKey)) {
        renderingGroups.set(unit.renderingKey, {
          unitId: comp.unitId,
          totalCount: comp.unitCount,
          renderCount: 0,
        });
      } else {
        renderingGroups.get(unit.renderingKey).totalCount += comp.unitCount;
      }
    }

    // 确定各渲染组的渲染数量
    const maxTotalUnits = MilitaryConfig.layoutConfig.unitLayout.maxCount;
    let totalRenderingUnits = 0;

    // 计算总数量
    renderingGroups.forEach((group) => {
      totalRenderingUnits += group.totalCount;
    });

    // 计算渲染比例并保证至少渲染1个
    let totalPlannedRenderCount = 0;

    renderingGroups.forEach((group) => {
      // 新的渲染数量计算：确保每种渲染类型至少有1个，但总数不超过maxCount
      if (totalRenderingUnits <= maxTotalUnits) {
        // 如果总数少于最大显示数，全部显示
        group.renderCount = group.totalCount;
      } else {
        // 根据比例计算显示数量，保证至少1个
        const ratio = group.totalCount / totalRenderingUnits;
        group.renderCount = Math.max(1, Math.floor(ratio * maxTotalUnits));
      }
      totalPlannedRenderCount += group.renderCount;
    });

    // 调整数量，确保总数不超过maxCount
    if (totalPlannedRenderCount > maxTotalUnits) {
      // 按比例减少多余的数量
      let excess = totalPlannedRenderCount - maxTotalUnits;

      // 优先从数量最多的组中减少
      while (excess > 0) {
        let maxGroup = null;
        let maxCount = 1; // 最小保留1个

        renderingGroups.forEach((group) => {
          if (group.renderCount > maxCount) {
            maxCount = group.renderCount;
            maxGroup = group;
          }
        });

        if (maxGroup && maxGroup.renderCount > 1) {
          maxGroup.renderCount--;
          excess--;
        } else {
          // 如果所有组都已经是1个，但仍然超出，则继续减少
          // 按照优先级升序排序，优先级低的先减少
          const sortedGroups = Array.from(renderingGroups.entries())
            .map(([key, group]) => {
              // 从配置中获取优先级
              const priority = MilitaryConfig.models[key]?.priority || 0;
              return { key, group, priority };
            })
            .sort((a, b) => a.priority - b.priority);

          for (const { key, group } of sortedGroups) {
            if (excess > 0 && group.renderCount > 0) {
              group.renderCount--;
              excess--;
              // 如果减为0，从renderingGroups中移除
              if (group.renderCount === 0) {
                renderingGroups.delete(key);
              }
              if (excess === 0) break;
            }
          }
          // 保险操作
          if (excess > 0) break;
        }
      }
    }

    return renderingGroups;
  }
}
