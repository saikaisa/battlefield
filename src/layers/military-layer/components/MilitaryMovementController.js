/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { TerrainHeightCache } from "@/layers/scene-layer/components/TerrainHeightCache";
import { ModelPoseCalculator } from "./ModelPoseCalculator";
import { GeoMathUtils } from "@/utils/GeoMathUtils";
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
export class MilitaryMovementController {
  // 单例实例
  static #instance = null;
  
  /**
   * 获取单例实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   * @returns {MilitaryMovementController} 单例实例
   */
  static getInstance(viewer) {
    if (!MilitaryMovementController.#instance) {
      MilitaryMovementController.#instance = new MilitaryMovementController(viewer);
    }
    return MilitaryMovementController.#instance;
  }
  
  /**
   * 私有构造函数，避免外部直接创建实例
   * @param {Cesium.Viewer} viewer Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    
    // 获取地形高度缓存系统
    this.terrainCache = TerrainHeightCache.getInstance(viewer);

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
    //         matrix: Matrix4,           // 兵种在该六角格内的变换矩阵
    //       }>,
    //       startTime: number(Date),     // 这段路径开始直线运动时的时间戳
    //       startTurnTime: number(Date), // 开始转弯时的时间戳
    //       duration: number,            // 这段路径规定的直线运动时间
    //     }
    //   ],
    //   currentPathIndex: number,        // 当前路径段索引，与起点编号相同
    //   isTurning: boolean,              // 是否正在转向
    //   isMoving: boolean,               // 是否正在移动
    //   isComplete: boolean              // 是否完成移动
    // }
    this.movingForces = new Map();
    
    // 移动配置
    this.movementConfig = {
      turnDuration: 500,  // 转向时间
    };
  }

  /**
   * 准备移动
   * @param {string} forceId 部队ID
   * @param {string[]} hexPath 路径（六角格ID数组）
   */
  prepareMove(forceId, hexPath) {
    const forceInstance = this.forceInstanceMap.get(forceId);
    const force = forceInstance.force;
    
    // =========== 计算部队及内部兵种模型在每个途径六角格内分配到的位置和姿态 ===========
    const forcePaths = [];
    
    // 使用当前部队位置作为起点
    const unitPaths = new Map();
    forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
      const position = this.poseCalculator.computeUnitPosition(
        forceInstance.pose, 
        unitInstance.localOffset, 
        force.hexId
      );
      const heading = forceInstance.pose.heading;
      unitPaths.set(unitInstanceId, {
        position: position,
        heading: heading,
        matrix: unitInstance.currentModel.modelMatrix.clone()
      });
    });

    // 起点
    forcePaths.push({
      hexId: hexPath[0],
      position: {...forceInstance.pose.position},
      heading: forceInstance.pose.heading,
      unitPaths: new Map(unitPaths),
      startTime: 0, // 会在后面设置
      startTurnTime: 0,
      duration: 0   // 第一个点不需要持续时间，因为它是起点
    });
    
    // 计算路径上后续的每个点
    for (let i = 1; i < hexPath.length; i++) {
      const hexId = hexPath[i];
      const forcePos = this.poseCalculator.computeForcePosition(force, hexId);
      
      // 计算从上一个点到当前点的朝向
      const forceHeading = GeoMathUtils.calculateHeading(forcePaths[i-1].position, forcePos);
      
      // 为每个单位计算位置和朝向
      const unitPaths = new Map();
      forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
        // 计算单位在该六角格内的位置
        const unitPos = this.poseCalculator.computeUnitPosition(
          { position: forcePos, heading: forceHeading },
          unitInstance.localOffset, 
          hexId
        );
        const preUnitInstance = forcePaths[i-1].unitPaths.get(unitInstanceId);
        const unitHeading = GeoMathUtils.calculateHeading(preUnitInstance.position, unitPos);
        
        unitPaths.set(unitInstanceId, {
          position: unitPos,
          heading: unitHeading,
          matrix: this.poseCalculator.computeUnitModelMatrix(unitPos, unitHeading)
        });
      });

      // 计算这段路径移动持续时间
      const cell = this.store.getHexCellById(hexId); // 获取六角格
      const distance = GeoMathUtils.calculateDistance(forcePaths[i-1].position, forcePos); // 两点直线距离
      const terrainFactor = 1 - (cell.terrainAttributes.elevation / 1000) * 0.5; // 地形影响因子
      const adjustedSpeed = 20 * Math.max(0.5, terrainFactor); // 基础速度20米/秒，根据地形调整
      const rawDuration = distance / adjustedSpeed * 1000; // 毫秒
      const duration = Math.max(2000, Math.min(6000, rawDuration)); // 最小2秒，最大6秒

      // 添加到路径数组
      forcePaths.push({
        hexId: hexId,
        position: forcePos,
        heading: forceHeading,
        unitPaths: unitPaths,
        startTime: 0, // 后续设置
        startTurnTime: 0,
        duration: duration
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
    
    // 设置开始时间，一开始为转向
    movementState.forcePaths[0].startTurnTime = Date.now();
    
    // =========== 存储移动状态 ===========
    this.movingForces.set(forceId, movementState);

    return true;
  }

  /**
   * 更新移动中的部队
   * @param {string} forceId 部队ID
   * @returns {boolean} 是否继续移动
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
    
    // 如果到达下一个点，则开启下一轮
    if (elapsed >= target.duration && movementState.isMoving || currentPathIndex === movementState.forcePaths.length - 1) {
      return this._handleReachingNextPoint(movementState, forceInstance, start, target, now);
    }
    
    // 正常移动阶段：沿直线移动并更新模型
    return this._handleLinearMovement(forceInstance, start, target, elapsed);
  }

  /**
   * 处理部队到达下一个点的逻辑
   * @private
   * @param {string} forceId 部队ID
   * @param {Object} movementState 移动状态
   * @param {Object} forceInstance 部队实例
   * @param {number} currentPathIndex 当前路径索引
   * @param {Object} target 目标点
   * @param {number} now 当前时间戳
   * @returns {boolean} 是否继续移动
   */
  _handleReachingNextPoint(movementState, forceInstance, start, target, now) {
    if (movementState.currentPathIndex < movementState.forcePaths.length - 1) {
      // 修正位置
      target.unitPaths.forEach((targetUnitPath, unitInstanceId) => {
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        // 更新模型矩阵
        unitInstance.currentModel.modelMatrix = targetUnitPath.matrix;
      });
      // 更新状态和计时器
      movementState.isMoving = false;
      movementState.isTurning = true;
      target.startTurnTime = now;
      movementState.currentPathIndex++;
      
      return true;
    } else {
      // 移动完成
      movementState.isMoving = false;
      movementState.isTurning = false;

      // 将兵种模型旋转至与部队朝向一致
      const turnElapsed = now - start.startTurnTime;

      // 检查转向是否完成
      if (turnElapsed >= this.movementConfig.turnDuration) {
        // 修正角度
        start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
          const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
          if (startUnitPath && unitInstance) {              
            // 计算矩阵
            const newMatrix = this.poseCalculator.computeUnitModelMatrix(
              startUnitPath.position,
              start.heading
            );
            // 更新模型矩阵
            unitInstance.currentModel.modelMatrix = newMatrix;
          }
        });

        forceInstance.pose.position = {...start.position};
        forceInstance.pose.heading = start.heading;
        movementState.isComplete = true; // 完成移动
        return false;
      }

      // 转向未完成，计算转向进度
      const turnProgress = Math.min(1.0, turnElapsed / this.movementConfig.turnDuration);
      
      // 遍历start和target的相同unitInstanceId的兵种并计算每帧姿态
      start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        if (startUnitPath && unitInstance) {
          const startHeading = startUnitPath.heading;
          const targetHeading = start.heading;
            
          // 插值计算朝向
          const newHeading = GeoMathUtils.lerpAngle(startHeading, targetHeading, turnProgress);

          // 计算矩阵
          const newMatrix = this.poseCalculator.computeUnitModelMatrix(
            startUnitPath.position,
            newHeading
          );
          // 更新模型矩阵
          unitInstance.currentModel.modelMatrix = newMatrix;
        }
      });

      return true;
    }
  }

  /**
   * 处理部队转向逻辑
   * @private
   * @param {Object} movementState 移动状态
   * @param {Object} start 当前点
   * @param {Object} target 目标点
   * @param {Object} forceInstance 部队实例
   * @param {number} now 当前时间戳
   * @returns {boolean} 是否继续移动
   */
  _handleTurning(movementState, forceInstance, start, target, now) {
    const turnElapsed = now - start.startTurnTime;
    
    // 检查转向是否完成
    if (turnElapsed >= this.movementConfig.turnDuration) {
      // 修正角度
      start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
        const targetUnitPath = target.unitPaths.get(unitInstanceId);
        const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
        if (targetUnitPath && unitInstance) {              
          // 计算矩阵
          const newMatrix = this.poseCalculator.computeUnitModelMatrix(
            startUnitPath.position,
            targetUnitPath.heading  // 让每个兵种模型朝向各自的目标点
          );
          // 更新模型矩阵
          unitInstance.currentModel.modelMatrix = newMatrix;
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
    const turnProgress = Math.min(1.0, turnElapsed / this.movementConfig.turnDuration);
    
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
        const newMatrix = this.poseCalculator.computeUnitModelMatrix(
          startUnitPath.position,
          newHeading
        );
        // 更新模型矩阵
        unitInstance.currentModel.modelMatrix = newMatrix;
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
          const position = {
            longitude: startUnitPath.position.longitude + (targetUnitPath.position.longitude - startUnitPath.position.longitude) * progress,
            latitude: startUnitPath.position.latitude + (targetUnitPath.position.latitude - startUnitPath.position.latitude) * progress,
            height: 0
          };
          // 计算高度插值
          position.height = this.terrainCache.getApproxiHeight(
            start.hexId,
            position.longitude,
            position.latitude,
            target.hexId
          ) + MilitaryConfig.layoutConfig.unitLayout.heightOffset;
          
          // 计算矩阵
          const newMatrix = this.poseCalculator.computeUnitModelMatrix(
            position,
            targetUnitPath.heading
          );
          // 更新模型矩阵
          unitInstance.currentModel.modelMatrix = newMatrix;
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
   * 清理资源
   */
  dispose() {
    // 停止所有移动
    this.movingForces.forEach((_, forceId) => {
      this.stopMovement(forceId);
    });
    this.movingForces.clear();
    
    // 清理单例
    MilitaryMovementController.#instance = null;
  }
}
