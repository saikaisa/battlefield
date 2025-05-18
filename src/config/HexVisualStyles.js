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
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 平原地形
  plain: {
    layer: 'base',
    type: 'plain',
    priority: 1,
    fillColor: Cesium.Color.WHITE.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 丘陵地形
  hill: {
    layer: 'base',
    type: 'hill',
    priority: 1,
    fillColor: Cesium.Color.GREEN.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 山地地形
  mountain: {
    layer: 'base',
    type: 'mountain',
    priority: 1,
    fillColor: Cesium.Color.BURLYWOOD.withAlpha(0.1),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 水域地形
  water: {
    layer: 'base',
    type: 'water',
    priority: 1,
    fillColor: Cesium.Color.CYAN.withAlpha(0.1),
    borderColor: Cesium.Color.BLUE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // =========================== 标记层 ===========================
  // 蓝方阵营标记
  factionBlue: {
    layer: 'mark',
    type: 'factionBlue',
    priority: 0,
    fillColor: Cesium.Color.BLUE.withAlpha(0.15),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 红方阵营标记
  factionRed: {
    layer: 'mark',
    type: 'factionRed',
    priority: 0,
    fillColor: Cesium.Color.RED.withAlpha(0.15),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 战争迷雾
  invisible: {
    layer: 'mark',
    type: 'invisible',
    priority: 2,
    fillColor: Cesium.Color.BLACK.withAlpha(0.7),
    borderColor: Cesium.Color.BLACK.withAlpha(0.7),
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 1.0
  },
  // =========================== 交互层 ===========================
  // 选中高亮：默认黄色
  selected: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.YELLOW.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE,
    showFill: true,
    showBorder: true,
    borderPattern: true,  // 使用虚线边框，注意虚线边框的颜色不能带alpha
    borderWidth: 4.0
  },
  // 选中高亮：淡黄色
  selectedLightYellow: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.YELLOW.withAlpha(0.04),
    borderColor: Cesium.Color.WHITE.withAlpha(0),
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 选中高亮：蓝色
  selectedBlue: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.BLUE.withAlpha(0.08),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 选中高亮：红色
  selectedRed: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.RED.withAlpha(0.08),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 选中高亮：绿色
  selectedGreen: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.GREEN.withAlpha(0.3),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: false,
    borderWidth: 2.0
  },
  // 选中高亮：仅边框
  selectedBorder: {
    layer: 'interaction',
    type: 'selected',
    priority: 2,
    fillColor: Cesium.Color.BLACK.withAlpha(0),
    borderColor: Cesium.Color.YELLOW,
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 0.0
  },
  // 指挥部队：蓝方
  commanderBlue: {
    layer: 'interaction',
    type: 'commander',
    priority: 3,
    fillColor: Cesium.Color.BLUE.withAlpha(0.6),
    borderColor: Cesium.Color.WHITE,
    showFill: true,
    showBorder: true,
    borderPattern: true,
    borderWidth: 4.0
  },
  // 指挥部队：红方
  commanderRed: {
    layer: 'interaction',
    type: 'commander',
    priority: 3,
    fillColor: Cesium.Color.RED.withAlpha(0.6),
    borderColor: Cesium.Color.WHITE,
    showFill: true,
    showBorder: true,
    borderPattern: true,
    borderWidth: 4.0
  },
  // 支援部队：蓝方
  supportBlue: {
    layer: 'interaction',
    type: 'support',
    priority: 4,
    fillColor: Cesium.Color.BLUE.withAlpha(0.15),
    borderColor: Cesium.Color.WHITE,
    showFill: true,
    showBorder: true,
    borderPattern: true,
    borderWidth: 4.0
  },
  // 支援部队：红方
  supportRed: {
    layer: 'interaction',
    type: 'support',
    priority: 4,
    fillColor: Cesium.Color.RED.withAlpha(0.15),
    borderColor: Cesium.Color.WHITE,
    showFill: true,
    showBorder: true,
    borderPattern: true,
    borderWidth: 4.0
  },
  // 提示不合法的高亮
  invalid: {
    layer: 'interaction',
    type: 'invalid',
    priority: 4,
    fillColor: Cesium.Color.RED.withAlpha(0.6),
    borderColor: Cesium.Color.WHITE.withAlpha(0.2),
    showFill: true,
    showBorder: true,
    borderPattern: true, // 使用虚线边框
    borderWidth: 3.0
  },
  // 鼠标悬浮灰块
  hovered: {
    layer: 'immediately',
    type: 'hovered',
    priority: 1,
    fillColor: Cesium.Color.GRAY.withAlpha(0.5),
    borderColor: null,
    showFill: true,
    showBorder: false,
    borderPattern: false,
    borderWidth: 1.0
  },
};
