// src\layers\geo-layer\components\HexGridRenderer.js
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';
import { computed } from "vue";
import { HexRendererConfig } from "@/config/GameConfig";

// 缓存：每个六角格几何 (fillGeom, borderGeom)
const geometryCache = new Map();
// 缓存：按 layerIndex 存放 PrimitiveCollection，Map<layerIndex , PrimitiveCollection>
const baseLayerCache = new Map();

export class HexGridRenderer {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();

    this.layerIndex = computed(() => this.store.layerIndex);
    // console.log(`layerIndex: ${this.layerIndex.value}`)
    this.interactGridPrimitives = null; // 交互层
    this.selectedHexIds = this.store.getSelectedHexIds(); // 鼠标选中的六角格，保存至全局状态
    
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
        this._renderExtrudedPolygons(hexCells, idx, primCollection);
         
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
   * 挤压多边形模式渲染 - 使用普通Primitive
   * @private
   */
  _renderExtrudedPolygons(hexCells, layerIdx, primCollection) {
    const borderInstances = [];
    const fillInstances = [];
        
    hexCells.forEach((hexCell) => {
      // 选择对应样式
      let visual = layerIdx === 1
        ? HexVisualStyles.default
        : hexCell.getTopVisualStyle('base') || HexVisualStyles.default;
      
      if (visual.showFill) {
        // 使用直接创建的3D多边形，而不是GroundGeometry
        const positions = this.createHexagon3DPositions(hexCell, false);
        
          // 使用挤压多边形确保没有缝隙
          const fillInstance = new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(positions),
              perPositionHeight: true,
              vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
              extrudedHeight: HexRendererConfig.extrusionHeight, // 向下挤压
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
        // 使用普通边界线而非地面边界线，边界线高度额外增加一点
        const positions = this.createHexagon3DPositions(hexCell, true);
        // 闭合轮廓
        positions.push(positions[0]);
        
        const borderInstance = new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry({
            positions: positions,
            width: 2.0,
            vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(visual.borderColor || Cesium.Color.RED.withAlpha(0.1))
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
      primCollection.add(new Cesium.Primitive({
        geometryInstances: borderInstances,
        appearance: new Cesium.PolylineColorAppearance(),
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true
      }));
    }
  }

  /**
   * 渲染六角格交互图层
   *  - 鼠标划过 / 选中 / 其他交互标记
   */
  renderInteractGrid() {
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }
    if (this.layerIndex.value === 3) return; // layerIndex=3时，不渲染

    this.interactGridPrimitives = new Cesium.PrimitiveCollection();
    const hexCells = this.store.getHexCells();
    
    // 渲染交互层
    this._renderExtrudedInteractions(hexCells);

    this.viewer.scene.primitives.add(this.interactGridPrimitives);
  }
   
  /**
   * 渲染挤压多边形模式下的交互层
   * @private
   */
  _renderExtrudedInteractions(hexCells) {
    const interactInstances = [];
  
    hexCells.forEach((hexCell) => {
      // 获取 interaction 层内 优先级最高的样式
      const style = hexCell.getTopVisualStyle('interaction');
      if (!style) {
        return; // 该 hexCell 在交互层没有样式，不渲染
      }
      
      // 创建3D位置
      const positions = this.createHexagon3DPositions(hexCell, false);
      
      // 取 fillColor
      const color = style.fillColor || Cesium.Color.WHITE.withAlpha(0.1);

        // 使用挤压多边形确保没有缝隙
        const interactInstance = new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(positions),
            perPositionHeight: true,
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            extrudedHeight: HexRendererConfig.extrusionHeight, // 向下挤压
            closeTop: true,
            closeBottom: true
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
          },
          id: hexCell.hexId + "_fill"
        });
        interactInstances.push(interactInstance);
    });

    if (interactInstances.length > 0) {
      this.interactGridPrimitives.add(new Cesium.Primitive({
        geometryInstances: interactInstances,
        appearance: new Cesium.PerInstanceColorAppearance({
          flat: true,
          translucent: true,
          closed: true
        }),
        asynchronous: true,
        allowPicking: true
      }));
    }
  }

