/* eslint-disable no-unused-vars */
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";
import { MilitaryInstanceGenerator } from "./MilitaryInstanceGenerator";
import { HexHeightCache } from "@/layers/scene-layer/components/HexHeightCache";
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
    try {
      const forceInstance = this.forceInstanceMap.get(forceId);
      if (!forceInstance || !forceInstance.force) {
        console.error(`[MilitaryMovementController] 找不到部队实例: ${forceId}`);
        return false;
      }
      
      const force = forceInstance.force;
      
      // 验证路径
      if (!hexPath || hexPath.length < 2) {
        console.error(`[MilitaryMovementController] 无效的路径: ${hexPath}`);
        return false;
      }
      
      // =========== 批量预先计算所有位置信息 ===========
      // 1. 批量计算所有路径点上的部队位置
      // 注意：第一个点直接使用当前位置，不需要计算
      const forcePositionsResult = this.poseCalculator.computeForcePosition(force, hexPath.slice(1));
      
      // 构建兵种位置查询索引，便于根据hexId快速查找
      const forcePositionsMap = {};
      // 第一个点使用当前位置
      const startHexId = hexPath[0];
      
      // 检查当前位置是否有效
      if (!forceInstance.pose || !forceInstance.pose.position || 
          !this._isValidCoord(forceInstance.pose.position.longitude) ||
          !this._isValidCoord(forceInstance.pose.position.latitude)) {
        console.error(`[MilitaryMovementController] 部队当前位置无效:`, forceInstance.pose);
        return false;
      }
      
      forcePositionsMap[startHexId] = {...forceInstance.pose.position};
      
      // 其他点使用计算结果 (result中不包含第一个六角格)
      forcePositionsResult.forEach(result => {
        // 验证计算结果
        if (!result || !result.hexId || !result.position ||
            !this._isValidCoord(result.position.longitude) ||
            !this._isValidCoord(result.position.latitude)) {
          console.error(`[MilitaryMovementController] 部队位置计算结果无效:`, result);
          return;
        }
        forcePositionsMap[result.hexId] = result.position;
      });  
      
      // 检查是否所有路径点都有对应的位置
      for (let i = 1; i < hexPath.length; i++) {
        if (!forcePositionsMap[hexPath[i]]) {
          console.error(`[MilitaryMovementController] 路径点 ${hexPath[i]} 缺少位置信息`);
          return false;
        }
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
        
        // 计算从上一个点到当前点的朝向
        const prevForcePos = forcePositionsMap[prevHexId];
        const forceHeading = GeoMathUtils.calculateHeading(prevForcePos, forcePos);
        
        // 为每个兵种准备位置计算参数 (包括第一个点)
        forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
          unitPositionParams.push({
            forcePose: { position: forcePos, heading: forceHeading },
            localOffset: unitInstance.localOffset,
            hexId: hexId,
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
        if (!result || !result.hexId || !result.position ||
            !this._isValidCoord(result.position.longitude) ||
            !this._isValidCoord(result.position.latitude)) {
          console.error(`[MilitaryMovementController] 兵种位置计算结果无效:`, { result, param });
          return;
        }

        // 初始化hexId对应的映射
        if (!unitPositionsMap[result.hexId]) {
          unitPositionsMap[result.hexId] = {};
        }
        
        // 后续通过六角格id和兵种模型id即可查到其位置
        unitPositionsMap[result.hexId][param.unitInstanceId] = result.position;
      });
      
      // 检查是否所有路径点都有对应的兵种位置
      for (const unitInstanceId of forceInstance.unitInstanceMap.keys()) {
        for (const hexId of hexPath) {
          if (!unitPositionsMap[hexId] || !unitPositionsMap[hexId][unitInstanceId]) {
            console.error(`[MilitaryMovementController] 兵种 ${unitInstanceId} 在路径点 ${hexId} 缺少位置信息`);
            return false;
          }
        }
      }
      
      // =========== 构建路径信息 ===========
      const forcePaths = [];
      
      // 4. 处理起点
      const startUnitPaths = new Map();
      forceInstance.unitInstanceMap.forEach((unitInstance, unitInstanceId) => {
        const unitPos = unitPositionsMap[startHexId][unitInstanceId];
        const heading = forceInstance.pose.heading;
        
        if (!unitInstance.activeModel) {
          console.error(`[MilitaryMovementController] 兵种 ${unitInstanceId} 没有活跃模型`);
          return;
        }
        
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
        const cell = this.store.getHexCellById(hexId);
        if (!cell) {
          console.error(`[MilitaryMovementController] 找不到六角格: ${hexId}`);
          return false;
        }
        
        // 计算移动持续时间，如果计算失败则使用默认值
        let duration;
        try {
          duration = this._calMovementDuration(
            cell.terrainAttributes.elevation, 
            prevForcePos, 
            forcePos
          );
          
          // 确保duration是有效的数值
          if (!this._isValidCoord(duration) || duration <= 0) {
            console.warn(`[MilitaryMovementController] 计算的持续时间无效: ${duration}，使用默认值3000ms`);
            duration = 3000; // 使用默认值3秒
          }
        } catch (error) {
          console.error(`[MilitaryMovementController] 计算持续时间失败:`, error);
          duration = 3000; // 使用默认值3秒
        }

        // 计算上一个点的转向时间：使用上一点的朝向与当前路径点所需朝向的角度差计算，得到的是上一点的转向时间
        const prevHeading = forcePaths[i-1].heading;
        const angleDiff = Math.abs(GeoMathUtils.calculateAngleDiff(prevHeading, forceHeading));
        const prevTurnDuration = this._calTurnDuration(angleDiff);
        forcePaths[i-1].turnDuration = prevTurnDuration;

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
    } catch (error) {
      console.error(`[MilitaryMovementController] 准备移动时出错:`, error);
      return false;
    }
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
    try {
      const movementState = this.movingForces.get(forceId);
      if (!movementState || movementState.isComplete) return false;
      
      const forceInstance = this.forceInstanceMap.get(forceId);
      if (!forceInstance) {
        console.error(`[MilitaryMovementController] 找不到部队实例: ${forceId}`);
        return false;
      }
      
      // 检查forcePaths数组是否有效
      if (!movementState.forcePaths || !Array.isArray(movementState.forcePaths) || 
          movementState.forcePaths.length === 0) {
        console.error(`[MilitaryMovementController] 无效的路径数组:`, movementState.forcePaths);
        return false;
      }
      
      // 获取当前路径段索引
      const currentPathIndex = movementState.currentPathIndex;
      if (currentPathIndex >= movementState.forcePaths.length) {
        console.error(`[MilitaryMovementController] 当前路径索引越界: ${currentPathIndex}/${movementState.forcePaths.length}`);
        return false;
      }
      
      const nextPathIndex = Math.min(movementState.forcePaths.length - 1, currentPathIndex + 1);
      
      // 获取当前点和下一个点
      const start = movementState.forcePaths[currentPathIndex];
      const target = movementState.forcePaths[nextPathIndex];
      
      if (!start || !target) {
        console.error(`[MilitaryMovementController] 无效的路径点:`, { start, target });
        return false;
      }

      // 检查路径点必要属性
      if (!start.hexId || !target.hexId) {
        console.error(`[MilitaryMovementController] 路径点缺少hexId:`, 
            { startHexId: start.hexId, targetHexId: target.hexId });
        return false;
      }

      // 获取当前时间
      const now = Date.now();
      
      // 添加状态日志
      console.log(`[MilitaryMovementController] 部队${forceId}状态:`, {
        currentIndex: currentPathIndex,
        isTurning: movementState.isTurning,
        isMoving: movementState.isMoving,
        startHexId: start.hexId,
        targetHexId: target.hexId,
        startTime: start.startTime ? new Date(start.startTime).toISOString() : 'null',
        duration: target.duration,
        hasStartUnitPaths: start.unitPaths ? start.unitPaths.size : 0,
        hasTargetUnitPaths: target.unitPaths ? target.unitPaths.size : 0
      });
      
      // 确保有startTime, 如果没有则设置
      if (movementState.isMoving && !start.startTime) {
        console.log(`[MilitaryMovementController] 设置缺少的startTime: ${start.hexId}`);
        start.startTime = now;
      }

      // 确保target有持续时间，如果没有给一个默认值
      if (movementState.isMoving && !target.duration) {
        console.warn(`[MilitaryMovementController] 目标点缺少持续时间，使用默认值3000ms`);
        target.duration = 3000; // 使用默认值3秒
      }
      
      const elapsed = movementState.isMoving ? (now - (start.startTime || now)) : 0;

      // 检查当前点是否在转向中，这里统一看作先转向再移动，到最后一个点时不通过该方法转向
      if (movementState.isTurning && currentPathIndex < movementState.forcePaths.length - 1) {
        return this._handleTurning(movementState, forceInstance, start, target, now);
      }
      
      // 触发条件：移动到每段路径的规定时间，或已经到达终点
      if ((movementState.isMoving && target.duration && elapsed >= target.duration) || 
          currentPathIndex === movementState.forcePaths.length - 1) {
        return this._handleReachingNextPoint(movementState, forceInstance, start, target, now);
      }
      
      // 检查是否已经开始移动，但没有正确设置开始时间
      if (movementState.isMoving && !start.startTime) {
        start.startTime = now;
        console.log(`[MilitaryMovementController] 重新设置移动开始时间`);
      }
      
      // 正常移动阶段：沿直线移动并更新模型
      return this._handleLinearMovement(forceInstance, start, target, elapsed);
    } catch (error) {
      console.error(`[MilitaryMovementController] 更新移动部队时出错:`, error);
      return false;
    }
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
    // 记录当前转向状态
    console.log(`[MilitaryMovementController] 转向状态: 从${start.hexId}到${target.hexId}`, {
      duration: target.duration,
      hasStartUnitPaths: start.unitPaths ? start.unitPaths.size : 0,
      hasTargetUnitPaths: target.unitPaths ? target.unitPaths.size : 0
    });
    
    const turnElapsed = now - start.startTurnTime;
    
    // 检查转向是否完成
    if (turnElapsed >= start.turnDuration) {
      try {
        console.log(`[MilitaryMovementController] 转向完成: ${turnElapsed}ms >= ${start.turnDuration}ms`);
        
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
          
          // 检查目标路径是否有有效的duration
          if (!target.duration) {
            console.warn(`[MilitaryMovementController] 目标点缺少持续时间，设置默认值3000ms`);
            target.duration = 3000; // 使用默认值3秒
          }
          
          // 确保设置了有效的开始时间
          start.startTime = now;
          console.log(`[MilitaryMovementController] 转向完成，开始从 ${start.hexId} 到 ${target.hexId} 的直线移动, duration=${target.duration}ms`);
          
          // 打印unitPaths信息，确认数据有效性
          if (target.unitPaths) {
            console.log(`[MilitaryMovementController] 目标点unitPaths大小: ${target.unitPaths.size}`);
            // 检查unitPaths中的position是否有效
            let validPositions = true;
            target.unitPaths.forEach((unit, id) => {
              if (!unit.position || 
                  !this._isValidCoord(unit.position.longitude) || 
                  !this._isValidCoord(unit.position.latitude)) {
                console.error(`[MilitaryMovementController] 目标点unitPath ${id}的位置无效:`, unit.position);
                validPositions = false;
              }
            });
            if (validPositions) {
              console.log(`[MilitaryMovementController] 所有目标点unitPaths位置有效`);
            }
          } else {
            console.error(`[MilitaryMovementController] 目标点没有unitPaths`);
          }
        }
      } catch (error) {
        console.error(`[MilitaryMovementController] 转向完成时出错:`, error);
        return false;
      }
      
      return true;
    }
    
    // 转向未完成，计算转向进度
    const turnProgress = Math.min(1.0, turnElapsed / start.turnDuration);
    
    try {
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
    } catch (error) {
      console.error(`[MilitaryMovementController] 转向过程中出错:`, error);
      return false;
    }
    
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
    // 添加更详细的日志，记录参数具体内容
    console.log(`[MilitaryMovementController] 开始线性移动:`, {
      start: start, 
      target: target, 
      elapsed: elapsed,
      targetDuration: target?.duration
    });
    
    // 检查参数有效性
    if (!start) {
      console.error('[MilitaryMovementController] 起点数据无效');
      return false;
    }
    
    if (!target) {
      console.error('[MilitaryMovementController] 终点数据无效');
      return false;
    }
    
    if (!target.duration) {
      // 如果duration无效，添加兜底值并添加警告
      console.warn('[MilitaryMovementController] 目标点缺少持续时间，使用默认值3000ms');
      target.duration = 3000; // 使用默认值3秒
    }

    // 计算线性插值进度
    const progress = Math.min(1.0, elapsed / target.duration);
    console.log(`[MilitaryMovementController] 移动进度: ${progress.toFixed(2)}, 已用时间: ${elapsed}ms, 总时间: ${target.duration}ms`);

    // 遍历start和target的相同unitInstanceId的兵种并计算每帧姿态
    let processedUnits = 0;
    start.unitPaths.forEach((startUnitPath, unitInstanceId) => {
      const targetUnitPath = target.unitPaths.get(unitInstanceId);
      const unitInstance = forceInstance.unitInstanceMap.get(unitInstanceId);
      
      // 检查必要对象和属性是否存在
      if (!targetUnitPath) {
        console.warn(`[MilitaryMovementController] 找不到目标路径上的兵种: ${unitInstanceId}`);
        return;
      }
      
      if (!unitInstance || !unitInstance.activeModel) {
        console.warn(`[MilitaryMovementController] 找不到有效的兵种实例: ${unitInstanceId}`);
        return;
      }

      // 检查位置坐标是否有效
      if (!startUnitPath.position) {
        console.error(`[MilitaryMovementController] 起点兵种位置缺失:`, unitInstanceId);
        return;
      }
      
      if (!targetUnitPath.position) {
        console.error(`[MilitaryMovementController] 终点兵种位置缺失:`, unitInstanceId);
        return;
      }
      
      if (!this._isValidCoord(startUnitPath.position.longitude) || 
          !this._isValidCoord(startUnitPath.position.latitude)) {
        console.error(`[MilitaryMovementController] 起点位置坐标无效:`, startUnitPath.position);
        return;
      }
      
      if (!this._isValidCoord(targetUnitPath.position.longitude) || 
          !this._isValidCoord(targetUnitPath.position.latitude)) {
        console.error(`[MilitaryMovementController] 终点位置坐标无效:`, targetUnitPath.position);
        return;
      }

      try {
        // 计算本帧的位置
        const position = {
          longitude: startUnitPath.position.longitude + (targetUnitPath.position.longitude - startUnitPath.position.longitude) * progress,
          latitude: startUnitPath.position.latitude + (targetUnitPath.position.latitude - startUnitPath.position.latitude) * progress,
          height: 0
        };
        
        // 再次验证插值结果的有效性
        if (!this._isValidCoord(position.longitude) || !this._isValidCoord(position.latitude)) {
          console.error(`[MilitaryMovementController] 插值计算产生了无效坐标:`, position);
          return;
        }
        
        // 计算高度插值
        try {
          position.height = this.terrainCache.getSurfaceHeight(
            start.hexId,
            position.longitude,
            position.latitude,
          ) + MilitaryConfig.layoutConfig.unitLayout.heightOffset;
        } catch (e) {
          console.error(`[MilitaryMovementController] 获取地形高度失败:`, e);
          // 使用起点和终点的平均高度作为备选
          if (startUnitPath.position.height && targetUnitPath.position.height) {
            position.height = (startUnitPath.position.height + targetUnitPath.position.height) / 2 + 
                             MilitaryConfig.layoutConfig.unitLayout.heightOffset;
          } else if (startUnitPath.position.height) {
            position.height = startUnitPath.position.height + MilitaryConfig.layoutConfig.unitLayout.heightOffset;
          } else {
            position.height = 0 + MilitaryConfig.layoutConfig.unitLayout.heightOffset; // 兜底值
          }
        }
        
        // 检查朝向是否有效
        if (!this._isValidCoord(targetUnitPath.heading)) {
          console.warn(`[MilitaryMovementController] 无效的朝向值: ${targetUnitPath.heading}，使用默认值0`);
          targetUnitPath.heading = 0;
        }
        
        // 计算矩阵
        const newMatrix = this.poseCalculator.computeModelMatrix(
          position,
          targetUnitPath.heading,
          unitInstance.offset
        );
        
        // 更新模型矩阵
        unitInstance.activeModel.modelMatrix = newMatrix;
        processedUnits++;
      } catch (error) {
        console.error(`[MilitaryMovementController] 更新模型位置失败:`, error);
      }
    });
    
    console.log(`[MilitaryMovementController] 线性移动完成: 处理了${processedUnits}个兵种单位`);
    return true;
  }
  
  /**
   * 检查坐标值是否有效
   * @private
   * @param {number} value 要检查的坐标值
   * @returns {boolean} 坐标是否有效
   */
  _isValidCoord(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
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
   * @param {string} elevation 高度
   * @param {Object} fromPosition 起点位置 {longitude, latitude, height}
   * @param {Object} toPosition 终点位置 {longitude, latitude, height}
   * @returns {number} 移动持续时间（毫秒）
   */
  _calMovementDuration(elevation, fromPosition, toPosition) {
    // 计算两点之间的直线距离(米)
    const distanceMeters = GeoMathUtils.calculateDistance(fromPosition, toPosition);
    
    // 计算地形影响因子（高度越高，速度越慢）
    const terrainFactor = 1 - (elevation / 1000) * 0.5;
    
    // 计算实际移动速度(米/秒)
    const actualSpeed = MilitaryConfig.limit.baseSpeed * Math.max(0.5, terrainFactor);
    
    // 计算理论移动时间(秒)
    const timeSeconds = distanceMeters / actualSpeed;
    
    // 转换为毫秒并限制最小2秒，最大6秒
    return Math.max(2000, Math.min(6000, timeSeconds * 1000));
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
    MilitaryMovementController.#instance = null;
  }
}
