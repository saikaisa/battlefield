/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { MilitaryConfig, BattleConfig } from '@/config/GameConfig';
import { ModelInstanceLoader } from "./ModelInstanceLoader";
import { ModelPoseCalculator } from "../utils/ModelPoseCalculator";

/**
 * 战斗特效渲染器
 * 
 * 主要职责：
 * 1. 渲染战斗过程中的视觉特效
 * 2. 管理子弹/导弹轨迹和爆炸动画
 * 3. 提供异步等待特效完成的接口
 */
export class BattleEffectsRenderer {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {BattleEffectsRenderer} 单例实例
   */
  static getInstance(viewer) {
    if (!BattleEffectsRenderer.#instance) {
      BattleEffectsRenderer.#instance = new BattleEffectsRenderer(viewer);
    }
    return BattleEffectsRenderer.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    // 初始化模型加载器
    this.modelLoader = ModelInstanceLoader.getInstance(viewer);
    // 初始化姿态计算器
    this.poseCalculator = ModelPoseCalculator.getInstance(viewer);
    
    // 活跃中的战斗特效 {id: {type, entity, startTime, endTime, completed}}
    this.activeEffects = new Map();
    // 特效ID计数器
    this.effectCounter = 0;
    // 爆炸效果集合
    this.explosions = new Map();
    // 特效更新句柄
    this._updateHandle = null;
    // 战斗特效完成回调
    this._battleCompleteCallbacks = new Map();
  }

