// src\layers\scene-layer\components\HexGridRenderer.js
import * as Cesium from "cesium";
import { openGameStore } from '@/store';
import { HexVisualStyles } from '@/config/HexVisualStyles';
// eslint-disable-next-line no-unused-vars
import { HexCell } from '@/models/HexCell';
import { computed, watch } from "vue";
import { HexRendererConfig } from "@/config/GameConfig";
import { HexHeightCache } from './HexHeightCache';
import { GameMode } from '@/config/GameModeConfig';

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
    this.markGridPrimitives = null; // 标记层
    this.interactGridPrimitives = null; // 交互层集合(选中高亮)
    this.commandRangePrimitives = null; // 指挥范围高亮层
    this.enemyCommandRangePrimitives = null; // 敌方指挥范围高亮层
    
    // 存储六角格ID到Primitive的映射
    this.hexPrimitiveMap = new Map();
    this.commandRangeHexMap = new Map(); // 指挥范围六角格ID到Primitive的映射
    this.enemyCommandRangeHexMap = new Map(); // 敌方指挥范围六角格ID到Primitive的映射
    
    // 监听选中状态、样式、游戏模式的变化，更新交互层渲染
    watch(
      [
        () => this.store.getSelectedHexIds(),
        () => this.store.getSelectedForceIds(),
        () => this.store.highlightStyle,
        () => this.store.rangeStyle,
        () => this.store.gameMode,
        () => this.store.attackState,
      ],
      () => {
        // 直接触发交互层渲染
        this.renderInteractGrid(false);
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
          styleType: 'base'
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
      heightOffset: 1.0 // 略高于base层
    });

    this.viewer.scene.primitives.add(this.markGridPrimitives);
  }

  /**
   * 通用方法：更新六角格primitive集合(增量更新)
   * @param {Cesium.PrimitiveCollection} primCollection 要更新的primitive集合
   * @param {Map} primMap 六角格ID到primitive的映射
   * @param {Set} hexIdsToRender 需要显示的六角格ID集合
   * @param {Function} createPrimitiveFn 创建primitive的函数，接收hexId参数，返回primitive
   * @param {string} prefix 用于区分不同类型的primitive，防止同一hexId的不同类型primitive相互覆盖
   * @private
   */
  _updateHexPrimitives(primCollection, primMap, hexIdsToRender, createPrimitiveFn, prefix = '') {
    // 1. 计算需要移除的格子
    const hexIdsToRemove = [];
    for (const key of primMap.keys()) {
      const [p, hexId] = key.split('::');
      if (p === prefix && !hexIdsToRender.has(hexId)) {
        hexIdsToRemove.push(key);
      }
    }
    
    // 2. 计算需要新增的格子
    const hexIdsToAdd = [];
    for (const hexId of hexIdsToRender) {
      const key = `${prefix}::${hexId}`;
      if (!primMap.has(key)) {
        hexIdsToAdd.push(hexId);
      }
    }
    
    // 3. 移除不再需要的primitive
    for (const key of hexIdsToRemove) {
      const primitive = primMap.get(key);
      if (primitive) {
        primCollection.remove(primitive);
        primMap.delete(key);
      }
    }
    
    // 4. 添加新的primitive
    for (const hexId of hexIdsToAdd) {
      const primitive = createPrimitiveFn(hexId);
      if (primitive) {
        primCollection.add(primitive);
        // 使用前缀+hexId作为key，防止不同类型的primitive相互覆盖
        primMap.set(`${prefix}::${hexId}`, primitive);
      }
    }
  }

  /**
   * 渲染六角格交互图层
   *  - 处理所有交互样式，包括选中和其他交互标记
   *  - 为每个六角格单独创建primitive，避免闪烁
   */
  renderInteractGrid(indexChange = false) {
    // 图层切换时处理显隐控制
    if (indexChange) {
      const shouldShow = (this.layerIndex.value !== 3); 
      if (this.interactGridPrimitives) {
        this.interactGridPrimitives.show = shouldShow;
      }
      if (this.commandRangePrimitives) {
        this.commandRangePrimitives.show = shouldShow;
      }
      if (this.enemyCommandRangePrimitives) {
        this.enemyCommandRangePrimitives.show = shouldShow;
      }
      return;
    }
    
    // ===================================================
    // 1. 初始化和重置primitive集合
    // ===================================================
    
    // 移除并重新创建所有primitive集合，确保没有历史数据干扰
    
    // 1.1 选中高亮层
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
    }
    this.interactGridPrimitives = new Cesium.PrimitiveCollection();
    this.hexPrimitiveMap = new Map();
    this.viewer.scene.primitives.add(this.interactGridPrimitives);
    
    // 1.2 友方指挥范围高亮层
    if (this.commandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.commandRangePrimitives);
    }
    this.commandRangePrimitives = new Cesium.PrimitiveCollection();
    this.commandRangeHexMap = new Map();
    this.viewer.scene.primitives.add(this.commandRangePrimitives);
    
    // 1.3 敌方指挥范围高亮层
    if (this.enemyCommandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.enemyCommandRangePrimitives);
    }
    this.enemyCommandRangePrimitives = new Cesium.PrimitiveCollection();
    this.enemyCommandRangeHexMap = new Map();
    this.viewer.scene.primitives.add(this.enemyCommandRangePrimitives);
    
    // ===================================================
    // 2. 处理选中高亮
    // ===================================================
    
    // 获取当前选中的六角格
    const selectedHexIds = this.store.getSelectedHexIds();
    
    // 2.1 直接使用selectedHexIds创建高亮Primitive，无需修改HexCell对象
    this._updateHexPrimitives(
      this.interactGridPrimitives,
      this.hexPrimitiveMap,
      selectedHexIds,
      (hexId) => {
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          return this._createHexPrimitive(
            hexCell,
            'interaction', 
            2.0,
            this.store.highlightStyle // 直接使用store中的highlightStyle
          );
        }
        return null;
      },
      'selected_hex' // 选中六角格前缀
    );
    
    // ===================================================
    // 3. 处理指挥范围高亮
    // ===================================================
    
    // 记录当前游戏模式，用于条件判断
    const currentGameMode = this.store.gameMode;
    
    // 3.1 在自由模式或环绕模式下启用部队指挥范围高亮
    if (currentGameMode === GameMode.FREE || currentGameMode === GameMode.ORBIT) {
      // 获取当前选中的部队
      const selectedForceIds = this.store.getSelectedForceIds();
      
      if (selectedForceIds.size > 0) {
        // 获取第一个选中的部队
        const firstForceId = Array.from(selectedForceIds)[0];
        const force = this.store.getForceById(firstForceId);
        
        if (force) {
          // 获取部队所在六角格
          const hexId = force.hexId;
          const hexCell = this.store.getHexCellById(hexId);
          
          if (hexCell) {
            // 获取部队的指挥范围
            const commandRange = force.commandRange;
            
            // 根据部队阵营选择高亮样式
            let rangeStyle = null;
            if (force.faction === 'blue') {
              rangeStyle = this.store.rangeStyle.blue;
            } else if (force.faction === 'red') {
              rangeStyle = this.store.rangeStyle.red;
            }
            
            // 获取指挥范围内的所有六角格
            const hexesInRange = hexCell.getHexCellInRange(commandRange);
            
            // 收集所有需要显示的指挥范围六角格ID
            // 转换hexesInRange数组为hexId的Set
            const rangeHexIdsToRender = new Set(hexesInRange.map(cell => cell.hexId));
            
            // 使用通用方法更新指挥范围高亮，明确传入rangeStyle
            this._updateHexPrimitives(
              this.commandRangePrimitives,
              this.commandRangeHexMap,
              rangeHexIdsToRender,
              (hexId) => {
                const hexCell = this.store.getHexCellById(hexId);
                if (hexCell && rangeStyle) {
                  return this._createHexPrimitive(
                    hexCell,
                    'interaction', 
                    1.5,
                    rangeStyle // 明确使用rangeStyle
                  );
                }
                return null;
              },
              'free_mode_range' // 自由模式范围前缀
            );
            console.log('[HexGridRenderer] 渲染指挥范围高亮，六角格数量:', rangeHexIdsToRender.size);
          }
        }
      } else {
        // 没有选中部队，清空指挥范围
        this.commandRangePrimitives.removeAll();
        this.commandRangeHexMap.clear();
      }
      
      // 在非攻击准备模式下，不需要渲染攻击准备模式下的敌方指挥范围
      this.enemyCommandRangePrimitives.removeAll();
      this.enemyCommandRangeHexMap.clear();
    }
    // 3.2 在攻击准备模式下，使用attackState中的指挥部队渲染指挥范围
    else if (currentGameMode === GameMode.ATTACK_PREPARE) {
      console.log('[HexGridRenderer] 正在攻击准备模式下渲染指挥范围高亮');
      
      // 获取攻击状态
      const attackState = this.store.attackState;
      
      // ==================================================
      // 处理友方指挥部队
      // ==================================================
      if (attackState.commandForceId) {
        const commandForce = this.store.getForceById(attackState.commandForceId);
        
        if (commandForce) {
          // 获取部队所在六角格
          const hexId = commandForce.hexId;
          const hexCell = this.store.getHexCellById(hexId);
          
          if (hexCell) {
            // 获取部队的指挥范围
            const commandRange = commandForce.commandRange;
            
            // 获取指挥范围内的所有六角格
            const hexesInRange = hexCell.getHexCellInRange(commandRange);
            
            // 阵营和样式
            const friendlyFaction = commandForce.faction;
            const friendlyRangeStyle = this.store.rangeStyle[friendlyFaction];
            const friendlyCommanderStyle = this.store.commanderStyle[friendlyFaction];
            
            // 收集需要显示的友方指挥范围六角格ID (不包括指挥部队所在六角格)
            const friendlyRangeHexIds = new Set();
            hexesInRange.forEach(rangeHexCell => {
              // 排除已选中高亮和指挥部队本身所在的六角格
              if (!selectedHexIds.has(rangeHexCell.hexId) && rangeHexCell.hexId !== hexId) {
                friendlyRangeHexIds.add(rangeHexCell.hexId);
              }
            });
            
            // 渲染友方指挥范围
            if (friendlyRangeHexIds.size > 0) {
              console.log('[HexGridRenderer] 渲染友方指挥范围，六角格数量:', friendlyRangeHexIds.size);
              console.log('[HexGridRenderer] 友方样式:', friendlyRangeStyle);
              
              // 强行使用敌方primitive集合来渲染友方指挥范围(该死的，只能这样了)
              this._updateHexPrimitives(
                this.enemyCommandRangePrimitives,
                this.enemyCommandRangeHexMap,
                friendlyRangeHexIds,
                (hexId) => {
                  const hexCell = this.store.getHexCellById(hexId);
                  if (hexCell) {
                    // 将友方样式的不透明度加大一点
                    const enhancedStyle = friendlyRangeStyle ? {
                      ...friendlyRangeStyle,
                      fillColor: new Cesium.Color(
                        friendlyRangeStyle.fillColor.red,
                        friendlyRangeStyle.fillColor.green,
                        friendlyRangeStyle.fillColor.blue,
                        0.2 // 强制提高不透明度
                      ),
                      showBorder: true
                    } : HexVisualStyles.selectedBlue;
                    
                    return this._createHexPrimitive(
                      hexCell,
                      'interaction', 
                      1.7, // 提高高度偏移
                      enhancedStyle
                    );
                  }
                  return null;
                },
                'friendly_range' // 友方指挥范围前缀
              );
              
              // 检查是否成功添加了primitive
              console.log('[HexGridRenderer] 友方指挥范围primitive数量(使用敌方集合):', this.enemyCommandRangePrimitives.length);
            } else {
              // 如果没有友方范围，清空现有的primitive
              this.commandRangePrimitives.removeAll();
              this.commandRangeHexMap.clear();
            }
            
            // 单独处理友方指挥部队所在的六角格，使用commanderStyle
            if (!selectedHexIds.has(hexId)) {
              const friendlyCommanderHexIds = new Set([hexId]);
              console.log('[HexGridRenderer] 渲染友方指挥部队高亮');
              
              // 友方指挥部队继续使用commandRangePrimitives
              this._updateHexPrimitives(
                this.commandRangePrimitives,
                this.commandRangeHexMap,
                friendlyCommanderHexIds,
                (hexId) => {
                  const hexCell = this.store.getHexCellById(hexId);
                  if (hexCell) {
                    const style = friendlyCommanderStyle || HexVisualStyles.commanderBlue;
                    console.log('[HexGridRenderer] 友方指挥部队样式:', style);
                    return this._createHexPrimitive(
                      hexCell,
                      'interaction', 
                      2.0, // 使其高于所有范围，确保可见
                      style // 使用指挥部队样式
                    );
                  }
                  return null;
                },
                'friendly_commander' // 友方指挥部队前缀
              );
            }
          }
        }
      } else {
        // 如果没有友方指挥部队，清空友方指挥范围
        this.commandRangePrimitives.removeAll();
        this.commandRangeHexMap.clear();
      }
      
      // ==================================================
      // 处理敌方指挥部队
      // ==================================================
      if (attackState.enemyCommandForceId) {
        const enemyCommandForce = this.store.getForceById(attackState.enemyCommandForceId);
        
        if (enemyCommandForce) {
          // 获取部队所在六角格
          const hexId = enemyCommandForce.hexId;
          const hexCell = this.store.getHexCellById(hexId);
          
          if (hexCell) {
            // 获取部队的指挥范围
            const commandRange = enemyCommandForce.commandRange;
            
            // 获取指挥范围内的所有六角格
            const hexesInRange = hexCell.getHexCellInRange(commandRange);
            
            // 敌方阵营和样式
            const enemyFaction = enemyCommandForce.faction;
            const enemyRangeStyle = this.store.rangeStyle[enemyFaction];
            const enemyCommanderStyle = this.store.commanderStyle[enemyFaction];
            
            // 收集需要显示的敌方指挥范围六角格ID (不包括指挥部队所在六角格)
            const enemyRangeHexIds = new Set();
            hexesInRange.forEach(rangeHexCell => {
              // 排除已选中高亮和敌方指挥部队本身所在的六角格
              if (!selectedHexIds.has(rangeHexCell.hexId) && rangeHexCell.hexId !== hexId) {
                enemyRangeHexIds.add(rangeHexCell.hexId);
              }
            });
            
            // 渲染敌方指挥范围
            if (enemyRangeHexIds.size > 0) {
              console.log('[HexGridRenderer] 渲染敌方指挥范围，六角格数量:', enemyRangeHexIds.size);
              
              // 由于我们用enemyCommandRangePrimitives渲染了友方范围，所以敌方范围需要用commandRangePrimitives
              this._updateHexPrimitives(
                this.commandRangePrimitives,
                this.commandRangeHexMap,
                enemyRangeHexIds,
                (hexId) => {
                  const hexCell = this.store.getHexCellById(hexId);
                  if (hexCell) {
                    return this._createHexPrimitive(
                      hexCell,
                      'interaction', 
                      1.3, // 稍低于友方范围，确保自然重叠
                      enemyRangeStyle || HexVisualStyles.selectedRed // 明确传入样式
                    );
                  }
                  return null;
                },
                'enemy_range' // 敌方指挥范围前缀
              );
            } else {
              // 如果没有敌方范围，清空现有的primitive
              this.enemyCommandRangePrimitives.removeAll();
              this.enemyCommandRangeHexMap.clear();
            }
            
            // 单独处理敌方指挥部队所在的六角格，使用enemyCommanderStyle
            if (!selectedHexIds.has(hexId)) {
              const enemyCommanderHexIds = new Set([hexId]);
              console.log('[HexGridRenderer] 渲染敌方指挥部队高亮');
              
              // 敌方指挥部队也使用commandRangePrimitives，但高度略低于友方
              this._updateHexPrimitives(
                this.commandRangePrimitives, // 改为与友方一致
                this.commandRangeHexMap,
                enemyCommanderHexIds,
                (hexId) => {
                  const hexCell = this.store.getHexCellById(hexId);
                  if (hexCell) {
                    const style = enemyCommanderStyle || HexVisualStyles.commanderRed;
                    console.log('[HexGridRenderer] 敌方指挥部队样式:', style);
                    return this._createHexPrimitive(
                      hexCell,
                      'interaction', 
                      1.9, // 略低于友方指挥部队，但高于范围
                      style // 使用指挥部队样式
                    );
                  }
                  return null;
                },
                'enemy_commander' // 敌方指挥部队前缀
              );
            }
          }
        }
      } else {
        // 如果没有敌方指挥部队，清空敌方指挥范围
        this.enemyCommandRangePrimitives.removeAll();
        this.enemyCommandRangeHexMap.clear();
      }
      
      // 不管敌方指挥部队是否存在，都需要单独确保友方指挥范围显示
      // 这部分代码移到了敌方处理之后，确保它独立运行
      if (attackState.commandForceId) {
        console.log('[HexGridRenderer] 强制单独渲染友方指挥范围...');
        const commandForce = this.store.getForceById(attackState.commandForceId);
        
        if (commandForce && commandForce.hexId) {
          const hexId = commandForce.hexId;
          const hexCell = this.store.getHexCellById(hexId);
          
          if (hexCell) {
            // 获取部队的指挥范围
            const commandRange = commandForce.commandRange;
            const hexesInRange = hexCell.getHexCellInRange(commandRange);
            
            // 阵营和样式
            const friendlyFaction = commandForce.faction;
            const friendlyRangeStyle = this.store.rangeStyle[friendlyFaction];
            
            // 收集需要显示的友方指挥范围六角格ID
            const forcedFriendlyRangeHexIds = new Set();
            hexesInRange.forEach(rangeHexCell => {
              // 不排除任何六角格，确保所有范围内六角格都显示
              forcedFriendlyRangeHexIds.add(rangeHexCell.hexId);
            });
            
            if (forcedFriendlyRangeHexIds.size > 0) {
              console.log('[HexGridRenderer] 强制渲染友方指挥范围，六角格数量:', forcedFriendlyRangeHexIds.size);
              
              // 尝试用互换后的集合渲染
              this._updateHexPrimitives(
                this.enemyCommandRangePrimitives,
                this.enemyCommandRangeHexMap, 
                forcedFriendlyRangeHexIds,
                (hexId) => {
                  const hexCell = this.store.getHexCellById(hexId);
                  if (hexCell) {
                    // 友方样式加强版
                    const style = friendlyRangeStyle ? {
                      ...friendlyRangeStyle,
                      fillColor: new Cesium.Color(
                        friendlyRangeStyle.fillColor.red,
                        friendlyRangeStyle.fillColor.green,
                        friendlyRangeStyle.fillColor.blue,
                        0.2 // 强制提高不透明度
                      ),
                      showBorder: true,
                      borderWidth: 2.0
                    } : HexVisualStyles.selectedBlue;
                    
                    // 创建独立的primitive
                    return this._createHexPrimitive(
                      hexCell,
                      'interaction', 
                      1.7,
                      style
                    );
                  }
                  return null;
                },
                'forced_friendly_range' // 使用独特的前缀
              );
            }
          }
        }
      }
    } else {
      // 在其他模式下，清空所有指挥范围
      this.commandRangePrimitives.removeAll();
      this.commandRangeHexMap.clear();
      this.enemyCommandRangePrimitives.removeAll();
      this.enemyCommandRangeHexMap.clear();
    }
  }
   
  /**
   * 为单个六角格创建primitive
   * @param {HexCell} hexCell 六角格单元
   * @param {string} styleType 样式类型
   * @param {number} heightOffset 高度偏移
   * @param {Object} [customStyle] 自定义样式，不提供则使用hexCell中的样式
   * @returns {Cesium.Primitive} 创建的primitive
   */
  _createHexPrimitive(hexCell, styleType, heightOffset, customStyle = null) {
    const visual = customStyle || hexCell.getTopVisualStyle(styleType);
    if (!visual) return null;
    
    const primCollection = new Cesium.PrimitiveCollection();
    
    if (visual.showFill) {
      // 使用HexHeightCache获取3D位置
      const positions = this.heightCache.getHex3DPositions(hexCell, false, heightOffset);
      if (positions.length === 0) return null; // 如果无法获取位置，跳过

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
      
      primCollection.add(new Cesium.Primitive({
        geometryInstances: fillInstance,
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
    
    if (visual.showBorder) {
      // 使用HexHeightCache获取边界线3D位置
      const positions = this.heightCache.getHex3DPositions(hexCell, true, heightOffset);
      if (positions.length === 0) return null; // 如果无法获取位置，跳过
      
      // 闭合轮廓
      positions.push(positions[0]);
      
      // 边框属性
      const borderColor = visual.borderColor || Cesium.Color.RED.withAlpha(0.1);
      const borderWidth = visual.borderWidth || 2.0;
      const borderPattern = visual.borderPattern || false;
      
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
        geometryInstances: borderInstance,
        appearance: appearance,
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true
      }));
    }
    
    return primCollection;
  }

  /**
   * 通用渲染挤压多边形图层
   * @param {Array<HexCell>} hexCells 六角格单元数组
   * @param {Cesium.PrimitiveCollection} primCollection 要添加到的primitive集合
   * @param {Object} options 渲染选项
   * @param {number} [options.layerIdx] 图层索引，用于基础图层选择样式
   * @param {string} options.styleType 样式类型，如'base', 'mark', 'interaction'
   * @param {number} [options.heightOffset=0] 高度偏移，用于层叠效果
   * @private
   */
  _renderExtrudedLayer(hexCells, primCollection, options = {}) {
    const {
      layerIdx,
      styleType = 'base',
      heightOffset = 0
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
        const borderWidth = visual.borderWidth || 2.0;
        const borderPattern = visual.borderPattern || false;
        
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
      // 将边框按照样式分组
      const dashedBorders = [];
      const solidBorders = [];
      
      borderInstances.forEach(instance => {
        // 获取对应的六角格ID
        const hexId = instance.id.replace("_border", "");
        const hexCell = hexCells.find(cell => cell.hexId === hexId);
        if (!hexCell) return;
        
        // 获取样式
        let visual;
        if (styleType === 'base' && layerIdx !== undefined) {
          visual = layerIdx === 1
            ? HexVisualStyles.default
            : hexCell.getTopVisualStyle('base') || HexVisualStyles.default;
        } else {
          visual = hexCell.getTopVisualStyle(styleType);
        }
        
        if (!visual) return;
        
        // 根据样式决定是实线还是虚线
        if (visual.borderPattern) {
          dashedBorders.push(instance);
        } else {
          solidBorders.push(instance);
        }
      });
      
      // 添加实线边框
      if (solidBorders.length > 0) {
        primCollection.add(new Cesium.Primitive({
          geometryInstances: solidBorders,
          appearance: new Cesium.PolylineColorAppearance(),
          asynchronous: true,
          allowPicking: false,
          releaseGeometryInstances: true
        }));
      }
      
      // 添加虚线边框
      if (dashedBorders.length > 0) {
        primCollection.add(new Cesium.Primitive({
          geometryInstances: dashedBorders,
          appearance: new Cesium.PolylineMaterialAppearance({
          material: Cesium.Material.fromType('PolylineDash', {
            color: Cesium.Color.WHITE,
            dashLength: 16.0,
            dashPattern: 255 // 0b11111111
          })
          }),
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true
      }));
      }
    }
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
    // 回收所有primitives资源
    if (this.baseGridPrimitives) {
      this.viewer.scene.primitives.remove(this.baseGridPrimitives);
      this.baseGridPrimitives = null;
    }
    if (this.markGridPrimitives) {
      this.viewer.scene.primitives.remove(this.markGridPrimitives);
      this.markGridPrimitives = null;
    }
    if (this.interactGridPrimitives) {
      this.viewer.scene.primitives.remove(this.interactGridPrimitives);
      this.interactGridPrimitives = null;
    }
    if (this.commandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.commandRangePrimitives);
      this.commandRangePrimitives = null; 
    }
    if (this.enemyCommandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.enemyCommandRangePrimitives);
      this.enemyCommandRangePrimitives = null;
    }

    // 清空缓存
    this._clearModuleLevelCache();
    
    // 解除引用关系
    this.viewer = null;
    this.store = null;
    this.layerIndex = null;

    // 重置单例
    HexGridRenderer.#instance = null;
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