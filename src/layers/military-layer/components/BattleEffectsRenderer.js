/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { MilitaryConfig, BattleConfig } from '@/config/GameConfig';
import { ModelInstanceLoader } from "./ModelInstanceLoader";
import { ModelPoseCalculator } from "../utils/ModelPoseCalculator";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { GeoMathUtils } from "@/layers/scene-layer/utils/GeoMathUtils";
import { MilitaryInstanceRenderer } from "./MilitaryInstanceRenderer";
import { showSuccess } from "@/layers/interaction-layer/utils/MessageBox";
import { OverviewConsole } from "@/layers/interaction-layer/utils/OverviewConsole";

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
    
    // 获取姿态计算器
    this.poseCalculator = ModelPoseCalculator.getInstance(viewer);
    // 获取部队实例映射表
    this.forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap(viewer);
    // 获取部队实例渲染器
    this.renderer = MilitaryInstanceRenderer.getInstance(viewer);
    
    // 活跃中的子弹实体 {id: {type, entity, startTime, endTime, completed}}
    this.activeBullets = new Map();
    // 爆炸效果集合
    this.explosions = new Map();
    // 特效ID计数器
    this.effectCounter = 0;
    // 特效更新句柄
    this._updateHandle = null;
    // 战斗数据实例
    this.battleInstances = [];
    // 战斗时的临时朝向 {battleId: {forceId: tempHeading}}
    this.battleHeadings = new Map();
  }

  /**
   * 启动特效更新循环
   */
  startEffectsUpdateLoop() {
    if (this._updateHandle) return;
    
    this._updateHandle = this.viewer.scene.postUpdate.addEventListener(() => {
      // 当前时间
      const now = Date.now();
      
      // 检查所有活跃子弹是否完成
      this.activeBullets.forEach((bullet, id) => {
        if (bullet.completed) return;
        
        if (now >= bullet.endTime) {
          // 子弹效果结束
          bullet.completed = true;
          
          // 创建目标位置的爆炸效果
          if (bullet.targetPosition && bullet.battleId && bullet.bulletType) {
            this._createExplosion(bullet.targetPosition, bullet.battleId, bullet.bulletType);
          }
          
          // 移除子弹实体
          if (bullet.entity) {
            try {
              this.viewer.entities.remove(bullet.entity);
            } catch (error) {
              console.warn(`在更新循环中移除子弹实体时出错: ${error.message}`);
            }
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
          if (explosion.entity) {
            try {
              this.viewer.entities.remove(explosion.entity);
            } catch (error) {
              console.warn(`在更新循环中移除爆炸实体时出错: ${error.message}`);
            }
          }
        }
      });
    });
    
    console.log('已启动特效更新循环');
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
    // 清除所有活跃子弹
    this.activeBullets.forEach(bullet => {
      if (bullet.entity) {
        try {
          this.viewer.entities.remove(bullet.entity);
        } catch (error) {
          console.warn(`移除子弹实体时出错: ${error.message}`);
        }
      }
    });
    this.activeBullets.clear();
    
    // 清除所有爆炸效果
    this.explosions.forEach(explosion => {
      if (explosion.entity) {
        try {
          this.viewer.entities.remove(explosion.entity);
        } catch (error) {
          console.warn(`移除爆炸实体时出错: ${error.message}`);
        }
      }
    });
    this.explosions.clear();

    // 清除战斗实例数据
    this.battleInstances = [];
    
    console.log('已清理所有战斗特效');
  }

  /**
   * 创建战斗特效配置
   * @param {string} battleId 战斗ID
   * @param {Array} attackerForces 攻击方部队ID数组
   * @param {Array} defenderForces 防守方部队ID数组
   * @returns {Array} 战斗特效配置数组
   */
  _createBattleEffectsConfig(battleId, attackerForces, defenderForces) {
    // 战斗实例列表，包含所有符合要求的战斗单位和其目标
    const battleInstances = [];
    
    // 1. 获取所有参战部队并分配子弹类型
    // 收集攻击方部队实例（只包含有战斗机会的部队）
    const attackerBattleForces = attackerForces
      .map(forceId => {
        const force = this.store.getForceById(forceId);
        const forceInstance = this.forceInstanceMap.get(forceId);
        return { force, forceInstance };
      })
      .filter(item => item.force && item.force.combatChance > 0 && item.forceInstance);
    // 收集防守方部队实例
    const defenderBattleForces = defenderForces
      .map(forceId => {
        const force = this.store.getForceById(forceId);
        const forceInstance = this.forceInstanceMap.get(forceId);
        return { force, forceInstance };
      })
      .filter(item => item.force && item.forceInstance);
    // 处理攻击方部队
    const attackerOriginForces = this._processBattleForces(attackerBattleForces, 'attacker');
    // 处理防守方部队
    const defenderOriginForces = this._processBattleForces(defenderBattleForces, 'defender');
    
    // 2. 每个进攻部队分配目标防守部队，并为每个防守部队分配目标进攻部队
    // 为攻击方分配防守目标
    this._assignTargetsForForces(attackerOriginForces, defenderOriginForces, battleInstances);
    // 为防守方分配攻击目标
    this._assignTargetsForForces(defenderOriginForces, attackerOriginForces, battleInstances);
    
    // 3. 计算子弹轨迹、出现点、落点和飞行时间
    this._calculateBulletTrajectories(battleInstances);
    
    // 4. 计算粒子效果参数
    this._calculateParticleEffects(battleInstances);
    
    // 为每个战斗实例添加战斗ID
    battleInstances.forEach(instance => {
      instance.battleId = battleId;
    });
    
    // 保存战斗数据
    this.battleInstances = battleInstances;

    // 在控制台输出战斗实例详细信息
    // console.log('\n▶ 战斗实例详细信息:');
    // battleInstances.forEach((instance, index) => {
    //   console.log(`\n  战斗实例 #${index + 1}:`);
    //   console.log(`  ├─ 战斗ID: ${instance.battleId}`);
      
    //   // 输出原始部队信息
    //   console.log('  ├─ 原始部队:');
    //   console.log(`  │  ├─ 战斗类型: ${instance.originForce.battleType}`);
    //   console.log(`  │  ├─ 部队ID: ${instance.originForce.forceInstance.force.forceId}`);
    //   console.log(`  │  └─ 部队名称: ${instance.originForce.forceInstance.force.forceName}`);
      
    //   // 输出目标部队信息
    //   console.log('  ├─ 目标部队:');
    //   console.log(`  │  ├─ 部队ID: ${instance.targetForce.forceInstance.force.forceId}`);
    //   console.log(`  │  └─ 部队名称: ${instance.targetForce.forceInstance.force.forceName}`);
      
    //   // 输出子弹效果信息
    //   console.log('  └─ 子弹效果:');
    //   instance.originForce.bulletEffectMap.forEach((effect, unitId) => {
    //     console.log(`\n     ├─ 单位ID: ${unitId}`);
    //     console.log(`     ├─ 子弹类型: ${effect.bulletType}`);
    //     console.log(`     ├─ 发射次数: ${effect.fireCount}`);
    //     console.log(`     ├─ 发射延迟: ${effect.delay}ms`);
    //     console.log(`     ├─ 起始点: ${effect.startPosition ? `(${effect.startPosition.longitude.toFixed(2)}, ${effect.startPosition.latitude.toFixed(2)}, ${effect.startPosition.height.toFixed(2)})` : '未设置'}`);
    //     console.log(`     ├─ 落点: ${effect.endPosition ? `(${effect.endPosition.longitude.toFixed(2)}, ${effect.endPosition.latitude.toFixed(2)}, ${effect.endPosition.height.toFixed(2)})` : '未设置'}`);
    //     console.log(`     ├─ 飞行方向（角度）: ${effect.heading ? effect.heading.toFixed(2) : '未设置'}`);
    //     console.log(`     └─ 飞行时间: ${effect.flightDuration}ms`);
    //   });
    // });
    
    return battleInstances;
  }

  /**
   * 处理战斗部队，为每个兵种分配子弹类型
   * @param {Array} battleForces 战斗部队数组，每项包含{force, forceInstance}
   * @param {string} battleType 战斗类型，'attacker'或'defender'
   * @returns {Array} 处理后的部队数组，每项包含{battleType, forceInstance, bulletEffectMap}
   */
  _processBattleForces(battleForces, battleType) {
    const processedForces = [];
    
    battleForces.forEach(({ force, forceInstance }) => {
      // 为每个部队创建子弹效果映射
      const bulletEffectMap = new Map();
      let hasBulletEffect = false;
      
      // 遍历部队中的每个兵种实例
      forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
        // 获取兵种的渲染键
        const renderingKey = unitInstance.renderingKey;
        
        // 从配置中获取子弹类型
        const modelConfig = MilitaryConfig.models[renderingKey];
        if (!modelConfig || !modelConfig.bullet || modelConfig.bullet === 'none') {
          return; // 跳过没有子弹配置或子弹为none的兵种
        }
        
        // 获取子弹配置
        const bulletType = modelConfig.bullet;
        const bulletConfig = MilitaryConfig.bullets[bulletType];
        if (!bulletConfig) {
          return; // 跳过配置缺失的子弹类型
        }
        
        // 创建子弹效果
        const bulletEffect = {
          unitInstanceId,
          bulletType,
          path: bulletConfig.path,
          speed: bulletConfig.speed,
          fireCount: bulletConfig.fireCount,
          delay: bulletConfig.fireInterval + Math.random() * 500 // 添加随机延迟
        };
        
        // 将子弹效果添加到映射中
        bulletEffectMap.set(unitInstanceId, bulletEffect);
        hasBulletEffect = true;
      });
      
      // 只添加有子弹效果的部队
      if (hasBulletEffect) {
        processedForces.push({
          battleType,
          forceInstance,
          bulletEffectMap
        });
      }
    });
    
    return processedForces;
  }

  /**
   * 为部队分配攻击目标
   * @param {Array} originForces 原始部队数组
   * @param {Array} targetCandidates 目标候选部队数组
   * @param {Array} battleInstances 战斗实例数组，将被修改
   */
  _assignTargetsForForces(originForces, targetCandidates, battleInstances) {
    if (originForces.length === 0 || targetCandidates.length === 0) {
      return;
    }
    
    // 为每个原始部队分配一个目标
    originForces.forEach((originForce, index) => {
      // 如果目标候选数小于原始部队数，则循环分配
      const targetIndex = index % targetCandidates.length;
      const targetForce = targetCandidates[targetIndex];
      
      // 创建战斗实例
      battleInstances.push({
        originForce,
        targetForce: {
          forceInstance: targetForce.forceInstance
        }
      });
    });
  }

  /**
   * 计算子弹轨迹、出现点、落点和飞行时间
   * @param {Array} battleInstances 战斗实例数组，将被修改
   */
  _calculateBulletTrajectories(battleInstances) {
    if (!battleInstances || battleInstances.length === 0) {
      return;
    }
    
    // 遍历每个战斗实例
    for (const battleInstance of battleInstances) {
      const originForce = battleInstance.originForce;
      const targetForce = battleInstance.targetForce;
      
      // 验证基本数据有效性
      if (!originForce || !targetForce || !originForce.forceInstance || !targetForce.forceInstance) {
        console.warn('战斗实例中的部队数据无效，跳过计算子弹轨迹');
        continue;
      }
      
      // 获取目标部队位置
      const targetPose = targetForce.forceInstance.pose;
      if (!targetPose || !targetPose.position) {
        console.warn('目标部队位置无效，跳过计算子弹轨迹');
        continue;
      }
      
      // 确保目标位置的经纬度有效
      const targetLon = targetPose.position.longitude;
      const targetLat = targetPose.position.latitude;
      const targetHeight = targetPose.position.height;
      
      if (!isFinite(targetLon) || !isFinite(targetLat) || !isFinite(targetHeight)) {
        console.warn(`目标部队坐标无效: (${targetLon}, ${targetLat}, ${targetHeight})`);
        continue;
      }
      
      // 获取子弹效果映射表
      const bulletEffectMap = originForce.bulletEffectMap;
      if (!bulletEffectMap || bulletEffectMap.size === 0) {
        console.warn('部队没有可用的子弹效果配置');
        continue;
      }
      
      // 为每个兵种计算子弹轨迹
      for (const [unitInstanceId, bulletEffect] of bulletEffectMap.entries()) {
        try {
          // 获取兵种实例
          const unitInstance = originForce.forceInstance.unitInstanceMap.get(unitInstanceId);
          if (!unitInstance) {
            console.warn(`找不到兵种实例: ${unitInstanceId}`);
            continue;
          }
          
          // 计算兵种位置
          const posWithHex = this.poseCalculator.computeUnitPosition({
            forcePose: originForce.forceInstance.pose,
            localOffset: unitInstance.localOffset,
            hexId: originForce.forceInstance.force.hexId,
            service: originForce.forceInstance.force.service
          });
          
          if (!posWithHex || !posWithHex.position) {
            console.warn(`计算的兵种位置无效: ${unitInstanceId}`);
            continue;
          }
          
          const unitPos = posWithHex.position;
          if (!unitPos || !isFinite(unitPos.longitude) || !isFinite(unitPos.latitude) || !isFinite(unitPos.height)) {
            console.warn(`兵种位置坐标无效: (${unitPos?.longitude}, ${unitPos?.latitude}, ${unitPos?.height})`);
            continue;
          }
          
          // 计算目标的随机落点
          const targetRadius = MilitaryConfig.layoutConfig.unitLayout.radius || 50;
          const randomAngle = Math.random() * Math.PI * 2;
          const randomRadius = Math.random() * targetRadius;
          
          // 计算落点的经纬度偏移
          const metersPerDegree = 111000;
          const latOffset = (randomRadius * Math.sin(randomAngle)) / metersPerDegree;
          const lonOffset = (randomRadius * Math.cos(randomAngle)) / (metersPerDegree * Math.cos(targetLat * Math.PI / 180));
          
          // 目标随机落点
          const endPosition = {
            longitude: targetLon + lonOffset,
            latitude: targetLat + latOffset,
            height: targetHeight + 10 // 略高于地面
          };
          
          // 计算子弹飞行方向
          const heading = GeoMathUtils.calculateHeading(unitPos, endPosition);
          
          // 计算子弹出现点（略微偏移，避免从模型内部出现）
          const startPosition = this._calculateBulletStartPosition(unitPos, heading, 10);
          
          // 验证最终计算的坐标有效性
          if (!isFinite(startPosition.longitude) || !isFinite(startPosition.latitude) || !isFinite(startPosition.height) ||
              !isFinite(endPosition.longitude) || !isFinite(endPosition.latitude) || !isFinite(endPosition.height) ||
              !isFinite(heading)) {
            console.warn(`计算的子弹坐标无效: 起点(${startPosition.longitude}, ${startPosition.latitude}, ${startPosition.height}), 终点(${endPosition.longitude}, ${endPosition.latitude}, ${endPosition.height}), 朝向: ${heading}`);
            continue;
          }
          
          // 计算飞行距离和时间
          const startCartesian = Cesium.Cartesian3.fromDegrees(
            startPosition.longitude, 
            startPosition.latitude, 
            startPosition.height || 0
          );
          
          const endCartesian = Cesium.Cartesian3.fromDegrees(
            endPosition.longitude, 
            endPosition.latitude, 
            endPosition.height || 0
          );
          
          const distance = Cesium.Cartesian3.distance(startCartesian, endCartesian);
          const speed = bulletEffect.speed || 200; // 默认200米/秒
          const flightDuration = distance / speed * 1000; // 转换为毫秒
          
          // 更新子弹效果
          bulletEffect.startPosition = startPosition;
          bulletEffect.endPosition = endPosition;
          bulletEffect.heading = heading;
          bulletEffect.flightDuration = flightDuration;
          
          // console.log(`计算子弹轨迹成功 - ${unitInstanceId}, 距离: ${distance.toFixed(2)}m, 飞行时间: ${flightDuration.toFixed(2)}ms`);
        } catch (error) {
          console.error(`计算子弹轨迹出错: ${unitInstanceId}, ${error.message}`, error);
        }
      }
    }
  }

  /**
   * 计算子弹出现点
   * @param {Object} unitPos 兵种位置
   * @param {number} heading 朝向角度（弧度）
   * @param {number} offset 偏移距离（米）
   * @returns {Object} 子弹出现点
   */
  _calculateBulletStartPosition(unitPos, heading, offset) {
    if (!unitPos || !isFinite(unitPos.longitude) || !isFinite(unitPos.latitude) || !isFinite(unitPos.height) || 
        !isFinite(heading) || !isFinite(offset)) {
      console.warn(`计算子弹出现点的参数无效 - unitPos: ${JSON.stringify(unitPos)}, heading: ${heading}, offset: ${offset}`);
      // 返回默认位置，避免错误
      return {
        longitude: 0,
        latitude: 0,
        height: 0
      };
    }
    
    // 计算经纬度偏移
    const metersPerDegree = 111000; // 每度大约111公里
    const latOffset = (offset * Math.sin(heading)) / metersPerDegree;
    const lonOffset = (offset * Math.cos(heading)) / (metersPerDegree * Math.cos(unitPos.latitude * Math.PI / 180));
    
    return {
      longitude: unitPos.longitude + lonOffset,
      latitude: unitPos.latitude + latOffset,
      height: unitPos.height + 10 // 略高于兵种位置
    };
  }
  
  /**
   * 计算两点间的朝向角度
   * @param {Object} from 起始点，包含{longitude, latitude}
   * @param {Object} to 终点，包含{longitude, latitude}
   * @returns {number} 朝向角度（弧度）
   */
  _calculateHeading(from, to) {
    if (!from || !to || 
        !isFinite(from.longitude) || !isFinite(from.latitude) || 
        !isFinite(to.longitude) || !isFinite(to.latitude)) {
      console.warn(`计算朝向的参数无效 - from: ${JSON.stringify(from)}, to: ${JSON.stringify(to)}`);
      return 0; // 返回默认朝向
    }
    
    // 将经纬度转换为弧度
    const fromLon = from.longitude * Math.PI / 180;
    const fromLat = from.latitude * Math.PI / 180;
    const toLon = to.longitude * Math.PI / 180;
    const toLat = to.latitude * Math.PI / 180;
    
    // 计算朝向
    const y = Math.sin(toLon - fromLon) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLon - fromLon);
    
    return Math.atan2(y, x);
  }

  /**
   * 计算粒子效果参数
   * @param {Array} battleInstances 战斗实例数组，将被修改
   */
  _calculateParticleEffects(battleInstances) {
    battleInstances.forEach(battleInstance => {
      battleInstance.originForce.bulletEffectMap.forEach(bulletEffect => {
        // 根据子弹类型从配置中获取粒子效果参数
        const bulletConfig = MilitaryConfig.bullets[bulletEffect.bulletType];
        
        if (bulletConfig && bulletConfig.particle) {
          const particleConfig = bulletConfig.particle;
          
          // 设置粒子效果参数
          bulletEffect.explosionType = particleConfig.explosionType;
          bulletEffect.explosionSize = particleConfig.explosionSize;
          bulletEffect.explosionDuration = particleConfig.explosionDuration;
          bulletEffect.particleImage = particleConfig.particleImage;
        } else {
          console.error(`找不到粒子效果参数: ${bulletEffect.bulletType}`);
        }
      });
    });
  }

  /**
   * 执行部队转向和战斗动画
   * @param {string} battleId 战斗ID
   * @param {Array} attackerForces 攻击方部队ID数组
   * @param {Array} defenderForces 防守方部队ID数组
   * @returns {Promise<void>} 当所有动画完成时解析的Promise
   */
  async createBattleEffects(battleId, attackerForces, defenderForces) {    
    // 清理现有特效
    this.clearAllEffects();
    
    // 验证参数
    if (!battleId || !attackerForces || !defenderForces) {
      console.warn(`缺少战斗参数，无法创建动画: battleId=${battleId}`);
      return;
    }
    
    // 确保更新循环已启动
    this.startEffectsUpdateLoop();
    
    try {
      // 1. 创建战斗配置
      const battleInstances = this._createBattleEffectsConfig(battleId, attackerForces, defenderForces);
      if (!battleInstances || battleInstances.length === 0) {
        console.warn(`没有生成有效的战斗实例配置`);
        return;
      }

      // 为每个兵种模型添加动画
      for (const battleInstance of battleInstances) {
        const forceInstance = battleInstance.originForce.forceInstance;
        if (!forceInstance || !forceInstance.unitInstanceMap) continue;
        forceInstance.unitInstanceMap.forEach(unitInstance => {
          this.renderer.addAnimation(unitInstance, 'attack');
        });
      }
      
      // 2. 执行部队转向动画（等待完成）
      console.log(`开始执行部队转向动画`);
      await this._rotateForces(battleInstances, battleId);
      console.log(`部队转向动画完成`);
      
      // 3. 执行子弹效果（不等待，异步进行）
      console.log(`开始执行子弹效果`);
      this._executeBulletEffects(battleInstances, battleId);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 4. 等待所有子弹和爆炸特效完成
      console.log(`等待所有子弹和爆炸特效完成`);
      await this._waitForAllEffectsComplete(battleId);

      showSuccess('战斗结束！正在打扫战场...');
      OverviewConsole.success('战斗结束！正在打扫战场...');
      
      // 5. 执行被消灭部队的渐隐动画
      await this._fadeOutAnimation(1500);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 6. 执行部队回转动画（等待完成）
      console.log(`开始执行部队回转动画`);
      await this._rotateBackForces(battleId);
      console.log(`部队回转动画完成`);

      await new Promise(resolve => setTimeout(resolve, 1000));
      // 为每个兵种模型移除动画
      for (const battleInstance of battleInstances) {
        const forceInstance = battleInstance.originForce.forceInstance;
        if (!forceInstance || !forceInstance.unitInstanceMap) continue;
        forceInstance.unitInstanceMap.forEach(unitInstance => {
          this.renderer.removeAnimation(unitInstance);
        });
      }
      
      console.log(`战斗动画完成 - 战斗ID: ${battleId}`);
    } catch (error) {
      console.error(`战斗动画执行出错: ${error.message}`, error);
    }
  }

  async _fadeOutAnimation(duration = 1000) {
    // console.log('开始执行部队渐隐动画');
    const allForces = this.store.getForces();
    const fadePromises = [];
    
    // 遍历所有部队，找出兵力为0的部队
    allForces.forEach(force => {
      if (force.troopStrength <= 0) {
        // 获取部队实例
        const forceInstance = this.forceInstanceMap.get(force.forceId);
        if (!forceInstance || !forceInstance.unitInstanceMap) {
          console.warn(`找不到部队实例或其单位实例映射: ${force.forceId}`);
          return;
        }
        
        // console.log(`为兵力为0的部队执行渐隐动画: ${force.forceId} - ${force.forceName}`);
        
        // 为该部队的每个兵种实例创建渐隐动画
        forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
          if (!unitInstance.activeModel) {
            console.warn(`兵种实例没有激活的模型: ${unitInstanceId}`);
            return;
          }
          
          // 添加到渐隐Promise数组
          fadePromises.push(
            this._fadeOut(unitInstance.activeModel, duration)
              .catch(error => {
                console.error(`兵种 ${unitInstanceId} 渐隐动画执行错误: ${error.message}`);
              })
          );
        });
      }
    });
    
    // 等待所有渐隐动画完成
    if (fadePromises.length > 0) {
      // console.log(`共有 ${fadePromises.length} 个兵种模型需要执行渐隐动画`);
      await Promise.all(fadePromises);
      // console.log('所有部队渐隐动画已完成');
    } else {
      // console.log('没有找到需要执行渐隐动画的兵种模型');
    }
  }

  async _fadeOut(model, duration = 1000) {
    return new Promise(resolve => {
      if (!model) {
        console.warn('无法执行渐隐动画：模型不存在');
        resolve();
        return;
      }
      
      // 如果模型已经隐藏，直接返回
      if (!model.show) {
        resolve();
        return;
      }
      
      let start = null;
      // 记录初始颜色
      let initialColor = model.color ? model.color.clone() : Cesium.Color.WHITE.clone();
      let startAlpha = initialColor.alpha;
    
      function animate(timestamp) {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        let progress = Math.min(elapsed / duration, 1.0);
        
        // 使用指数缓动函数，创建更均匀的渐隐效果
        // easeOutQuad函数: 在开始时变化更明显，结束时变化更平滑
        let easedProgress = 1 - Math.pow(1 - progress, 2);
        let newAlpha = startAlpha * (1.0 - easedProgress);
        
        try {
          // 应用新的透明度
          model.color = Cesium.Color.fromAlpha(initialColor, newAlpha);
          
          if (progress < 1.0) {
            requestAnimationFrame(animate);
          } else {
            // 动画结束后彻底隐藏
            model.show = false;
            // console.log('模型渐隐动画完成');
            resolve();
          }
        } catch (error) {
          console.error('渐隐动画执行错误:', error.message);
          resolve();
        }
      }
      
      // 开始动画
      requestAnimationFrame(animate);
    });
  }

  /**
   * 执行模型转向动画
   * @param {Object} unitInstance 兵种实例
   * @param {Object} position 位置{longitude, latitude, height}
   * @param {number} startHeading 起始朝向（弧度）
   * @param {number} targetHeading 目标朝向（弧度）
   * @param {number} duration 动画持续时间（毫秒）
   * @returns {Promise<void>} 当转向完成时解析的Promise
   */
  _rotateModel(unitInstance, position, startHeading, targetHeading, duration = 300) {
    return new Promise(resolve => {
      if (!unitInstance || !unitInstance.activeModel) {
        resolve();
        return;
      }

      const startTime = Date.now();
      let completed = false;
      
      // 创建动画更新函数
      const updateRotation = () => {
        if (completed) {
          resolve();
          return;
        }
        
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        
        let currentHeading;
        if (progress >= 1.0) {
          currentHeading = targetHeading;
          completed = true;
        } else {
          currentHeading = GeoMathUtils.lerpAngle(startHeading, targetHeading, progress);
        }
        
        // 计算新的模型矩阵
        const modelMatrix = this.poseCalculator.computeModelMatrix(
          position,
          currentHeading,
          unitInstance.offset
        );
        
        // 应用到活跃模型
        Cesium.Matrix4.clone(modelMatrix, unitInstance.activeModel.modelMatrix);
        
        if (completed) {
          resolve();
          return;
        }
        
        // 继续动画
        requestAnimationFrame(updateRotation);
      };
      
      // 启动动画
      requestAnimationFrame(updateRotation);
    });
  }

  /**
   * 执行部队转向动画
   * @param {Array} battleInstances 战斗实例数组
   * @param {string} battleId 战斗ID
   * @returns {Promise<void>} 当所有转向完成时解析的Promise
   * @private
   */
  async _rotateForces(battleInstances, battleId) {
    // 创建用于存储这个战斗的临时朝向数据
    const battleHeadingsMap = new Map();
    this.battleHeadings.set(battleId, battleHeadingsMap);
    
    const rotationPromises = [];
    
    // 为每个战斗实例执行转向
    for (const battleInstance of battleInstances) {
      const originForce = battleInstance.originForce;
      const targetForce = battleInstance.targetForce;
      
      // 计算从原始部队到目标部队的朝向
      const fromPos = originForce.forceInstance.pose.position;
      const toPos = targetForce.forceInstance.pose.position;
      
      // 验证位置有效性
      if (!fromPos || !toPos || 
          !isFinite(fromPos.longitude) || !isFinite(fromPos.latitude) ||
          !isFinite(toPos.longitude) || !isFinite(toPos.latitude)) {
        console.warn('部队位置无效，无法计算朝向');
        continue;
      }
      
      // 计算目标朝向角度
      const targetHeading = GeoMathUtils.calculateHeading(fromPos, toPos);
      
      // 获取部队的原始朝向和ID
      const forceId = originForce.forceInstance.force.forceId;
      const originalHeading = originForce.forceInstance.pose.heading || 0;
      
      // 保存战斗时的临时朝向，用于回转
      battleHeadingsMap.set(forceId, targetHeading);
      
      // 对每个兵种执行转向动画
      for (const [unitInstanceId, unitInstance] of originForce.forceInstance.unitInstanceMap.entries()) {
        if (!unitInstance.activeModel) continue;
        
        // 计算单位当前位置
        const unitPos = this.poseCalculator.computeUnitPosition({
          forcePose: originForce.forceInstance.pose,
          localOffset: unitInstance.localOffset,
          hexId: originForce.forceInstance.force.hexId,
          service: originForce.forceInstance.force.service
        });
        
        if (!unitPos || !unitPos.position) {
          console.warn(`计算兵种 ${unitInstanceId} 位置失败，跳过转向`);
          continue;
        }
        
        // 创建转向动画Promise
        rotationPromises.push(
          this._rotateModel(
            unitInstance,
            unitPos.position,
            originalHeading,
            targetHeading,
          ).catch(error => {
            console.error(`兵种 ${unitInstanceId} 转向动画执行错误: ${error.message}`);
          })
        );
      }
    }
    
    // 等待所有转向完成
    if (rotationPromises.length > 0) {
      await Promise.all(rotationPromises);
      // console.log(`战斗 ${battleId} 的所有部队转向已完成，共 ${rotationPromises.length} 个兵种`);
    } else {
      console.warn(`战斗 ${battleId} 没有需要转向的兵种`);
    }
  }

  /**
   * 执行部队回转动画（战斗结束后转回原始朝向）
   * @param {string} battleId 战斗ID
   * @returns {Promise<void>} 当所有回转完成时解析的Promise
   * @private
   */
  async _rotateBackForces(battleId) {
    // 检查是否存在临时朝向数据
    if (!this.battleHeadings.has(battleId)) {
      console.warn(`找不到战斗 ${battleId} 的临时朝向数据，跳过回转`);
      return;
    }

    const battleHeadingsMap = this.battleHeadings.get(battleId);
    const rotationPromises = [];

    // console.log(`开始回转所有部队 - 临时朝向数据共有 ${battleHeadingsMap.size} 条记录`);

    // 获取所有参与战斗的部队ID
    const forceIds = Array.from(battleHeadingsMap.keys());

    for (const forceId of forceIds) {
      // 从forceInstanceMap获取部队实例
      const forceInstance = this.forceInstanceMap.get(forceId);
      if (!forceInstance) {
        console.warn(`找不到部队实例 ${forceId}，跳过回转`);
        continue;
      }

      // 获取部队的当前临时朝向和原始朝向
      const tempHeading = battleHeadingsMap.get(forceId);
      const originalHeading = forceInstance.pose.heading || 0;

      // console.log(`部队 ${forceId} 临时朝向: ${tempHeading.toFixed(2)}, 原始朝向: ${originalHeading.toFixed(2)}`);

      // 对每个兵种执行回转动画
      for (const [unitInstanceId, unitInstance] of forceInstance.unitInstanceMap.entries()) {
        if (!unitInstance.activeModel) {
          console.warn(`兵种 ${unitInstanceId} 没有激活的模型，跳过回转`);
          continue;
        }

        // 计算单位当前位置
        const unitPos = this.poseCalculator.computeUnitPosition({
          forcePose: forceInstance.pose,
          localOffset: unitInstance.localOffset,
          hexId: forceInstance.force.hexId,
          service: forceInstance.force.service
        });

        if (!unitPos || !unitPos.position) {
          console.warn(`计算兵种 ${unitInstanceId} 位置失败，跳过回转`);
          continue;
        }

        // 确保回转角度与临时朝向有明显差别
        let actualTempHeading = tempHeading;
        if (Math.abs(tempHeading - originalHeading) < 0.01) {
          console.warn(`兵种 ${unitInstanceId} 临时朝向与原始朝向几乎相同，设置一个明显的差异`);
          // 如果几乎没有差异，强制设置一个差异以确保动画效果
          actualTempHeading = tempHeading + 0.1;
        }
        
        // 创建回转动画Promise
        rotationPromises.push(
          this._rotateModel(
            unitInstance,
            unitPos.position,
            actualTempHeading,
            originalHeading,
          ).catch(error => {
            console.error(`兵种 ${unitInstanceId} 回转动画执行错误: ${error.message}`);
          })
        );
      }
    }

    // 确保我们有回转动画要执行
    if (rotationPromises.length === 0) {
      console.warn(`战斗 ${battleId} 没有发现需要回转的兵种模型`);
      // 清理这个战斗的临时朝向数据
      this.battleHeadings.delete(battleId);
      return;
    }

    // console.log(`战斗 ${battleId} 共有 ${rotationPromises.length} 个兵种模型需要回转`);

    // 等待所有回转完成
    await Promise.all(rotationPromises);
    // console.log(`战斗 ${battleId} 的所有部队回转已完成`);

    // 清理这个战斗的临时朝向数据
    this.battleHeadings.delete(battleId);
  }

  /**
   * 执行子弹效果
   * @param {Array} battleInstances 战斗实例数组
   * @param {string} battleId 战斗ID
   * @private
   */
  _executeBulletEffects(battleInstances, battleId) {
    // 创建发射计划，按照发射延迟排序
    const firePlans = [];
    
    battleInstances.forEach(battleInstance => {
      const originForce = battleInstance.originForce;
      
      originForce.bulletEffectMap.forEach(bulletEffect => {
        // 为每次开火创建子弹效果
        for (let i = 0; i < bulletEffect.fireCount; i++) {
          // 计算开火延迟
          const fireDelay = bulletEffect.delay * i;
          
          // 添加到发射计划
          firePlans.push({
            delay: fireDelay,
            bulletEffect: bulletEffect,
            battleId: battleId
          });
        }
      });
    });
    
    // 排序发射计划（按延迟时间从小到大）
    firePlans.sort((a, b) => a.delay - b.delay);
    
    // 执行发射计划
    firePlans.forEach(plan => {
      setTimeout(() => {
        this._fireBullet(plan.battleId, plan.bulletEffect);
      }, plan.delay);
    });
    
    console.log(`已安排 ${firePlans.length} 个子弹发射计划`);
  }

  /**
   * 发射子弹
   * @param {string} battleId 战斗ID
   * @param {Object} bulletEffect 子弹效果配置
   */
  _fireBullet(battleId, bulletEffect) {
    try {
      const bulletId = `bullet_${++this.effectCounter}`;
      const startTime = Date.now();
      const flightDurationMs = bulletEffect.flightDuration || 2000; // 使用计算好的飞行时间，如果没有默认为2000毫秒
      const endTime = startTime + flightDurationMs;
      
      // 验证坐标
      if (!bulletEffect.startPosition || !bulletEffect.endPosition ||
          !isFinite(bulletEffect.startPosition.longitude) || 
          !isFinite(bulletEffect.startPosition.latitude) ||
          !isFinite(bulletEffect.startPosition.height) ||
          !isFinite(bulletEffect.endPosition.longitude) || 
          !isFinite(bulletEffect.endPosition.latitude) ||
          !isFinite(bulletEffect.endPosition.height)) {
        console.warn(`子弹坐标无效，无法发射: ${bulletEffect.unitInstanceId}`);
        return;
      }
      
      // 从配置中获取子弹类型和路径
      const bulletConfig = MilitaryConfig.bullets[bulletEffect.bulletType];
      const bulletPath = bulletEffect.path || bulletConfig?.path;
      
      if (!bulletPath) {
        console.warn(`子弹没有有效的贴图路径: ${bulletEffect.bulletType}`);
        return;
      }
      
      // 创建子弹实体的位置采样属性
      const positionProperty = new Cesium.SampledPositionProperty();
      
      // 开始位置和结束位置
      const startPosition = Cesium.Cartesian3.fromDegrees(
        bulletEffect.startPosition.longitude,
        bulletEffect.startPosition.latitude,
        bulletEffect.startPosition.height || 0
      );
      
      const endPosition = Cesium.Cartesian3.fromDegrees(
        bulletEffect.endPosition.longitude,
        bulletEffect.endPosition.latitude,
        bulletEffect.endPosition.height || 0
      );
      
      // 设置简单的直线轨迹，不再使用中点
      positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(startTime)), startPosition);
      positionProperty.addSample(Cesium.JulianDate.fromDate(new Date(endTime)), endPosition);
      
      // 计算从起点到终点的方向向量
      const direction = new Cesium.Cartesian3();
      Cesium.Cartesian3.subtract(endPosition, startPosition, direction);
      Cesium.Cartesian3.normalize(direction, direction);
      
      // 从配置中获取缩放比例
      const scale = bulletConfig?.scale || 0.5;
      
      // 创建固定朝向的HeadingPitchRoll（基于从起点到终点的方向）
      const orientation = new Cesium.VelocityOrientationProperty(positionProperty);
      
      // 使用model实体渲染子弹
      const entity = this.viewer.entities.add({
        position: positionProperty,
        orientation: orientation,
        model: {
          uri: bulletPath,
          scale: scale,
          minimumPixelSize: 16,
          maximumScale: 20000,
          runAnimations: false,
          allowPicking: false, 
          imageBasedLightingFactor: new Cesium.Cartesian2(1.0, 1.0),
          color: Cesium.Color.WHITE.withAlpha(1.0),
          lightColor: new Cesium.Color(1.0, 1.0, 1.0, 1.0),
          shadow: Cesium.ShadowMode.ENABLED,
          nodeTransformations: {
            // 调整初始朝向
            root: {
              rotation: Cesium.Quaternion.fromHeadingPitchRoll(
                new Cesium.HeadingPitchRoll(0, Math.PI/2, 0)
              )
            }
          },
          // 确保模型头部向上
          up: new Cesium.Cartesian3(0, 0, 1),
          right: new Cesium.Cartesian3(0, -1, 0),
          forward: new Cesium.Cartesian3(1, 0, 0)
        }
      });
      
      // 为导弹添加轨迹效果
      if (bulletEffect.bulletType === 'missile') {
        entity.path = {
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.RED
          }),
          width: 3,
          leadTime: 0
        };
      }
      
      // 从配置中获取粒子效果参数
      const particleConfig = bulletConfig?.particle;
      
      // 记录子弹信息
      this.activeBullets.set(bulletId, {
        type: bulletEffect.bulletType,
        entity: entity,
        startTime: startTime,
        endTime: endTime,
        completed: false,
        battleId: battleId,
        targetPosition: endPosition,
        bulletType: bulletEffect.bulletType,
        explosionType: particleConfig.explosionType,
        explosionSize: particleConfig.explosionSize,
        explosionDuration: particleConfig.explosionDuration,
        particleImage: particleConfig.particleImage,
        particleScale: particleConfig.particleScale
      });
      
      // console.log(`发射子弹成功 - ID: ${bulletId}, 类型: ${bulletEffect.bulletType}, 飞行时间: ${flightDurationMs.toFixed(2)}ms`);
    } catch (error) {
      console.error(`发射子弹时出错: ${error.message}`, error);
    }
  }

  /**
   * 创建爆炸特效
   * @param {Cesium.Cartesian3} position 爆炸位置
   * @param {string} battleId 战斗ID
   * @param {string} bulletType 子弹类型
   * @private
   */
  _createExplosion(position, battleId, bulletType) {
    try {
      if (!position || !battleId || !bulletType) {
        console.warn('创建爆炸特效时参数无效');
        return;
      }

      const explosionId = `explosion_${++this.effectCounter}`;
      const startTime = Date.now();
      
      // 获取子弹配置
      const bulletConfig = MilitaryConfig.bullets[bulletType];
      const particleConfig = bulletConfig?.particle;
      
      // 获取子弹特效参数
      let explosionDuration = 1000;
      let particleImage = '/assets/maps/explosion.png';
      let explosionSize = 10;
      let particleScale = 0.5; // 默认粒子缩放
      
      // 如果有粒子配置，优先使用配置的参数
      if (particleConfig) {
        explosionDuration = particleConfig.explosionDuration;
        particleImage = particleConfig.particleImage;
        explosionSize = particleConfig.explosionSize;
        particleScale = particleConfig.particleScale || 0.5;
      } else {
        // 查找对应的子弹实例，获取其配置
        const bullet = Array.from(this.activeBullets.values()).find(b => 
          b.battleId === battleId && b.bulletType === bulletType
        );
        
        if (bullet) {
          explosionDuration = bullet.explosionDuration || explosionDuration;
          particleImage = bullet.particleImage || particleImage;
          explosionSize = bullet.explosionSize || explosionSize;
          particleScale = bullet.particleScale || particleScale;
        }
      }
      
      const endTime = startTime + explosionDuration;
      
      // 创建爆炸实体
      const entity = this.viewer.entities.add({
        position: position,
        billboard: {
          image: particleImage,
          scale: particleScale, // 使用配置的缩放比例
          scaleByDistance: new Cesium.NearFarScalar(1.0e2, particleScale * 2.0, 1.0e4, particleScale * 0.5)
        }
      });
      
      // 添加简单的爆炸动画(缩放)
      this._animateExplosion(entity, explosionDuration, explosionSize * particleScale);
      
      // 记录爆炸信息
      this.explosions.set(explosionId, {
        entity: entity,
        startTime: startTime,
        endTime: endTime,
        completed: false,
        battleId: battleId
      });
      
      // console.log(`创建爆炸特效成功 - ID: ${explosionId}, 类型: ${bulletType}, 持续时间: ${explosionDuration}ms, 缩放: ${particleScale}`);
    } catch (error) {
      console.error(`创建爆炸特效时出错: ${error.message}`, error);
    }
  }
  
  /**
   * 为爆炸实体添加动画
   * @param {Cesium.Entity} entity 爆炸实体
   * @param {number} duration 持续时间(毫秒)
   * @param {number} maxSize 最大尺寸
   * @private
   */
  _animateExplosion(entity, duration, maxSize) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // 基础缩放值
    const baseScale = 0.1; // 开始时的基础缩放比例
    
    // 创建爆炸动画回调
    const explosionCallback = () => {
      const now = Date.now();
      if (now > endTime || !entity) {
        return;
      }
      
      // 计算动画进度(0到1)
      const progress = (now - startTime) / duration;
      
      // 根据进度更新爆炸效果
      // 先放大后缩小的效果
      let scale;
      if (progress < 0.3) {
        // 放大阶段 - 从基础缩放值逐渐放大到指定最大值
        scale = baseScale + progress * (maxSize - baseScale) / 0.3;
      } else if (progress < 0.7) {
        // 保持阶段 - 维持最大尺寸一段时间
        scale = maxSize;
      } else {
        // 缩小阶段 - 从最大值逐渐缩小到基础缩放值
        const fadeProgress = (progress - 0.7) / 0.3; // 0到1的缩小进度
        scale = maxSize - fadeProgress * (maxSize - baseScale);
      }
      
      // 透明度从1逐渐变为0
      const alpha = Math.max(0, 1 - progress * 1.2); // 略微加快透明度衰减
      
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
   * 检查特定战斗的所有特效是否已完成
   * @param {string} battleId 战斗ID
   * @returns {boolean} 是否所有特效都已完成
   * @private
   */
  _checkBattleComplete(battleId) {
    // 检查是否所有相关特效都已完成
    let allCompleted = true;
    
    // 检查子弹特效
    this.activeBullets.forEach(bullet => {
      if (bullet.battleId === battleId && !bullet.completed) {
        allCompleted = false;
      }
    });
    
    // 检查爆炸特效
    this.explosions.forEach(explosion => {
      if (explosion.battleId === battleId && !explosion.completed) {
        allCompleted = false;
      }
    });
    
    return allCompleted;
  }
  
  /**
   * 等待特定战斗的所有特效完成
   * @param {string} battleId 战斗ID
   * @returns {Promise<void>} 当所有特效完成时解析的Promise
   * @private
   */
  async _waitForAllEffectsComplete(battleId) {
    // 检查是否有与该战斗相关的特效
    const hasBattleEffects = () => {
      let hasEffects = false;
      
      // 检查子弹特效
      this.activeBullets.forEach(bullet => {
        if (bullet.battleId === battleId && !bullet.completed) {
          hasEffects = true;
        }
      });
      
      // 检查爆炸特效
      this.explosions.forEach(explosion => {
        if (explosion.battleId === battleId && !explosion.completed) {
          hasEffects = true;
        }
      });
      
      return hasEffects;
    };
    
    // 如果没有特效，直接返回
    if (!hasBattleEffects()) {
      return;
    }
    
    // 等待所有特效完成
    return new Promise(resolve => {
      const checkInterval = 500; // 毫秒
      const checkComplete = () => {
        if (!hasBattleEffects()) {
          resolve();
        } else {
          setTimeout(checkComplete, checkInterval);
        }
      };
      
      // 开始检查
      setTimeout(checkComplete, checkInterval);
    });
  }
  
  /**
   * 销毁实例
   */
  destroy() {
    this.clearAllEffects();
    this.stopEffectsUpdateLoop();
    BattleEffectsRenderer.#instance = null;
  }

  /**
   * 渲染战斗特效（外部入口）
   * @param {string} battleId 战斗ID
   * @param {Array} attackerForces 攻击方部队ID数组
   * @param {Array} defenderForces 防守方部队ID数组
   * @returns {Promise<void>} 当所有动画完成时解析的Promise
   */
  async renderBattle(battleId, attackerForces, defenderForces) {
    try {
      return await this.createBattleEffects(battleId, attackerForces, defenderForces);
    } catch (error) {
      console.error(`渲染战斗特效时出错: ${error.message}`, error);
    }
  }
} 