import * as Cesium from 'cesium';

// 各种视觉预设预定义
export const HexVisualStyles = {
  default: {
    fillColor: Cesium.Color.BLACK.withAlpha(0.1),
    borderColor: Cesium.Color.BLACK.withAlpha(0.2),
    showFill: false,
    showBorder: true
  },
  plain: {
    fillColor: Cesium.Color.WHITE.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  hill: {
    fillColor: Cesium.Color.GREEN.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  mountain: {
    fillColor: Cesium.Color.BURLYWOOD.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  water: {
    fillColor: Cesium.Color.CYAN.withAlpha(0.1),
    borderColor: Cesium.Color.BLUE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 高亮时使用（一般会显示填充效果）
  highlight: {
    fillColor: Cesium.Color.YELLOW.withAlpha(0.3),
    borderColor: Cesium.Color.ORANGE.withAlpha(0.3),
    showFill: true,
    showBorder: false
  },
  // 路径状态示例
  pathFeasible: {
    fillColor: Cesium.Color.GREEN.withAlpha(0.3),
    borderColor: Cesium.Color.LIME.withAlpha(0.3),
    showFill: true,
    showBorder: false
  },
  pathInfeasible: {
    fillColor: Cesium.Color.RED.withAlpha(0.3),
    borderColor: Cesium.Color.DARKRED.withAlpha(0.3),
    showFill: true,
    showBorder: false
  }
};

/**
 * 根据 DEM 高度（elevation）自动返回视觉样式
 * @param {number} elevation DEM 高度（米）
 * @returns {Object} 视觉样式预设对象
 */
export function assignVisualStyle(elevation) {
  // 示例：低海拔用 plain；中等海拔用 hill；高海拔用 mountain
  if (elevation < 100) {
    return HexVisualStyles.plain;
  } else if (elevation < 200) {
    return HexVisualStyles.hill;
  } else {
    return HexVisualStyles.mountain;
  }
}
