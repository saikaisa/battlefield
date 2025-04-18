// src\layers\interaction-layer\ScreenInteractor.js
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { HexVisualStyles } from "@/config/HexVisualStyles";
// eslint-disable-next-line no-unused-vars
import { HexGridRenderer } from "@/layers/geo-layer/components/HexGridRenderer";

/**
 * ScreenInteractor: 管理鼠标悬浮 / 点击选中交互
 *  - 悬浮灰块 hovered
 *  - 点击高亮 selected
 *  - 支持单选或多选模式
 *  - 单/多选模式下，对同一格点击是否可取消选中也可配置
 */
export class ScreenInteractor {
  /**
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {Object} options
   * @param {boolean} [options.enabled=true] - 是否启用鼠标交互
   * @param {boolean} [options.multiSelect=false] - 是否多选
   * @param {boolean} [options.allowCancelSingle=true] - 单选模式下，点击已选的格子是否可取消
   * @param {boolean} [options.allowCancelMulti=false] - 多选模式下，点击已选的格子是否可取消
   */
  constructor(viewer, hexGridRenderer, options = {}) {
    this.viewer = viewer;
    this.hexGridRenderer = hexGridRenderer;
    this.store = openGameStore();

    // 基本交互设置
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.multiSelect = options.multiSelect !== undefined ? options.multiSelect : false;

    // 关于“点击已选格能否取消”
    this.allowCancelSingle = options.allowCancelSingle !== undefined ? options.allowCancelSingle : true;
    this.allowCancelMulti = options.allowCancelMulti !== undefined ? options.allowCancelMulti : false;

    // 记录当前悬浮的 hexId（只能有一个）
    this.hoveredHexId = null;

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
      if (Cesium.defined(pickedObj) && pickedObj.id && pickedObj.id.includes("_fill")) {
        const hexId = pickedObj.id.replace("_fill", "");
        this._handleHover(hexId);
      } else {
        this._handleHover(null); // 移开到空白
      }
      this.hexGridRenderer.renderInteractGrid();
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

  /**
   * 悬浮处理：移除旧悬浮，加新悬浮
   */
  _handleHover(hexId) {
    if (hexId === this.hoveredHexId) {
      return; // 无需重复
    }
    // 移除旧悬浮
    if (this.hoveredHexId) {
      this._removeVisualStyleByType(this.hoveredHexId, "hovered");
    }
    this.hoveredHexId = hexId;

    // 新建悬浮
    if (hexId) {
      const hexCell = this._getHexCellById(hexId);
      if (hexCell) {
        hexCell.addVisualStyle(HexVisualStyles.hovered); 
      }
    }
  }

  /**
   * 点击处理：单选或多选，根据配置决定能否取消
   */
  _handleClick(hexId) {
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
        const hexCell = this._getHexCellById(hexId);
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
        const hexCell = this._getHexCellById(hexId);
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
  }

  // =============== 辅助方法 ===============

  _getHexCellById(hexId) {
    const all = this.store.getHexCells();
    return all.find(c => c.hexId === hexId);
  }

  _removeVisualStyleByType(hexId, styleType) {
    const cell = this._getHexCellById(hexId);
    if (!cell) return;
    cell.removeVisualStyleByType(styleType);
  }

  _removeStyleFromAll(type) {
    const hexCells = this.store.getHexCells();
    hexCells.forEach((hexCell) => {
      hexCell.removeVisualStyleByType(type);
    });
  }
}
