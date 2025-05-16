/* eslint-disable no-unused-vars */
// src\layers\scene-layer\components\FogOfWarManager.js

import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexForceMapper } from '@/layers/interaction-layer/utils/HexForceMapper';
import { HexGridRenderer } from './HexGridRenderer';
import { HexVisualStyles } from '@/config/HexVisualStyles';
import { computed, watch, reactive } from "vue";
import { HexConfig } from '@/config/GameConfig';

/**
 * 战争迷雾管理器 - 优化版
 * 
 * 主要职责：
 * 1. 计算并更新战场中各个六角格的可见性
 * 2. 根据部队视野范围更新迷雾效果
 * 3. 处理视野阻挡和共享视野
 * 
 * 优化特性：
 * 1. 使用异步计算，避免阻塞主线程
 * 2. 增量更新，只计算有变化的部分
 * 3. 视野缓存，减少重复计算
 * 4. 批处理，提高大范围更新性能
 */
export class FogOfWarManager {
  static #instance = null;

  /**
   * 获取 FogOfWarManager 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {FogOfWarManager} 单例实例
   */
  static getInstance(viewer) {
    if (!FogOfWarManager.#instance) {
      if (!viewer) {
        throw new Error('首次创建 FogOfWarManager 实例时必须提供 viewer 参数');
      }
      FogOfWarManager.#instance = new FogOfWarManager(viewer);
    }
    return FogOfWarManager.#instance;
  }

  /**
   * 构造函数
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    // 存储计算结果 - 使用reactive使其响应式
    this.visibleHexIds = reactive({
      blue: new Set(),
      red: new Set()
    });
    
    // 当前玩家阵营
    this.currentFaction = computed(() => this.store.currentFaction);
    
    // 处理状态
    this.isUpdating = false;          // 是否正在更新
    this.pendingUpdate = false;       // 是否有待处理的更新
    this.lastUpdateTime = 0;          // 上次更新时间
    this.updateTimeout = null;        // 更新延时器
    this.updateBatchSize = 10;        // 每批处理的部队数量
    this.minUpdateInterval = 100;     // 最小更新间隔(毫秒)
    
    // 缓存
    this.forcePositionCache = new Map();    // 部队位置缓存
    this.hexVisibilityCache = new Map();    // 视线计算缓存
    this.forcesSnapshot = null;             // 上次计算时的部队快照
    
    // 六角格可见性变化时添加的视觉样式
    this.fogStyle = HexVisualStyles.invisible;
    
    // 调试相关
    this.debugEntities = [];          // 调试实体
    this.debugOptions = {
      enabled: false,                 // 是否启用调试模式
      visualizeShape: false,          // 是否可视化视野形状
      ignoreTerrain: false,           // 是否忽略地形阻挡
      showRadius: 1.5                 // 视野范围倍数
    };
    
    // 监听回合变化和游戏状态变化
    this._setupWatchers();
    
    // 初始化
    this._init();
  }

  /**
   * 初始化
   * @private
   */
  _init() {
    // 默认启用调试模式，方便查看视野范围
    // 视野倍数调整为1.0，不忽略地形，使用射线检测
    this.enableDebug(true, 1.0, false, false);
    
    // 存储默认检测方法引用
    this._originalHasLineOfSightAsync = null;
    
    // 初始计算
    this.updateFogOfWar(true);
    
    // 设置定期更新(轻量级检查，不是完整计算)
    setInterval(() => this._checkForChanges(), 1000);
  }

  /**
   * 设置各种监听器
   * @private
   */
  _setupWatchers() {
    // 监听回合变化
    watch(
      () => this.store.currentRound,
      () => this.scheduleUpdate()
    );
    
    // 监听阵营变化
    watch(
      () => this.currentFaction.value,
      () => this._applyFogOfWarEffect() // 仅更新显示效果，不重新计算可见性
    );
    
    // 监听部队数量变化
    watch(
      () => this.store.getForces().length,
      () => this.scheduleUpdate()
    );

    // 监听部队位置变化
    this._setupForceMapperWatcher();
    
    // 监听六角格变化(筛选重要属性)
    watch(
      () => {
        const hexCells = this.store.getHexCells();
        return hexCells.map(hex => ({
          id: hex.hexId,
          terrainType: hex.terrainAttributes?.terrainType,
          elevation: hex.terrainAttributes?.elevation
        }));
      },
      () => this.scheduleUpdate(),
      { deep: true }
    );
  }

