// src\layers\scene-layer\components\HexGridRenderer.js
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';
import { computed, watch } from "vue";
import { HexRendererConfig } from "@/config/GameConfig";
import { HexHeightCache } from './HexHeightCache';

// 缓存：每个六角格几何 (fillGeom, borderGeom)
const geometryCache = new Map();
// 缓存：按 layerIndex 存放 PrimitiveCollection，Map<layerIndex , PrimitiveCollection>
const baseLayerCache = new Map();

export class HexGridRenderer {
  static #instance = null;

  /**
   * 获取 HexGridRenderer 的单例实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例（仅首次调用时需要）
   * @returns {HexGridRenderer} 单例实例
   */
  static getInstance(viewer) {
    if (!HexGridRenderer.#instance) {
      if (!viewer) {
        throw new Error('首次创建 HexGridRenderer 实例时必须提供 viewer 参数');
      }
      HexGridRenderer.#instance = new HexGridRenderer(viewer);
    }
    return HexGridRenderer.#instance;
  }

  /**
   * 私有构造函数，接收 Cesium.Viewer 实例
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @private
   */
  constructor(viewer) {
    if (HexGridRenderer.#instance) {
      throw new Error('HexGridRenderer 是单例类，请使用 getInstance() 方法获取实例');
    }
    this.viewer = viewer;
    this.store = openGameStore();
    this.heightCache = HexHeightCache.getInstance(viewer);

    this.layerIndex = computed(() => this.store.layerIndex);
    this.interactGridPrimitives = null; // 交互层
    this.markGridPrimitives = null; // 标记层
    
    // 监听 selectedHexIds 的变化，更新六角格高亮样式
    watch(
      () => this.store.getSelectedHexIds(),
      (newSelectedIds, oldSelectedIds) => {
        this._updateSelectedHexStyles(newSelectedIds, oldSelectedIds);
      },
      { deep: true }
    );

    // 监听 layerIndex 的变化，更新六角格各层样式
    watch(
      () => this.layerIndex.value,
      () => {
        this.renderBaseGrid();
        this.renderMarkGrid(true);
        this.renderInteractGrid(true);
      }
    );

    // 设置地形采样精度
    this.viewer.scene.globe.maximumScreenSpaceError = HexRendererConfig.optimization.terrainSamplingError;
  }

  /**
   * 渲染六角格基础图层
   * @param {number} refresh 是否强制刷新
   */
  renderBaseGrid(refresh = false) {
    // 隐藏所有 (layerIndex===3)
    if (this.layerIndex.value === 3) {
      baseLayerCache.forEach(collection => collection.show = false);
      return;
    }

    // 首次或强制：清除旧缓存并重建所有层
    if (refresh || baseLayerCache.size === 0) {
      // 从场景移除并销毁旧集合
      baseLayerCache.forEach(collection => {
        this.viewer.scene.primitives.remove(collection);
      });
      baseLayerCache.clear();

      const hexCells = this.store.getHexCells();

      // 构建 layer 1 & 2 两套 PrimitiveCollection
      [1, 2].forEach(idx => {
        const primCollection = new Cesium.PrimitiveCollection();
         
        // 渲染挤压多边形
        this._renderExtrudedLayer(hexCells, primCollection, {
          layerIdx: idx,
          styleType: 'base',
          borderWidth: 2.0
        });
         
        // 显隐控制
        primCollection.show = (this.layerIndex.value === idx);
        // 加入场景 & 缓存
        this.viewer.scene.primitives.add(primCollection);
        baseLayerCache.set(idx, primCollection);
      });
    } else {
      // 仅切换显隐
      baseLayerCache.forEach((collection, idx) => {
        collection.show = (this.layerIndex.value === idx);
      });
    }
  }

