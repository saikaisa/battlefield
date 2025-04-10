import { ref, reactive } from 'vue';

/**
 * 地图交互管理器类
 * 负责处理地图上的交互事件
 */
export class MapInteractionManager {
  /**
   * 构造函数
   * @param {Object} viewer - Cesium Viewer实例
   * @param {Object} hexGridGenerator - 六角网格生成器实例
   * @param {Object} unitPlacer - 单位放置器实例
   */
  constructor(viewer, hexGridGenerator, unitPlacer) {
    this.viewer = viewer;
    this.hexGridGenerator = hexGridGenerator;
    this.unitPlacer = unitPlacer;
    
    // 交互状态
    this.state = reactive({
      mode: 'normal', // 当前交互模式: normal, move, attack, select
      selectedHexes: [], // 选中的六角格列表
      selectedForces: [], // 选中的部队列表
      pathHexes: [], // 移动路径上的六角格列表
      hoveredHex: null, // 当前悬停的六角格
      dragStartPosition: null, // 拖拽开始位置
      dragEndPosition: null, // 拖拽结束位置
      isSelecting: false // 是否正在框选
    });
    
    // 初始化事件处理
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  setupEventHandlers() {
    // 获取场景的事件处理器
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    
    // 左键点击事件
    handler.setInputAction(this.onLeftClick.bind(this), Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    // 鼠标移动事件
    handler.setInputAction(this.onMouseMove.bind(this), Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    // 左键按下事件
    handler.setInputAction(this.onLeftDown.bind(this), Cesium.ScreenSpaceEventType.LEFT_DOWN);
    
    // 左键释放事件
    handler.setInputAction(this.onLeftUp.bind(this), Cesium.ScreenSpaceEventType.LEFT_UP);
    
    // 右键点击事件
    handler.setInputAction(this.onRightClick.bind(this), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
   * 左键点击事件处理
   * @param {Object} event - 事件对象
   */
  onLeftClick(event) {
    // 获取点击位置的实体
    const pickedObject = this.viewer.scene.pick(event.position);
    
    if (Cesium.defined(pickedObject)) {
      // 如果点击到了实体
      const entity = pickedObject.id;
      
      if (entity) {
        // 检查是否点击到六角格
        if (entity.name && entity.name.startsWith('H')) {
          this.handleHexClick(entity);
        }
        // 检查是否点击到部队
        else if (entity.id && entity.id.startsWith('force_')) {
          this.handleForceClick(entity);
        }
      }
    } else {
      // 点击到空白区域
      this.handleEmptyClick();
    }
  }

  /**
   * 处理六角格点击
   * @param {Entity} hexEntity - 六角格实体
   */
  handleHexClick(hexEntity) {
    const hexId = hexEntity.name;
    const hexData = this.hexGridGenerator.getHexData(hexId);
    
    if (!hexData) return;
    
    switch (this.state.mode) {
      case 'normal':
        // 普通模式下，选中六角格
        this.selectHex(hexId);
        break;
        
      case 'move':
        // 移动模式下，添加到路径
        this.addToPath(hexId);
        break;
        
      case 'attack':
        // 攻击模式下，选择目标六角格
        this.selectTargetHex(hexId);
        break;
        
      case 'select':
        // 选择模式下，添加到选中列表
        this.addToSelection(hexId);
        break;
    }
  }

  /**
   * 处理部队点击
   * @param {Entity} forceEntity - 部队实体
   */
  handleForceClick(forceEntity) {
    const forceId = parseInt(forceEntity.id.replace('force_', ''));
    const forceData = forceEntity.properties.forceData;
    
    if (!forceData) return;
    
    // 选中部队
    this.selectForce(forceId, forceData);
  }

  /**
   * 处理空白区域点击
   */
  handleEmptyClick() {
    // 如果不是在选择模式下，清除选中状态
    if (this.state.mode !== 'select') {
      this.clearSelection();
    }
  }

  /**
   * 鼠标移动事件处理
   * @param {Object} event - 事件对象
   */
  onMouseMove(event) {
    // 获取鼠标位置的实体
    const pickedObject = this.viewer.scene.pick(event.endPosition);
    
    if (Cesium.defined(pickedObject)) {
      // 如果悬停到了实体
      const entity = pickedObject.id;
      
      if (entity) {
        // 检查是否悬停到六角格
        if (entity.name && entity.name.startsWith('H')) {
          this.handleHexHover(entity);
        }
        // 检查是否悬停到部队
        else if (entity.id && entity.id.startsWith('force_')) {
          this.handleForceHover(entity);
        }
      }
    } else {
      // 悬停到空白区域
      this.handleEmptyHover();
    }
    
    // 如果正在框选，更新框选区域
    if (this.state.isSelecting) {
      this.updateSelectionBox(event.endPosition);
    }
  }

  /**
   * 处理六角格悬停
   * @param {Entity} hexEntity - 六角格实体
   */
  handleHexHover(hexEntity) {
    const hexId = hexEntity.name;
    
    // 如果悬停的六角格变化了，更新状态
    if (this.state.hoveredHex !== hexId) {
      // 取消之前悬停的六角格高亮
      if (this.state.hoveredHex) {
        this.hexGridGenerator.highlightHex(this.state.hoveredHex, false);
      }
      
      // 高亮当前悬停的六角格
      this.hexGridGenerator.highlightHex(hexId, true);
      
      // 更新状态
      this.state.hoveredHex = hexId;
    }
  }

  /**
   * 处理部队悬停
   * @param {Entity} forceEntity - 部队实体
   */
  handleForceHover(forceEntity) {
    const forceId = parseInt(forceEntity.id.replace('force_', ''));
    
    // 高亮部队
    this.unitPlacer.highlightUnit(forceId, true);
    
    // 同时高亮部队所在的六角格
    const forceData = forceEntity.properties.forceData;
    if (forceData && forceData.hex_id) {
      this.handleHexHover({ name: forceData.hex_id });
    }
  }

  /**
   * 处理空白区域悬停
   */
  handleEmptyHover() {
    // 取消之前悬停的六角格高亮
    if (this.state.hoveredHex) {
      this.hexGridGenerator.highlightHex(this.state.hoveredHex, false);
      this.state.hoveredHex = null;
    }
  }

  /**
   * 左键按下事件处理
   * @param {Object} event - 事件对象
   */
  onLeftDown(event) {
    // 如果是在选择模式下，开始框选
    if (this.state.mode === 'select') {
      this.startSelectionBox(event.position);
    }
  }

  /**
   * 左键释放事件处理
   * @param {Object} event - 事件对象
   */
  onLeftUp(event) {
    // 如果正在框选，结束框选
    if (this.state.isSelecting) {
      this.endSelectionBox(event.position);
    }
  }

  /**
   * 右键点击事件处理
   * @param {Object} event - 事件对象
   */
  onRightClick(event) {
    // 根据当前模式处理右键点击
    switch (this.state.mode) {
      case 'move':
        // 移动模式下，确认路径
        this.confirmPath();
        break;
        
      case 'attack':
        // 攻击模式下，取消攻击
        this.cancelAttack();
        break;
        
      case 'select':
        // 选择模式下，确认选择
        this.confirmSelection();
        break;
        
      default:
        // 其他模式下，返回普通模式
        this.setMode('normal');
        break;
    }
  }

  /**
   * 选中六角格
   * @param {string} hexId - 六角格ID
   */
  selectHex(hexId) {
    // 清除之前的选中状态
    this.clearSelection();
    
    // 高亮选中的六角格
    this.hexGridGenerator.highlightHex(hexId, true);
    
    // 更新选中列表
    this.state.selectedHexes = [hexId];
    
    // 获取六角格中的部队
    const hexData = this.hexGridGenerator.getHexData(hexId);
    if (hexData && hexData.battlefield_state.forces_list.length > 0) {
      // 更新选中的部队列表
      this.state.selectedForces = hexData.battlefield_state.forces_list;
    }
  }

  /**
   * 选中部队
   * @param {number} forceId - 部队ID
   * @param {Object} forceData - 部队数据
   */
  selectForce(forceId, forceData) {
    // 清除之前的选中状态
    this.clearSelection();
    
    // 高亮部队
    this.unitPlacer.highlightUnit(forceId, true);
    
    // 高亮部队所在的六角格
    if (forceData.hex_id) {
      this.hexGridGenerator.highlightHex(forceData.hex_id, true);
      this.state.selectedHexes = [forceData.hex_id];
    }
    
    // 更新选中的部队列表
    this.state.selectedForces = [forceId];
  }

  /**
   * 添加到路径
   * @param {string} hexId - 六角格ID
   */
  addToPath(hexId) {
    // 检查是否已经在路径中
    if (this.state.pathHexes.includes(hexId)) {
      return;
    }
    
    // 检查是否与上一个六角格相邻
    if (this.state.pathHexes.length > 0) {
      const lastHexId = this.state.pathHexes[this.state.pathHexes.length - 1];
      const lastHexData = this.hexGridGenerator.getHexData(lastHexId);
      const currentHexData = this.hexGridGenerator.getHexData(hexId);
      
      if (!this.areHexesAdjacent(lastHexData, currentHexData)) {
        console.warn('六角格不相邻，无法添加到路径');
        return;
      }
    }
    
    // 添加到路径
    this.state.pathHexes.push(hexId);
    
    // 高亮路径
    this.highlightPath();
  }

  /**
   * 检查两个六角格是否相邻
   * @param {Object} hex1 - 第一个六角格数据
   * @param {Object} hex2 - 第二个六角格数据
   * @returns {boolean} 是否相邻
   */
  areHexesAdjacent(hex1, hex2) {
    if (!hex1 || !hex2) return false;
    
    const { row: row1, col: col1 } = hex1.position;
    const { row: row2, col: col2 } = hex2.position;
    
    // 考虑六角格的偏移
    const x1 = col1 + (row1 % 2) * 0.5;
    const x2 = col2 + (row2 % 2) * 0.5;
    const dx = x2 - x1;
    const dy = row2 - row1;
    
    // 计算距离
    const distance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
    
    // 距离为1表示相邻
    return distance === 1;
  }

  /**
   * 高亮路径
   */
  highlightPath() {
    // 清除之前的高亮
    this.clearHighlight();
    
    // 高亮路径上的每个六角格
    this.state.pathHexes.forEach((hexId, index) => {
      // 使用不同的颜色区分路径顺序
      const hexEntity = this.hexGridGenerator.hexEntities.find(entity => entity.name === hexId);
      if (hexEntity && hexEntity.polygon) {
        // 起点使用绿色
        if (index === 0) {
          hexEntity.polygon.material = Cesium.Color.GREEN.withAlpha(0.7);
        }
        // 终点使用红色
        else if (index === this.state.pathHexes.length - 1) {
          hexEntity.polygon.material = Cesium.Color.RED.withAlpha(0.7);
        }
        // 中间点使用黄色
        else {
          hexEntity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.7);
        }
      }
    });
  }

  /**
   * 确认路径
   */
  confirmPath() {
    if (this.state.pathHexes.length < 2) {
      console.warn('路径太短，无法确认');
      return;
    }
    
    // 触发路径确认事件
    const event = new CustomEvent('path-confirmed', {
      detail: {
        path: this.state.pathHexes,
        forceId: this.state.selectedForces[0]
      }
    });
    window.dispatchEvent(event);
    
    // 清除路径
    this.clearPath();
    
    // 返回普通模式
    this.setMode('normal');
  }

  /**
   * 清除路径
   */
  clearPath() {
    // 恢复路径上的六角格样式
    this.state.pathHexes.forEach(hexId => {
      this.hexGridGenerator.updateHexVisualStyle(hexId);
    });
    
    // 清空路径
    this.state.pathHexes = [];
  }

  /**
   * 选择目标六角格
   * @param {string} hexId - 六角格ID
   */
  selectTargetHex(hexId) {
    // 检查是否已经选择了攻击方
    if (this.state.selectedForces.length === 0) {
      console.warn('请先选择攻击方');
      return;
    }
    
    // 获取目标六角格数据
    const hexData = this.hexGridGenerator.getHexData(hexId);
    if (!hexData) return;
    
    // 检查目标六角格是否有敌方部队
    const hasEnemyForce = hexData.battlefield_state.forces_list.length > 0 && 
                          hexData.battlefield_state.control_faction !== 'neutral' &&
                          hexData.battlefield_state.control_faction !== this.getCurrentFaction();
    
    if (!hasEnemyForce) {
      console.warn('目标六角格没有敌方部队');
      return;
    }
    
    // 高亮目标六角格
    this.hexGridGenerator.highlightHex(hexId, true);
    
    // 触发攻击事件
    const event = new CustomEvent('attack-confirmed', {
      detail: {
        attackerForceId: this.state.selectedForces[0],
        targetHexId: hexId
      }
    });
    window.dispatchEvent(event);
    
    // 返回普通模式
    this.setMode('normal');
  }

  /**
   * 取消攻击
   */
  cancelAttack() {
    // 清除选中状态
    this.clearSelection();
    
    // 返回普通模式
    this.setMode('normal');
  }

  /**
   * 开始框选
   * @param {Cartesian2} position - 屏幕位置
   */
  startSelectionBox(position) {
    this.state.dragStartPosition = position.clone();
    this.state.isSelecting = true;
    
    // 创建框选矩形
    this.selectionRectangle = this.viewer.entities.add({
      rectangle: {
        coordinates: new Cesium.CallbackProperty(() => {
          if (!this.state.dragStartPosition || !this.state.dragEndPosition) {
            return Cesium.Rectangle.fromDegrees(0, 0, 0, 0);
          }
          
          // 将屏幕坐标转换为地理坐标
          const startCartographic = this.screenToCartographic(this.state.dragStartPosition);
          const endCartographic = this.screenToCartographic(this.state.dragEndPosition);
          
          if (!startCartographic || !endCartographic) {
            return Cesium.Rectangle.fromDegrees(0, 0, 0, 0);
          }
          
          // 创建矩形
          return Cesium.Rectangle.fromCartographicArray([startCartographic, endCartographic]);
        }, false),
        material: Cesium.Color.YELLOW.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.YELLOW
      }
    });
  }

  /**
   * 更新框选区域
   * @param {Cartesian2} position - 屏幕位置
   */
  updateSelectionBox(position) {
    this.state.dragEndPosition = position.clone();
  }

  /**
   * 结束框选
   * @param {Cartesian2} position - 屏幕位置
   */
  endSelectionBox(position) {
    this.state.dragEndPosition = position.clone();
    this.state.isSelecting = false;
    
    // 移除框选矩形
    if (this.selectionRectangle) {
      this.viewer.entities.remove(this.selectionRectangle);
      this.selectionRectangle = null;
    }
    
    // 获取框选区域内的六角格
    const selectedHexes = this.getHexesInSelectionBox();
    
    // 高亮选中的六角格
    selectedHexes.forEach(hexId => {
      this.hexGridGenerator.highlightHex(hexId, true);
    });
    
    // 更新选中列表
    this.state.selectedHexes = selectedHexes;
    
    // 获取选中六角格中的部队
    const selectedForces = [];
    selectedHexes.forEach(hexId => {
      const hexData = this.hexGridGenerator.getHexData(hexId);
      if (hexData && hexData.battlefield_state.forces_list.length > 0) {
        selectedForces.push(...hexData.battlefield_state.forces_list);
      }
    });
    
    // 更新选中的部队列表
    this.state.selectedForces = selectedForces;
  }

  /**
   * 获取框选区域内的六角格
   * @returns {Array} 六角格ID列表
   */
  getHexesInSelectionBox() {
    if (!this.state.dragStartPosition || !this.state.dragEndPosition) {
      return [];
    }
    
    // 将屏幕坐标转换为地理坐标
    const startCartographic = this.screenToCartographic(this.state.dragStartPosition);
    const endCartographic = this.screenToCartographic(this.state.dragEndPosition);
    
    if (!startCartographic || !endCartographic) {
      return [];
    }
    
    // 创建矩形
    const rectangle = Cesium.Rectangle.fromCartographicArray([startCartographic, endCartographic]);
    
    // 获取矩形内的六角格
    const hexesInRectangle = [];
    const hexData = this.hexGridGenerator.getAllHexData();
    
    Object.keys(hexData).forEach(hexId => {
      const hex = hexData[hexId];
      const hexCartographic = Cesium.Cartographic.fromDegrees(
        hex.position.longitude,
        hex.position.latitude
      );
      
      if (Cesium.Rectangle.contains(rectangle, hexCartographic)) {
        hexesInRectangle.push(hexId);
      }
    });
    
    return hexesInRectangle;
  }

  /**
   * 屏幕坐标转地理坐标
   * @param {Cartesian2} screenPosition - 屏幕位置
   * @returns {Cartographic} 地理坐标
   */
  screenToCartographic(screenPosition) {
    // 将屏幕坐标转换为世界坐标
    const ray = this.viewer.camera.getPickRay(screenPosition);
    const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    
    if (!cartesian) {
      return null;
    }
    
    // 将世界坐标转换为地理坐标
    return Cesium.Cartographic.fromCartesian(cartesian);
  }

  /**
   * 确认选择
   */
  confirmSelection() {
    // 触发选择确认事件
    const event = new CustomEvent('selection-confirmed', {
      detail: {
        hexes: this.state.selectedHexes,
        forces: this.state.selectedForces
      }
    });
    window.dispatchEvent(event);
    
    // 返回普通模式
    this.setMode('normal');
  }

  /**
   * 添加到选中列表
   * @param {string} hexId - 六角格ID
   */
  addToSelection(hexId) {
    // 检查是否已经在选中列表中
    if (this.state.selectedHexes.includes(hexId)) {
      // 如果已经选中，则取消选中
      this.state.selectedHexes = this.state.selectedHexes.filter(id => id !== hexId);
      this.hexGridGenerator.highlightHex(hexId, false);
    } else {
      // 如果未选中，则添加到选中列表
      this.state.selectedHexes.push(hexId);
      this.hexGridGenerator.highlightHex(hexId, true);
      
      // 获取六角格中的部队
      const hexData = this.hexGridGenerator.getHexData(hexId);
      if (hexData && hexData.battlefield_state.forces_list.length > 0) {
        // 更新选中的部队列表
        this.state.selectedForces.push(...hexData.battlefield_state.forces_list);
      }
    }
  }

  /**
   * 清除选中状态
   */
  clearSelection() {
    // 取消选中的六角格高亮
(Content truncated due to size limit. Use line ranges to read in chunks)