  /**
   * 设置监听部队位置映射变化
   * @private
   */
  _setupForceMapperWatcher() {
    // 代理HexForceMapper的moveForceToHex方法
    const originalMoveForceToHex = HexForceMapper.moveForceToHex;
    HexForceMapper.moveForceToHex = (forceId, newHexId) => {
      const oldHexId = HexForceMapper.getHexByForceId(forceId);
      const result = originalMoveForceToHex.call(HexForceMapper, forceId, newHexId);
      
      if (result) {
        // 移动成功，立即标记这两个区域需要更新
        this._invalidateAreaCache(oldHexId);
        this._invalidateAreaCache(newHexId);
        // 安排更新
        this.scheduleUpdate();
      }
      return result;
    };
    
    // 监听部队添加
    const originalAddForceById = HexForceMapper.addForceById;
    HexForceMapper.addForceById = (forceId, hexId) => {
      const result = originalAddForceById.call(HexForceMapper, forceId, hexId);
      if (result) {
        this._invalidateAreaCache(hexId);
        this.scheduleUpdate();
      }
      return result;
    };
    
    // 监听部队移除
    const originalRemoveForceById = HexForceMapper.removeForceById;
    HexForceMapper.removeForceById = (forceId) => {
      const hexId = HexForceMapper.getHexByForceId(forceId);
      const result = originalRemoveForceById.call(HexForceMapper, forceId);
      if (result) {
        this._invalidateAreaCache(hexId);
        this.scheduleUpdate();
      }
      return result;
    };
  }
  
  /**
   * 使某个区域的缓存失效
   * @param {string} hexId - 中心六角格ID
   * @private
   */
  _invalidateAreaCache(hexId) {
    if (!hexId) return;
    
    const cell = this.store.getHexCellById(hexId);
    if (!cell) return;
    
    // 最大视野范围(估计值)
    const maxRadius = 10;
    
    // 获取该区域内所有可能受影响的六角格
    try {
      const affectedHexes = cell.getHexCellInRange(maxRadius);
      
      // 使这些六角格的视线缓存失效
      affectedHexes.forEach(hex => {
        if (hex && hex.hexId) {
          this.hexVisibilityCache.delete(hex.hexId);
        }
      });
    } catch (error) {
      console.error('[FogOfWarManager] 使缓存失效时出错:', error);
    }
  }

  /**
   * 安排一个延迟更新，防止频繁计算
   */
  scheduleUpdate() {
    // 如果已经在排队，则不重复排队
    if (this.updateTimeout) return;
    
    // 如果正在更新，则标记有待处理的更新
    if (this.isUpdating) {
      this.pendingUpdate = true;
      return;
    }
    
    // 计算距离上次更新的时间
    const now = Date.now();
    const elapsed = now - this.lastUpdateTime;
    
    // 如果距离上次更新时间太短，则延迟更新
    if (elapsed < this.minUpdateInterval) {
      const delay = this.minUpdateInterval - elapsed;
      this.updateTimeout = setTimeout(() => {
        this.updateTimeout = null;
        this.updateFogOfWar();
      }, delay);
    } else {
      // 否则直接更新
      this.updateFogOfWar();
    }
  }

