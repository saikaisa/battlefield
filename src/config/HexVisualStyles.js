import * as Cesium from 'cesium';

/**
 * 各种视觉预设预定义
 * 
 * layer = 
 * base: renderBaseGrid() 渲染参考属性
 * interaction: renderInteractGrid() 渲染参考属性
 */ 
export const HexVisualStyles = {
  // 默认样式
  default: {
    layer: 'base',
    type: 'default',
    priority: 1,
    fillColor: Cesium.Color.BLACK.withAlpha(0.1),
    borderColor: Cesium.Color.BLACK.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 平原地形
  plain: {
    layer: 'base',
    type: 'plain',
    priority: 1,
    fillColor: Cesium.Color.WHITE.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 丘陵地形
  hill: {
    layer: 'base',
    type: 'hill',
    priority: 1,
    fillColor: Cesium.Color.GREEN.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 山地地形
  mountain: {
    layer: 'base',
    type: 'mountain',
    priority: 1,
    fillColor: Cesium.Color.BURLYWOOD.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 水域地形
  water: {
    layer: 'base',
    type: 'water',
    priority: 1,
    fillColor: Cesium.Color.CYAN.withAlpha(0.1),
    borderColor: Cesium.Color.BLUE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 蓝方阵营高亮标记
  factionBlue: {
    layer: 'base',
    type: 'factionBlue',
    priority: 2,
    fillColor: Cesium.Color.BLUE.withAlpha(0.3),
    showFill: true,
  },
  // 红方阵营高亮标记
  factionRed: {
    layer: 'base',
    type: 'factionRed',
    priority: 2,
    fillColor: Cesium.Color.RED.withAlpha(0.3),
    showFill: true,
  },
  // 鼠标悬浮灰块
  hovered: {
    layer: 'interaction',
    type: 'hovered',
    priority: 1,
    fillColor: Cesium.Color.GRAY.withAlpha(0.5),
    showFill: true,
  },
  // 选中高亮
  selected: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.YELLOW.withAlpha(0.3),
    showFill: true,
  },
  // 提示不合法的高亮
  invalid: {
    layer: 'interaction',
    type: 'invalid',
    priority: 3,
    fillColor: Cesium.Color.RED.withAlpha(0.6),
    showFill: true,
  }
};