  /**
   * 创建3D六角形位置坐标数组，带高度偏移
   * @param {HexCell} hexCell 六角格单元
   * @param {boolean} isBorder 是否为边界线，边界线高度会额外增加
   * @returns {Array<Cesium.Cartesian3>} 3D位置数组
   */
  createHexagon3DPositions(hexCell, isBorder = false) {
    const vertices = hexCell.getVertices();
    const positions = [];
    
    // 获取平均高度和最高点，用于更好地确定偏移量
    let maxHeight = 0;
    let minHeight = Infinity;
    let avgHeight = 0;
    
    // 考虑中心点高度，中心点对山脊检测很重要
    const centerHeight = hexCell.getCenter().height;
    
    // 记录山顶情况 - 中心高于周围顶点平均值说明有可能在山顶/脊
    let isMountainPeak = false;
    
    vertices.forEach(vertex => {
      if (vertex.height > maxHeight) {
        maxHeight = vertex.height;
      }
      if (vertex.height < minHeight) {
        minHeight = vertex.height;
      }
      avgHeight += vertex.height;
    });
    
    avgHeight /= vertices.length;
    
    // 检测地形的陡峭程度 - 高低差越大，地形越陡峭
    const heightRange = maxHeight - minHeight;
    
    // 检测是否为山顶/山脊 - 中心点比平均高度高，很可能在山脊上
    if (centerHeight > avgHeight) {
      isMountainPeak = true;
      // 考虑中心点可能高于所有顶点的情况
      if (centerHeight > maxHeight) {
        maxHeight = centerHeight;
      }
    }
    
    // 增加对中心点的考虑，确保覆盖山脊
    const variationFromCenter = Math.abs(centerHeight - avgHeight);
    
    // 地形变化 - 取最大顶点与平均值差，或中心点与平均值差的较大者
    const heightVariation = Math.max(maxHeight - avgHeight, variationFromCenter);
    
    // 动态计算偏移值 - 地形越复杂，偏移越大
    let dynamicOffset = HexRendererConfig.heightOffset;
    
    // 根据地形变化添加偏移
    let terrainOffset = heightVariation * HexRendererConfig.terrainFactor;
    
    // 山脊/山顶区域需要额外偏移 - 作为地形因素的加成而不是单独叠加
    if (isMountainPeak) {
      // 将山顶额外偏移应用到地形偏移上，而不是直接加到最终偏移
      terrainOffset += terrainOffset * (HexRendererConfig.mountainPeakExtraOffset / 100);
    }
    
    // 将地形偏移添加到基础偏移
    dynamicOffset += terrainOffset;
    
    // 陡峭地形分级处理
    // 根据高度差范围细分地形类型，给予不同的高度偏移
    switch (true) {
      // 平缓地形 (0-10米高差) - 不需额外偏移
      case (heightRange <= HexRendererConfig.terrainSteepness.flat.maxRange):
        // 保持基础偏移
        break;
      // 轻微起伏 (10-20米高差)
      case (heightRange <= HexRendererConfig.terrainSteepness.gentle.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.gentle.extraOffset;
        break;
      // 中等陡峭 (20-50米高差)
      case (heightRange <= HexRendererConfig.terrainSteepness.moderate.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.moderate.extraOffset;
        break;
      // 显著陡峭 (50-100米高差)
      case (heightRange <= HexRendererConfig.terrainSteepness.steep.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.steep.extraOffset;
        break;
      // 非常陡峭 (100-200米高差)
      case (heightRange <= HexRendererConfig.terrainSteepness.verysteep.maxRange):
        dynamicOffset += HexRendererConfig.terrainSteepness.verysteep.extraOffset;
        break;
      // 极端陡峭 (>200米高差，如悬崖、峡谷或高山)
      default:
        dynamicOffset += HexRendererConfig.terrainSteepness.extreme.extraOffset;
        
        // 对于特别极端的情况，进一步增加偏移
        if (heightRange > HexRendererConfig.terrainSteepness.extreme.maxRange) {
          dynamicOffset += HexRendererConfig.terrainSteepness.mountain.extraOffset;
        }
        break;
    }
    
    // 如果是边界线，额外增加高度
    const finalOffset = isBorder ? dynamicOffset + HexRendererConfig.borderExtraOffset : dynamicOffset;
    
    // 转换每个顶点为Cartesian3并添加高度偏移
    vertices.forEach(vertex => {
      const position = Cesium.Cartesian3.fromDegrees(
        vertex.longitude, 
        vertex.latitude, 
        vertex.height + finalOffset
      );
      positions.push(position);
    });
    
    return positions;
  }

  /**
   * 创建悬停效果原语
   * @param {HexCell} cell 六角格单元
   * @param {Cesium.Color} hoverColor 悬停颜色
   * @returns {Cesium.Primitive} 悬停原语
   */
  createHoverPrimitive(cell, hoverColor) {
    // 创建3D位置坐标
    const positions = this.createHexagon3DPositions(cell, false);
    
    // 使用挤压多边形确保没有缝隙
    const inst = new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        perPositionHeight: true,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        extrudedHeight: HexRendererConfig.extrusionHeight,
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
}