  /**
   * 渲染六角格标记图层 (阵营标记等)
   * 只在layerIndex=1时渲染
   */
  renderMarkGrid(indexChange = false) {
    if (this.markGridPrimitives) {
      // 如果是通过切换图层调用的该方法，则只进行显隐控制
      if (indexChange) {
        this.markGridPrimitives.show = (this.layerIndex.value === 1);
        return;
      }
      
      this.viewer.scene.primitives.remove(this.markGridPrimitives);
      this.markGridPrimitives = null;
    }

    this.markGridPrimitives = new Cesium.PrimitiveCollection();
    const hexCells = this.store.getHexCells();
    
    // 渲染标记层
    this._renderExtrudedLayer(hexCells, this.markGridPrimitives, {
      styleType: 'mark',
      heightOffset: 1.0, // 略高于base层
      borderWidth: 2.0
    });

    this.viewer.scene.primitives.add(this.markGridPrimitives);
  }

  /**
   * 渲染六角格交互图层
   *  - 选中 / 其他交互标记
   */
  renderInteractGrid(indexChange = false) {
    if (this.interactGridPrimitives) {
      // 如果是通过切换图层调用的该方法，则只进行显隐控制
      if (indexChange) {
        this.interactGridPrimitives.show = (this.layerIndex.value !== 3);
        return;
      }
      
      // 否则重新渲染，先移除旧的
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }

    this.interactGridPrimitives = new Cesium.PrimitiveCollection();
    const hexCells = this.store.getHexCells();
    
    // 渲染交互层 - 使用粗虚线边框
    this._renderExtrudedLayer(hexCells, this.interactGridPrimitives, {
      styleType: 'interaction',
      heightOffset: 2.0, // 在mark层之上
      borderWidth: 4.0,
      borderPattern: true  // 使用虚线边框
    });

    this.viewer.scene.primitives.add(this.interactGridPrimitives);
  }
   
