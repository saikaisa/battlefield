import { Cartesian3, Color, PolygonHierarchy, HeightReference, Math as CesiumMath } from 'cesium';

/**
 * 六角网格生成器类
 * 负责在地图上生成规则的六角格网格
 */
export class HexGridGenerator {
  /**
   * 构造函数
   * @param {Object} viewer - Cesium Viewer实例
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.hexEntities = [];
    this.hexData = {};
  }

  /**
   * 生成六角网格
   * @param {Object} options - 网格选项
   * @param {number} options.centerLon - 中心经度
   * @param {number} options.centerLat - 中心纬度
   * @param {number} options.radius - 六角格半径(米)
   * @param {number} options.rows - 行数
   * @param {number} options.cols - 列数
   * @returns {Object} 生成的六角格数据
   */
  generateGrid(options) {
    const { centerLon, centerLat, radius, rows, cols } = options;
    
    // 清除现有的六角格
    this.clearGrid();
    
    // 计算六角格的水平和垂直间距
    const hexWidth = radius * Math.sqrt(3);
    const hexHeight = radius * 2;
    const horizontalDistance = hexWidth;
    const verticalDistance = hexHeight * 0.75;
    
    // 计算起始点
    const startLon = centerLon - (cols * horizontalDistance) / (2 * 111320 * Math.cos(centerLat * CesiumMath.RADIANS_PER_DEGREE));
    const startLat = centerLat - (rows * verticalDistance) / 111320;
    
    // 生成六角格
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // 计算六角格中心点
        const offsetX = col * horizontalDistance + (row % 2 === 1 ? horizontalDistance / 2 : 0);
        const offsetY = row * verticalDistance;
        
        const hexLon = startLon + offsetX / (111320 * Math.cos(centerLat * CesiumMath.RADIANS_PER_DEGREE));
        const hexLat = startLat + offsetY / 111320;
        
        // 生成六角格ID
        const hexId = `H${row.toString().padStart(4, '0')}${col.toString().padStart(4, '0')}`;
        
        // 创建六角格数据
        const hexData = this.createHexData(hexId, hexLon, hexLat, row, col);
        
        // 存储六角格数据
        this.hexData[hexId] = hexData;
        
        // 绘制六角格
        this.drawHex(hexData);
      }
    }
    
    return this.hexData;
  }
  
  /**
   * 创建六角格数据
   * @param {string} hexId - 六角格ID
   * @param {number} longitude - 经度
   * @param {number} latitude - 纬度
   * @param {number} row - 行号
   * @param {number} col - 列号
   * @returns {Object} 六角格数据
   */
  createHexData(hexId, longitude, latitude, row, col) {
    // 随机生成高度(实际项目中应从DEM数据获取)
    const height = 50 + Math.random() * 50;
    
    // 随机生成地形类型(实际项目中应从地形数据获取)
    const terrainTypes = ['plain', 'mountain', 'urban', 'water', 'forest', 'desert'];
    const terrainType = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
    
    // 根据地形类型设置可通行性
    const passability = {
      land: terrainType !== 'water' && terrainType !== 'mountain',
      naval: terrainType === 'water',
      air: true
    };
    
    // 创建六角格数据
    return {
      hex_id: hexId,
      position: {
        longitude,
        latitude,
        height,
        row,
        col
      },
      terrain_attributes: {
        terrain_type: terrainType,
        terrain_composition: {
          [terrainType]: 0.8,
          plain: 0.2
        },
        elevation: height,
        passability
      },
      battlefield_state: {
        forces_list: [],
        control_faction: 'neutral'
      },
      visibility: {
        visual_style: {
          color: this.getTerrainColor(terrainType),
          outlineColor: '#FFFFFF'
        },
        visible_to: {
          blue: false,
          red: false
        }
      },
      additional_info: {
        is_objective_point: false,
        resource: null
      }
    };
  }
  
  /**
   * 根据地形类型获取颜色
   * @param {string} terrainType - 地形类型
   * @returns {string} 颜色代码
   */
  getTerrainColor(terrainType) {
    const colorMap = {
      plain: '#A0D26E',
      mountain: '#B08D5B',
      urban: '#AAAAAA',
      water: '#4A90E2',
      forest: '#2E7D32',
      desert: '#F9E076'
    };
    
    return colorMap[terrainType] || '#FFFFFF';
  }
  
  /**
   * 绘制六角格
   * @param {Object} hexData - 六角格数据
   */
  drawHex(hexData) {
    const { longitude, latitude, height } = hexData.position;
    const radius = 0.005; // 约500米
    const points = [];
    
    // 计算六角形的顶点
    for (let i = 0; i < 6; i++) {
      const angle = CesiumMath.toRadians(60 * i);
      const x = longitude + radius * Math.cos(angle) / Math.cos(latitude * CesiumMath.RADIANS_PER_DEGREE);
      const y = latitude + radius * Math.sin(angle);
      points.push(x, y);
    }
    
    // 创建六角形实体
    const hexEntity = this.viewer.entities.add({
      name: hexData.hex_id,
      polygon: {
        hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(points)),
        material: Color.fromCssColorString(hexData.visibility.visual_style.color).withAlpha(0.5),
        outline: true,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND
      },
      properties: {
        hexData: hexData
      }
    });
    
    // 存储实体引用
    this.hexEntities.push(hexEntity);
    
    return hexEntity;
  }
  
  /**
   * 更新六角格样式
   * @param {string} hexId - 六角格ID
   * @param {Object} visualStyle - 视觉样式
   */
  updateHexStyle(hexId, visualStyle) {
    const hexEntity = this.hexEntities.find(entity => entity.name === hexId);
    
    if (hexEntity && hexEntity.polygon) {
      hexEntity.polygon.material = Color.fromCssColorString(visualStyle.color).withAlpha(0.5);
      hexEntity.polygon.outlineColor = Color.fromCssColorString(visualStyle.outlineColor);
      
      // 更新数据
      if (this.hexData[hexId]) {
        this.hexData[hexId].visibility.visual_style = visualStyle;
      }
    }
  }
  
  /**
   * 高亮显示六角格
   * @param {string} hexId - 六角格ID
   * @param {boolean} highlight - 是否高亮
   */
  highlightHex(hexId, highlight = true) {
    const hexEntity = this.hexEntities.find(entity => entity.name === hexId);
    
    if (hexEntity && hexEntity.polygon) {
      if (highlight) {
        hexEntity.polygon.material = Color.YELLOW.withAlpha(0.7);
        hexEntity.polygon.outlineColor = Color.WHITE;
        hexEntity.polygon.outlineWidth = 3;
      } else {
        const hexData = this.hexData[hexId];
        if (hexData) {
          hexEntity.polygon.material = Color.fromCssColorString(hexData.visibility.visual_style.color).withAlpha(0.5);
          hexEntity.polygon.outlineColor = Color.WHITE;
          hexEntity.polygon.outlineWidth = 2;
        }
      }
    }
  }
  
  /**
   * 更新六角格可见性
   * @param {string} hexId - 六角格ID
   * @param {Object} visibleTo - 可见性状态
   */
  updateHexVisibility(hexId, visibleTo) {
    if (this.hexData[hexId]) {
      this.hexData[hexId].visibility.visible_to = visibleTo;
      
      // 根据可见性更新样式
      this.updateHexVisualStyle(hexId);
    }
  }
  
  /**
   * 根据可见性更新六角格视觉样式
   * @param {string} hexId - 六角格ID
   */
  updateHexVisualStyle(hexId) {
    const hexData = this.hexData[hexId];
    
    if (hexData) {
      const { visible_to } = hexData.visibility;
      const { control_faction } = hexData.battlefield_state;
      const { terrain_type } = hexData.terrain_attributes;
      
      let color = this.getTerrainColor(terrain_type);
      let outlineColor = '#FFFFFF';
      
      // 根据控制方和可见性设置样式
      if (control_faction !== 'neutral') {
        if (control_faction === 'blue') {
          color = visible_to.blue ? '#4A90E2' : '#AAAAAA';
        } else if (control_faction === 'red') {
          color = visible_to.red ? '#E57373' : '#AAAAAA';
        }
      }
      
      // 更新样式
      this.updateHexStyle(hexId, { color, outlineColor });
    }
  }
  
  /**
   * 获取六角格数据
   * @param {string} hexId - 六角格ID
   * @returns {Object} 六角格数据
   */
  getHexData(hexId) {
    return this.hexData[hexId];
  }
  
  /**
   * 获取所有六角格数据
   * @returns {Object} 所有六角格数据
   */
  getAllHexData() {
    return this.hexData;
  }
  
  /**
   * 清除六角网格
   */
  clearGrid() {
    // 移除所有六角格实体
    this.hexEntities.forEach(entity => {
      this.viewer.entities.remove(entity);
    });
    
    // 清空数组和数据
    this.hexEntities = [];
    this.hexData = {};
  }
}
