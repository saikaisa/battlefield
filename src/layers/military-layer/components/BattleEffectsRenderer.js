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
          
          // 如果是子弹/导弹/炮弹，创建目标位置的爆炸效果
          if (effect.type === 'bullet' || effect.type === 'plainBullet') {
            this._createExplosion(effect.targetPosition, 'bullet', effect.battleId);
          } else if (effect.type === 'missile') {
            this._createExplosion(effect.targetPosition, 'missile', effect.battleId);
          } else if (effect.type === 'shell') {
            this._createExplosion(effect.targetPosition, 'shell', effect.battleId);
          }
          
          // 移除特效实体
          if (effect.entity && !effect.entity._isDestroyed && this.viewer.entities.contains(effect.entity)) {
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
          if (explosion.entity && !explosion.entity._isDestroyed && this.viewer.entities.contains(explosion.entity)) {
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
      if (effect.entity && !effect.entity._isDestroyed && this.viewer.entities.contains(effect.entity)) {
        this.viewer.entities.remove(effect.entity);
      }
    });
    this.activeEffects.clear();
    
    // 清除所有爆炸效果
    this.explosions.forEach(explosion => {
      if (explosion.entity && !explosion.entity._isDestroyed && this.viewer.entities.contains(explosion.entity)) {
        this.viewer.entities.remove(explosion.entity);
      }
    });
    this.explosions.clear();
  }

  /**
   * 创建战斗视觉特效
   * @param {string} battleId 战斗ID，用于分组特效
   * @param {Array<Object>} effectsConfig 特效配置数组，包含详细的战斗效果配置
   * @returns {Promise<void>} 当所有特效完成时解析的Promise
   */
  async createBattleEffects(battleId, effectsConfig) {
    if (!battleId || !effectsConfig || effectsConfig.length === 0) {
      return Promise.resolve();
    }
    
    // 确保更新循环已启动
    this.startEffectsUpdateLoop();
    
    // 创建Promise等待所有特效完成
    return new Promise((resolve) => {
      // 注册战斗完成回调
      this._battleCompleteCallbacks.set(battleId, resolve);
      
      // 最小战斗持续时间
      const minDuration = BattleConfig.animation.battleMinDuration || 5000;
      // 记录战斗开始时间
      const battleStartTime = Date.now();
      
      // 处理特效配置
      for (const effectConfig of effectsConfig) {
        let sourcePos, targetPos;
        
        // 处理源位置
        if (effectConfig.from.position) {
          sourcePos = this._getPositionCartesian3(effectConfig.from.position);
        } else if (effectConfig.from.unitInstance && effectConfig.from.forceInstance) {
          // 如果有兵种实例和部队实例，则使用兵种位置
          const unitPos = effectConfig.from.unitInstance.getPosition();
          sourcePos = unitPos ? 
            Cesium.Cartesian3.fromDegrees(unitPos.longitude, unitPos.latitude, unitPos.height) :
            this._getPositionCartesian3(effectConfig.from.forceInstance.pose.position);
        }
        
        // 处理目标位置
        if (effectConfig.to.position) {
          targetPos = this._getPositionCartesian3(effectConfig.to.position);
        } else if (effectConfig.to.forceInstance && effectConfig.to.forceInstance.pose) {
          targetPos = this._getPositionCartesian3(effectConfig.to.forceInstance.pose.position);
        }
        
        if (!sourcePos || !targetPos) {
          console.warn('无法创建战斗特效：无效的源位置或目标位置', effectConfig);
          continue;
        }
        
        // 计算飞行时间
        const distance = Cesium.Cartesian3.distance(sourcePos, targetPos);
        const speed = effectConfig.speed || BattleConfig.animation.bulletSpeed || 500;
        const flightDuration = (distance / speed) * 1000; // 毫秒
        
        // 延迟创建特效
        setTimeout(() => {
          // 根据类型创建不同特效
          switch (effectConfig.type) {
            case 'missile':
              this._createMissileEffect(battleId, sourcePos, targetPos, flightDuration);
              break;
            case 'shell':
              this._createShellEffect(battleId, sourcePos, targetPos, flightDuration);
              break;
            case 'plainBullet':
              this._createBulletEffect(battleId, sourcePos, targetPos, flightDuration);
              break;
            default:
              this._createBulletEffect(battleId, sourcePos, targetPos, flightDuration);
              break;
          }
        }, effectConfig.delay || 0);
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
   * 将地理位置转换为Cartesian3坐标
   * @param {Object} position 地理位置对象 {longitude, latitude, height}
   * @returns {Cesium.Cartesian3|null} Cartesian3坐标
   * @private
   */
  _getPositionCartesian3(position) {
    if (!position || position.longitude === undefined || position.latitude === undefined) {
      return null;
    }
    
    return Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.height || 0
    );
  }

  /**
   * 处理旧格式的特效配置（兼容性）
   * @param {string} battleId 战斗ID
   * @param {Object} effect 旧格式的特效配置
   * @private
   */
  _handleLegacyEffectConfig(battleId, effect) {
    // 获取源六角格和目标六角格
    const store = openGameStore();
    const sourceHex = store.getHexCellById(effect.from);
    const targetHex = store.getHexCellById(effect.to);
    
    if (!sourceHex || !targetHex) {
      console.warn('无法创建战斗特效：找不到源六角格或目标六角格', effect);
      return;
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

  /**
   * 检查特定战斗的所有特效是否已完成
   * @param {string} battleId 战斗ID
   * @private
   */
  _checkBattleComplete(battleId) {
    // 检查是否所有相关特效都已完成
    let allCompleted = true;
    
    // 检查子弹/导弹/炮弹特效
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
    
    // 获取导弹模型配置
    const missileModelConfig = MilitaryConfig.bullets && MilitaryConfig.bullets.missile;
    let entity;
    
    // 如果有模型配置，使用3D模型；否则使用简单实体
    if (missileModelConfig && missileModelConfig.path) {
      // 创建模型实体
      entity = this.viewer.entities.add({
        position: new Cesium.SampledPositionProperty(),
        orientation: new Cesium.VelocityOrientedProperty(new Cesium.SampledPositionProperty()),
        model: {
          uri: missileModelConfig.path,
          scale: missileModelConfig.transform.scale || 1.0,
          minimumPixelSize: 16,
          maximumScale: 100
        },
        path: {
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.RED
          }),
          width: 8,
          leadTime: 0
        }
      });
    } else {
      // 创建简单实体作为备选
      entity = this.viewer.entities.add({
        position: new Cesium.SampledPositionProperty(),
        path: {
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.RED
          }),
          width: 8,
          leadTime: 0
        },
        point: {
          pixelSize: 8,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        }
      });
    }
    
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
   * 创建炮弹特效
   * @param {string} battleId 战斗ID
   * @param {Cesium.Cartesian3} sourcePosition 源位置
   * @param {Cesium.Cartesian3} targetPosition 目标位置
   * @param {number} duration 持续时间(毫秒)
   * @private
   */
  _createShellEffect(battleId, sourcePosition, targetPosition, duration) {
    const effectId = `shell_${++this.effectCounter}`;
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 计算中间点，使炮弹飞行轨迹呈高抛物线
    const midPoint = new Cesium.Cartesian3();
    Cesium.Cartesian3.lerp(sourcePosition, targetPosition, 0.5, midPoint);
    
    // 抬高中间点，炮弹轨迹比导弹更高
    const normal = Cesium.Cartesian3.normalize(midPoint, new Cesium.Cartesian3());
    Cesium.Cartesian3.multiplyByScalar(normal, 800, normal); // 800米的高度偏移，比导弹更高
    Cesium.Cartesian3.add(midPoint, normal, midPoint);
    
    // 获取炮弹模型配置
    const shellModelConfig = MilitaryConfig.bullets && MilitaryConfig.bullets.shell;
    let entity;
    
    // 如果有模型配置，使用3D模型；否则使用简单实体
    if (shellModelConfig && shellModelConfig.path) {
      // 创建模型实体
      entity = this.viewer.entities.add({
        position: new Cesium.SampledPositionProperty(),
        orientation: new Cesium.VelocityOrientedProperty(new Cesium.SampledPositionProperty()),
        model: {
          uri: shellModelConfig.path,
          scale: shellModelConfig.transform.scale || 1.0,
          minimumPixelSize: 12,
          maximumScale: 100
        },
        path: {
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.ORANGERED
          }),
          width: 5,
          leadTime: 0
        }
      });
    } else {
      // 创建简单实体作为备选
      entity = this.viewer.entities.add({
        position: new Cesium.SampledPositionProperty(),
        path: {
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.ORANGERED
          }),
          width: 5,
          leadTime: 0
        },
        point: {
          pixelSize: 6,
          color: Cesium.Color.ORANGERED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        }
      });
    }
    
    // 设置炮弹轨迹
    const positionProperty = entity.position;
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime)), sourcePosition);
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime + duration / 2)), midPoint);
    positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(endTime)), targetPosition);
    
    // 记录特效信息
    this.activeEffects.set(effectId, {
      type: 'shell',
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
   * @param {string} [type='bullet'] 爆炸类型：'bullet', 'shell', 'missile'
   * @param {string} [battleId] 战斗ID
   * @private
   */
  _createExplosion(position, type = 'bullet', battleId) {
    const explosionId = `explosion_${++this.effectCounter}`;
    const startTime = Date.now();
    const duration = this._getExplosionDuration(type);
    const endTime = startTime + duration;
    
    // 根据爆炸类型设置不同的特效
    let scale, color, particleCount, particleSize, maxParticleLife;
    switch (type) {
      case 'missile':
        scale = 2.0;
        color = Cesium.Color.ORANGERED;
        particleCount = 150;
        particleSize = 25;
        maxParticleLife = 2.0;
        break;
      case 'shell':
        scale = 1.5;
        color = Cesium.Color.ORANGE;
        particleCount = 80;
        particleSize = 20;
        maxParticleLife = 1.5;
        break;
      case 'bullet':
      case 'plainBullet':
      default:
        scale = 1.0;
        color = Cesium.Color.YELLOW;
        particleCount = 30;
        particleSize = 15;
        maxParticleLife = 1.0;
        break;
    }
    
    // 创建爆炸实体
    const entity = this.viewer.entities.add({
      position: position,
      billboard: {
        image: this._getExplosionImage(type),
        scale: scale,
        scaleByDistance: new Cesium.NearFarScalar(1.0e2, 2.0, 1.0e4, 0.5)
      }
    });
    
    // 添加爆炸动画
    this._animateExplosion(entity, duration, {
      type: type,
      scale: scale,
      color: color,
      particleCount: particleCount
    });
    
    // 记录爆炸信息
    this.explosions.set(explosionId, {
      entity: entity,
      startTime: startTime,
      endTime: endTime,
      completed: false,
      battleId: battleId,
      type: type
    });
    
    // 添加粒子效果，根据爆炸类型调整粒子系统
    this._addExplosionParticles(position, {
      type: type,
      particleCount: particleCount,
      particleSize: particleSize,
      color: color,
      duration: duration,
      maxLife: maxParticleLife
    });
  }
  
  /**
   * 获取爆炸持续时间
   * @param {string} type 爆炸类型
   * @returns {number} 持续时间(毫秒)
   * @private
   */
  _getExplosionDuration(type) {
    switch (type) {
      case 'missile':
        return BattleConfig.animation.missileExplosionDuration || 1500;
      case 'shell':
        return BattleConfig.animation.shellExplosionDuration || 1000;
      case 'bullet':
      default:
        return BattleConfig.animation.explosionDuration || 500;
    }
  }
  
  /**
   * 获取爆炸图片
   * @param {string} type 爆炸类型
   * @returns {string} 图片路径
   * @private
   */
  _getExplosionImage(type) {
    const baseUrl = '/assets/icons/';
    switch (type) {
      case 'missile':
        return `${baseUrl}attack.png`;
      case 'shell':
        return `${baseUrl}march.png`;
      case 'bullet':
      case 'plainBullet':
      default:
        return `${baseUrl}confirm.png`;
    }
  }
  
  /**
   * 添加爆炸粒子效果
   * @param {Cesium.Cartesian3} position 爆炸位置
   * @param {Object} options 粒子选项
   * @private
   */
  _addExplosionParticles(position, options) {
    // 如果浏览器不支持或者禁用了WebGL 2，则简化粒子效果
    const useSimplifiedEffect = !this.viewer.scene.context.webgl2;
    
    if (useSimplifiedEffect) {
      // 简化版粒子系统 - 仅使用少量粒子
      const particleSystem = new Cesium.ParticleSystem({
        image: '/assets/icons/add.png', // 使用现有的图标替代
        startColor: options.color.withAlpha(0.8),
        endColor: options.color.withAlpha(0),
        startScale: options.type === 'missile' ? 1.5 : 1.0,
        endScale: 0.5,
        minimumParticleLife: 0.3,
        maximumParticleLife: options.maxLife || 1.5,
        minimumSpeed: 1.0,
        maximumSpeed: 3.0,
        imageSize: new Cesium.Cartesian2(15, 15),
        emissionRate: Math.min(options.particleCount / 2, 30),  // 减少粒子数量
        lifetime: options.duration / 1000,
        emitter: new Cesium.CircleEmitter(options.type === 'missile' ? 10 : 5),
        modelMatrix: Cesium.Matrix4.fromTranslation(position),
        emitterModelMatrix: Cesium.Matrix4.IDENTITY
      });
      
      this.viewer.scene.primitives.add(particleSystem);
      
      setTimeout(() => {
        if (!this.viewer.isDestroyed() && !particleSystem.isDestroyed()) {
          this.viewer.scene.primitives.remove(particleSystem);
        }
      }, options.duration + 200);
      
      return;
    }
    
    // 完整版粒子效果 - 主爆炸粒子系统
    const mainParticleSystem = new Cesium.ParticleSystem({
      image: '/assets/icons/attack.png', // 使用现有的图标替代
      startColor: options.color.withAlpha(0.9),
      endColor: options.color.withAlpha(0),
      startScale: options.type === 'missile' ? 2.0 : 1.5,
      endScale: 0.5,
      minimumParticleLife: 0.3,
      maximumParticleLife: options.maxLife || 1.5,
      minimumSpeed: 2.0,
      maximumSpeed: 6.0,
      imageSize: new Cesium.Cartesian2(options.particleSize || 20, options.particleSize || 20),
      emissionRate: options.particleCount,
      lifetime: options.duration / 2000, // 主爆炸持续时间较短
      emitter: new Cesium.CircleEmitter(options.type === 'missile' ? 15 : 10),
      modelMatrix: Cesium.Matrix4.fromTranslation(position),
      emitterModelMatrix: Cesium.Matrix4.IDENTITY
    });
    
    // 烟雾粒子系统 - 在主爆炸之后持续更长时间
    const smokeParticleSystem = new Cesium.ParticleSystem({
      image: '/assets/icons/dragger.png', // 使用现有的图标替代
      startColor: Cesium.Color.DARKGRAY.withAlpha(0.7),
      endColor: Cesium.Color.WHITE.withAlpha(0),
      startScale: options.type === 'missile' ? 1.5 : 1.0,
      endScale: 2.0, // 烟雾会扩散
      minimumParticleLife: 1.0,
      maximumParticleLife: options.maxLife * 1.5,
      minimumSpeed: 1.0,
      maximumSpeed: 3.0,
      imageSize: new Cesium.Cartesian2(options.particleSize * 1.2, options.particleSize * 1.2),
      emissionRate: options.particleCount / 2,
      lifetime: options.duration / 1000,
      emitter: new Cesium.CircleEmitter(options.type === 'missile' ? 20 : 15),
      modelMatrix: Cesium.Matrix4.fromTranslation(position),
      emitterModelMatrix: Cesium.Matrix4.IDENTITY
    });
    
    // 如果是导弹爆炸，添加额外的碎片粒子
    let debrisParticleSystem = null;
    if (options.type === 'missile') {
      debrisParticleSystem = new Cesium.ParticleSystem({
        image: '/assets/icons/multiSelect.png', // 使用现有的图标替代
        startColor: Cesium.Color.YELLOW.withAlpha(0.9),
        endColor: Cesium.Color.ORANGERED.withAlpha(0),
        startScale: 0.8,
        endScale: 0.1,
        minimumParticleLife: 0.6,
        maximumParticleLife: 1.2,
        minimumSpeed: 8.0,
        maximumSpeed: 15.0,
        imageSize: new Cesium.Cartesian2(5, 5),
        emissionRate: 100,
        lifetime: 0.3, // 短暂的碎片喷射
        emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45)),
        modelMatrix: Cesium.Matrix4.fromTranslation(position),
        emitterModelMatrix: Cesium.Matrix4.IDENTITY
      });
    }
    
    // 添加到场景
    this.viewer.scene.primitives.add(mainParticleSystem);
    this.viewer.scene.primitives.add(smokeParticleSystem);
    if (debrisParticleSystem) {
      this.viewer.scene.primitives.add(debrisParticleSystem);
    }
    
    // 设置定时器以移除粒子系统
    setTimeout(() => {
      if (!this.viewer.isDestroyed() && !mainParticleSystem.isDestroyed()) {
        this.viewer.scene.primitives.remove(mainParticleSystem);
      }
    }, options.duration / 2 + 200);
    
    setTimeout(() => {
      if (!this.viewer.isDestroyed() && !smokeParticleSystem.isDestroyed()) {
        this.viewer.scene.primitives.remove(smokeParticleSystem);
      }
    }, options.duration + 500);
    
    if (debrisParticleSystem) {
      setTimeout(() => {
        if (!this.viewer.isDestroyed() && !debrisParticleSystem.isDestroyed()) {
          this.viewer.scene.primitives.remove(debrisParticleSystem);
        }
      }, 1000); // 碎片效果只持续短时间
    }
  }
  
  /**
   * 为爆炸实体添加动画
   * @param {Cesium.Entity} entity 爆炸实体
   * @param {number} duration 持续时间(毫秒)
   * @param {Object} options 动画选项
   * @private
   */
  _animateExplosion(entity, duration, options) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 创建爆炸动画回调
    const explosionCallback = () => {
      const now = Date.now();
      // 检查实体是否已被移除或销毁
      if (now > endTime || !entity || entity._isDestroyed || !this.viewer.entities.contains(entity)) {
        return;
      }
      
      // 计算动画进度(0到1)
      const progress = (now - startTime) / duration;
      
      // 根据进度更新爆炸效果
      // 根据爆炸类型调整动画效果
      let scale;
      if (options.type === 'missile') {
        // 导弹爆炸 - 快速放大后缓慢缩小
        if (progress < 0.2) {
          // 放大阶段
          scale = options.scale * (0.5 + progress * 5); // 从0.5倍快速放大到最大2.0倍
        } else {
          // 缩小阶段
          scale = options.scale * (2.0 - (progress - 0.2) * 2); // 从2.0倍逐渐缩小到0
        }
      } else if (options.type === 'shell') {
        // 炮弹爆炸 - 中等速度放大后缩小
        if (progress < 0.3) {
          // 放大阶段
          scale = options.scale * (0.5 + progress * 3); // 从0.5倍放大到最大1.5倍
        } else {
          // 缩小阶段
          scale = options.scale * (1.5 - (progress - 0.3) * 2); // 从1.5倍逐渐缩小到0
        }
      } else {
        // 普通子弹爆炸 - 默认动画
        if (progress < 0.3) {
          // 放大阶段
          scale = options.scale * (0.5 + progress * 2.5); // 从0.5倍逐渐放大到最大1.25倍
        } else {
          // 缩小阶段
          scale = options.scale * (1.25 - (progress - 0.3) * 1.8); // 从1.25倍逐渐缩小到0
        }
      }
      
      // 透明度从1逐渐变为0
      const alpha = Math.max(0, 1 - progress);
      
      // 更新爆炸效果的缩放和透明度
      if (entity.billboard) {
        entity.billboard.scale = scale;
        entity.billboard.color = options.color.withAlpha(alpha);
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