  /**
   * 更新战争迷雾 - 入口函数
   * @param {boolean} [force=false] - 是否强制完全更新
   */
  async updateFogOfWar(force = false) {
    // 防止重入
    if (this.isUpdating) {
      this.pendingUpdate = true;
      return;
    }
    
    try {
      this.isUpdating = true;
      this.lastUpdateTime = Date.now();
      
      console.log('[FogOfWarManager] 开始更新战争迷雾');
      
      // 获取所有部队，并按阵营分组
      const allForces = this.store.getForces();
      const forcesByFaction = {
        blue: allForces.filter(force => force.faction === 'blue'),
        red: allForces.filter(force => force.faction === 'red')
      };
      
      // 检查部队位置是否发生变化
      const needFullUpdate = force || this._hasSignificantChanges(allForces);
      
      // 更新视野范围缓存
      if (needFullUpdate) {
        this.forcePositionCache.clear();
        allForces.forEach(force => {
          this.forcePositionCache.set(force.forceId, {
            hexId: force.hexId,
            radius: force.visibilityRadius || 0
          });
        });
      }
      
      // 清除调试实体
      this._clearDebugEntities();
      
      // 如果启用了调试模式，显示所有部队的视野范围
      if (this.debugOptions.enabled) {
        await this._showDebugVisualizations(allForces);
      }
      
      // 为每个阵营异步更新可见性
      await Promise.all([
        this._updateFactionVisibility('blue', forcesByFaction.blue, needFullUpdate),
        this._updateFactionVisibility('red', forcesByFaction.red, needFullUpdate)
      ]);
      
      // 更新快照
      this.forcesSnapshot = JSON.stringify(
        allForces.map(f => ({ id: f.forceId, hex: f.hexId, radius: f.visibilityRadius || 0 }))
      );
      
      // 应用战争迷雾效果
      this._applyFogOfWarEffect();
      
      // 请求重新渲染
      this.viewer.scene.requestRender();
      
      console.log('[FogOfWarManager] 战争迷雾更新完成');
    } catch (error) {
      console.error('[FogOfWarManager] 更新战争迷雾出错:', error);
    } finally {
      this.isUpdating = false;
      
      // 如果有待处理的更新，继续更新
      if (this.pendingUpdate) {
        this.pendingUpdate = false;
        // 短暂延迟，避免连续计算
        setTimeout(() => this.updateFogOfWar(), 50);
      }
    }
  }
  
  /**
   * 检查部队位置是否发生重大变化
   * @param {Array} forces - 当前部队列表
   * @returns {boolean} 是否有重大变化
   * @private
   */
  _hasSignificantChanges(forces) {
    if (!this.forcesSnapshot) return true;
    
    // 简单比较快照
    const currentSnapshot = JSON.stringify(
      forces.map(f => ({ id: f.forceId, hex: f.hexId, radius: f.visibilityRadius || 0 }))
    );
    
    return this.forcesSnapshot !== currentSnapshot;
  }
  
  /**
   * 检查是否需要更新
   * 轻量级检查，定期执行
   * @private
   */
  _checkForChanges() {
    // 如果已经在更新或有待处理的更新，则跳过
    if (this.isUpdating || this.pendingUpdate || this.updateTimeout) return;
    
    // 获取所有部队
    const allForces = this.store.getForces();
    
    // 检查部队位置是否发生变化
    if (this._hasSignificantChanges(allForces)) {
      this.scheduleUpdate();
    }
  }

