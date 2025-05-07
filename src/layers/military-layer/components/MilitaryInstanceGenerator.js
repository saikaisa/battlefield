// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { reactive } from "vue";
import { openGameStore } from "@/store";
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
// eslint-disable-next-line no-unused-vars
import { ModelInstanceLoader } from "./ModelInstanceLoader";
import { MilitaryConfig } from "@/config/GameConfig";
import { ModelPoseCalculator } from "./ModelPoseCalculator";

/**
 * 军事单位实例生成器
 *
 * 主要职责：
 * 1. 管理部队、兵种实例的生成
 * 2. 计算部队位置和初始化姿态
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
    this.poseCalculator = ModelPoseCalculator.getInstance(viewer);
    // 获取模型加载器
    this.loader = ModelInstanceLoader.getInstance(viewer);

    // forceInstanceMap: Map<forceId, forceInstance>
    // forceInstance: {
    //   force: Force, —— 部队
    //   unitInstanceMap: Map<unitInstanceId, unitInstance>, —— 兵种实例集合
    //   pose: { position: { longitude, latitude, height }, heading: number } —— 部队位置和朝向
    //   isReady: boolean —— 标记部队实例是否准备就绪
    // }
    // unitInstanceId: `${forceId}_${renderingKey}_${index}`
    // unitInstance: {
    //   activeLOD: number, // 当前激活的LOD级别
    //   activeModel: Cesium.Model | null, // 当前在场景中显示的模型
    //   lodModels: Array<{ level, distance, model }>, // 所有LOD级别的模型
    //   offset: { x, y, z }, // 模型相对于兵种实例的偏移
    //   localOffset: { x, y } // 兵种实例在部队内的相对偏移
    // }
    this.forceInstanceMap = reactive(new Map());
  }

  /**
   * 创建部队实例，但此时不会渲染到地图上
   * @param {Force} force 部队对象
   * @returns {Promise<Object|null>} 部队实例对象或null（如果创建失败）
   */
  async createForceInstance(force) {
    try {
      // 检查是否已存在该部队实例，避免重复创建
      if (this.forceInstanceMap.has(force.forceId)) {
        console.log(`部队实例已存在: ${force.forceId}`);
        return this.forceInstanceMap.get(force.forceId);
      }
      
      // 计算部队位置
      const posInfo = await this.poseCalculator.computeForcePosition(force);

      if (!posInfo) {
        console.error(`无法创建部队实例: ${force.forceId}，位置计算失败`);
        return null;
      }
      
      // 创建一个包含基本数据的部队实例
      const forceInstance = {
        force: force,
        unitInstanceMap: new Map(),
        pose: {
          position: posInfo.position,
          heading: 0, // 初始朝向为0
        },
        isReady: false // 初始状态为未就绪
      };
      
      // 先将实例添加到Map中
      this.forceInstanceMap.set(force.forceId, forceInstance);
      
      // 计算渲染组并创建兵种实例
      const renderingGroups = this._calculateRenderingGroups(force);
      
      // 获取兵种实例总数
      let totalUnits = 0;
      for (const count of renderingGroups.values()) {
        totalUnits += count;
      }
      
      // 如果没有需要渲染的兵种
      if (totalUnits === 0) {
        console.log(`部队 ${force.forceId} 没有需要渲染的兵种`);
        forceInstance.isReady = true; // 标记为就绪
        return forceInstance;
      }
      
      let unitIndex = 0;
      let loadedCount = 0;
      
      // 逐个处理渲染组
      for (const [renderingKey, renderCount] of renderingGroups.entries()) {
        console.log(`处理渲染组: ${renderingKey}, 数量: ${renderCount}`);
        
        // 为每个渲染组创建实例
        for (let i = 0; i < renderCount; i++) {
          // 计算环形布局位置
          const angle = (2 * Math.PI * unitIndex) / totalUnits;
          const radius = MilitaryConfig.layoutConfig.unitLayout.radius;
          const localOffset = {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
          };
          
          // 创建兵种实例ID
          const unitInstanceId = `${force.forceId}_${renderingKey}_${i}`;
          
          try {
            // 加载模型实例 - 一次只加载一个，减少并行
            console.log(`加载模型: ${unitInstanceId}`);
            const modelInstance = await this.loader.loadModelInstance(renderingKey);
            
            if (!modelInstance || !modelInstance.lodModels || modelInstance.lodModels.length === 0) {
              console.error(`加载模型实例失败: ${renderingKey}`);
              continue;
            }
            
            // 创建兵种实例
            const unitInstance = {
              activeLOD: -1,                          // 当前激活的LOD级别，-1表示未激活
              activeModel: null,                      // 当前在场景中显示的模型
              lodModels: modelInstance.lodModels,     // 所有LOD级别的模型及切换距离
              animationList: modelInstance.animationList, // 动画列表
              offset: modelInstance.offset,           // 模型偏移
              localOffset: localOffset                // 兵种在部队内的相对偏移
            };
            
            // 添加到兵种实例映射
            forceInstance.unitInstanceMap.set(unitInstanceId, unitInstance);
            unitIndex++;
            loadedCount++;
            
          } catch (error) {
            console.error(`创建兵种实例失败: ${unitInstanceId}`, error);
            // 继续处理下一个，不中断整个流程
          }
        }
      }
      
      // 只有当所有模型都加载完成时，才标记部队实例为就绪状态
      if (loadedCount > 0) {
        forceInstance.isReady = true;
        console.log(`部队实例创建完成: ${force.forceId}, 兵种数量: ${forceInstance.unitInstanceMap.size}`);
      } else {
        console.error(`部队实例创建失败: ${force.forceId}，未能成功加载任何兵种模型`);
        // 如果所有模型加载失败，则从Map中移除
        this.forceInstanceMap.delete(force.forceId);
        return null;
      }
      
      return forceInstance;
    } catch (error) {
      console.error(`创建部队实例失败: ${force.forceId}`, error);
      // 如果失败，从Map中移除
      this.forceInstanceMap.delete(force.forceId);
      return null;
    }
  }

  /**
   * 移除部队实例，及其在地图上的渲染
   */
  removeForceInstanceById(forceId) {
    const forceInstance = this.forceInstanceMap.get(forceId);
    if (forceInstance) {
      forceInstance.unitInstanceMap.forEach((unitInstance) => {
        if (unitInstance.activeModel) {
          this.viewer.scene.primitives.remove(unitInstance.activeModel);
          unitInstance.activeModel = null;
        }
      });
      this.forceInstanceMap.delete(forceId);
    }
  }

  /**
   * 计算渲染组信息
   * @private
   * @param {Object} force 部队对象
   * @returns {Map<string, number>} 渲染组信息，Map<renderingKey, renderCount>
   */
  _calculateRenderingGroups(force) {
    // 用于存储每个renderingKey的总数量
    const totalCounts = new Map();
    // 最终返回的渲染组（只包含renderCount）
    const renderingGroups = new Map();

    // 统计每个renderingKey的总数量
    for (const comp of force.composition) {
      const unit = this.store.getUnitById(comp.unitId);
      if (!unit || !unit.renderingKey) continue;

      const renderingKey = unit.renderingKey;
      const currentTotal = totalCounts.get(renderingKey) || 0;
      totalCounts.set(renderingKey, currentTotal + comp.unitCount);
    }

    // 确定各渲染组的渲染数量
    const maxTotalUnits = MilitaryConfig.layoutConfig.unitLayout.maxCount;
    let totalRenderingUnits = 0;

    // 计算总数量
    totalCounts.forEach((count) => {
      totalRenderingUnits += count;
    });

    // 计算渲染比例并保证至少渲染1个
    let totalPlannedRenderCount = 0;

    totalCounts.forEach((totalCount, renderingKey) => {
      let renderCount;
      // 新的渲染数量计算：确保每种渲染类型至少有1个，但总数不超过maxCount
      if (totalRenderingUnits <= maxTotalUnits) {
        // 如果总数少于最大显示数，全部显示
        renderCount = totalCount;
      } else {
        // 根据比例计算显示数量，保证至少1个
        const ratio = totalCount / totalRenderingUnits;
        renderCount = Math.max(1, Math.floor(ratio * maxTotalUnits));
      }
      renderingGroups.set(renderingKey, renderCount);
      totalPlannedRenderCount += renderCount;
    });

    // 调整数量，确保总数不超过maxCount
    if (totalPlannedRenderCount > maxTotalUnits) {
      // 按比例减少多余的数量
      let excess = totalPlannedRenderCount - maxTotalUnits;

      // 优先从数量最多的组中减少
      while (excess > 0) {
        let maxRenderingKey = null;
        let maxCount = 1; // 最小保留1个

        renderingGroups.forEach((renderCount, renderingKey) => {
          if (renderCount > maxCount) {
            maxCount = renderCount;
            maxRenderingKey = renderingKey;
          }
        });

        if (maxRenderingKey && renderingGroups.get(maxRenderingKey) > 1) {
          renderingGroups.set(maxRenderingKey, renderingGroups.get(maxRenderingKey) - 1);
          excess--;
        } else {
          // 如果所有组都已经是1个，但仍然超出，则继续减少
          // 按照优先级升序排序，优先级低的先减少
          const sortedGroups = Array.from(renderingGroups.entries())
            .map(([key, renderCount]) => {
              // 从配置中获取优先级
              const priority = MilitaryConfig.models[key]?.priority || 0;
              return { key, renderCount, priority };
            })
            .sort((a, b) => a.priority - b.priority);

          for (const { key, renderCount } of sortedGroups) {
            if (excess > 0 && renderCount > 0) {
              renderingGroups.set(key, renderCount - 1);
              excess--;
              // 如果减为0，从renderingGroups中移除
              if (renderingGroups.get(key) === 0) {
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

  /**
   * 清理所有实例
   */
  dispose() {
    // 清理 forceInstanceMap
    this.forceInstanceMap.forEach(forceInstance => {
      forceInstance.unitInstanceMap.forEach(unitInstance => {
        if (unitInstance.activeModel) {
          this.viewer.scene.primitives.remove(unitInstance.activeModel);
        }
      });
    });
    this.forceInstanceMap.clear();

    // 清理单例
    MilitaryInstanceGenerator.#instance = null;
  }
}