  /**
   * 通用渲染挤压多边形图层
   * @param {Array<HexCell>} hexCells 六角格单元数组
   * @param {Cesium.PrimitiveCollection} primCollection 要添加到的primitive集合
   * @param {Object} options 渲染选项
   * @param {number} [options.layerIdx] 图层索引，用于基础图层选择样式
   * @param {string} options.styleType 样式类型，如'base', 'mark', 'interaction'
   * @param {number} [options.heightOffset=0] 高度偏移，用于层叠效果
   * @param {number} [options.borderWidth=2.0] 边框宽度
   * @param {boolean} [options.borderPattern=false] 是否使用虚线边框
   * @private
   */
  _renderExtrudedLayer(hexCells, primCollection, options = {}) {
    const {
      layerIdx,
      styleType = 'base',
      heightOffset = 0,
      borderWidth = 2.0,
      borderPattern = false
    } = options;
    
    const borderInstances = [];
    const fillInstances = [];
        
    hexCells.forEach((hexCell) => {
      // 选择对应样式 - 根据不同条件获取样式
      let visual;
      
      if (styleType === 'base' && layerIdx !== undefined) {
        // 基础层根据layerIdx选择样式
        visual = layerIdx === 1
          ? HexVisualStyles.default
          : hexCell.getTopVisualStyle('base') || HexVisualStyles.default;
      } else {
        // 其他层取对应layer的顶层样式
        visual = hexCell.getTopVisualStyle(styleType);
      }
      
      // 如果没有对应样式，跳过此六角格
      if (!visual) return;
      console.log(`[Debug] 渲染六角格: ${hexCell.hexId}, 样式: ${JSON.stringify(visual)}`);
      
      if (visual.showFill) {
        // 使用HexHeightCache获取3D位置
        const positions = this.heightCache.getHex3DPositions(hexCell, false, heightOffset);
        if (positions.length === 0) return; // 如果无法获取位置，跳过

        // 获取六角格地形陡峭程度，用于动态调整挤压高度
        const hexCache = this.heightCache.hexHeightCache.get(hexCell.hexId);
        // 计算挤压高度 - 额外挤压高度 + 基础高度偏移
        const extrusionHeight = -(hexCache.heightOffset + HexRendererConfig.extrusionHeight);

        // 使用挤压多边形确保没有缝隙
        const fillInstance = new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(positions),
            perPositionHeight: true,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            extrudedHeight: extrusionHeight, // 动态计算挤压高度
            closeTop: true,
            closeBottom: true
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.fillColor || Cesium.Color.WHITE.withAlpha(0.1))
          },
          id: hexCell.hexId + "_fill"
        });
        fillInstances.push(fillInstance);
      }
      
      if (visual.showBorder) {
        // 使用HexHeightCache获取边界线3D位置
        const positions = this.heightCache.getHex3DPositions(hexCell, true, heightOffset);
        if (positions.length === 0) return; // 如果无法获取位置，跳过
        
        // 闭合轮廓
        positions.push(positions[0]);
        
        // 边框属性
        const borderColor = visual.borderColor || Cesium.Color.RED.withAlpha(0.1);
        
        const borderGeometryOptions = {
          positions: positions,
          width: borderWidth,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT
        };
        
        // 如果需要虚线边框，添加虚线样式
        if (borderPattern) {
          borderGeometryOptions.vertexFormat = Cesium.PolylineMaterialAppearance.VERTEX_FORMAT;
        }
        
        const borderInstance = new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry(borderGeometryOptions),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(borderColor)
          },
          id: hexCell.hexId + "_border"
        });
        
        borderInstances.push(borderInstance);
      }
    });

    // 添加填充实例
    if (fillInstances.length > 0) {
      primCollection.add(new Cesium.Primitive({
        geometryInstances: fillInstances,
        appearance: new Cesium.PerInstanceColorAppearance({
          flat: true,
          translucent: true,
          closed: true
        }),
        asynchronous: true,
        allowPicking: true,
        releaseGeometryInstances: true
      }));
    }

    // 添加边界线实例
    if (borderInstances.length > 0) {
      // 如果是虚线边框，使用材质外观
      let appearance;
      if (borderPattern) {
        appearance = new Cesium.PolylineMaterialAppearance({
          material: Cesium.Material.fromType('PolylineDash', {
            color: Cesium.Color.WHITE,
            dashLength: 16.0,
            dashPattern: 255 // 0b11111111
          })
        });
      } else {
        appearance = new Cesium.PolylineColorAppearance();
      }
      
      primCollection.add(new Cesium.Primitive({
        geometryInstances: borderInstances,
        appearance: appearance,
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true
      }));
    }
  }

  /**
   * 创建悬停Primitive
   * @param {HexCell} cell 六角格单元
   * @param {Cesium.Color} hoverColor 悬停颜色
   * @returns {Cesium.Primitive} 悬停Primitive
   */
  createHoverPrimitive(cell, hoverColor) {
    // 使用HexHeightCache获取3D位置，hover显示在所有层之上
    const positions = this.heightCache.getHex3DPositions(cell, false, 3.0);
    if (positions.length === 0) return null; // 无法获取位置
    
    // 获取六角格地形陡峭程度，用于动态调整挤压高度
    const hexCache = this.heightCache.hexHeightCache.get(cell.hexId);
    // 根据地形陡峭程度调整挤压深度
    const dynamicExtrusionHeight = hexCache ? 
      Math.min(HexRendererConfig.extrusionHeight, -hexCache.steepness * 1.5) : 
      HexRendererConfig.extrusionHeight;
    
    // 使用挤压多边形确保没有缝隙
    const inst = new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        perPositionHeight: true,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        extrudedHeight: dynamicExtrusionHeight, // 动态计算挤压高度
        closeTop: true,
        closeBottom: true
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(hoverColor)
      },
      id: cell.hexId + "_fill",
    });
    
    return new Cesium.Primitive({
      geometryInstances: inst,
      appearance: new Cesium.PerInstanceColorAppearance({
        flat: true,
        translucent: true,
        closed: true
      }),
      asynchronous: true,
      allowPicking: true
    });
  }

  /**
   * 监听selectedHexIds变化的回调，用于更新六角格的样式
   * @param {Set<string>} newSelectedIds - 新的选中ID集合
   * @param {Set<string>} oldSelectedIds - 旧的选中ID集合
   */
  _updateSelectedHexStyles(newSelectedIds, oldSelectedIds) {
    // 先处理移除的六角格（在旧集合中但不在新集合中）
    if (oldSelectedIds) {
      for (const hexId of oldSelectedIds) {
        if (!newSelectedIds.has(hexId)) {
          const hexCell = this.store.getHexCellById(hexId);
          if (hexCell) {
            hexCell.removeVisualStyleByType("selected");
          }
        }
      }
    }
    
    // 再处理新增的六角格（在新集合中但不在旧集合中）
    for (const hexId of newSelectedIds) {
      if (!oldSelectedIds || !oldSelectedIds.has(hexId)) {
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          hexCell.addVisualStyle(this.store.highlightStyle);
        }
      }
    }
    // 重新渲染交互层
    this.renderInteractGrid(false);
  }
  
  /**
   * 获取或创建六角格几何
   */
  static getOrCreateGeometry(hexCell) {
    let geom = geometryCache.get(hexCell.hexId);
    if (!geom) {
      geom = {
        fillGeometry: HexGridRenderer._createHexCellGeometry(hexCell),
        borderGeometry: HexGridRenderer._createHexCellBorderGeometry(hexCell)
      };
      geometryCache.set(hexCell.hexId, geom);
    }
    return geom;
  }

  /**
   * 根据 hexCell 对象创建 Cesium.PolygonGeometry 用于渲染
   * 注意：此函数只使用 position.points 中的顶点（第 1 至第 6 个元素）来创建多边形边界，中
   * 心点不参与边界绘制。
   * @param {HexCell} hexCell 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.PolygonGeometry}
   */
  static _createHexCellGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const pos = vertices.concat(vertices[0]);
    const posArr = pos.flatMap((pt) => [pt.longitude, pt.latitude, pt.height]);
    
    // 创建几何体时使用较低精度
    return Cesium.PolygonGeometry.fromPositions({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(posArr),
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      granularity: Cesium.Math.RADIANS_PER_DEGREE // 降低采样精度
    });
  }

  /**
   * 根据 hexCell 对象生成边框的 PolylineGeometry
   * 只使用 position.points 中的顶点（第 1 至第 6 个元素），然后重复第一个顶点闭合
   * @param {HexCell} hexCell - 六角格数据对象，要求 position.points 包含至少 7 个点（中心 + 6 个顶点）
   * @returns {Cesium.GroundPolylineGeometry}
   */
  static _createHexCellBorderGeometry(hexCell) {
    const vertices = hexCell.getVertices();
    const posArr = vertices.map((pt) => [pt.longitude, pt.latitude]).flat();
    
    // 创建几何体时使用较低精度
    return new Cesium.GroundPolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(posArr),
      loop: true,
      width: 4.0,
      granularity: Cesium.Math.RADIANS_PER_DEGREE * 2 // 降低采样精度
    });
  }
  
  /**
   * 清理模块级别缓存
   * @private
   */
  _clearModuleLevelCache() {
    // 清理模块级别的缓存
    geometryCache.clear();
    
    // 从场景移除并销毁所有图层集合
    baseLayerCache.forEach(collection => {
      if (this.viewer && this.viewer.scene) {
        this.viewer.scene.primitives.remove(collection);
      }
    });
    baseLayerCache.clear();
  }
  
  /**
   * 清理资源
   * 释放所有Cesium资源和缓存
   */
  dispose() {
    // 移除mark图层
    if (this.markGridPrimitives) {
      this.viewer.scene.primitives.remove(this.markGridPrimitives);
      this.markGridPrimitives = null;
    }
    
    // 移除交互图层
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }
    
    // 清理模块级别的缓存
    this._clearModuleLevelCache();
    
    // 清理单例引用
    HexGridRenderer.#instance = null;
  }
}

// 导出渲染服务
export const HexRenderer = {
  /**
   * 获取渲染器实例
   * @returns {HexGridRenderer} 六角格渲染器实例
   */
  getRenderer() {
    return HexGridRenderer.getInstance();
  },
  
  /**
   * 渲染基础六角格网格
   * @param {boolean} [refresh=false] 是否强制刷新
   */
  renderBaseGrid(refresh = false) {
    const renderer = this.getRenderer();
    renderer.renderBaseGrid(refresh);
  },
  
  /**
   * 渲染标记图层
   */
  renderMarkGrid() {
    const renderer = this.getRenderer();
    renderer.renderMarkGrid(false); // 从外部调用时都是因为要刷新了，而不是因为图层切换
  },
  
  /**
   * 渲染交互图层
   */
  renderInteractGrid() {
    const renderer = this.getRenderer();
    renderer.renderInteractGrid(false); // 从外部调用时都是因为要刷新了，而不是因为图层切换
  },
}