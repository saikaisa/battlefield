// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { ModelTemplateLoader } from './components/ModelTemplateLoader';
import { MilitaryInstanceRenderer } from './components/MilitaryInstanceRenderer';
// eslint-disable-next-line no-unused-vars
import { MilitaryPanelManager } from '@/layers/interaction-layer/legacy/MilitaryPanelManager';
import { HexForceMapper } from '@/layers/interaction-layer/utils/HexForceMapper';
import { showWarning, showError, showSuccess } from '@/layers/interaction-layer/utils/MessageBox';
import { MilitaryInstanceGenerator } from "./components/MilitaryInstanceGenerator";

/**
 * 军事单位管理器
 *
 * 主要职责：
 *  1. 模板预加载 (Loader)
 *  2. 模型实例化渲染 (Renderer)
 *  3. Pinia forceMap 数据同步
 *  4. 交互面板 (PanelManager) 命令回调对接
 *  5. 维护 HexForceMapper 映射关系
 *  6. 管理部队编队和组织体系
 */
export class MilitaryManager {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MilitaryManager} 单例实例
   */
  static getInstance(viewer) {
    if (!MilitaryManager.#instance) {
      MilitaryManager.#instance = new MilitaryManager(viewer);
    }
    return MilitaryManager.#instance;
  }

  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    // 初始化管理器
    this.loader = null;
    this.generator = null;
    this.renderer = null;
    // this.panelManager = null;
    
    this._stopForceWatch = null;
    this._stopHexWatch = null;
    this._stopFactionWatch = null;
    this._stopHexVisibilityWatch = null;
  }

  /**
   * 初始化管理器及其组件
   * @param {Function} onProgress 加载进度回调 (当前进度, 总数)
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(onProgress) {
    // 初始化 HexForceMapper
    this._initHexForceMapper();

    // 初始化编队系统
    this._initFormationSystem();

    // 初始化模型加载器
    this.loader = ModelTemplateLoader.getInstance(this.viewer);
    await this.loader.preloadModelTemplates(onProgress);

    // 初始化军事单位实例生成器
    this.generator = MilitaryInstanceGenerator.getInstance(this.viewer);

    // 初始化军事单位实例渲染器
    this.renderer = MilitaryInstanceRenderer.getInstance(this.viewer);
    this.renderer.regenerateAllForceInstances();

    // 设置初始可见性
    this.renderer.updateForceInstanceVisibility();

    // 监听部队变化，当部队发生增删时同步
    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newForceIds, oldForceIds) => {
        // 计算新增和删除的部队ID
        const addedForceIds = newForceIds.filter(id => !oldForceIds.includes(id));
        const removedForceIds = oldForceIds.filter(id => !newForceIds.includes(id));
        // 更新部队实例
        this.renderer.updateForceInstance(newForceIds, removedForceIds);
        // 更新新增和删除部队与六角格的位置映射
        this._syncHexForceMapper(addedForceIds, removedForceIds);
        // 更新编队中的部队
        this._syncFormationSystem(addedForceIds, removedForceIds);
        // 更新现存部队的可见性
        this.renderer.updateForceInstanceVisibility();
      }
    );

    // 监听阵营变化，更新部队可见性
    this._stopFactionWatch = watch(
      () => this.store.currentFaction,
      () => {
        // 更新所有部队可见性
        this.renderer.updateForceInstanceVisibility();
      }
    );

    // 监听六角格可见性变化
    this._stopHexVisibilityWatch = watch(
      () => {
        // 监听所有六角格的visibleTo属性变化
        const visibilityStates = [];
        this.store.hexCellMap.forEach(hexCell => {
          if (hexCell.visibility && hexCell.visibility.visibleTo) {
            visibilityStates.push({
              hexId: hexCell.hexId,
              blue: hexCell.visibility.visibleTo.blue,
              red: hexCell.visibility.visibleTo.red
            });
          }
        });
        return visibilityStates;
      },
      () => {
        // 更新所有部队可见性
        this.renderer.updateForceInstanceVisibility();
      },
      { deep: true } // 深度监听对象属性变化
    );

    // 监听六角格变化，当六角格数量发生变化时，同步 HexForceMapper
    this._stopHexWatch = watch(
      () => Array.from(this.store.hexCellMap.keys()),
      () => {
        this._syncHexForceMapper();
        // 更新部队可见性
        this.renderer.updateForceInstanceVisibility();
      }
    );

    return true;
  }

  // /**
  //  * 将 MilitaryPanelManager 挂载进来，以后从 this.panelManager 调用
  //  * @param {MilitaryPanelManager} pm
  //  */
  // setPanelManager(pm) {
  //   this.panelManager = pm;
  //   this._bindPanelCommands();
  // }

  /**
   * 初始化 HexForceMapper
   * @private
   */
  _initHexForceMapper() {
    const hexCells = this.store.getHexCells();
    const forces = this.store.getForces();
    HexForceMapper.initMapping(hexCells, forces);
  }

  /**
   * 同步 HexForceMapper 的映射关系
   * @private
   * @param {string[]} addedForceIds 新增的部队ID列表
   * @param {string[]} removedForceIds 已删除的部队ID列表
   */
  _syncHexForceMapper(addedForceIds, removedForceIds) {
    // 如果没有传入参数，则重新初始化所有映射关系
    if (!addedForceIds || !removedForceIds) {
      this._initHexForceMapper();
      return;
    }
    
    // 处理新增的部队，将它们与对应的六角格建立映射关系
    if (addedForceIds.length > 0) {
      addedForceIds.forEach(forceId => {
        const force = this.store.getForceById(forceId);
        if (force && force.hexId) {
          HexForceMapper.addForceById(forceId, force.hexId);
        }
      });
    }
    
    // 处理删除的部队，解除它们与六角格的映射关系
    if (removedForceIds.length > 0) {
      removedForceIds.forEach(forceId => {
        HexForceMapper.removeForceById(forceId);
      });
    }
  }

  /**
   * 初始化编队系统
   * @private
   */
  _initFormationSystem() {
    // 检查蓝方默认编队是否存在，不存在则创建
    if (!this.store.formationMap.has('FM_blue_default')) {
      const blueDefault = new Formation({
        formationId: 'FM_blue_default',  // 特殊ID，不使用自增ID
        formationName: '预备队',
        faction: 'blue',
        forceIdList: []
      });
      this.store.formationMap.set(blueDefault.formationId, blueDefault);
    }

    // 检查红方默认编队是否存在，不存在则创建
    if (!this.store.formationMap.has('FM_red_default')) {
      const redDefault = new Formation({
        formationId: 'FM_red_default',  // 特殊ID，不使用自增ID
        formationName: '预备队',
        faction: 'red',
        forceIdList: []
      });
      this.store.formationMap.set(redDefault.formationId, redDefault);
    }
    
    // 将所有未在编队中的部队加入对应阵营的默认编队
    const allForceIds = Array.from(this.store.forceMap.keys());
    const allForceInFormation = new Set();
    for (const formation of this.store.formationMap.values()) {
      formation.forceIdList.forEach(id => allForceInFormation.add(id));
    }
    allForceIds.forEach(forceId => {
      if (!allForceInFormation.has(forceId)) {
        const force = this.store.getForceById(forceId);
        if (force) {
          this.store.addForceToFormation(forceId, `FM_${force.faction}_default`);
        }
      }
    });
  }

  /**
   * 同步编队系统，并且让新创建的部队自动加入默认编队
   * @param {string[]} addedForceIds 新增的部队ID列表
   * @param {string[]} removedForceIds 已删除的部队ID列表
   * @private
   */
  _syncFormationSystem(addedForceIds, removedForceIds) {
    // 如果没有传入参数，则重新初始化编队系统
    if (!addedForceIds || !removedForceIds) {
      this._initFormationSystem();
      return;
    }
    
    // 从所有编队中移除已不存在的部队ID
    if (removedForceIds && removedForceIds.length > 0) {
      removedForceIds.forEach(forceId => {
        this.store.removeForceFromCurrentFormation(forceId);
      });
    }
    
    // 将新增的部队加入到对应阵营的默认编队中
    if (addedForceIds && addedForceIds.length > 0) {
      addedForceIds.forEach(forceId => {
        const force = this.store.getForceById(forceId);
        if (force) {
          this.store.addForceToFormation(forceId, `FM_${force.faction}_default`);
        }
      });
    }
  }

  // /**
  //  * 绑定面板命令
  //  * @private
  //  */
  // _bindPanelCommands() {
  //   /**
  //    * 移动命令
  //    * @param {string} forceId 部队ID
  //    * @param {string[]} path 路径（六角格ID数组）
  //    */
  //   this.panelManager.onMoveCommand = async ({ forceId, path }) => {
  //     try {
  //       // 1. 检查路径有效性
  //       if (!path || path.length < 2) {
  //         showWarning("路径过短，无法进行移动");
  //         return;
  //       }
        
  //       // 2. 获取部队
  //       const force = this.store.getForceById(forceId);
  //       if (!force) {
  //         showError(`未找到部队: ${forceId}`);
  //         return;
  //       }
        
  //       // 3. 计算行动力消耗
  //       const actionPointCost = force.computeActionPointsForPath(path);
        
  //       // 4. 检查行动力是否足够
  //       if (actionPointCost > force.actionPoints) {
  //         showWarning(`行动力不足. 需要: ${actionPointCost}, 剩余: ${force.actionPoints}`);
  //         return;
  //       }
        
  //       // 6. 更新行动力
  //       force.consumeActionPoints(actionPointCost);
        
  //       // 7. 在渲染器中执行移动动画
  //       const isMoving = await this.renderer.moveForceAlongPath(forceId, path);

  //       // 8. 更新部队在六角格中的位置
  //       if (isMoving) {
  //         HexForceMapper.moveForceToHex(forceId, path[path.length - 1]);
  //       }
        
  //       showSuccess(`部队 ${forceId} 开始移动，消耗行动力 ${actionPointCost}`);
  //     } catch (error) {
  //       showError(`移动命令执行失败: ${error.message}`);
  //     }
  //   };

  //   /**
  //    * 攻击命令
  //    * @param {string} commandForceId 指挥部队ID
  //    * @param {string} targetHex 目标六角格ID
  //    * @param {string[]} supportForceIds 支援部队ID数组
  //    */
  //   this.panelManager.onAttackCommand = async ({ commandForceId, targetHex, supportForceIds }) => {
      
  //   };

  //   /**
  //    * 创建部队命令
  //    * @param {Object} forceData 部队初始数据的PlainObject形式
  //    * forceData: {
  //    *   forceName: string,
  //    *   faction: string,
  //    *   service: string,
  //    *   hexId: string,
  //    *   composition: Array<Object>
  //    * }
  //    */
  //   this.panelManager.onCreateForce = async ({ forceData }) => {
  //     try {
  //       // 创建部队
  //       const force = new Force({
  //         forceName: forceData.forceName,
  //         faction: forceData.faction,
  //         service: forceData.service,
  //         hexId: forceData.hexId,
  //         composition: forceData.composition
  //       });
  //       // 添加到Store
  //       this.store.addForce(force);
        
  //       showSuccess(`创建部队成功: ${force.forceId}`);
  //     } catch (error) {
  //       showError(`创建部队时发生错误: ${error.message}`);
  //     }
  //   };

  //   /**
  //    * 合并部队命令
  //    * @param {string} hexId 六角格ID
  //    * @param {string[]} forceIds 部队ID数组
  //    */
  //   this.panelManager.onMergeForces = async ({ hexId, forceIds }) => {
  //     try {
  //       // 从 Store 中移除原部队
  //       forceIds.forEach(fid => {
  //         this.store.forceMap.delete(fid);
  //         HexForceMapper.removeForceById(fid);
  //       });

  //       // 添加新部队到 Store
  //       const newForce = res.data.new_force;
  //       this.store.addForce(newForce);
  //       HexForceMapper.addForceById(newForce.force_id, hexId);
        
  //       // 添加到默认编队
  //       this._addForceToFormation(newForce);
        
  //       showSuccess(`合并部队成功: ${forceIds.join(',')}`);
  //     } catch (error) {
  //       showError(`合并部队时发生错误: ${error.message}`);
  //     }
  //   };

  //   /**
  //    * 拆分部队命令
  //    * @param {string} forceId 部队ID
  //    * @param {string[]} splitDetails 拆分后的部队
  //    */
  //   this.panelManager.onSplitForce = async ({ forceId, splitDetails }) => {
  //     try {
  //       // 实现拆分部队逻辑
  //       const res = await API.splitForce(forceId, splitDetails);
        
  //       if (res.status === "success") {
  //         // 从 Store 中移除原部队
  //         this.store.forceMap.delete(forceId);
  //         HexForceMapper.removeForceById(forceId);
  
  //         // 添加新部队到 Store
  //         const hexId = this.store.getForceById(forceId)?.hexId;
  //         res.data.new_forces.forEach(newForce => {
  //           this.store.addForce(newForce);
  //           if (hexId) {
  //             HexForceMapper.addForceById(newForce.force_id, hexId);
  //           }
            
  //           // 添加到默认编队
  //           this._addForceToFormation(newForce);
  //         });
          
  //         showSuccess(`拆分部队成功: ${forceId}`);
  //       } else {
  //         showError(`拆分部队失败: ${res.message}`);
  //       }
  //     } catch (error) {
  //       showError(`拆分部队时发生错误: ${error.message}`);
  //     }
  //   };

  //   /**
  //    * 删除编队命令
  //    * @param {string} formationId 编队ID
  //    */
  //   this.panelManager.onDeleteFormation = (formationId) => {
  //     try {
  //       const formation = this.store.formationMap.get(formationId);
  //       if (formation && formation.forceIdList.length === 0) {
  //         this.store.formationMap.delete(formationId);
  //         showSuccess(`删除编队成功: ${formationId}`);
  //       } else {
  //         showWarning(`无法删除非空编队: ${formationId}`);
  //       }
  //     } catch (error) {
  //       showError(`删除编队时发生错误: ${error.message}`);
  //     }
  //   };
  // }

  /**
   * 销毁管理器及所有相关资源
   */
  destroy() {
    if (this._stopForceWatch) {
      this._stopForceWatch();
      this._stopForceWatch = null;
    }
    if (this._stopHexWatch) {
      this._stopHexWatch();
      this._stopHexWatch = null;
    }
    if (this._stopFactionWatch) {
      this._stopFactionWatch();
      this._stopFactionWatch = null;
    }
    if (this._stopHexVisibilityWatch) {
      this._stopHexVisibilityWatch();
      this._stopHexVisibilityWatch = null;
    }
    
    this.renderer?.dispose();
    this.loader?.dispose();
    this.panelManager?.destroy?.();
    
    // 清理单例
    MilitaryManager.#instance = null;
  }
}
