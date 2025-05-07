// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { ModelTemplateLoader } from './components/ModelTemplateLoader';
import { MilitaryInstanceRenderer } from './components/MilitaryInstanceRenderer';
import { HexForceMapper } from '@/layers/interaction-layer/utils/HexForceMapper';
// import { showWarning, showError, showSuccess } from '@/layers/interaction-layer/utils/MessageBox';
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
    this.renderer.updateHexObjectVisibility();

    // 监听部队变化，当部队发生增删时同步
    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newForceIds, oldForceIds) => {
        // 计算新增和删除的部队ID
        const addedForceIds = newForceIds.filter(id => !oldForceIds.includes(id));
        const removedForceIds = oldForceIds.filter(id => !newForceIds.includes(id));
        // 更新新增和删除部队与六角格的位置映射
        this._syncHexForceMapper(addedForceIds, removedForceIds);
        // 更新编队中的部队
        this._syncFormationSystem(addedForceIds, removedForceIds);
        // 更新部队实例
        this.renderer.updateForceInstance(newForceIds, removedForceIds);
        // 更新现存部队实例的可见性
        this.renderer.updateHexObjectVisibility();
      }
    );

    // 监听阵营变化，更新部队可见性
    this._stopFactionWatch = watch(
      () => this.store.currentFaction,
      () => {
        // 更新所有部队可见性
        this.renderer.updateHexObjectVisibility();
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
        this.renderer.updateHexObjectVisibility();
      },
      { deep: true } // 深度监听对象属性变化
    );

    // 监听六角格变化，当六角格数量发生变化时，同步 HexForceMapper
    this._stopHexWatch = watch(
      () => Array.from(this.store.hexCellMap.keys()),
      () => {
        this._syncHexForceMapper();
        // 更新部队可见性
        this.renderer.updateHexObjectVisibility();
      }
    );

    return true;
  }

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
    
    // 如果新增部队没有编队，将新增的部队加入到对应阵营的默认编队中
    if (addedForceIds && addedForceIds.length > 0) {
      addedForceIds.forEach(forceId => {
        let isInFormation = false;
        for (const formation of this.store.formationMap.values()) {
          if (formation.forceIdList.includes(forceId)) {
            isInFormation = true;
            break;
          }
        }
        if (!isInFormation) {
          const force = this.store.getForceById(forceId);
          if (force) {
            this.store.addForceToFormation(forceId, `FM_${force.faction}_default`);
          }
        }
      });
    }
  }

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
    
    // 清理单例
    MilitaryManager.#instance = null;
  }
}
