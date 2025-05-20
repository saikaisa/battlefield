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
    /* 全量渲染图层 */
    this.markGridPrimitives = null; // 标记层
    this.friendlyCommandRangePrimitives = null; // 攻击准备模式下友方指挥范围高亮层
    this.enemyCommandRangePrimitives = null; // 攻击准备模式下敌方指挥范围高亮层

    /* 增量渲染图层 */
    this.highlightPrimitives = null; // 交互层集合(选中高亮)
    this.immCommandRangePrimitives = null; // 自由模式下指挥范围高亮层
    this.friendlyCommanderPrimitives = null; // 攻击准备模式下友方指挥部队高亮层
    this.enemyCommanderPrimitives = null; // 攻击准备模式下敌方指挥部队高亮层
    this.friendlySupportPrimitives = null; // 攻击准备模式下友方支援部队高亮层
    this.enemySupportPrimitives = null; // 攻击准备模式下敌方支援部队高亮层
    
    this.highlightPrimitivesMap = new Map(); // 存储高亮六角格ID到Primitive的映射
    this.immCommandRangePrimitiveMap = new Map(); // 存储自由模式下指挥范围六角格ID到Primitive的映射
    this.friendlyCommanderPrimitiveMap = new Map(); // 存储攻击准备模式下的友方指挥部队六角格ID到Primitive的映射
    this.enemyCommanderPrimitiveMap = new Map(); // 存储攻击准备模式下的敌方指挥部队六角格ID到Primitive的映射
    this.friendlySupportPrimitiveMap = new Map(); // 存储攻击准备模式下的友方支援部队六角格ID到Primitive的映射
    this.enemySupportPrimitiveMap = new Map(); // 存储攻击准备模式下的敌方支援部队六角格ID到Primitive的映射
    
    // 用于跟踪上一次渲染的敌方指挥部队ID，避免频繁重新渲染
    this._lastEnemyCommandForceId = null;
    
    // 监听选中状态、样式的变化，更新交互层渲染
    watch(
      [
        () => this.store.getSelectedHexIds(),
        () => this.store.getSelectedForceIds(),
        () => this.store.highlightStyle,
        () => this.store.rangeStyle,
        () => this.store.attackState,
      ],
      () => {
        // 直接触发交互层渲染
        this.renderInteractGrid(false);
      },
      { deep: true }
    );

    // 监听游戏模式的变化，更新高亮样式
    watch(
      () => this.store.gameMode,
      () => {
        // 切换高亮样式
        if (this.store.gameMode === GameMode.ATTACK_PREPARE) {
          this.store.setHighlightStyle(HexVisualStyles.selectedBorder);
        } else if (this.store.gameMode === GameMode.MOVE_EXECUTE) {
          this.store.setHighlightStyle(HexVisualStyles.selectedGreen);
        } else {
          this.store.setHighlightStyle(HexVisualStyles.selected);
        }
        this.renderMarkGrid(false);
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
   * 只在layerIndex=1且非攻击模式时渲染
   */
  renderMarkGrid(indexChange = false) {
    const isAttackMode = this.store.gameMode === GameMode.ATTACK_EXECUTE;

    if (this.markGridPrimitives) {
      // 如果是通过切换图层调用的该方法，则只进行显隐控制
      if (indexChange) {
        this.markGridPrimitives.show = (this.layerIndex.value === 1 && !isAttackMode);
        return;
      }
      
      this.viewer.scene.primitives.remove(this.markGridPrimitives);
      this.markGridPrimitives = null;
    }

    if (isAttackMode) {
      return;
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
   * @param {boolean} [forceUpdate=false] 是否强制更新所有格子，包括已存在于primMap中的
   * @private
   */
  _updateHexPrimitives(primCollection, primMap, hexIdsToRender, createPrimitiveFn, forceUpdate = false) {
    // 1. 计算需要移除的格子
    const hexIdsToRemove = [];
    for (const mapKey of primMap.keys()) {
      const [hexId] = mapKey.split('|');
      if (!hexIdsToRender.has(hexId)) {
        hexIdsToRemove.push(mapKey);
      }
    }
    
    // 2. 计算需要处理的格子
    const hexIdsToProcess = [];
    for (const hexId of hexIdsToRender) {
      // 获取六角格当前的样式
      const hexCell = this.store.getHexCellById(hexId);
      if (!hexCell) continue;
      
      // 获取样式的哈希值
      const styleHash = this._getStyleHash(hexId);
      const mapKey = `${hexId}|${styleHash}`;
      
      // 如果是强制更新模式，或者格子不在primMap中，或者样式已变化，则需要处理
      if (forceUpdate || !primMap.has(mapKey)) {
        hexIdsToProcess.push({hexId, mapKey});
      }
    }
    
    // 3. 移除不再需要的primitive
    for (const mapKey of hexIdsToRemove) {
      const primitive = primMap.get(mapKey);
      if (primitive) {
        primCollection.remove(primitive);
        primMap.delete(mapKey);
      }
    }
    
    // 4. 添加或更新primitive
    for (const {hexId, mapKey} of hexIdsToProcess) {
      // 查找并移除所有与该hexId相关的旧primitive
      for (const [oldKey, oldPrimitive] of primMap.entries()) {
        if (oldKey.startsWith(hexId + '|')) {
          primCollection.remove(oldPrimitive);
          primMap.delete(oldKey);
        }
      }
      
      // 添加新的
      const primitive = createPrimitiveFn(hexId);
      if (primitive) {
        primCollection.add(primitive);
        primMap.set(mapKey, primitive);
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
      if (this.highlightPrimitives) {
        this.highlightPrimitives.show = shouldShow;
      }
      if (this.immCommandRangePrimitives) {
        this.immCommandRangePrimitives.show = shouldShow;
      }
      if (this.friendlyCommandRangePrimitives) {
        this.friendlyCommandRangePrimitives.show = shouldShow;
      }
      if (this.enemyCommandRangePrimitives) {
        this.enemyCommandRangePrimitives.show = shouldShow;
      }
      if (this.friendlyCommanderPrimitives) {
        this.friendlyCommanderPrimitives.show = shouldShow;
      }
      if (this.enemyCommanderPrimitives) {
        this.enemyCommanderPrimitives.show = shouldShow;
      }
      if (this.friendlySupportPrimitives) {
        this.friendlySupportPrimitives.show = shouldShow;
      }
      if (this.enemySupportPrimitives) {
        this.enemySupportPrimitives.show = shouldShow;
      }
      return;
    }
    
    // ===================================================
    // 1. 初始化primitive集合，如果不存在则创建
    // ===================================================
    if (!this.highlightPrimitives) {
      this.highlightPrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.highlightPrimitives);
    }
    
    if (!this.immCommandRangePrimitives) {
      this.immCommandRangePrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.immCommandRangePrimitives);
    }

    if (!this.friendlyCommanderPrimitives) {
      this.friendlyCommanderPrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.friendlyCommanderPrimitives);
    }

    if (!this.enemyCommanderPrimitives) {
      this.enemyCommanderPrimitives = new Cesium.PrimitiveCollection(); 
      this.viewer.scene.primitives.add(this.enemyCommanderPrimitives);
    }

    if (!this.friendlySupportPrimitives) {
      this.friendlySupportPrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.friendlySupportPrimitives);
    }

    if (!this.enemySupportPrimitives) {
      this.enemySupportPrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.enemySupportPrimitives);
    }
    
    if (!this.friendlyCommandRangePrimitives) {
      this.friendlyCommandRangePrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.friendlyCommandRangePrimitives);
    }
    
    if (!this.enemyCommandRangePrimitives) {
      this.enemyCommandRangePrimitives = new Cesium.PrimitiveCollection();
      this.viewer.scene.primitives.add(this.enemyCommandRangePrimitives);
    }
    
    // ===================================================
    // 2. 处理选中高亮
    // ===================================================
    
    // 获取当前选中的六角格
    const selectedHexIds = this.store.getSelectedHexIds();
    
    // 2.1 直接使用selectedHexIds创建高亮Primitive，无需修改HexCell对象
    this._updateHexPrimitives(
      this.highlightPrimitives,
      this.highlightPrimitivesMap,
      selectedHexIds,
      (hexId) => {
        const hexCell = this.store.getHexCellById(hexId);
        if (hexCell) {
          return this._createHexPrimitive(
            hexCell,
            'interaction', 
            5.0,
            this.store.highlightStyle,
          );
        }
        return null;
      }
    );
    
    // ===================================================
    // 3. 处理指挥范围高亮
    // ===================================================
    
    // 记录当前游戏模式，用于条件判断
    const currentGameMode = this.store.gameMode;
    
    // 在自由模式或环绕模式下启用部队指挥范围高亮
    if (currentGameMode === GameMode.FREE || currentGameMode === GameMode.ORBIT) {
      // 清空攻击准备模式下的图层
      this.friendlyCommanderPrimitives.removeAll();
      this.enemyCommanderPrimitives.removeAll();
      this.friendlySupportPrimitives.removeAll();
      this.enemySupportPrimitives.removeAll();
      this.friendlyCommandRangePrimitives.removeAll();
      this.enemyCommandRangePrimitives.removeAll();
      this.friendlyCommanderPrimitiveMap.clear();
      this.enemyCommanderPrimitiveMap.clear();
      this.friendlySupportPrimitiveMap.clear();
      this.enemySupportPrimitiveMap.clear();
      
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
            const rangeHexIdsToRender = new Set();
            for (const rangeHexCell of hexesInRange) {
              // 排除选中高亮的六角格和指挥部队所在的六角格
              if (!selectedHexIds.has(rangeHexCell.hexId) && rangeHexCell.hexId !== hexCell.hexId) {
                rangeHexIdsToRender.add(rangeHexCell.hexId);
              }
            }
            
            // 使用_updateHexPrimitives进行增量更新，而不是完全重建
            this._updateHexPrimitives(
              this.immCommandRangePrimitives,
              this.immCommandRangePrimitiveMap,
              rangeHexIdsToRender,
              (hexId) => {
                const rangeHexCell = this.store.getHexCellById(hexId);
                if (rangeHexCell) {
                  return this._createHexPrimitive(
                    rangeHexCell,
                    'interaction', 
                    1.5,
                    rangeStyle
                  );
                }
                return null;
              }
            );
          }
        }
      } else {
        // 没有选中部队，清空指挥范围
        this.immCommandRangePrimitives.removeAll();
        this.immCommandRangePrimitiveMap.clear();
      }
    }

    // 在攻击准备和执行模式下，使用attackState中的指挥部队渲染指挥范围
    else if (currentGameMode === GameMode.ATTACK_PREPARE || currentGameMode === GameMode.ATTACK_EXECUTE) {
      
      // 清空自由模式下的指挥范围
      this.immCommandRangePrimitives.removeAll();
      this.immCommandRangePrimitiveMap.clear();
      
      // 获取攻击状态
      const attackState = this.store.attackState;

      // 获取敌我指挥部队和支援部队所在的六角格
      const commandForce = this.store.getForceById(attackState.commandForceId);
      const commandForceHex = commandForce && this.store.getHexCellById(commandForce.hexId);
      
      const enemyCommandForce = this.store.getForceById(attackState.enemyCommandForceId);
      const enemyCommandForceHex = enemyCommandForce && this.store.getHexCellById(enemyCommandForce.hexId);
      
      const supportForceHexes = [];
      for (const forceId of attackState.supportForceIds) {
        const force = this.store.getForceById(forceId);
        if (force) {
          const hexCell = this.store.getHexCellById(force.hexId);
          if (hexCell) supportForceHexes.push(hexCell);
        }
      }
      
      const enemySupportForceHexes = [];
      for (const forceId of attackState.enemySupportForceIds) {
        const force = this.store.getForceById(forceId);
        if (force) {
          const hexCell = this.store.getHexCellById(force.hexId);
          if (hexCell) enemySupportForceHexes.push(hexCell);
        }
      }
      
      // 处理指挥部队高亮
      if (commandForceHex && attackState.phase) {
        // 使用增量更新指挥部队高亮
        this._updateHexPrimitives(
          this.friendlyCommanderPrimitives,
          this.friendlyCommanderPrimitiveMap,
          new Set([commandForceHex.hexId]),
          (hexId) => {
            const hexCell = this.store.getHexCellById(hexId);
            if (hexCell) {
              const faction = commandForce.faction;
              const style = this.store.commanderStyle[faction] || HexVisualStyles.commanderBlue;
              return this._createHexPrimitive(
                hexCell,
                'interaction',
                2.5, // 最高层
                style,
                attackState.phase === 'attacking' ? false : null // 攻击阶段不使用虚线边框而是实线
              );
            }
            return null;
          }
        );
      } else {
        this.friendlyCommanderPrimitives.removeAll();
        this.friendlyCommanderPrimitiveMap.clear();
      }
      
      // 处理敌方指挥部队高亮
      if (enemyCommandForceHex && attackState.phase) {
        // 使用增量更新敌方指挥部队高亮
        this._updateHexPrimitives(
          this.enemyCommanderPrimitives,
          this.enemyCommanderPrimitiveMap,
          new Set([enemyCommandForceHex.hexId]),
          (hexId) => {
            const hexCell = this.store.getHexCellById(hexId);
            if (hexCell) {
              const faction = enemyCommandForce.faction;
              const style = this.store.commanderStyle[faction] || HexVisualStyles.commanderRed;
              return this._createHexPrimitive(
                hexCell,
                'interaction',
                2.3, // 稍低于友方指挥部队
                style,
                attackState.phase === 'attacking' ? false : null
              );
            }
            return null;
          }
        );
      } else {
        this.enemyCommanderPrimitives.removeAll();
        this.enemyCommanderPrimitiveMap.clear();
      }
      
      // 处理支援部队高亮
      if (supportForceHexes.length > 0) {
        const hexIds = new Set(supportForceHexes.map(hex => hex.hexId));
        this._updateHexPrimitives(
          this.friendlySupportPrimitives,
          this.friendlySupportPrimitiveMap,
          hexIds,
          (hexId) => {
            const hexCell = this.store.getHexCellById(hexId);
            if (hexCell) {
              const faction = commandForce ? commandForce.faction : 'blue';
              const style = this.store.supportStyle[faction] || HexVisualStyles.supportBlue;
              return this._createHexPrimitive(
                hexCell,
                'interaction',
                2.0,
                style,
                attackState.phase === 'attacking' ? false : null
              );
            }
            return null;
          }
        );
      } else {
        this.friendlySupportPrimitives.removeAll();
        this.friendlySupportPrimitiveMap.clear();
      }
      
      // 处理敌方支援部队高亮
      if (enemySupportForceHexes.length > 0) {
        const hexIds = new Set(enemySupportForceHexes.map(hex => hex.hexId));
        this._updateHexPrimitives(
          this.enemySupportPrimitives,
          this.enemySupportPrimitiveMap,
          hexIds,
          (hexId) => {
            const hexCell = this.store.getHexCellById(hexId);
            if (hexCell) {
              const faction = enemyCommandForce ? enemyCommandForce.faction : 'red';
              const style = this.store.supportStyle[faction] || HexVisualStyles.supportRed;
              return this._createHexPrimitive(
                hexCell,
                'interaction',
                1.8,
                style,
                attackState.phase === 'attacking' ? false : null
              );
            }
            return null;
          }
        );
      } else {
        this.enemySupportPrimitives.removeAll();
        this.enemySupportPrimitiveMap.clear();
      }
      
      // 刚进入selectTarget阶段或攻击执行模式时，画出指挥部队的指挥范围
      if (attackState.commandForceId && 
           (this.friendlyCommandRangePrimitives.length === 0 || 
            attackState.phase === 'attacking')) {
        // 获取部队的指挥范围
        const commandRange = commandForce.commandRange;
        
        // 获取指挥范围内的所有六角格
        const hexesInRange = commandForceHex.getHexCellInRange(commandRange);
        
        // 阵营和样式
        const friendlyFaction = commandForce.faction;
        const friendlyRangeStyle = this.store.rangeStyle[friendlyFaction];
        
        // 收集需要显示的友方指挥范围六角格ID (不包括指挥部队所在六角格)
        const friendlyRangeHexIds = new Set();
        hexesInRange.forEach(rangeHexCell => {
          // 排除已选中高亮和指挥部队本身所在的六角格
          if (rangeHexCell.hexId !== commandForceHex.hexId &&
              !supportForceHexes.some(hex => hex.hexId === rangeHexCell.hexId)) {
            friendlyRangeHexIds.add(rangeHexCell.hexId);
          }
        });
        
        // 渲染友方指挥范围
        if (friendlyRangeHexIds.size > 0) {          
          // 完全重建友方指挥范围，不使用增量更新
          this.friendlyCommandRangePrimitives.removeAll();
          
          // 直接创建并添加所有指挥范围内的六角格primitive
          for (const hexId of friendlyRangeHexIds) {
            const hexCell = this.store.getHexCellById(hexId);
            if (hexCell) {
              const primitive = this._createHexPrimitive(
                hexCell,
                'interaction', 
                1.5,
                friendlyRangeStyle || HexVisualStyles.selectedBlue,
                attackState.phase === 'attacking' ? false : null
              );
              
              if (primitive) {
                this.friendlyCommandRangePrimitives.add(primitive);
              }
            }
          }
        }
      } else if (!attackState.commandForceId || attackState.phase === null) {
        // 只有在指挥部队不存在或退出攻击模式时才清除
        this.friendlyCommandRangePrimitives.removeAll();
      }
      
      // 在selectTarget阶段，实时更新敌方指挥范围；在selectSupport阶段，保持不变
      if (!attackState.enemyCommandForceId || !attackState.phase) {
        this.enemyCommandRangePrimitives.removeAll();
      } else if (attackState.phase === 'selectTarget' || attackState.phase === 'attacking') {
        const enemyRangeHexIds = new Set();
        
        // 只有当选中不同敌方部队或首次渲染时才重新计算
        if (this.enemyCommandRangePrimitives.length === 0 || this._lastEnemyCommandForceId !== attackState.enemyCommandForceId) {
          this._lastEnemyCommandForceId = attackState.enemyCommandForceId;
          
          // 获取部队的指挥范围
          const commandRange = enemyCommandForce.commandRange;
          
          // 获取指挥范围内的所有六角格
          const hexesInRange = enemyCommandForceHex.getHexCellInRange(commandRange);
          
          // 敌方阵营和样式
          const enemyFaction = enemyCommandForce.faction;
          const enemyRangeStyle = this.store.rangeStyle[enemyFaction];
          
          // 收集需要显示的敌方指挥范围六角格ID (不包括指挥部队所在六角格)
          hexesInRange.forEach(rangeHexCell => {
            // 排除指挥部队本身所在的六角格和支援部队
            if (rangeHexCell.hexId !== enemyCommandForceHex.hexId &&
                !enemySupportForceHexes.some(hex => hex.hexId === rangeHexCell.hexId)) {
              enemyRangeHexIds.add(rangeHexCell.hexId);
            }
          });
          
          // 渲染敌方指挥范围
          if (enemyRangeHexIds.size > 0) {            
            // 完全重建敌方指挥范围，不使用增量更新
            this.enemyCommandRangePrimitives.removeAll();
            
            // 直接创建并添加所有指挥范围内的六角格primitive
            for (const hexId of enemyRangeHexIds) {
              const hexCell = this.store.getHexCellById(hexId);
              if (hexCell) {
                const primitive = this._createHexPrimitive(
                  hexCell,
                  'interaction', 
                  1.3,
                  enemyRangeStyle || HexVisualStyles.selectedRed,
                  attackState.phase === 'attacking' ? false : null
                );
                
                if (primitive) {
                  this.enemyCommandRangePrimitives.add(primitive);
                }
              }
            }
          }
        }
      }
    } else {
      // 在其他模式下，清空所有指挥和范围
      this.immCommandRangePrimitives.removeAll();
      this.immCommandRangePrimitiveMap.clear();
      this.friendlyCommandRangePrimitives.removeAll();
      this.enemyCommandRangePrimitives.removeAll();
      this.friendlyCommanderPrimitives.removeAll();
      this.enemyCommanderPrimitives.removeAll();
      this.friendlySupportPrimitives.removeAll();
      this.enemySupportPrimitives.removeAll();
      this.friendlyCommanderPrimitiveMap.clear();
      this.enemyCommanderPrimitiveMap.clear();
      this.friendlySupportPrimitiveMap.clear();
      this.enemySupportPrimitiveMap.clear();
      this._lastEnemyCommandForceId = null; // 重置上次渲染的敌方指挥部队ID
    }
  }
   
  /**
   * 为单个六角格创建primitive
   * @param {HexCell} hexCell 六角格单元
   * @param {string} styleType 样式类型
   * @param {number} heightOffset 高度偏移
   * @param {Object} [customStyle] 自定义样式，不提供则使用hexCell中的样式
   * @param {boolean} [customBorderPattern] 是否使用虚线边框，若不传入则使用样式自带定义
   * @returns {Cesium.Primitive} 创建的primitive
   */
  _createHexPrimitive(hexCell, styleType, heightOffset, customStyle = null, customBorderPattern = null) {
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
        releaseGeometryInstances: true,
        // shadows: Cesium.ShadowMode.RECEIVE_ONLY
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
      const borderPattern = customBorderPattern ?? visual.borderPattern ?? false;
      
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
            color: borderColor,
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
        releaseGeometryInstances: true,
        shadows: Cesium.ShadowMode.RECEIVE_ONLY
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
   * 获取六角格样式的哈希值
   * @param {string} hexId 六角格ID
   * @returns {string} 样式的哈希值
   * @private
   */
  _getStyleHash(hexId) {
    const hexCell = this.store.getHexCellById(hexId);
    if (!hexCell) return 'none';
    
    // 获取六角格当前的样式信息
    let styleHash = '';
    
    // 基于当前六角格的可视样式生成哈希
    if (hexCell.visibility && hexCell.visibility.visualStyles) {
      // 获取interaction层和base层的样式
      const interactionStyle = hexCell.getTopVisualStyle('interaction');
      const baseStyle = hexCell.getTopVisualStyle('base');
      const markStyle = hexCell.getTopVisualStyle('mark');
      
      // 添加各层样式的哈希信息
      if (interactionStyle) {
        styleHash += `int:${interactionStyle.type}:${interactionStyle.priority}:`;
        if (interactionStyle.fillColor) {
          styleHash += `${interactionStyle.fillColor.toString()}:`;
        }
        if (interactionStyle.borderColor) {
          styleHash += `${interactionStyle.borderColor.toString()}:`;
        }
        styleHash += `${interactionStyle.showFill}:${interactionStyle.showBorder}:${interactionStyle.borderPattern}:${interactionStyle.borderWidth}|`;
      }
      
      if (baseStyle) {
        styleHash += `base:${baseStyle.type}:`;
      }
      
      if (markStyle) {
        styleHash += `mark:${markStyle.type}:`;
      }
    }
    
    // 添加游戏模式相关的样式信息
    styleHash += `mode:${this.store.gameMode}:`;
    
    // 添加全局样式信息
    styleHash += `highlight:${JSON.stringify(this.store.highlightStyle)}:`;
    
    // 基于不同游戏模式添加特定样式信息
    if (this.store.gameMode === GameMode.ATTACK_PREPARE) {
      // 攻击模式特定状态
      const attackState = this.store.attackState;
      
      // 检查该六角格是否是指挥部队或支援部队
      const isCommandForce = attackState.commandForceId && 
                            this.store.getForceById(attackState.commandForceId)?.hexId === hexId;
      const isEnemyCommandForce = attackState.enemyCommandForceId && 
                                 this.store.getForceById(attackState.enemyCommandForceId)?.hexId === hexId;
      
      // 检查是否在支援部队列表中
      const isSupportForce = attackState.supportForceIds.some(id => 
        this.store.getForceById(id)?.hexId === hexId);
      const isEnemySupportForce = attackState.enemySupportForceIds.some(id => 
        this.store.getForceById(id)?.hexId === hexId);
      
      // 添加状态信息到哈希
      styleHash += `attack:${attackState.phase}:${isCommandForce}:${isEnemyCommandForce}:${isSupportForce}:${isEnemySupportForce}:`;
    } else {
      // 其他模式下，如果有选中的部队，检查其指挥范围
      const selectedForceIds = this.store.getSelectedForceIds();
      if (selectedForceIds.size > 0) {
        const firstForceId = Array.from(selectedForceIds)[0];
        const force = this.store.getForceById(firstForceId);
        
        if (force && force.hexId) {
          // 检查该六角格是否在选中部队的指挥范围内
          const commandCell = this.store.getHexCellById(force.hexId);
          if (commandCell) {
            const inRange = commandCell.getHexCellInRange(force.commandRange)
                            .some(cell => cell.hexId === hexId);
            styleHash += `selected:${firstForceId}:inRange:${inRange}:`;
          }
        }
      }
    }
    
    // 最后添加选中状态
    const isSelected = this.store.getSelectedHexIds().has(hexId);
    styleHash += `selected:${isSelected}`;
    
    return styleHash;
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
    if (this.highlightPrimitives) {
      this.viewer.scene.primitives.remove(this.highlightPrimitives);
      this.highlightPrimitives = null;
    }
    if (this.immCommandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.immCommandRangePrimitives);
      this.immCommandRangePrimitives = null; 
    }
    if (this.friendlyCommandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.friendlyCommandRangePrimitives);
      this.friendlyCommandRangePrimitives = null; 
    }
    if (this.enemyCommandRangePrimitives) {
      this.viewer.scene.primitives.remove(this.enemyCommandRangePrimitives);
      this.enemyCommandRangePrimitives = null;
    }

    // 清空缓存
    this._clearModuleLevelCache();
    this.highlightPrimitivesMap.clear();
    this.immCommandRangePrimitiveMap.clear();
    this._lastEnemyCommandForceId = null;
    
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
      allowPicking: true,
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