// src\layers\interaction-layer\ScreenInteractor.js
import { watch } from 'vue';
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexVisualStyles } from "@/config/HexVisualStyles";
// eslint-disable-next-line no-unused-vars
import { HexGridRenderer } from "@/layers/scene-layer/components/HexGridRenderer";

/**
 * ScreenInteractor: 管理鼠标悬浮 / 点击选中交互
 *  - 悬浮灰块 hovered
 *  - 点击高亮 selected
 *  - 支持单选或多选模式
 *  - 单/多选模式下，对同一格点击是否可取消也可配置
 */
export class ScreenInteractor {
  static instance = null;

  /**
   * 获取 ScreenInteractor 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @param {Object} options - 配置选项
   * @returns {ScreenInteractor} 单例实例
   */
  static getInstance(viewer, options = {}) {
    if (!ScreenInteractor.instance) {
      if (!viewer) {
        throw new Error('首次创建 ScreenInteractor 实例时必须提供 viewer 和 hexGridRenderer 参数');
      }
      ScreenInteractor.instance = new ScreenInteractor(viewer, options);
    }
    return ScreenInteractor.instance;
  }

  /**
   * 私有构造函数
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {Object} options
   * @param {boolean} [options.enabled=true] - 是否启用鼠标交互
   * @param {boolean} [options.multiSelect=false] - 是否多选
   * @param {boolean} [options.allowCancelSingle=true] - 单选模式下，点击已选的格子是否可取消
   * @param {boolean} [options.allowCancelMulti=false] - 多选模式下，点击已选的格子是否可取消
   * @private
   */
  constructor(viewer, options = {}) {
    if (ScreenInteractor.instance) {
      throw new Error('ScreenInteractor 是单例类，请使用 getInstance() 方法获取实例');
    }

    this.viewer = viewer;
    this.hexGridRenderer = HexGridRenderer.getInstance(viewer);
    this.store = openGameStore();

    // 基本交互设置
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.multiSelect = options.multiSelect !== undefined ? options.multiSelect : false;

    // 关于"点击已选格能否取消"
    this.allowCancelSingle = options.allowCancelSingle !== undefined ? options.allowCancelSingle : true;
    this.allowCancelMulti = options.allowCancelMulti !== undefined ? options.allowCancelMulti : false;

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
      } else {
        // 点到空白
        if (!this.multiSelect) {
          // 单选模式下点击空白就清空
          this._removeStyleFromAll("selected");
          this.store.clearSelectedHexIds();
        }
      }
      this.hexGridRenderer.renderInteractGrid();
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
  
    const { fillGeometry } = HexGridRenderer.getOrCreateGeometry(cell);
  
    const inst = new Cesium.GeometryInstance({
      geometry: fillGeometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          HexVisualStyles.hovered.fillColor
        )
      },
      id: cell.hexId + "_fill",
    });
  
    this.hoverPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: inst,
      asynchronous: false,
    });
    this.viewer.scene.primitives.add(this.hoverPrimitive);
  }

  /**
   * 点击处理：单选或多选，根据配置决定能否取消
   */
  _handleClick(hexId) {
    if (!this.enabled) return;
    
    const selectedIds = this.store.getSelectedHexIds();
    const isSelected = selectedIds.has(hexId);

    if (!this.multiSelect) {
      // ================== 单选模式 ==================
      if (isSelected) {
        // 如果已经选中
        if (this.allowCancelSingle) {
          // 允许取消，则移除
          this.store.removeSelectedHexId(hexId);
          this._removeVisualStyleByType(hexId, "selected");
        } else {
          // 不允许取消 => 什么都不做
        }
      } else {
        // 没选中 => 先清空，再选它
        this._removeStyleFromAll("selected");
        this.store.clearSelectedHexIds();

        this.store.addSelectedHexId(hexId);
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          hexCell.addVisualStyle(HexVisualStyles.selected);
        }
      }

    } else {
      // ================== 多选模式 ==================
      if (isSelected) {
        if (this.allowCancelMulti) {
          // 允许取消 => 移除
          this.store.removeSelectedHexId(hexId);
          this._removeVisualStyleByType(hexId, "selected");
        } else {
          // 不允许取消 => 不做处理
        }
      } else {
        // 新增选中
        this.store.addSelectedHexId(hexId);
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          hexCell.addVisualStyle(HexVisualStyles.selected);
        }
      }
    }
  }

  /**
   * 清空所有交互层样式 + 清空 store
   */
  clearInteractionStyles() {
    this.store.clearSelectedHexIds();
    // 移除所有 interaction 样式
    const hexCells = this.store.getHexCells();
    hexCells.forEach((hexCell) => {
      if (hexCell.visibility.visualStyles) {
        hexCell.visibility.visualStyles = hexCell.visibility.visualStyles.filter(s => s.layer !== 'interaction');
      }
    });
    // 取消悬浮
    this.hoveredHexId = null;
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
  _removeVisualStyleByType(hexId, styleType) {
    const cell = this.store.getHexCellById(hexId);
    if (!cell) return;
    cell.removeVisualStyleByType(styleType);
  }

  _removeStyleFromAll(type) {
    const hexCells = this.store.getHexCells();
    hexCells.forEach((hexCell) => {
      hexCell.removeVisualStyleByType(type);
    });
  }
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
