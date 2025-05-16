// src\config\HexVisualStyles.js
import * as Cesium from "cesium";

/**
 * 各种视觉预设预定义
 */ 
export const HexVisualStyles = {
  // =========================== 基础层 ===========================
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
  // =========================== 标记层 ===========================
  // 蓝方阵营标记
  factionBlue: {
    layer: 'mark',
    type: 'factionBlue',
    priority: 0,
    fillColor: Cesium.Color.BLUE.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 红方阵营标记
  factionRed: {
    layer: 'mark',
    type: 'factionRed',
    priority: 0,
    fillColor: Cesium.Color.RED.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 战争迷雾
  invisible: {
    layer: 'mark',
    type: 'invisible',
    priority: 1,
    fillColor: Cesium.Color.BLACK.withAlpha(0.7),
    borderColor: Cesium.Color.BLACK.withAlpha(0.7),
    showFill: true,
    showBorder: false
  },
  // =========================== 交互层 ===========================
  // 选中高亮：默认黄色
  selected: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.YELLOW.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 选中高亮：蓝色
  selectedBlue: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.BLUE.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 选中高亮：红色
  selectedRed: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.RED.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 选中高亮：绿色
  selectedGreen: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.GREEN.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 提示不合法的高亮
  invalid: {
    layer: 'interaction',
    type: 'invalid',
    priority: 3,
    fillColor: Cesium.Color.RED.withAlpha(0.6),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true
  },
  // 鼠标悬浮灰块
  hovered: {
    layer: 'immediately',
    type: 'hovered',
    priority: 1,
    fillColor: Cesium.Color.GRAY.withAlpha(0.5),
    borderColor: null,
    showFill: true,
    showBorder: false
  },
};
