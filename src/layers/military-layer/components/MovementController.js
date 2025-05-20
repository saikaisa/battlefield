/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { HexHeightCache } from "@/layers/scene-layer/components/HexHeightCache";
import { ModelPoseCalculator } from "../utils/ModelPoseCalculator";
import { GeoMathUtils } from "@/layers/scene-layer/utils/GeoMathUtils";
import { MilitaryConfig } from "@/config/GameConfig";

/**
 * 军事单位移动控制器
 * 
 * 主要职责：
 * 1. 处理单位的移动路径规划
 * 2. 控制单位沿路径的平滑移动
 * 3. 基于地形计算移动速度
 * 4. 管理单位移动状态
 */
export class MovementController {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MovementController} 单例实例
   */
  static getInstance(viewer) {
    if (!MovementController.#instance) {
      MovementController.#instance = new MovementController(viewer);
    }
    return MovementController.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    // 获取地形高度缓存系统
    this.terrainCache = HexHeightCache.getInstance(viewer);

    // 获取模型姿态计算器
    this.poseCalculator = ModelPoseCalculator.getInstance(viewer);

    // 获取部队实例映射表
    this.forceInstanceMap = MilitaryInstanceGenerator.getforceInstanceMap();
    
    // 记录正在移动中的部队
    // movingForces: Map<forceId, movementState>
    // movementState: {
    //   force: Force,                    // 部队对象
    //   forcePaths: [                    // 路径
    //     {
    //       hexId: string,               // 六角格ID
    //       position: { longitude, latitude, height }, // 部队在该六角格内的经纬度位置
    //       heading: number,             // 部队在该六角格内的朝向
    //       unitPaths: Map<unitInstanceId, {    // 部队内各兵种的路径
    //         position: { longitude, latitude, height }, // 兵种在该六角格内的经纬度位置
    //         heading: number,           // 兵种在该六角格内的朝向，注意这与部队朝向并不一致！！！
    //         matrix: Matrix4,           // 兵种在该六角格内的变换矩阵（检查点）
    //       }>,
    //       startTime: number(Date),     // 这段路径开始直线运动时的时间戳
    //       startTurnTime: number(Date), // 开始转弯时的时间戳
    //       duration: number,            // 从该点到下一点直线运动需要的时间
    //       turnDuration: number,        // 从该点出发时转向需要的转向时间。最后一个点的转向不参考该值，使用默认转向时间
    //     }
    //   ],
    //   currentPathIndex: number,        // 当前路径段索引，与起点编号相同
    //   isTurning: boolean,              // 是否正在转向
    //   isMoving: boolean,               // 是否正在移动
    //   isComplete: boolean              // 是否完成移动
    // }
    this.movingForces = new Map();
    this.config = MilitaryConfig.movementConfig;
  }

  /**
   * 准备移动
   * @param {string} forceId 部队ID
   * @param {string[]} hexPath 路径（六角格ID数组）
   */
  async prepareMove(forceId, hexPath) {
    console.log(`[Debug] 准备移动 - forceId=${forceId}, 路径:`, hexPath);
    
    const forceInstance = this.forceInstanceMap.get(forceId);
    const force = forceInstance.force;
    
    if (!forceInstance || !force) {
      console.error(`[Error] 无效的部队实例: forceInstance=${!!forceInstance}, force=${!!force}`);
      return false;
    }
    
    // 验证路径有效性
    if (!Array.isArray(hexPath) || hexPath.length < 2) {
      console.error(`[Error] 无效的路径: ${hexPath}`);
      return false;
    }
    
    // =========== 批量预先计算所有位置信息 ===========
    // 1. 批量计算所有路径点上的部队位置
    // 注意：第一个点直接使用当前位置，不需要计算
    const forcePositionsResult = this.poseCalculator.computeForcePosition(force, hexPath.slice(1));
    console.log(`[Debug] 计算部队位置结果:`, forcePositionsResult);
    
    // 构建兵种位置查询索引，便于根据hexId快速查找
    const forcePositionsMap = {};
    // 第一个点使用当前位置
    const startHexId = hexPath[0];
    forcePositionsMap[startHexId] = {...forceInstance.pose.position};
    
    console.log(`[Debug] 起始点位置:`, forcePositionsMap[startHexId]);
    
    // 其他点使用计算结果 (result中不包含第一个六角格)
    forcePositionsResult.forEach(result => {
      forcePositionsMap[result.hexId] = result.position;
    });

    // 检查计算出的位置是否有效
    let invalidPos = false;
    Object.entries(forcePositionsMap).forEach(([hexId, position]) => {
      if (!position || isNaN(position.longitude) || isNaN(position.latitude)) {
        console.error(`[Error] 生成的路径点位置无效: hexId=${hexId}, position=`, position);
        invalidPos = true;
      }
    });
    
    if (invalidPos) {
      console.error(`[Error] 存在无效路径点坐标，中止移动准备`);
      return false;
    }
    
    // 2. 准备兵种单位位置计算参数
    const unitPositionParams = [];
    
    // 起点特殊处理 - 使用当前位置
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      unitPositionParams.push({
        forcePose: {...forceInstance.pose},
        localOffset: unitInstance.localOffset,
        hexId: startHexId,
        unitInstanceId: unitInstanceId
      });
    });
    
    // 路径中其他点
    for (let i = 1; i < hexPath.length; i++) {
      const hexId = hexPath[i];
      const prevHexId = hexPath[i-1];
      const forcePos = forcePositionsMap[hexId];
      
      // 计算从上一个点到当前点的朝向（弃用）
      // const prevForcePos = forcePositionsMap[prevHexId];
      // const forceHeading = GeoMathUtils.calculateHeading(prevForcePos, forcePos);
      // 部队朝向不变
      const forceHeading = forcePos.heading;
      
      // 为每个兵种准备位置计算参数 (包括第一个点)
      forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
        unitPositionParams.push({
          forcePose: { position: forcePos, heading: forceHeading },
          localOffset: unitInstance.localOffset,
          hexId: hexId,
          service: forceInstance.force.service,
          unitInstanceId: unitInstanceId
        });
      });
    }
    
    // 3. 批量计算所有兵种单位在各路径点的位置 (包括第一个点)
    const unitPositionsResult = this.poseCalculator.computeUnitPosition(unitPositionParams);
    
    // 构建兵种位置查询索引
    const unitPositionsMap = {};
    unitPositionsResult.forEach((result, index) => {
      // 获取这个查询结果对应的原查询
      const param = unitPositionParams[index];

      // 确保结果有效
      if (!result) return;

      // 初始化hexId对应的映射
      if (!unitPositionsMap[result.hexId]) {
        unitPositionsMap[result.hexId] = {};
      }
      
      // 后续通过六角格id和兵种模型id即可查到其位置
      unitPositionsMap[result.hexId][param.unitInstanceId] = result.position;
    });
    
    // =========== 构建路径信息 ===========
    const forcePaths = [];
    
    // 4. 处理起点
    const startUnitPaths = new Map();
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      const unitPos = unitPositionsMap[startHexId][unitInstanceId];
      const heading = forceInstance.pose.heading;
      
      startUnitPaths.set(unitInstanceId, {
        position: unitPos,
        heading: heading,
        matrix: unitInstance.activeModel.modelMatrix.clone()
      });
    });
    
    // 添加起点
    forcePaths.push({
      hexId: startHexId,
      position: {...forceInstance.pose.position},
      heading: forceInstance.pose.heading,
      unitPaths: startUnitPaths,
      startTime: 0, // 会在后面设置
      startTurnTime: 0, // 会在后面设置
      duration: 0,   // 第一个点不需要持续时间，因为它是起点
      turnDuration: this.config.defaultTurnDuration // 会在后面设置计算值
    });
    
    // 5. 处理路径上的其他点
    for (let i = 1; i < hexPath.length; i++) {
      const hexId = hexPath[i];
      // 为部队计算从上一个点到当前点的朝向
      const prevHexId = hexPath[i-1];
      const forcePos = forcePositionsMap[hexId];
      const prevForcePos = forcePositionsMap[prevHexId]; 
      const forceHeading = GeoMathUtils.calculateHeading(prevForcePos, forcePos);
      
      // 为每个兵种模型计算位置和朝向
      const unitPaths = new Map();
      forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
        const unitPos = unitPositionsMap[hexId][unitInstanceId];
        const preUnitPos = unitPositionsMap[prevHexId][unitInstanceId];
        
        // 计算单位朝向
        const unitHeading = GeoMathUtils.calculateHeading(preUnitPos, unitPos);
        
        unitPaths.set(unitInstanceId, {
          position: unitPos,
          heading: unitHeading,
          matrix: this.poseCalculator.computeModelMatrix(
            unitPos, 
            unitHeading,
            unitInstance.offset
          )
        });
      });

      // 计算路径持续时间
      const duration = this._calMovementDuration(
        prevForcePos, 
        forcePos
      );
      // console.log(`[Debug] 计算路径持续时间: hexId=${hexId}, prevForcePos=`, prevForcePos, "forcePos=", forcePos);
      // console.log(`[Debug] 计算路径持续时间: hexId=${hexId}, duration=${duration}`);

      // 计算上一个点的转向时间：使用上一点的朝向与当前路径点所需朝向的角度差计算，得到的是上一点的转向时间
      const prevHeading = forcePaths[i-1].heading;
      const angleDiff = Math.abs(GeoMathUtils.calculateAngleDiff(prevHeading, forceHeading));
      const prevTurnDuration = this._calTurnDuration(angleDiff);
      forcePaths[i-1].turnDuration = prevTurnDuration;
      // console.log(`[Debug] 转向角: angleDiff=${angleDiff}`);

      // 添加到路径数组
      forcePaths.push({
        hexId: hexId,
        position: forcePos,
        heading: forceHeading,
        unitPaths: unitPaths,
        startTime: 0, // 后续设置
        startTurnTime: 0,
        duration: duration,
        turnDuration: this.config.defaultTurnDuration
      });
    }

    // =========== 创建移动状态 ===========
    const movementState = {
      force: force,
      forcePaths: forcePaths,
      currentPathIndex: 0,
      isTurning: true, // 第一个点默认需要转向
      isMoving: false, // 第一个点默认一开始正在转向，尚未开始移动
      isComplete: false
    };
    
    // 设置开始时间，开始移动前先进行转向操作
    movementState.forcePaths[0].startTurnTime = Date.now();
    
    // =========== 存储移动状态 ===========
    this.movingForces.set(forceId, movementState);

    return true;
  }

  /**
   * 更新移动中的部队
   * @param {string} forceId 部队ID
   * @returns {boolean} 是否继续移动
   * 
   * 流程：
   * 1. 获取movementState，先检查这个部队是否正在移动
   * 2. 根据movementState的currentPathIndex，获取当前直线路程的起点start和终点target (forcePath)
   * 3. 先转向：在起点处对模型进行转向，转到终点unitPaths的各模型对应的heading，计算转向插值，位置保持不变
   * 4. 再移动：对模型进行直线移动，移动到终点unitPaths的各模型对应的position，计算位置插值，转向保持不变
   * 5. 循环 3,4 步，到最终点后，将模型旋转至与部队朝向一致
   */
  updateMovingForces(forceId) {
    const movementState = this.movingForces.get(forceId);
    if (!movementState || movementState.isComplete) return false;
    
    const forceInstance = this.forceInstanceMap.get(forceId);
    if (!forceInstance) return false;
    
    // 获取当前路径段索引
    const currentPathIndex = movementState.currentPathIndex;
    const nextPathIndex = Math.min(movementState.forcePaths.length - 1, currentPathIndex + 1);
    
    // 获取当前点和下一个点
    const start = movementState.forcePaths[currentPathIndex];
    const target = movementState.forcePaths[nextPathIndex];

    // 获取当前时间
    const now = Date.now();
    const elapsed = now - start.startTime;

    // 检查当前点是否在转向中，这里统一看作先转向再移动，到最后一个点时不通过该方法转向
    if (movementState.isTurning && currentPathIndex < movementState.forcePaths.length - 1) {
      return this._handleTurning(movementState, forceInstance, start, target, now);
    }
    
    // 触发条件：移动到每段路径的规定时间，或已经到达终点
    if ((movementState.isMoving && elapsed >= target.duration) || currentPathIndex === movementState.forcePaths.length - 1) {
      return this._handleReachingNextPoint(movementState, forceInstance, start, target, now);
    }
    
    // 正常移动阶段：沿直线移动并更新模型
    return this._handleLinearMovement(forceInstance, start, target, elapsed);
  }

  /**
   * 处理部队到达下一个点时的逻辑
   * @private
   * @param {Object} movementState 移动状态
   * @param {Object} forceInstance 部队实例
   * @param {Object} start 起点路径对象
   * @param {Object} target 目标点路径对象
   * @param {number} now 当前时间戳
   * @returns {boolean} 是否继续移动
   */
  _handleReachingNextPoint(movementState, forceInstance, start, target, now) {
    // 尚未移动到最终点，切换到下一条路径
    if (movementState.currentPathIndex < movementState.forcePaths.length - 1) {
      // 使用存储的 matrix 检查点,修正位置
      target.unitPaths.forEach((targetUnitPath, unitInstanceId) => {
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        unitInstance.activeModel.modelMatrix = targetUnitPath.matrix;
      });
      // 更新状态和计时器
      movementState.isMoving = false;
      movementState.isTurning = true;
      target.startTurnTime = now;
      movementState.currentPathIndex++;
      // 在新的点需要转向的角度
      // console.log(`[Debug] 在新的点需要转向的角度:`, GeoMathUtils.calculateAngleDiff(start.heading, target.heading));
      
      return true;
    } 
    // 特殊处理：已移动到最终点，旋转方向至与部队方向一致
    else {
      // 将兵种模型旋转至与部队朝向一致
      const turnElapsed = now - start.startTurnTime;

      // 检查转向是否完成
      if (turnElapsed >= start.turnDuration) {
        // 修正角度
        start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
          const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
          if (startUnitPath && unitInstance) {              
            // 更新模型矩阵
            const newMatrix = this.poseCalculator.computeModelMatrix(
              startUnitPath.position,
              start.heading,
              unitInstance.offset
            );
            unitInstance.activeModel.modelMatrix = newMatrix;
          }
        });

        forceInstance.pose.position = {...start.position};
        forceInstance.pose.heading = start.heading;
        movementState.isMoving = false;
        movementState.isTurning = false;
        movementState.isComplete = true; // 完成移动
        return false;
      }

      // 转向未完成，计算转向进度
      const turnProgress = Math.min(1.0, turnElapsed / start.turnDuration);
      
      // 遍历start和target的相同unitInstanceId的兵种并计算每帧姿态
      start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        if (startUnitPath && unitInstance) {
          const startHeading = startUnitPath.heading;
          const targetHeading = start.heading;
            
          // 插值计算朝向
          const newHeading = GeoMathUtils.lerpAngle(startHeading, targetHeading, turnProgress);

          // 计算矩阵
          const newMatrix = this.poseCalculator.computeModelMatrix(
            startUnitPath.position,
            newHeading,
            unitInstance.offset
          );
          // 更新模型矩阵
          unitInstance.activeModel.modelMatrix = newMatrix;
        }
      });

      return true;
    }
  }

  /**
   * 处理部队转向逻辑
   * @private
   * @param {Object} movementState 移动状态
   * @param {Object} forceInstance 部队实例
   * @param {Object} start 当前点路径对象
   * @param {Object} target 目标点路径对象
   * @param {number} now 当前时间戳
   * @returns {boolean} 是否继续移动
   */
  _handleTurning(movementState, forceInstance, start, target, now) {
    const turnElapsed = now - start.startTurnTime;
    
    // 检查转向是否完成
    if (turnElapsed >= start.turnDuration) {
      // 修正角度
      start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
        const targetUnitPath = target.unitPaths.get(unitInstanceId);
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        if (targetUnitPath && unitInstance) {              
          // 计算矩阵
          const newMatrix = this.poseCalculator.computeModelMatrix(
            startUnitPath.position,
            targetUnitPath.heading,  // 让每个兵种模型朝向各自的目标点
            unitInstance.offset
          );
          // 更新模型矩阵
          unitInstance.activeModel.modelMatrix = newMatrix;
        }
      });
      
      // 转向完成，开始移动
      if (movementState.currentPathIndex < movementState.forcePaths.length - 1) {
        // 更新状态和计时器
        movementState.isTurning = false;
        movementState.isMoving = true;
        start.startTime = now;
      }
      
      return true;
    }
    
    // 转向未完成，计算转向进度
    const turnProgress = Math.min(1.0, turnElapsed / start.turnDuration);
    
    // 遍历start和target的相同unitInstanceId的兵种并计算每帧姿态
    start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
      const targetUnitPath = target.unitPaths.get(unitInstanceId);
      const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
      if (targetUnitPath && unitInstance) {
        const startHeading = startUnitPath.heading;
        const targetHeading = targetUnitPath.heading;
          
        // 插值计算朝向
        const newHeading = GeoMathUtils.lerpAngle(startHeading, targetHeading, turnProgress);

        // 计算矩阵
        const newMatrix = this.poseCalculator.computeModelMatrix(
          startUnitPath.position,
          newHeading,
          unitInstance.offset
        );
        // 更新模型矩阵
        unitInstance.activeModel.modelMatrix = newMatrix;
      }
    });
    
    return true;
  }

  /**
   * 处理部队沿直线移动逻辑
   * @private
   * @param {Object} forceInstance 部队实例
   * @param {Object} start 起始点forcePath
   * @param {Object} target 目标点forcePath
   * @param {number} elapsed 已经过时间（毫秒）
   * @returns {boolean} 是否继续移动
   */
  _handleLinearMovement(forceInstance, start, target, elapsed) {
    // 计算线性插值进度
    const progress = Math.min(1.0, elapsed / target.duration);

    // 遍历start和target的相同unitInstanceId的兵种并计算每帧姿态
    start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
      const targetUnitPath = target.unitPaths.get(unitInstanceId);
      const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
      if (targetUnitPath && unitInstance) {
          // 计算本帧的位置
          const nextPosition = GeoMathUtils.lerp2DPosition(startUnitPath.position, targetUnitPath.position, progress);
          const position = {
            longitude: nextPosition.longitude,
            latitude: nextPosition.latitude,
            height: 0
          };
          // 计算高度插值
          position.height = this.terrainCache.getSurfaceHeight(
            start.hexId,
            position.longitude,
            position.latitude,
          ) + MilitaryConfig.layoutConfig.unitLayout.heightOffset;
          
          // 计算矩阵
          const newMatrix = this.poseCalculator.computeModelMatrix(
            position,
            targetUnitPath.heading,
            unitInstance.offset
          );
          // 更新模型矩阵
          unitInstance.activeModel.modelMatrix = newMatrix;
        }
      });
    return true;
  }

  /**
   * 清理已完成移动的部队
   */
  cleanupFinishedMovements() {
    this.movingForces.forEach((state, forceId) => {
      if (state.isComplete) {
        this.movingForces.delete(forceId);
      }
    });
  }

  /**
   * 计算两点间移动持续时间
   * @private
   * @param {Object} fromPosition 起点位置 {longitude, latitude, height}
   * @param {Object} toPosition 终点位置 {longitude, latitude, height}
   * @returns {number} 移动持续时间（毫秒）
   */
  _calMovementDuration(fromPosition, toPosition) {
    // 计算两点之间的3d距离(米)
    const distanceMeters = GeoMathUtils.calculateDistance(fromPosition, toPosition);
    // 计算高度差(米)，正值表示上坡，负值表示下坡
    const heightDiff = toPosition.height - fromPosition.height;
    
    // 计算坡度 = 高度差/距离
    const slope = (distanceMeters > 0) ? (heightDiff / distanceMeters) : 0;
    // 计算坡度影响因子，坡度大于0.4时，超过0.4的部分会对速度产生影响
    let slopeFactor = 1;
    if (slope > 0.4) {
      // 上坡
      slopeFactor = 1 - (slope - 0.4);
    } else if (slope < -0.4) {
      // 下坡影响减半
      slopeFactor = 1 + (Math.abs(slope) - 0.4) * 0.5;
    }
    
    // 计算实际移动速度(米/秒)
    const actualSpeed = MilitaryConfig.movementConfig.baseSpeed * slopeFactor;
    
    // 计算理论移动时间(秒)
    const timeSeconds = distanceMeters / actualSpeed;
    
    // 转换为毫秒并限制最小1秒，最大3秒
    return Math.max(1000, Math.min(3000, timeSeconds * 1000));
  }

  /**
   * 计算转向时间
   * @private
   * @param {number} angleDiff 角度差（弧度）
   * @returns {number} 转向时间（毫秒）
   */
  _calTurnDuration(angleDiff) {
    // 将角度差转换为正值
    const absDiff = Math.abs(angleDiff);
    
    // 基于角度差计算转向时间，角度越大，时间越长
    // 将角度差(弧度)除以基础转向速率(弧度/秒)得到转向时间(秒)
    const turnTimeSeconds = absDiff / this.config.baseTurnRate;
    
    // 转换为毫秒并限制在最小和最大转向时间范围内
    return Math.max(
      this.config.minTurnDuration, 
      Math.min(this.config.maxTurnDuration, turnTimeSeconds * 1000)
    );
  }

  /**
   * 清理资源
   */
  dispose() {
    this.movingForces.clear();
    MovementController.#instance = null;
  }
}