  /**
   * 更新指定阵营的可见性
   * @param {string} faction - 阵营名称
   * @param {Array} forces - 该阵营的部队
   * @param {boolean} fullUpdate - 是否进行完整更新
   * @private
   */
  async _updateFactionVisibility(faction, forces, fullUpdate) {
    // 如果是完整更新，则清空可见性集合
    if (fullUpdate) {
      this.visibleHexIds[faction].clear();
    }
    
    // 如果没有部队，则直接返回
    if (!forces || forces.length === 0) return;
    
    // 创建一个新的可见六角格集合
    const newVisibleHexes = new Set();
    
    // 分批处理部队
    for (let i = 0; i < forces.length; i += this.updateBatchSize) {
      const batch = forces.slice(i, i + this.updateBatchSize);
      
      // 处理当前批次部队的视野
      await this._processForcesBatch(batch, newVisibleHexes);
      
      // 让出主线程
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // 更新可见六角格集合
    newVisibleHexes.forEach(hexId => {
      this.visibleHexIds[faction].add(hexId);
    });
  }
  
  /**
   * 分批处理部队视野
   * @param {Array} forcesBatch - 当前批次的部队
   * @param {Set} visibleHexes - 可见六角格集合
   * @private
   */
  async _processForcesBatch(forcesBatch, visibleHexes) {
    // 创建处理Promise数组
    const promises = forcesBatch.map(force => this._processSingleForceVisibility(force, visibleHexes));
    
    // 等待所有处理完成
    await Promise.all(promises);
  }
  
  /**
   * 处理单个部队的视野
   * @param {Object} force - 部队对象
   * @param {Set} visibleHexes - 可见六角格集合
   * @private
   */
  async _processSingleForceVisibility(force, visibleHexes) {
    const hexId = force.hexId;
    if (!hexId) return;
    
    // 部队所在六角格一定可见
    visibleHexes.add(hexId);
    
    // 获取部队的视野范围
    const viewRadius = force.visibilityRadius || 0;
    if (viewRadius <= 0) return;
    
    // 尝试使用缓存
    const cacheKey = `${force.forceId}_${hexId}_${viewRadius}`;
    if (this.hexVisibilityCache.has(cacheKey)) {
      const cachedVisibility = this.hexVisibilityCache.get(cacheKey);
      cachedVisibility.forEach(id => visibleHexes.add(id));
      return;
    }
    
    // 获取中心六角格
    const centerHex = this.store.getHexCellById(hexId);
    if (!centerHex) return;
    
    try {
      // 使用getHexCellInRange获取指定范围内的六角格
      const hexesInRange = await this._getHexCellInRangeAsync(centerHex, viewRadius);
      
      // 检查每个六角格的可见性
      const visibleFromForce = new Set();
      for (const targetHex of hexesInRange) {
        if (!targetHex) continue;
        
        // 检查是否有视线
        if (this.debugOptions.ignoreTerrain || await this._hasLineOfSightAsync(centerHex, targetHex)) {
          visibleHexes.add(targetHex.hexId);
          visibleFromForce.add(targetHex.hexId);
        }
        
        // 定期让出主线程
        if (hexesInRange.indexOf(targetHex) % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // 缓存结果
      this.hexVisibilityCache.set(cacheKey, visibleFromForce);
    } catch (error) {
      console.error(`[FogOfWarManager] 处理部队${force.forceId}视野时出错:`, error);
    }
  }
  
  /**
   * 异步获取指定范围内的六角格
   * @param {Object} centerHex - 中心六角格
   * @param {number} radius - 半径
   * @returns {Promise<Array>} 范围内的六角格数组
   * @private
   */
  async _getHexCellInRangeAsync(centerHex, radius) {
    return new Promise((resolve, reject) => {
      try {
        // 地形类型对视野范围的额外加成
        let terrainBonus = 0;
        const terrainType = centerHex.terrainAttributes?.terrainType || 'plain';
        
        if (terrainType === 'mountain') {
          terrainBonus = 2; // 山地视野加成
        } else if (terrainType === 'hill') {
          terrainBonus = 1; // 丘陵视野加成
        }
        
        // 调试模式下使用用户设置的倍数
        let actualRadius = radius;
        if (this.debugOptions.enabled) {
          actualRadius = Math.ceil(radius * this.debugOptions.showRadius);
        }
        
        // 应用地形加成和最小范围保证
        actualRadius = Math.max(actualRadius + terrainBonus, 3);
        
        // 使用同步方法，但在Promise中执行
        const hexesInRange = centerHex.getHexCellInRange(actualRadius);
        resolve(hexesInRange);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 清除所有调试实体
   * @private
   */
  _clearDebugEntities() {
    if (this.debugEntities.length > 0) {
      for (const entity of this.debugEntities) {
        this.viewer.entities.remove(entity);
      }
      this.debugEntities = [];
    }
  }
  
  /**
   * 显示调试可视化
   * @param {Array} forces - 所有部队
   * @private
   */
  async _showDebugVisualizations(forces) {
    if (!this.debugOptions.enabled) return;
    
    // 确保清除旧的实体
    this._clearDebugEntities();
    
    // 为每个部队创建视野范围可视化
    for (const force of forces) {
      const hexId = force.hexId;
      if (!hexId) continue;
      
      const viewRadius = force.visibilityRadius || 0;
      if (viewRadius <= 0) continue;
      
      await this._visualizeViewRadius(hexId, viewRadius, force.faction);
    }
  }
  
  /**
   * 可视化部队的视野范围，用于调试
   * @param {string} hexId - 中心六角格ID
   * @param {number} radius - 视野半径
   * @param {string} faction - 阵营
   * @private
   */
  async _visualizeViewRadius(hexId, radius, faction) {
    // 获取中心六角格
    const centerHex = this.store.getHexCellById(hexId);
    if (!centerHex) return;
    
    // 获取中心点
    const center = centerHex.getCenter();
    
    // 创建中心标记
    const centerEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        center.longitude, 
        center.latitude, 
        center.height + 5
      ),
      ellipse: {
        semiMajorAxis: HexConfig.radius * 0.5,
        semiMinorAxis: HexConfig.radius * 0.5,
        height: 5,
        material: faction === 'blue' 
          ? new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.7))
          : new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.7)),
        outline: true,
        outlineColor: Cesium.Color.WHITE
      }
    });
    
    this.debugEntities.push(centerEntity);
    
    // 视野范围(使用扩展半径)
    const actualRadius = Math.ceil(radius * this.debugOptions.showRadius);
    
    try {
      // 获取视野范围内的六角格
      const hexesInRange = await this._getHexCellInRangeAsync(centerHex, radius);
      
      // 创建视野范围可视化
      const rangeEntity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          center.longitude, 
          center.latitude, 
          center.height + 2
        ),
        ellipse: {
          semiMajorAxis: HexConfig.radius * (actualRadius + 0.5),
          semiMinorAxis: HexConfig.radius * (actualRadius + 0.5),
          height: 2,
          material: faction === 'blue' 
            ? new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.2))
            : new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.2)),
          outline: true,
          outlineColor: faction === 'blue' ? Cesium.Color.BLUE : Cesium.Color.RED
        }
      });
      
      this.debugEntities.push(rangeEntity);
      
      // 高亮视野范围内的六角格
      for (const hex of hexesInRange) {
        if (!hex) continue;
        
        const hexCenter = hex.getCenter();
        const hexEntity = this.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            hexCenter.longitude, 
            hexCenter.latitude, 
            hexCenter.height + 1
          ),
          ellipse: {
            semiMajorAxis: HexConfig.radius * 0.7,
            semiMinorAxis: HexConfig.radius * 0.7,
            height: 1,
            material: faction === 'blue' 
              ? new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.1))
              : new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.1))
          }
        });
        
        this.debugEntities.push(hexEntity);
      }
    } catch (error) {
      console.error(`[FogOfWarManager] 创建视野可视化出错:`, error);
    }
  }
  
  /**
   * 异步检查两个六角格之间是否有视线
   * @param {Object} fromHex - 起始六角格
   * @param {Object} toHex - 目标六角格
   * @returns {Promise<boolean>} 是否有视线
   * @private
   */
  async _hasLineOfSightAsync(fromHex, toHex) {
    return new Promise((resolve) => {
      // 如果是同一个六角格，肯定有视线
      if (fromHex.hexId === toHex.hexId) {
        resolve(true);
        return;
      }
      
      // 调试模式下，忽略地形阻挡
      if (this.debugOptions.ignoreTerrain) {
        resolve(true);
        return;
      }
      
      // 在微任务队列中执行，让出主线程
      setTimeout(() => {
        try {
          // 使用射线判断视线
          const hasLineOfSight = this._rayLineOfSight(fromHex, toHex);
          resolve(hasLineOfSight);
        } catch (error) {
          console.error('[FogOfWarManager] 视线检测出错:', error);
          resolve(false);
        }
      }, 0);
    });
  }
  
  /**
   * 使用射线检测两点之间的视线
   * @param {Object} fromHex - 起始六角格
   * @param {Object} toHex - 目标六角格
   * @returns {boolean} 是否有视线
   * @private
   */
  _rayLineOfSight(fromHex, toHex) {
    // 获取两个六角格的中心点和地形类型
    const fromCenter = fromHex.getCenter();
    const toCenter = toHex.getCenter();
    const fromType = fromHex.terrainAttributes?.terrainType || 'plain';
    const toType = toHex.terrainAttributes?.terrainType || 'plain';
    
    // 计算六角格距离(步数)
    const hexDistance = this._getHexDistance(fromHex, toHex);
    
    // 根据地形类型设置视野范围
    let maxVisibleDistance = 4; // 默认平原视野范围
    
    // 特殊规则：基本可见规则
    // 1. 相邻六角格总是可见的
    if (hexDistance <= 1) return true;
    
    // 2. 地形类型影响最大可见距离
    if (fromType === 'mountain') {
      maxVisibleDistance = 8; // 山地视野范围 - 加大到8格
    } else if (fromType === 'hill') {
      maxVisibleDistance = 6; // 丘陵视野范围 - 加大到6格
    } else if (fromType === 'plain') {
      maxVisibleDistance = 5; // 平原视野范围 - 加大到5格
    }
    
    // 3. 可以看到远处的山
    if (toType === 'mountain' && hexDistance <= maxVisibleDistance + 2) {
      maxVisibleDistance += 2; // 山地目标可见度明显提高
    } else if (toType === 'hill' && hexDistance <= maxVisibleDistance + 1) {
      maxVisibleDistance += 1; // 丘陵目标可见度略微提高
    }
    
    // 4. 如果超出最大视野范围，直接返回不可见
    if (hexDistance > maxVisibleDistance) {
      return false;
    }
    
    // 设置射线起点和终点高度
    // 观察者的视点高度增加 - 模拟人站在地面上的视线高度
    const observerHeight = fromType === 'mountain' ? 5.0 : 
                          fromType === 'hill' ? 3.0 : 2.0;
    
    const fromHeight = fromCenter.height + observerHeight;
    const toHeight = toCenter.height + 1.0; // 目标点稍微抬高
    
    // 构建起点和终点的笛卡尔坐标
    const fromCartesian = Cesium.Cartesian3.fromDegrees(
      fromCenter.longitude,
      fromCenter.latitude,
      fromHeight
    );
    
    const toCartesian = Cesium.Cartesian3.fromDegrees(
      toCenter.longitude,
      toCenter.latitude,
      toHeight
    );
    
    // 方向向量
    const direction = Cesium.Cartesian3.subtract(
      toCartesian,
      fromCartesian,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(direction, direction);
    
    // 构建射线
    const ray = new Cesium.Ray(fromCartesian, direction);
    
    // 计算起点到终点的距离
    const distanceToTarget = Cesium.Cartesian3.distance(fromCartesian, toCartesian);
    
    // 射线与地形的交点
    const result = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    
    // 如果没有交点，则视为无阻挡
    if (!result) return true;
    
    // 计算交点到起点的距离
    const distanceToIntersection = Cesium.Cartesian3.distance(fromCartesian, result);
    
    // 根据地形类型和距离设置容差
    // 增加对高度差的处理 - 高差越大，越容易看到
    const heightDifference = Math.abs(fromCenter.height - toCenter.height);
    const heightFactor = 0.01 * heightDifference; // 每1米高度差增加1%的容差
    
    // 基础容差根据地形和距离确定
    let baseTolerance = 0.05; // 5% 基础容差
    
    // 地形影响容差
    if (fromType === 'mountain') {
      baseTolerance = 0.15; // 山上视野更好，容差更大
    } else if (fromType === 'hill') {
      baseTolerance = 0.1; // 丘陵上视野适中
    }
    
    // 距离影响容差 - 远距离要求更高的精度
    const distanceFactor = Math.max(0, 0.05 - (hexDistance * 0.005)); // 距离越远，容差越小
    
    // 计算最终容差
    const tolerance = distanceToTarget * (baseTolerance + heightFactor + distanceFactor);
    
    // 如果交点距离大于等于目标距离减去容差，则视为无阻挡
    return distanceToIntersection >= distanceToTarget - tolerance;
  }
  
  /**
   * 简化的视线判断逻辑
   * 基于六角格中心高度对比的视线检测
   * 在复杂地形或性能不足场景下可用此方法替代射线检测
   * @param {Object} fromHex - 起始六角格
   * @param {Object} toHex - 目标六角格
   * @returns {boolean} 是否有视线
   * @private
   */
  _simplifiedLineOfSight(fromHex, toHex) {
    // 相同格子或相邻格子总是可见
    if (fromHex.hexId === toHex.hexId) return true;
    const hexDistance = this._getHexDistance(fromHex, toHex);
    if (hexDistance <= 1) return true;
    
    // 获取六角格信息
    const fromCenter = fromHex.getCenter();
    const toCenter = toHex.getCenter();
    const fromType = fromHex.terrainAttributes?.terrainType || 'plain';
    const toType = toHex.terrainAttributes?.terrainType || 'plain';
    
    // 计算两点间的高度差
    const heightDifference = toCenter.height - fromCenter.height;
    
    // 根据地形类型设置视野范围
    let maxVisibleDistance = 4; // 默认平原视野范围
    
    // 地形类型影响最大可见距离
    if (fromType === 'mountain') {
      maxVisibleDistance = 8; // 山地视野范围
    } else if (fromType === 'hill') {
      maxVisibleDistance = 6; // 丘陵视野范围
    } else if (fromType === 'plain') {
      maxVisibleDistance = 5; // 平原视野范围
    }
    
    // 高度因素 - 与目标高度差越大，可见距离越远
    const heightFactor = Math.max(0, heightDifference / 10); // 每10米高度差增加1格视距
    maxVisibleDistance += heightFactor;
    
    // 超出视距，不可见
    if (hexDistance > maxVisibleDistance) {
      return false;
    }
    
    // 大幅度高度下降可能被遮挡
    if (heightDifference < -30 && hexDistance > 2) {
      const dropFactor = -heightDifference / 10;
      return hexDistance < (maxVisibleDistance - dropFactor);
    }
    
    // 默认可见
    return true;
  }
  
  /**
   * 获取两个六角格之间的距离
   * @param {Object} fromHex - 起始六角格
   * @param {Object} toHex - 目标六角格
   * @returns {number} 六角格距离
   * @private
   */
  _getHexDistance(fromHex, toHex) {
    if (fromHex.hexId === toHex.hexId) return 0;
    
    // 使用BFS计算最短路径距离
    const visited = new Set([fromHex.hexId]);
    let frontier = [fromHex];
    let distance = 0;
    
    while (frontier.length > 0) {
      distance++;
      const nextFrontier = [];
      
      for (const hex of frontier) {
        for (const neighbor of hex.neighbors || []) {
          if (!neighbor) continue;
          
          if (neighbor.hexId === toHex.hexId) {
            return distance;
          }
          
          if (!visited.has(neighbor.hexId)) {
            visited.add(neighbor.hexId);
            nextFrontier.push(neighbor);
          }
        }
      }
      
      frontier = nextFrontier;
      
      // 防止无限循环
      if (distance > 20) break;
    }
    
    return Infinity;
  }
  
  /**
   * 应用战争迷雾效果
   * 为所有六角格设置可见性
   * @private
   */
  _applyFogOfWarEffect() {
    // 获取所有六角格
    const allHexes = this.store.getHexCells();
    const currentFaction = this.currentFaction.value;
    
    // 更新每个六角格的可见性
    allHexes.forEach(hex => {
      const visibleToBlue = this.visibleHexIds.blue.has(hex.hexId);
      const visibleToRed = this.visibleHexIds.red.has(hex.hexId);
      
      // 更新六角格可见性属性
      hex.visibility.visibleTo = {
        blue: visibleToBlue,
        red: visibleToRed
      };
      
      // 根据当前阵营应用迷雾视觉效果
      if (currentFaction === 'blue' && !visibleToBlue) {
        hex.addVisualStyle(this.fogStyle);
      } else if (currentFaction === 'red' && !visibleToRed) {
        hex.addVisualStyle(this.fogStyle);
      } else {
        hex.removeVisualStyleByType('invisible');
      }
    });

    // 要求渲染器重新渲染标记层
    const renderer = HexGridRenderer.getInstance(this.viewer);
    renderer.renderMarkGrid();
    renderer.renderBaseGrid(false);
  }

  /**
   * 检查指定六角格是否对指定阵营可见
   * @param {string} hexId - 六角格ID
   * @param {string} faction - 阵营 ('blue'|'red')
   * @returns {boolean} 是否可见
   */
  isHexVisibleToFaction(hexId, faction) {
    if (!hexId || !faction) return false;
    if (!this.visibleHexIds[faction]) return false;
    return this.visibleHexIds[faction].has(hexId);
  }

  /**
   * 获取指定阵营的所有可见六角格ID
   * @param {string} faction - 阵营 ('blue'|'red')
   * @returns {Array<string>} 可见六角格ID数组
   */
  getVisibleHexesByFaction(faction) {
    if (!faction || !this.visibleHexIds[faction]) return [];
    return Array.from(this.visibleHexIds[faction]);
  }

  /**
   * 手动触发战争迷雾更新
   * 可在其他组件中调用，如部队移动后
   * @param {boolean} [force=true] 是否强制完全更新
   */
  forceUpdate(force = true) {
    return this.updateFogOfWar(force);
  }
  
  /**
   * 设置调试选项
   * @param {Object} options - 调试选项
   */
  setDebugOptions(options) {
    if (!options) return;
    
    // 更新调试选项
    if (options.enabled !== undefined) this.debugOptions.enabled = options.enabled;
    if (options.visualizeShape !== undefined) this.debugOptions.visualizeShape = options.visualizeShape;
    if (options.ignoreTerrain !== undefined) this.debugOptions.ignoreTerrain = options.ignoreTerrain;
    if (options.showRadius !== undefined) this.debugOptions.showRadius = options.showRadius;
    
    // 立即更新
    this.clearCache();
    this.updateFogOfWar(true);
  }
  
  /**
   * 启用调试模式 - 可以直接在控制台调用
   * @param {boolean} [enabled=true] - 是否启用调试
   * @param {number} [showRadius=1.0] - 视野范围扩展系数
   * @param {boolean} [ignoreTerrain=false] - 是否忽略地形阻挡
   * @param {boolean} [useSimplifiedDetection=false] - 是否使用简化的视线检测算法
   * @returns {FogOfWarManager} 实例自身，方便链式调用
   */
  enableDebug(enabled = true, showRadius = 1.0, ignoreTerrain = false, useSimplifiedDetection = false) {
    // 存储当前的视线检测方法
    if (useSimplifiedDetection) {
      // 替换视线检测方法为简化版
      this._originalHasLineOfSightAsync = this._hasLineOfSightAsync;
      this._hasLineOfSightAsync = async (fromHex, toHex) => {
        return this._simplifiedLineOfSight(fromHex, toHex);
      };
    } else if (this._originalHasLineOfSightAsync) {
      // 恢复原始视线检测方法
      this._hasLineOfSightAsync = this._originalHasLineOfSightAsync;
      this._originalHasLineOfSightAsync = null;
    }
    
    this.setDebugOptions({
      enabled: enabled,
      showRadius: showRadius,
      ignoreTerrain: ignoreTerrain
    });
    
    const detectionType = useSimplifiedDetection ? '简化检测' : '射线检测';
    console.log(`[FogOfWarManager] 调试模式${enabled ? '已启用' : '已禁用'}, 显示范围: ${showRadius}倍, 忽略地形: ${ignoreTerrain}, 检测方式: ${detectionType}`);
    
    return this;
  }
  
  /**
   * 清除缓存 - 在地形变化等情况下调用
   */
  clearCache() {
    this.hexVisibilityCache.clear();
    this.forcePositionCache.clear();
    this.forcesSnapshot = null;
  }

  /**
   * 销毁实例
   */
  dispose() {
    // 清理定时器
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    
    // 清理调试实体
    this._clearDebugEntities();
    
    // 清理数据
    this.clearCache();
    this.visibleHexIds.blue.clear();
    this.visibleHexIds.red.clear();
    
    // 清理单例
    FogOfWarManager.#instance = null;
  }
}