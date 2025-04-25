// eslint-disable-next-line no-unused-vars
import * as Cesium from "cesium";
import { watch } from 'vue';
import { openGameStore } from '@/store';
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { ModelTemplateLoader } from './components/ModelTemplateLoader';
import { MilitaryInstanceRenderer } from './components/MilitaryInstanceRenderer';
// eslint-disable-next-line no-unused-vars
import { MilitaryPanelManager } from '@/layers/interaction-layer/MilitaryPanelManager';
import { HexForceMapper } from '@/layers/interaction-layer/HexForceMapper';
import { API } from "@/services/api";

/**
 * 军事单位管理器
 *
 * 主要职责：
 *  1. 模板预加载 (Loader)
 *  2. 模型实例化渲染 (Renderer)
 *  3. Pinia forceMap 数据同步
 *  4. 交互面板 (PanelManager) 命令回调对接
 *  5. 维护 HexForceMapper 映射关系
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
    this.renderer = null;
    this.panelManager = null;
    
    this._stopForceWatch = null;
    this._stopHexWatch = null;
  }

  async init(onProgress) {
    // 初始化 HexForceMapper
    this._initHexForceMapper();

    // 初始化编队系统
    this._initFormationSystem();

    // 初始化模型加载器
    this.loader = ModelTemplateLoader.getInstance(this.viewer);
    await this.loader.preloadModelTemplates(onProgress);

    // 初始化模型渲染器
    this.renderer = MilitaryInstanceRenderer.getInstance(this.viewer);
    this.renderer.regenerateAllForceInstances();

    // 监听部队变化，当部队数量发生变化时，同步渲染器和 HexForceMapper
    this._stopForceWatch = watch(
      () => Array.from(this.store.forceMap.keys()),
      (newForceIds, oldForceIds) => {
        this.renderer.syncForcesChange(newForceIds, oldForceIds);
        this._syncHexForceMapper();
      }
    );

    // 监听六角格变化，当六角格数量发生变化时，同步 HexForceMapper
    this._stopHexWatch = watch(
      () => Array.from(this.store.hexCellMap.keys()),
      () => this._syncHexForceMapper()
    );

    this._bindPanelCommands();
    return true;
  }

  /**
   * 将 MilitaryPanelManager 挂载进来，以后从 this.panelManager 调用
   * @param {MilitaryPanelManager} pm
   */
  setPanelManager(pm) {
    this.panelManager = pm;
    this._bindPanelCommands();
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
   */
  _syncHexForceMapper() {
    const hexCells = this.store.getHexCells();
    const forces = this.store.getForces();
    HexForceMapper.initMapping(hexCells, forces);
  }

  /**
   * 初始化编队系统
   * @private
   */
  _initFormationSystem() {
    // 创建蓝方默认编队
    const blueDefault = new Formation({
      formationId: 'FM_blue_default',  // 特殊ID，不使用自增ID
      formationName: '蓝方预备队',
      faction: 'blue',
      forceIdList: []
    });
    this.store.formationMap.set(blueDefault.formationId, blueDefault);

    // 创建红方默认编队
    const redDefault = new Formation({
      formationId: 'FM_red_default',  // 特殊ID，不使用自增ID
      formationName: '红方预备队',
      faction: 'red',
      forceIdList: []
    });
    this.store.formationMap.set(redDefault.formationId, redDefault);

    // 将现有部队分配到对应阵营的默认编队中
    this.store.forceMap.forEach(force => {
      const defaultFormationId = `FM_${force.faction}_default`;
      const defaultFormation = this.store.formationMap.get(defaultFormationId);
      if (defaultFormation && !defaultFormation.forceIdList.includes(force.forceId)) {
        defaultFormation.forceIdList.push(force.forceId);
      }
    });
  }

  /**
   * 创建新部队时，将其添加到指定编队
   * @param {Force} force 新创建的部队
   * @param {string} formationId 目标编队ID，如果不指定则添加到默认编队
   */
  _addForceToFormation(force, formationId = null) {
    const targetFormationId = formationId || `FM_${force.faction}_default`;
    const formation = this.store.formationMap.get(targetFormationId);
    
    if (formation && formation.faction === force.faction) {
      if (!formation.forceIdList.includes(force.forceId)) {
        formation.forceIdList.push(force.forceId);
      }
    }
  }

  /**
   * 绑定面板命令
   * @private
   */
  _bindPanelCommands() {
    /**
     * 移动命令
     * @param {string} forceId 部队ID
     * @param {string[]} path 路径（六角格ID数组）
     */
    this.panelManager.onMoveCommand = async ({ forceId, path }) => {
      try {
        // 1. 检查路径有效性
        if (!path || path.length < 2) {
          console.warn("路径过短，无法进行移动");
          return;
        }
        
        // 2. 获取部队
        const force = this.store.getForceById(forceId);
        if (!force) {
          console.error(`未找到部队: ${forceId}`);
          return;
        }
        
        // 3. 计算行动力消耗
        const actionPointCost = force.computeActionPointsForPath(path);
        
        // 4. 检查行动力是否足够
        if (actionPointCost > force.actionPoints) {
          console.warn(`行动力不足. 需要: ${actionPointCost}, 剩余: ${force.actionPoints}`);
          return;
        }
        
        // 5. 调用API（实际可能是后端验证）
        const res = await API.move(forceId, path);
        
        if (res.status === "success") {
          // 6. 更新行动力
          force.consumeActionPoints(actionPointCost);
          
          // 7. 在渲染器中执行移动动画
          this.renderer.moveForceAlongPath(forceId, path);
          
          console.log(`部队 ${forceId} 开始移动，消耗行动力 ${actionPointCost}`);
        } else {
          console.error(`移动失败: ${res.message}`);
        }
      } catch (error) {
        console.error("移动部队时发生错误:", error);
      }
    };

    /**
     * 攻击命令
     * @param {string} commandForceId 指挥部队ID
     * @param {string} targetHex 目标六角格ID
     * @param {string[]} supportForceIds 支援部队ID数组
     */
    this.panelManager.onAttackCommand = async ({ commandForceId, targetHex, supportForceIds }) => {
      try {
        // 此处实现攻击逻辑，包含后端验证、战斗解算等
        const res = await API.attack(commandForceId, targetHex, supportForceIds);
        
        if (res.status === "success") {
          // 处理战斗结果
          console.log(`部队 ${commandForceId} 攻击 ${targetHex} 成功`);
          
          // 更新部队状态（兵力损失等）
          const { losses } = res.data;
          
          // 更新指挥部队
          const commandForce = this.store.getForceById(commandForceId);
          if (commandForce) {
            commandForce.troopStrength = Math.max(0, commandForce.troopStrength - losses.attacker);
          }
  
          // 更新支援部队
          supportForceIds.forEach(id => {
            const force = this.store.getForceById(id);
            if (force) {
              force.troopStrength = Math.max(0, force.troopStrength - losses.attacker);
            }
          });
        } else {
          console.error(`攻击失败: ${res.message}`);
        }
      } catch (error) {
        console.error("攻击目标时发生错误:", error);
      }
    };

    /**
     * 创建部队命令
     * @param {string} hexId 六角格ID
     * @param {string} faction 阵营
     * @param {string} composition 部队组成
     * @param {string} formationId 目标编队ID，如果不指定则添加到默认编队
     */
    this.panelManager.onCreateForce = async ({ hexId, faction, composition, formationId }) => {
      try {
        // 实现创建部队逻辑
        const force = new Force({
          forceName: `${faction}部队_${Date.now()}`,
          faction: faction,
          hexId: hexId,
          composition: composition
        });
        
        const res = await API.createForce(hexId, faction, composition, formationId);
        
        if (res.status === "success") {
          // 添加到Store
          this.store.addForce(force);
          
          if (formationId) {
            // 添加到编队
            const formation = this.store.formationMap.get(formationId);
            if (formation) {
              formation.forceIdList.push(force.forceId);
            }
          } else {
            // 添加到默认编队
            this._addForceToFormation(force);
          }
          
          console.log(`创建部队成功: ${force.forceId}`);
        } else {
          console.error(`创建部队失败: ${res.message}`);
        }
      } catch (error) {
        console.error("创建部队时发生错误:", error);
      }
    };

    /**
     * 合并部队命令
     * @param {string} hexId 六角格ID
     * @param {string[]} forceIds 部队ID数组
     */
    this.panelManager.onMergeForces = async ({ hexId, forceIds }) => {
      try {
        // 实现合并部队逻辑
        const res = await API.mergeForces(hexId, forceIds);
        
        if (res.status === "success") {
          // 从 Store 中移除原部队
          forceIds.forEach(fid => {
            this.store.forceMap.delete(fid);
            HexForceMapper.removeForceById(fid);
          });
  
          // 添加新部队到 Store
          const newForce = res.data.new_force;
          this.store.addForce(newForce);
          HexForceMapper.addForceById(newForce.force_id, hexId);
          
          // 添加到默认编队
          this._addForceToFormation(newForce);
          
          console.log(`合并部队成功: ${forceIds.join(',')}`);
        } else {
          console.error(`合并部队失败: ${res.message}`);
        }
      } catch (error) {
        console.error("合并部队时发生错误:", error);
      }
    };

    /**
     * 拆分部队命令
     * @param {string} forceId 部队ID
     * @param {string[]} splitDetails 拆分后的部队
     */
    this.panelManager.onSplitForce = async ({ forceId, splitDetails }) => {
      try {
        // 实现拆分部队逻辑
        const res = await API.splitForce(forceId, splitDetails);
        
        if (res.status === "success") {
          // 从 Store 中移除原部队
          this.store.forceMap.delete(forceId);
          HexForceMapper.removeForceById(forceId);
  
          // 添加新部队到 Store
          const hexId = this.store.getForceById(forceId)?.hexId;
          res.data.new_forces.forEach(newForce => {
            this.store.addForce(newForce);
            if (hexId) {
              HexForceMapper.addForceById(newForce.force_id, hexId);
            }
            
            // 添加到默认编队
            this._addForceToFormation(newForce);
          });
          
          console.log(`拆分部队成功: ${forceId}`);
        } else {
          console.error(`拆分部队失败: ${res.message}`);
        }
      } catch (error) {
        console.error("拆分部队时发生错误:", error);
      }
    };

    /**
     * 删除编队命令
     * @param {string} formationId 编队ID
     */
    this.panelManager.onDeleteFormation = (formationId) => {
      try {
        const formation = this.store.formationMap.get(formationId);
        if (formation && formation.forceIdList.length === 0) {
          this.store.formationMap.delete(formationId);
          console.log(`删除编队成功: ${formationId}`);
        } else {
          console.warn(`无法删除非空编队: ${formationId}`);
        }
      } catch (error) {
        console.error("删除编队时发生错误:", error);
      }
    };
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
    
    this.renderer?.dispose();
    this.loader?.dispose();
    this.panelManager?.destroy?.();
    
    // 清理单例
    MilitaryManager.#instance = null;
  }
}