  /**
   * 启动特效更新循环
   */
  startEffectsUpdateLoop() {
    if (this._updateHandle) return;
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 当前时间
      const now = Date.now();
      
      // 检查所有活跃特效是否完成
      this.activeEffects.forEach((effect, id) => {
        if (effect.completed) return;
        
        if (now >= effect.endTime) {
          // 特效结束
          effect.completed = true;
          
          // 如果是子弹/导弹，创建目标位置的爆炸效果
          if (effect.type === 'bullet' || effect.type === 'missile') {
            this._createExplosion(effect.targetPosition);
          }
          
          // 移除特效实体
          if (effect.entity && !effect.entity.isDestroyed()) {
            this.viewer.entities.remove(effect.entity);
          }
          
          // 检查特定战斗ID的所有特效是否都已完成
          if (effect.battleId) {
            this._checkBattleComplete(effect.battleId);
          }
        }
      });
      
      // 检查所有爆炸效果是否完成
      this.explosions.forEach((explosion, id) => {
        if (explosion.completed) return;
        
        if (now >= explosion.endTime) {
          // 爆炸效果结束
          explosion.completed = true;
          
          // 移除爆炸效果实体
          if (explosion.entity && !explosion.entity.isDestroyed()) {
            this.viewer.entities.remove(explosion.entity);
          }
          
          // 检查特定战斗ID的所有特效是否都已完成
          if (explosion.battleId) {
            this._checkBattleComplete(explosion.battleId);
          }
        }
      });
    });
  }
  
  /**
   * 停止特效更新循环
   */
  stopEffectsUpdateLoop() {
    if (this._updateHandle) {
      this.viewer.scene.postUpdate.removeEventListener(this._updateHandle);
      this._updateHandle = null;
    }
  }
  
  /**
   * 清理所有战斗特效
   */
  clearAllEffects() {
    // 清除所有活跃特效
    this.activeEffects.forEach(effect => {
      if (effect.entity && !effect.entity.isDestroyed()) {
        this.viewer.entities.remove(effect.entity);
      }
    });
    this.activeEffects.clear();
    
    // 清除所有爆炸效果
    this.explosions.forEach(explosion => {
      if (explosion.entity && !explosion.entity.isDestroyed()) {
        this.viewer.entities.remove(explosion.entity);
      }
    });
    this.explosions.clear();
  }

  /**
   * 创建战斗视觉特效
   * @param {string} battleId 战斗ID，用于分组特效
   * @param {Array<Object>} effects 特效定义数组，每个特效包含from(六角格ID)、to(六角格ID)、delay(延迟毫秒)、type(特效类型)等
   * @returns {Promise<void>} 当所有特效完成时解析的Promise
   */
  async createBattleEffects(battleId, effects) {
    if (!battleId || !effects || effects.length === 0) {
      return Promise.resolve();
    }
    
    // 确保更新循环已启动
    this.startEffectsUpdateLoop();
    
    // 创建Promise等待所有特效完成
    return new Promise((resolve) => {
      // 注册战斗完成回调
      this._battleCompleteCallbacks.set(battleId, resolve);
      
      // 最小战斗持续时间
      const minDuration = BattleConfig.animation.battleMinDuration;
      // 记录战斗开始时间
      const battleStartTime = Date.now();
      
      // 创建所有特效
      for (const effect of effects) {
        // 获取源六角格和目标六角格
        const sourceHex = this.store.getHexCellById(effect.from);
        const targetHex = this.store.getHexCellById(effect.to);
        
        if (!sourceHex || !targetHex) {
          console.warn('无法创建战斗特效：找不到源六角格或目标六角格', effect);
          continue;
        }
        
        // 获取六角格中心位置
        const sourceCenter = sourceHex.getCenter();
        const targetCenter = targetHex.getCenter();
        
        // 创建源点和目标点
        const sourcePosition = Cesium.Cartesian3.fromDegrees(
          sourceCenter.longitude,
          sourceCenter.latitude,
          sourceCenter.height + 50 // 稍微抬高，避免穿透地面
        );
        
        const targetPosition = Cesium.Cartesian3.fromDegrees(
          targetCenter.longitude,
          targetCenter.latitude,
          targetCenter.height + 30 // 目标点略低于源点
        );
        
        // 计算飞行时间
        const distance = Cesium.Cartesian3.distance(sourcePosition, targetPosition);
        const speed = effect.type === 'missile' ? 
                      BattleConfig.animation.missileSpeed : 
                      BattleConfig.animation.bulletSpeed;
        const flightDuration = (distance / speed) * 1000; // 毫秒
        
        // 延迟创建特效
        setTimeout(() => {
          // 根据类型创建不同特效
          if (effect.type === 'missile') {
            this._createMissileEffect(battleId, sourcePosition, targetPosition, flightDuration);
          } else {
            this._createBulletEffect(battleId, sourcePosition, targetPosition, flightDuration);
          }
        }, effect.delay || 0);
      }
      
      // 确保战斗至少持续一段时间
      setTimeout(() => {
        const elapsedTime = Date.now() - battleStartTime;
        if (elapsedTime < minDuration) {
          // 如果战斗持续时间不足最小值，等待一段时间后再检查完成状态
          setTimeout(() => {
            this._checkBattleComplete(battleId);
          }, minDuration - elapsedTime);
        } else {
          // 否则立即检查是否完成
          this._checkBattleComplete(battleId);
        }
      }, 100); // 短延迟确保所有特效都已创建
    });
  }

  /**
   * 检查特定战斗的所有特效是否已完成
   * @param {string} battleId 战斗ID
   * @private
   */
  _checkBattleComplete(battleId) {
    // 检查是否所有相关特效都已完成
    let allCompleted = true;
    
    // 检查子弹/导弹特效
    this.activeEffects.forEach(effect => {
      if (effect.battleId === battleId && !effect.completed) {
        allCompleted = false;
      }
    });
    
    // 检查爆炸特效
    this.explosions.forEach(explosion => {
      if (explosion.battleId === battleId && !explosion.completed) {
        allCompleted = false;
      }
    });
    
    // 如果所有特效都已完成，触发回调
    if (allCompleted && this._battleCompleteCallbacks.has(battleId)) {
      const callback = this._battleCompleteCallbacks.get(battleId);
      this._battleCompleteCallbacks.delete(battleId);
      callback();
    }
  }

  /**
   * 创建子弹特效
   * @param {string} battleId 战斗ID
   * @param {Cesium.Cartesian3} sourcePosition 源位置
   * @param {Cesium.Cartesian3} targetPosition 目标位置
   * @param {number} duration 持续时间(毫秒)
   * @private
   */
  _createBulletEffect(battleId, sourcePosition, targetPosition, duration) {
    const effectId = `bullet_${++this.effectCounter}`;
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 创建子弹实体
    const entity = this.viewer.entities.add({
      position: new Cesium.SampledPositionProperty(),
      point: {
        pixelSize: 4,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1
      }
    });
    
    // 设置子弹轨迹
    const positionProperty = entity.position;
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime)), sourcePosition);
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(endTime)), targetPosition);
    
    // 记录特效信息
    this.activeEffects.set(effectId, {
      type: 'bullet',
      entity: entity,
      startTime: startTime,
      endTime: endTime,
      completed: false,
      battleId: battleId,
      targetPosition: targetPosition
    });
  }

  /**
   * 创建导弹特效
   * @param {string} battleId 战斗ID
   * @param {Cesium.Cartesian3} sourcePosition 源位置
   * @param {Cesium.Cartesian3} targetPosition 目标位置
   * @param {number} duration 持续时间(毫秒)
   * @private
   */
  _createMissileEffect(battleId, sourcePosition, targetPosition, duration) {
    const effectId = `missile_${++this.effectCounter}`;
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 计算中间点，使导弹飞行轨迹呈抛物线
    const midPoint = new Cesium.Cartesian3();
    Cesium.Cartesian3.lerp(sourcePosition, targetPosition, 0.5, midPoint);
    
    // 抬高中间点
    const normal = Cesium.Cartesian3.normalize(midPoint, new Cesium.Cartesian3());
    Cesium.Cartesian3.multiplyByScalar(normal, 500, normal); // 500米的高度偏移
    Cesium.Cartesian3.add(midPoint, normal, midPoint);
    
    // 创建导弹实体
    const entity = this.viewer.entities.add({
      position: new Cesium.SampledPositionProperty(),
      path: {
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.RED
        }),
        width: 8
      },
      point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      }
    });
    
    // 设置导弹轨迹
    const positionProperty = entity.position;
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime)), sourcePosition);
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime + duration / 2)), midPoint);
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(endTime)), targetPosition);
    
    // 记录特效信息
    this.activeEffects.set(effectId, {
      type: 'missile',
      entity: entity,
      startTime: startTime,
      endTime: endTime,
      completed: false,
      battleId: battleId,
      targetPosition: targetPosition
    });
  }

  /**
   * 创建爆炸特效
   * @param {Cesium.Cartesian3} position 爆炸位置
   * @private
   */
  _createExplosion(position) {
    const explosionId = `explosion_${++this.effectCounter}`;
    const startTime = Date.now();
    const duration = BattleConfig.animation.explosionDuration;
    const endTime = startTime + duration;
    
    // 创建爆炸实体
    const entity = this.viewer.entities.add({
      position: position,
      billboard: {
        image: '/assets/icons/explosion.png', // 假设有爆炸图标
        scale: 1.0,
        scaleByDistance: new Cesium.NearFarScalar(1.0e2, 2.0, 1.0e4, 0.5)
      }
    });
    
    // 添加简单的爆炸动画(缩放)
    this._animateExplosion(entity, duration);
    
    // 记录爆炸信息
    this.explosions.set(explosionId, {
      entity: entity,
      startTime: startTime,
      endTime: endTime,
      completed: false
    });
  }
  
  /**
   * 为爆炸实体添加动画
   * @param {Cesium.Entity} entity 爆炸实体
   * @param {number} duration 持续时间(毫秒)
   * @private
   */
  _animateExplosion(entity, duration) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 创建爆炸动画回调
    const explosionCallback = () => {
      const now = Date.now();
      if (now > endTime || !entity || entity.isDestroyed()) {
        return;
      }
      
      // 计算动画进度(0到1)
      const progress = (now - startTime) / duration;
      
      // 根据进度更新爆炸效果
      // 先放大后缩小的效果
      let scale;
      if (progress < 0.3) {
        // 放大阶段
        scale = 0.5 + progress * 5; // 从0.5逐渐放大到最大2.0
      } else {
        // 缩小阶段
        scale = 2.0 - (progress - 0.3) * 2.5; // 从2.0逐渐缩小到0
      }
      
      // 透明度从1逐渐变为0
      const alpha = Math.max(0, 1 - progress);
      
      // 更新爆炸效果的缩放和透明度
      if (entity.billboard) {
        entity.billboard.scale = scale;
        entity.billboard.color = Cesium.Color.WHITE.withAlpha(alpha);
      }
      
      // 继续下一帧动画
      requestAnimationFrame(explosionCallback);
    };
    
    // 启动爆炸动画
    requestAnimationFrame(explosionCallback);
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    this.clearAllEffects();
    this.stopEffectsUpdateLoop();
    BattleEffectsRenderer.#instance = null;
  }
} 