import * as Cesium from "cesium";
import { openGameStore } from "@/store";
// eslint-disable-next-line no-unused-vars
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";

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
    this.hexGridManager = HexagonalGridManager.getInstance(viewer);
    this.profileManager = SurfaceProfileManager.getInstance(viewer);
    
    // 活动单位移动状态：Map<unitId, MoveState>
    this.moveStates = new Map();
    
    // 更新预设
    this.stepUpdateEnabled = true;  // 是否启用逐步更新
    this.lastUpdateTime = Date.now();
    this.updateIntervalMs = 100;    // 移动更新间隔
    this.heightOffset = 0;          // 高度偏移
    
    // 记录正在移动中的部队
    // movingForces: Map<forceId, movementState>
    // movementState: {
    //   path: { hexId: string, center: { longitude, latitude, height } }[], -- 完整路径各点
    //   currentPathIndex: number, -- 当前路径点索引
    //   startTime: number, -- 开始时间
    //   duration: number, -- 当前路径段持续时间（毫秒）
    //   startPosition: { longitude, latitude, height }, -- 当前路径段起点
    //   endPosition: { longitude, latitude, height }, -- 当前路径段终点
    //   direction: { heading, pitch, roll } -- 当前移动方向
    // }
    this.movingForces = new Map();
    
    // 移动配置
    this.movementConfig = {
      baseSpeed: 20,          // 基础移动速度（米/秒）
      heightEffect: 0.5,      // 地形高度对速度的影响系数
      minSpeed: 5,            // 最小移动速度（米/秒）
      turnRadius: 10,         // 转弯半径（米）
      updateInterval: 10,     // 更新间隔（毫秒）
      pathHeightOffset: 1,    // 路径高度偏移（米） 
    };
  }

  /**
   * 移动部队沿着路径前进
   * @param {string} forceId 部队ID
   * @param {string[]} hexPath 路径（六角格ID数组）
   * @param {Object} forceInstance 渲染器中的部队实例
   */
  moveForceAlongPath(forceId, hexPath, forceInstance) {
    try {
      // 将六角格路径转换为坐标点路径
      const coordinatePath = hexPath.map(hexId => {
        const hex = this.store.getHexCellById(hexId);
        if (!hex) {
          throw new Error(`未找到六角格: ${hexId}`);
        }
        return {
          hexId: hexId,
          center: hex.getCenter()
        };
      });
      
      // 确保路径有效
      if (coordinatePath.length < 2) {
        console.warn("路径点数不足，无法进行移动");
        return;
      }
      
      // 获取部队当前位置和朝向
      const currentPosition = forceInstance.pose.position;
      const currentHeading = forceInstance.pose.heading || 0;
      
      // 计算第一个路径段的方向
      const firstDirection = this._calculateDirection(currentPosition, coordinatePath[0].center);
      
      // 创建移动状态（使用当前朝向作为初始朝向）
      const movementState = {
        path: coordinatePath,
        currentPathIndex: 0,
        startTime: Date.now(),
        duration: 0,
        startPosition: currentPosition,
        endPosition: coordinatePath[0].center,
        direction: firstDirection,
        initialHeading: currentHeading
      };
      
      // 计算起始转向的持续时间
      const headingDifference = Math.abs(firstDirection.heading - currentHeading);
      const normalizedHeadingDiff = Math.min(headingDifference, 2 * Math.PI - headingDifference);
      
      // 如果转向角度较大，延长第一段路径的持续时间
      let turnTimeBonus = 0;
      if (normalizedHeadingDiff > Math.PI / 4) { // 大于45度的转向
        turnTimeBonus = (normalizedHeadingDiff / Math.PI) * 1000; // 每π弧度增加1000毫秒
      }
      
      // 计算第一段移动的持续时间
      movementState.duration = this._calculateMovementDuration(
        movementState.startPosition, 
        movementState.endPosition
      ) + turnTimeBonus;
      
      this.movingForces.set(forceId, movementState);
    } catch (error) {
      console.error("移动部队失败:", error);
    }
  }

  /**
   * 获取部队当前的移动状态
   * @param {string} forceId 部队ID
   * @returns {Object|null} 移动数据
   */
  getMovementData(forceId) {
    return this.movingForces.get(forceId) || null;
  }

  /**
   * 清理资源
   */
  dispose() {
    this.moveStates.clear();
    this.stepUpdateEnabled = false;
    this.movingForces.clear();
    
    // 清理单例
    MilitaryMovementController.#instance = null;
  }

  /**
   * 清理已完成移动的部队
   * 返回是否有部队在移动
   * @returns {boolean} 是否还有部队在移动
   */
  cleanupFinishedMovements() {
    const finishedForces = [];
    this.movingForces.forEach((state, forceId) => {
      if (state.currentPathIndex >= state.path.length - 1) {
        // 完成了最后一个路径段，记录待清理
        finishedForces.push(forceId);
        
        // 更新部队六角格位置
        const force = this.store.getForceById(forceId);
        if (force) {
          const lastHexId = state.path[state.path.length - 1].hexId;
          this.store.updateForceHexId(forceId, lastHexId);
        }
      }
    });
    
    // 移除已完成移动的部队
    finishedForces.forEach(forceId => {
      this.movingForces.delete(forceId);
    });
    
    return this.movingForces.size > 0;
  }

  /**
   * 计算移动中的部队实例下一帧的位置
   * @param {string} forceId 部队ID
   * @returns {Object|null} 更新后的位置，如果移动结束则返回null
   */
  computeNextPosition(forceId) {
    const state = this.movingForces.get(forceId);
    if (!state) return null;
    
    const now = Date.now();
    const timePassed = now - state.startTime;
    
    // 检查是否需要进入下一路径段
    if (timePassed >= state.duration) {
      // 当前路径段已完成
      const nextIndex = state.currentPathIndex + 1;
      
      if (nextIndex >= state.path.length) {
        // 整个路径已完成，返回终点位置
        return {
          position: state.endPosition,
          direction: state.direction
        };
      }
      
      // 进入下一路径段
      state.currentPathIndex = nextIndex;
      state.startTime = now;
      state.startPosition = state.endPosition;
      
      // 更新终点位置
      if (nextIndex < state.path.length) {
        state.endPosition = state.path[nextIndex].center;
        // 计算新的方向朝向
        state.direction = this._calculateDirection(state.startPosition, state.endPosition);
        // 计算新路径段持续时间
        state.duration = this._calculateMovementDuration(state.startPosition, state.endPosition);
      }
      
      // 返回路径段起点
      return {
        position: state.startPosition,
        direction: state.direction
      };
    }
    
    // 在当前路径段中移动
    const t = timePassed / state.duration; // 路径段完成百分比
    
    // 使用平滑的缓动函数，让起止更自然
    const smoothT = this._smoothstep(0, 1, t);
    
    // 线性插值计算当前位置
    const currentPosition = {
      longitude: state.startPosition.longitude + (state.endPosition.longitude - state.startPosition.longitude) * smoothT,
      latitude: state.startPosition.latitude + (state.endPosition.latitude - state.startPosition.latitude) * smoothT,
      height: state.startPosition.height + (state.endPosition.height - state.startPosition.height) * smoothT
    };
    
    // 特殊处理第一段移动时的朝向
    if (state.currentPathIndex === 0 && state.initialHeading !== undefined) {
      // 在前20%的移动时间内，平滑过渡朝向
      const turnBlend = Math.min(1, t / 0.2);
      
      if (turnBlend < 1) {
        // 在初始和目标朝向之间插值
        let targetHeading = state.direction.heading;
        let startHeading = state.initialHeading;
        
        // 处理朝向跨越0/2π边界的情况
        if (Math.abs(targetHeading - startHeading) > Math.PI) {
          if (targetHeading > startHeading) {
            targetHeading -= 2 * Math.PI;
          } else {
            targetHeading += 2 * Math.PI;
          }
        }
        
        // 平滑插值当前朝向
        const currentHeading = startHeading + (targetHeading - startHeading) * this._smoothstep(0, 1, turnBlend);
        
        return {
          position: currentPosition,
          direction: {
            heading: currentHeading,
            pitch: 0,
            roll: 0
          }
        };
      }
    }
    
    // 如果接近下一个路径点且还有下一段路径，提前计算下一段的方向用于平滑过渡
    if (t > 0.85 && state.currentPathIndex < state.path.length - 1) {
      const nextPoint = state.path[state.currentPathIndex + 1].center;
      const nextDirection = this._calculateDirection(state.endPosition, nextPoint);
      
      // 在接近终点时，逐渐过渡到下一段的方向
      const blendFactor = this._smoothstep(0.85, 1, t);
      const currentHeading = state.direction.heading;
      let nextHeading = nextDirection.heading;
      
      // 处理heading跨越0/2π边界的情况，确保最短路径旋转
      if (Math.abs(nextHeading - currentHeading) > Math.PI) {
        if (nextHeading > currentHeading) {
          nextHeading -= 2 * Math.PI;
        } else {
          nextHeading += 2 * Math.PI;
        }
      }
      
      const blendedHeading = currentHeading * (1 - blendFactor) + nextHeading * blendFactor;
      
      return {
        position: currentPosition,
        direction: {
          heading: blendedHeading,
          pitch: 0,
          roll: 0
        }
      };
    }
    
    return {
      position: currentPosition,
      direction: state.direction
    };
  }

  /**
   * 平滑插值函数，使移动更加自然
   * @private
   * @param {number} edge0 起始边界
   * @param {number} edge1 结束边界
   * @param {number} x 输入值 [0,1]
   * @returns {number} 平滑插值后的值
   */
  _smoothstep(edge0, edge1, x) {
    // 裁剪输入到[0,1]范围
    x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    // 应用平滑公式: 3x² - 2x³
    return x * x * (3 - 2 * x);
  }

  /**
   * 计算模型的朝向矩阵
   * @param {Object} position 位置
   * @param {Object} direction 方向
   * @returns {Cesium.Matrix4} 变换矩阵
   */
  computeOrientedModelMatrix(position, direction, localOffset = { x: 0, y: 0 }) {
    if (!position) return Cesium.Matrix4.IDENTITY;

    // 将局部偏移转换为经纬度偏移
    const metersPerDegree = 111320;
    const lonOffset = localOffset.x / (metersPerDegree * Math.cos(position.latitude * Math.PI / 180));
    const latOffset = localOffset.y / metersPerDegree;

    // 构建位置
    const cartesian = Cesium.Cartesian3.fromDegrees(
      position.longitude + lonOffset,
      position.latitude + latOffset,
      position.height
    );

    // 创建基础ENU矩阵（东北上坐标系）
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);
    
    // 如果有方向，应用旋转
    if (direction && direction.heading !== undefined) {
      // 创建旋转矩阵（根据heading旋转）
      // 注意：Cesium中Z轴向上，所以我们围绕Z轴旋转来改变heading方向
      const headingRotation = Cesium.Matrix3.fromRotationZ(direction.heading);
      
      if (direction.pitch !== undefined && direction.pitch !== 0) {
        // 如果有俯仰角，围绕X轴旋转
        const pitchRotation = Cesium.Matrix3.fromRotationX(direction.pitch);
        Cesium.Matrix3.multiply(headingRotation, pitchRotation, headingRotation);
      }
      
      if (direction.roll !== undefined && direction.roll !== 0) {
        // 如果有翻滚角，围绕Y轴旋转
        const rollRotation = Cesium.Matrix3.fromRotationY(direction.roll);
        Cesium.Matrix3.multiply(headingRotation, rollRotation, headingRotation);
      }
      
      // 创建旋转矩阵
      const rotationMatrix = Cesium.Matrix4.fromRotationTranslation(
        headingRotation,
        Cesium.Cartesian3.ZERO
      );
      
      // 将旋转应用到ENU矩阵
      Cesium.Matrix4.multiply(enuMatrix, rotationMatrix, enuMatrix);
    }

    return enuMatrix;
  }

  /**
   * 根据六角格高度计算移动持续时间
   * @private
   * @param {Object} startPosition 起始位置
   * @param {Object} endPosition 目标位置
   * @returns {number} 移动持续时间（毫秒）
   */
  _calculateMovementDuration(startPosition, endPosition) {
    // 距离计算（平面距离，米）
    const point1 = Cesium.Cartesian3.fromDegrees(
      startPosition.longitude,
      startPosition.latitude,
      0
    );
    const point2 = Cesium.Cartesian3.fromDegrees(
      endPosition.longitude,
      endPosition.latitude,
      0
    );
    const distance = Cesium.Cartesian3.distance(point1, point2);
    
    // 高度差（米）
    const heightDifference = Math.abs(endPosition.height - startPosition.height);
    
    // 计算坡度因子（高度差降低速度）
    const slopeFactor = 1 - Math.min(1, heightDifference / distance * this.movementConfig.heightEffect);
    
    // 计算实际速度（考虑地形和最小速度）
    const speed = Math.max(
      this.movementConfig.minSpeed,
      this.movementConfig.baseSpeed * slopeFactor
    );
    
    // 计算持续时间（毫秒）
    return (distance / speed) * 1000;
  }

  /**
   * 计算从起点到终点的方向
   * @private
   * @param {Object} startPosition 起点
   * @param {Object} endPosition 目标
   * @returns {Object} 方向
   */
  _calculateDirection(startPosition, endPosition) {
    // 将经纬度转换为弧度计算
    const startLon = startPosition.longitude * Math.PI / 180;
    const startLat = startPosition.latitude * Math.PI / 180;
    const endLon = endPosition.longitude * Math.PI / 180;
    const endLat = endPosition.latitude * Math.PI / 180;
    
    // 计算方位角（heading，弧度）- 使用大圆航线公式计算
    const y = Math.sin(endLon - startLon) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * 
              Math.cos(endLon - startLon);
    let heading = Math.atan2(y, x);
    
    // 确保heading在[0, 2π)范围内
    if (heading < 0) {
      heading += 2 * Math.PI;
    }
    
    return {
      heading: heading,
      pitch: 0,
      roll: 0
    };
  }

  /**
   * 获取六角格中心位置
   * @private
   */
  _getHexCenterPosition(hexId) {
    const hex = this.store.getHexCellById(hexId);
    if (!hex) return null;
    
    const center = hex.getCenter();
    return {
      longitude: center.longitude,
      latitude: center.latitude,
      height: center.height + this.movementConfig.pathHeightOffset,
      heading: center.heading
    };
  }
} 