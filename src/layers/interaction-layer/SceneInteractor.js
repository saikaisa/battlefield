// src\layers\interaction-layer\SceneInteractor.js
import { watch } from 'vue';
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexVisualStyles } from "@/config/HexVisualStyles";
// eslint-disable-next-line no-unused-vars
import { HexGridRenderer } from "@/layers/scene-layer/components/HexGridRenderer";
import { SelectValidator } from "./utils/HexSelectValidator";

/**
 * SceneInteractor: 管理鼠标悬浮 / 点击选中交互
 *  - 悬浮、点击、选中、取消选中，并将屏幕上的点击与六角格选中列表同步
 *  - 根据不同游戏模式来控制六角格的单选/多选/禁止选择
 */
export class SceneInteractor {
  static #instance = null;

  /**
   * 获取 SceneInteractor 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @param {Object} options - 配置选项
   * @returns {SceneInteractor} 单例实例
   */
  static getInstance(viewer, options = {}) {
    if (!SceneInteractor.#instance) {
      if (!viewer) {
        throw new Error('首次创建 SceneInteractor 实例时必须提供 viewer 和 hexGridRenderer 参数');
      }
      SceneInteractor.#instance = new SceneInteractor(viewer, options);
    }
    return SceneInteractor.#instance;
  }

  /**
   * 私有构造函数
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {Object} options
   * @param {boolean} [options.enabled=true] - 是否启用鼠标交互，包括悬浮、点击
   * @param {boolean} [options.multiSelect=false] - 是否多选
   * @private
   */
  constructor(viewer, options = {}) {
    if (SceneInteractor.#instance) {
      throw new Error('SceneInteractor 是单例类，请使用 getInstance() 方法获取实例');
    }

    this.viewer = viewer;
    this.hexGridRenderer = HexGridRenderer.getInstance(viewer);
    this.store = openGameStore();

    // 基本交互设置
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.multiSelect = options.multiSelect !== undefined ? options.multiSelect : false;

    // 记录当前悬浮的 hexId 和 primitive（只能有一个）
    this.hoveredHexId = null;
    this.hoverPrimitive = null;

    // 监听 layerIndex，全局图层切换时自动启停交互
    watch(
      () => this.store.layerIndex, // 侦听全局图层
      (newLayer) => {
        if (newLayer === 3) {
          this._hideHover();
          this.enabled = false;
        } else {
          this.enabled = true;
        }
      },
      { immediate: true }   // 首次立即触发一次，以设置 enabled
    );

    // 监听hexSelectMode变化，更新鼠标交互状态
    watch(
      () => this.store.hexSelectMode,
      (mode) => {
        if (mode === 'none') {
          this.enabled = false;
        } else {
          this.enabled = true;
          this.multiSelect = mode === 'multi';
        }
      },
      { immediate: true }
    );

    // Hover 降频调度
    this._nextHoverId = null;
    this._hoverRafId  = null;

    // 创建事件处理器
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 绑定事件
    this._bindMouseMove();
    this._bindLeftClick();
  }

  /**
   * 绑定鼠标移动事件，处理悬浮
   */
  _bindMouseMove() {
    this.handler.setInputAction((movement) => {
      if (!this.enabled) return;
      const pickedObj = this.viewer.scene.pick(movement.endPosition);
      const hexId = (Cesium.defined(pickedObj) && pickedObj.id?.includes("_fill"))
                      ? pickedObj.id.replace("_fill", "")
                      : null;
      this._scheduleHover(hexId);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  /**
   * 绑定鼠标点击事件，处理选中
   */
  _bindLeftClick() {
    this.handler.setInputAction((click) => {
      if (!this.enabled) return;
      const pickedObj = this.viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObj) && pickedObj.id && pickedObj.id.includes("_fill")) {
        const hexId = pickedObj.id.replace("_fill", "");
        this._handleClick(hexId);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }
  
  /** 将 hover 处理合并到下一帧，只执行一次 */
  _scheduleHover(hexId) {
    if (!this.enabled) return;
    if (this._hoverRafId) return;      // 已经排队
    this._nextHoverId = hexId;
    this._hoverRafId = requestAnimationFrame(() => {
      this._hoverRafId = null;
      this._handleHover(this._nextHoverId);
    });
  }

  /**
   * 悬浮处理：移除旧悬浮，加新悬浮
   */
  _handleHover(hexId) {
    if (!this.enabled) return;
    if (hexId === this.hoveredHexId) return;
    this.hoveredHexId = hexId;
  
    if (this.hoverPrimitive) {
      this.viewer.scene.primitives.remove(this.hoverPrimitive);
      this.hoverPrimitive = null;
    }
  
    // 如果移到空白就结束
    if (!hexId) return;
  
    // 为新的格子重新创建 Primitive
    const cell = this.store.getHexCellById(hexId);
    if (!cell) return;
  
    // 使用HexGridRenderer创建悬停效果
    this.hoverPrimitive = this.hexGridRenderer.createHoverPrimitive(cell, HexVisualStyles.hovered.fillColor);
    this.viewer.scene.primitives.add(this.hoverPrimitive);
  }

  /**
   * 点击处理：只负责更新store中的selectedHexIds，不直接操作样式
   */
  _handleClick(hexId) {
    if (!this.enabled) return;

    // 使用验证器检查选择是否有效
    if (!SelectValidator.validate(hexId)) {
      console.log(`无效的选择: ${hexId}`);
      return;
    }

    const selectedIds = this.store.getSelectedHexIds();
    const isSelected = selectedIds.has(hexId);

    if (!this.multiSelect) {
      // ================== 单选模式 ==================
      if (isSelected) {
        // 如果已经选中，则移除
          this.store.removeSelectedHexId(hexId);
      } else {
        // 没选中 => 先清空，再选中
        this.store.clearSelectedHexIds();
        this.store.addSelectedHexId(hexId);
      }
    } else {
      // ================== 多选模式 ==================
      if (isSelected) {
        this.store.removeSelectedHexId(hexId);
      } else {
        // 新增选中
        this.store.addSelectedHexId(hexId);
      }
    }
  }

  destroy() {
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
    // 清除 RAF
    if (this._hoverRafId) {
      cancelAnimationFrame(this._hoverRafId);
      this._hoverRafId = null;
    }
  }

  // =============== 辅助方法 ===============
  /**
   * 隐藏当前悬浮灰块
   */
  _hideHover() {
    if (this.hoverPrimitive) {
      this.viewer.scene.primitives.remove(this.hoverPrimitive);
      this.hoverPrimitive = null;
    }
    this.hoveredHexId = null;
  }
}
