import { JulianDate, ClockRange, ClockStep } from 'cesium';

/**
 * 动画控制器类
 * 负责处理部队移动、进攻、受损等动态效果
 */
export class AnimationController {
  /**
   * 构造函数
   * @param {Object} viewer - Cesium Viewer实例
   * @param {Object} unitPlacer - 单位放置器实例
   */
  constructor(viewer, unitPlacer) {
    this.viewer = viewer;
    this.unitPlacer = unitPlacer;
    this.animations = new Map();
    this.setupClock();
  }

  /**
   * 设置Cesium时钟
   */
  setupClock() {
    // 配置Cesium时钟
    this.viewer.clock.clockRange = ClockRange.LOOP_STOP;
    this.viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    this.viewer.clock.multiplier = 1.0;
    this.viewer.clock.shouldAnimate = true;
  }

  /**
   * 创建移动动画
   * @param {Object} force - 部队数据
   * @param {Array} path - 移动路径（六角格ID数组）
   * @param {Object} options - 动画选项
   * @returns {Object} 动画对象
   */
  createMoveAnimation(force, path, options = {}) {
    const forceId = force.force_id;
    const entity = this.unitPlacer.unitEntities.get(forceId);
    
    if (!entity) {
      console.error(`找不到部队实体: ${forceId}`);
      return null;
    }
    
    // 获取路径上的六角格数据
    const hexDataList = path.map(hexId => this.unitPlacer.hexGridGenerator.getHexData(hexId));
    
    // 过滤无效的六角格
    const validHexDataList = hexDataList.filter(hexData => hexData !== undefined);
    
    if (validHexDataList.length < 2) {
      console.error('有效路径点不足');
      return null;
    }
    
    // 计算路径点
    const positions = validHexDataList.map(hexData => {
      const { longitude, latitude, height } = hexData.position;
      return { longitude, latitude, height: height + 10 }; // 稍微抬高，避免陷入地面
    });
    
    // 设置默认选项
    const defaultOptions = {
      duration: 5.0, // 默认动画持续时间（秒）
      speedFactor: 1.0, // 速度因子
      loop: false, // 是否循环
      onStart: null, // 动画开始回调
      onUpdate: null, // 动画更新回调
      onComplete: null // 动画完成回调
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // 计算动画持续时间（根据路径长度和速度因子调整）
    const pathLength = this.calculatePathLength(positions);
    const duration = (pathLength / 100) * mergedOptions.duration / mergedOptions.speedFactor;
    
    // 创建动画时间轴
    const startTime = JulianDate.now();
    const stopTime = JulianDate.addSeconds(startTime, duration, new JulianDate());
    
    // 设置时钟范围
    this.viewer.clock.startTime = startTime.clone();
    this.viewer.clock.stopTime = stopTime.clone();
    this.viewer.clock.currentTime = startTime.clone();
    
    // 创建动画对象
    const animation = {
      id: `move_${forceId}_${Date.now()}`,
      type: 'move',
      forceId,
      entity,
      path,
      positions,
      startTime,
      stopTime,
      duration,
      options: mergedOptions,
      isPlaying: false,
      isComplete: false
    };
    
    // 存储动画
    this.animations.set(animation.id, animation);
    
    return animation;
  }
  
  /**
   * 计算路径长度
   * @param {Array} positions - 位置数组
   * @returns {number} 路径长度
   */
  calculatePathLength(positions) {
    let length = 0;
    
    for (let i = 1; i < positions.length; i++) {
      const p1 = positions[i - 1];
      const p2 = positions[i];
      
      // 使用简单的欧几里得距离计算
      const dx = (p2.longitude - p1.longitude) * 111320 * Math.cos(p1.latitude * Math.PI / 180);
      const dy = (p2.latitude - p1.latitude) * 111320;
      const dz = p2.height - p1.height;
      
      length += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    return length;
  }
  
  /**
   * 播放移动动画
   * @param {string} animationId - 动画ID
   */
  playMoveAnimation(animationId) {
    const animation = this.animations.get(animationId);
    
    if (!animation || animation.type !== 'move') {
      console.error(`找不到移动动画: ${animationId}`);
      return;
    }
    
    // 设置时钟
    this.viewer.clock.startTime = animation.startTime.clone();
    this.viewer.clock.stopTime = animation.stopTime.clone();
    this.viewer.clock.currentTime = animation.startTime.clone();
    this.viewer.clock.shouldAnimate = true;
    
    // 设置实体位置插值
    const { entity, positions, startTime, stopTime } = animation;
    
    // 创建位置属性
    const positionProperty = new Cesium.SampledPositionProperty();
    
    // 添加位置样本
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const time = JulianDate.addSeconds(
        startTime,
        (i / (positions.length - 1)) * animation.duration,
        new JulianDate()
      );
      
      const cartesian = Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        position.height
      );
      
      positionProperty.addSample(time, cartesian);
    }
    
    // 设置插值选项
    positionProperty.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation
    });
    
    // 应用位置属性
    entity.position = positionProperty;
    
    // 添加方向属性（使模型朝向移动方向）
    entity.orientation = new Cesium.VelocityOrientationProperty(positionProperty);
    
    // 标记动画为播放状态
    animation.isPlaying = true;
    
    // 调用开始回调
    if (typeof animation.options.onStart === 'function') {
      animation.options.onStart(animation);
    }
    
    // 添加时钟事件监听
    this.viewer.clock.onTick.addEventListener(this.onAnimationTick.bind(this, animation));
  }
  
  /**
   * 动画时钟事件处理
   * @param {Object} animation - 动画对象
   */
  onAnimationTick(animation) {
    if (!animation.isPlaying) return;
    
    const currentTime = this.viewer.clock.currentTime;
    
    // 检查动画是否完成
    if (JulianDate.greaterThanOrEquals(currentTime, animation.stopTime)) {
      // 标记动画为完成状态
      animation.isPlaying = false;
      animation.isComplete = true;
      
      // 更新部队位置
      const force = animation.entity.properties.forceData;
      force.hex_id = animation.path[animation.path.length - 1];
      
      // 调用完成回调
      if (typeof animation.options.onComplete === 'function') {
        animation.options.onComplete(animation);
      }
      
      // 移除时钟事件监听
      this.viewer.clock.onTick.removeEventListener(this.onAnimationTick);
      
      // 如果设置了循环，重新开始动画
      if (animation.options.loop) {
        this.playMoveAnimation(animation.id);
      }
    } else {
      // 调用更新回调
      if (typeof animation.options.onUpdate === 'function') {
        const progress = JulianDate.secondsDifference(currentTime, animation.startTime) / animation.duration;
        animation.options.onUpdate(animation, progress);
      }
    }
  }
  
  /**
   * 创建战斗动画
   * @param {Object} attackerForce - 攻击方部队
   * @param {Object} defenderForce - 防御方部队
   * @param {Object} battleResult - 战斗结果
   * @param {Object} options - 动画选项
   * @returns {Object} 动画对象
   */
  createBattleAnimation(attackerForce, defenderForce, battleResult, options = {}) {
    const attackerId = attackerForce.force_id;
    const defenderId = defenderForce.force_id;
    
    const attackerEntity = this.unitPlacer.unitEntities.get(attackerId);
    const defenderEntity = this.unitPlacer.unitEntities.get(defenderId);
    
    if (!attackerEntity || !defenderEntity) {
      console.error(`找不到部队实体: ${!attackerEntity ? attackerId : defenderId}`);
      return null;
    }
    
    // 设置默认选项
    const defaultOptions = {
      duration: 3.0, // 默认动画持续时间（秒）
      onStart: null, // 动画开始回调
      onUpdate: null, // 动画更新回调
      onComplete: null // 动画完成回调
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // 创建动画时间轴
    const startTime = JulianDate.now();
    const stopTime = JulianDate.addSeconds(startTime, mergedOptions.duration, new JulianDate());
    
    // 设置时钟范围
    this.viewer.clock.startTime = startTime.clone();
    this.viewer.clock.stopTime = stopTime.clone();
    this.viewer.clock.currentTime = startTime.clone();
    
    // 创建动画对象
    const animation = {
      id: `battle_${attackerId}_${defenderId}_${Date.now()}`,
      type: 'battle',
      attackerId,
      defenderId,
      attackerEntity,
      defenderEntity,
      battleResult,
      startTime,
      stopTime,
      duration: mergedOptions.duration,
      options: mergedOptions,
      isPlaying: false,
      isComplete: false,
      effects: [] // 存储动画效果
    };
    
    // 存储动画
    this.animations.set(animation.id, animation);
    
    return animation;
  }
  
  /**
   * 播放战斗动画
   * @param {string} animationId - 动画ID
   */
  playBattleAnimation(animationId) {
    const animation = this.animations.get(animationId);
    
    if (!animation || animation.type !== 'battle') {
      console.error(`找不到战斗动画: ${animationId}`);
      return;
    }
    
    // 设置时钟
    this.viewer.clock.startTime = animation.startTime.clone();
    this.viewer.clock.stopTime = animation.stopTime.clone();
    this.viewer.clock.currentTime = animation.startTime.clone();
    this.viewer.clock.shouldAnimate = true;
    
    // 获取攻击方和防御方位置
    const attackerPosition = animation.attackerEntity.position.getValue(this.viewer.clock.currentTime);
    const defenderPosition = animation.defenderEntity.position.getValue(this.viewer.clock.currentTime);
    
    // 创建爆炸效果
    this.createExplosionEffect(animation, defenderPosition);
    
    // 创建射击效果
    this.createShootingEffect(animation, attackerPosition, defenderPosition);
    
    // 标记动画为播放状态
    animation.isPlaying = true;
    
    // 调用开始回调
    if (typeof animation.options.onStart === 'function') {
      animation.options.onStart(animation);
    }
    
    // 添加时钟事件监听
    this.viewer.clock.onTick.addEventListener(this.onBattleAnimationTick.bind(this, animation));
  }
  
  /**
   * 创建爆炸效果
   * @param {Object} animation - 动画对象
   * @param {Cartesian3} position - 爆炸位置
   */
  createExplosionEffect(animation, position) {
    // 创建爆炸实体
    const explosionEntity = this.viewer.entities.add({
      position: position,
      billboard: {
        image: '/assets/explosion.png', // 爆炸图片
        scale: 0.0, // 初始大小为0
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.2)
      }
    });
    
    // 添加到动画效果列表
    animation.effects.push({
      type: 'explosion',
      entity: explosionEntity
    });
  }
  
  /**
   * 创建射击效果
   * @param {Object} animation - 动画对象
   * @param {Cartesian3} startPosition - 起始位置
   * @param {Cartesian3} endPosition - 结束位置
   */
  createShootingEffect(animation, startPosition, endPosition) {
    // 创建射击线实体
    const shootingEntity = this.viewer.entities.add({
      polyline: {
        positions: [startPosition, endPosition],
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW
        }),
        show: false
      }
    });
    
    // 添加到动画效果列表
    animation.effects.push({
      type: 'shooting',
      entity: shootingEntity
    });
  }
  
  /**
   * 战斗动画时钟事件处理
   * @param {Object} animation - 动画对象
   */
  onBattleAnimationTick(animation) {
    if (!animation.isPlaying) return;
    
    const currentTime = this.viewer.clock.currentTime;
    const progress = JulianDate.secondsDifference(currentTime, animation.startTime) / animation.duration;
    
    // 更新动画效果
    animation.effects.forEach(effect => {
      if (effect.type === 'explosion') {
        // 爆炸效果
        if (progress < 0.1) {
          // 开始阶段，逐渐显示
          effect.entity.billboard.scale = progress * 10;
        } else if (progress < 0.8) {
          // 中间阶段，保持显示
          effect.entity.billboard.scale = 1.0;
        } else {
          // 结束阶段，逐渐消失
          effect.entity.billboard.scale = (1.0 - progress) * 5;
        }
      } else if (effect.type === 'shooting') {
        // 射击效果
        if (progress < 0.3) {
          // 开始阶段，显示射击线
          effect.entity.polyline.show = true;
        } else {
          // 结束阶段，隐藏射击线
          effect.entity.polyline.show = false;
        }
      }
    });
    
    // 检查动画是否完成
    if (JulianDate.greaterThanOrEquals(currentTime, animation.stopTime)) {
      // 标记动画为完成状态
      animation.isPlaying = false;
      animation.isComplete = true;
      
      // 清理动画效果
      animation.effects.forEach(effect => {
        this.viewer.entities.remove(effect.entity);
      });
      
      // 更新部队状态
      this.updateForcesAfterBattle(animation);
      
      // 调用完成回调
      if (typeof animation.options.onComplete === 'function') {
        animation.options.onComplete(animation);
      }
      
      // 移除时钟事件监听
      this.viewer.clock.onTick.removeEventListener(this.onBattleAnimationTick);
    } else {
      // 调用更新回调
      if (typeof animation.options.onUpdate === 'function') {
        animation.options.onUpdate(animation, progress);
      }
    }
  }
  
  /**
   * 更新战斗后的部队状态
   * @param {Object} animation - 动画对象
   */
  updateForcesAfterBattle(animation) {
    const { battleResult, attackerEntity, defenderEntity } = animation;
    
    // 获取部队数据
    const attackerForce = attackerEntity.properties.forceData;
    const defenderForce = defenderEntity.properties.forceData;
    
    // 更新部队兵力
    if (battleResult.attacker_loss) {
      attackerForce.troop_strength = Math.max(0, attackerForce.troop_strength - battleResult.attacker_loss);
    }
    
    if (battleResult.defender_loss) {
      defenderForce.troop_strength = Math.max(0, defenderForce.troop_strength - battleResult.defender_loss);
    }
    
    // 如果部队被消灭，移除实体
    if (attackerForce.troop_strength <= 0) {
      this.unitPlacer.removeUnit(attackerForce.force_id);
    }
    
    if (defenderForce.troop_strength <= 0) {
      this.unitPlacer.removeUnit(defenderForce.force_id);
    }
  }
  
  /**
   * 停止动画
   * @param {string} animationId - 动画ID
   */
  stopAnimation(animationId) {
    const animation = this.animations.get(animationId);
    
    if (!animation) {
      console.error(`找不到动画: ${animationId}`);
      return;
    }
    
    // 标记动画为非播放状态
    animation.isPlaying = false;
    
    // 清理动画效果
    if (animation.effects) {
      animation.effects.forEach(effect => {
        this.viewer.entities.remove(effect.entity);
      });
    }
    
    // 移除时钟事件监听
    this.viewer.clock.onTick.removeEventListener(this.onAnimationTick);
    this.viewer.clock.onTick.removeEventListener(this.onBattleAnimationTick);
  }
  
  /**
   * 清除所有动画
   */
  clearAllAnimations() {
    this.animations.forEach((animation, id) => {
      this.stopAnimation(id);
    });
    
    this.animations.clear();
  }
}
