<!-- src\App.vue -->
<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染面板 -->
    <div v-if="gameReady">
      <OverviewPanel /> <!-- 概览面板 -->
      <!-- <DetailInfoPanel /> 详情信息面板 -->
      <FormationPanel /> <!-- 编队列表 -->
      <!-- <CommandPanel /> 命令管理面板 -->
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';
import { CommandDispatcher } from '@/layers/interaction-layer/CommandDispatcher';
import OverviewPanel from '@/components/hud/OverviewPanel.vue';
// import DetailInfoPanel from '@/components/hud/DetailInfoPanel.vue';
import FormationPanel from '@/components/hud/FormationPanel.vue';
// import CommandPanel from '@/components/hud/CommandPanel.vue';

// viewer 引用
const viewerRef = ref(null);

// 控制 UI 是否可加载
const gameReady = ref(false);

let sceneManager;
let militaryManager;
let commandDispatcher;

onMounted(async () => {
  // 初始化场景管理器
  sceneManager = SceneManager.getInstance('cesiumContainer');
  viewerRef.value = await sceneManager.init();

  // 初始化军事单位管理器
  militaryManager = MilitaryManager.getInstance(viewerRef.value);
  await militaryManager.init();

  // 初始化命令分发器
  commandDispatcher = CommandDispatcher.getInstance(viewerRef.value);
  commandDispatcher.init(); // 初始化命令处理器和游戏模式管理器

  // 初始化完成
  gameReady.value = true;

  // 初始化调试信息
  startDebug();
});

onBeforeUnmount(() => {
  // sceneManager?.destroy();
  militaryManager?.destroy();
  commandDispatcher?.destroy();
});

onUnmounted(() => {
  if (viewerRef.value) {
    viewerRef.value.destroy();
    viewerRef.value = null;
  }
});

// 创建一些测试用例
function startDebug() {
  // 导入需要的模块
  const { CommandType } = require('@/config/CommandConfig');
  const { openGameStore } = require('@/store');
  const store = openGameStore();
  
  console.log('[Debug] 开始创建测试用例...');
  
  // 创建两个测试兵种
  const infantry = {
    unitId: null,  // 自动生成ID
    unitName: '普通步兵',
    service: ['land'],
    category: '步兵',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 20,
      domainFactor: { land: 1.0, sea: 0.2, air: 0.5 },
      terrainFactor: { plain: 1.0, hill: 0.8, mountain: 0.6, water: 0.1 }
    },
    defensePowerComposition: {
      baseDefensePower: 15,
      domainFactor: { land: 1.0, sea: 0.2, air: 0.3 },
      terrainFactor: { plain: 1.0, hill: 1.2, mountain: 1.5, water: 0.1 }
    },
    visibilityRadius: 2,
    actionPointCostComposition: {
      baseActionPointCost: 10,
      terrainFactor: { plain: 1.0, hill: 1.5, mountain: 2.0, water: 5.0 }
    },
    recoveryRate: 10,
    commandCapability: 1.2,
    commandRange: 1,
    renderingKey: "soldier"
  };
  
  const tank = {
    unitId: null,
    unitName: '坦克',
    service: ['land'],
    category: '装甲',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 40,
      domainFactor: { land: 1.0, sea: 0.1, air: 0.7 },
      terrainFactor: { plain: 1.0, hill: 0.8, mountain: 0.4, water: 0 }
    },
    defensePowerComposition: {
      baseDefensePower: 30,
      domainFactor: { land: 1.0, sea: 0.1, air: 0.5 },
      terrainFactor: { plain: 1.0, hill: 0.9, mountain: 0.7, water: 0 }
    },
    visibilityRadius: 3,
    actionPointCostComposition: {
      baseActionPointCost: 15,
      terrainFactor: { plain: 1.0, hill: 1.8, mountain: 3.0, water: 10.0 }
    },
    recoveryRate: 5,
    commandCapability: 1.5,
    commandRange: 3,
    renderingKey: "missiletank"
  };
  
  // 查找六角格网中心位置
  const hexCells = store.getHexCells();
  if (hexCells.length === 0) {
    console.error('[Debug] 没有找到六角格');
    return;
  }
  
  // 计算六角格网的中心（大致计算，找出行列中间的六角格）
  const rows = new Set();
  const cols = new Set();
  hexCells.forEach(cell => {
    const { row, col } = cell.getRowCol();
    rows.add(row);
    cols.add(col);
  });
  
  const rowArray = Array.from(rows).sort((a, b) => a - b);
  const colArray = Array.from(cols).sort((a, b) => a - b);
  
  const centerRow = rowArray[Math.floor(rowArray.length / 2)];
  const centerCol = colArray[Math.floor(colArray.length / 2)];
  
  // 查找中心六角格和邻近六角格
  const centerHexId = `H_${centerRow}_${centerCol}`;
  const centerHex = store.getHexCellById(centerHexId);
  
  if (!centerHex) {
    console.error(`[Debug] 没有找到中心六角格 ${centerHexId}`);
    return;
  }

  console.log(`[Debug] 找到中心六角格: ${centerHexId}`);
  
  // 查找相邻六角格
  let neighborHex = null;
  const { row, col } = centerHex.getRowCol();
  
  // 根据行号奇偶尝试获取相邻六角格
  const offsets = row % 2 === 0 
    ? [[-1,-1], [-1,0], [0,-1], [0,1], [1,-1], [1,0]] // 偶数行
    : [[-1,0], [-1,1], [0,-1], [0,1], [1,0], [1,1]];  // 奇数行
  
  for (const [rowOffset, colOffset] of offsets) {
    const neighborRow = row + rowOffset;
    const neighborCol = col + colOffset;
    const neighborId = `H_${neighborRow}_${neighborCol}`;
    const hex = store.getHexCellById(neighborId);
    
    if (hex) {
      neighborHex = hex;
      console.log(`[Debug] 找到邻近六角格: ${neighborId}`);
      break;
    }
  }
  
  if (!neighborHex) {
    console.error('[Debug] 没有找到邻近六角格');
    return;
  }
  
  // 依次创建两个兵种
  createUnitAndForces();
  
  // 异步创建兵种和部队（确保按顺序执行）
  async function createUnitAndForces() {
    try {
      // 1. 创建步兵兵种
      console.log('[Debug] 开始创建步兵兵种...');
      const infantryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: infantry });
      const infantryId = infantryResult.result.data.unitId;
      console.log(`[Debug] 步兵兵种创建成功，ID: ${infantryId}`);
      
      // 2. 创建坦克兵种
      console.log('[Debug] 开始创建坦克兵种...');
      const tankResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: tank });
      const tankId = tankResult.result.data.unitId;
      console.log(`[Debug] 坦克兵种创建成功，ID: ${tankId}`);
      
      // 3. 创建红方部队（在中心六角格）
      console.log('[Debug] 开始创建红方部队...');
      const redForceData = {
        forceName: '红方测试部队',
        faction: 'red',
        service: 'land',
        hexId: centerHex.hexId,
        composition: [
          { unitId: infantryId, unitCount: 100 },
          { unitId: tankId, unitCount: 50 }
        ],
        troopStrength: 100,
        combatChance: 1,
        actionPoints: 100
      };
      
      const redForceResult = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: redForceData,
        formationId: 'FM_red_default'
      });
      const store = openGameStore();
      console.log(`[Debug] 红方部队创建成功，ID: ${store.getForceById(redForceResult.result.data.forceId).forceId}`);
      
      // 4. 创建蓝方部队（在邻近六角格）
      console.log('[Debug] 开始创建蓝方部队...');
      const blueForceData = {
        forceName: '蓝方测试部队',
        faction: 'blue',
        service: 'land',
        hexId: neighborHex.hexId,
        composition: [
          { unitId: infantryId, unitCount: 80 },
          { unitId: tankId, unitCount: 40 }
        ],
        troopStrength: 100,
        combatChance: 1,
        actionPoints: 100
      };
      
      const blueForceResult = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: blueForceData,
        formationId: 'FM_blue_default'
      });
      console.log(`[Debug] 蓝方部队创建成功，ID: ${store.getForceById(blueForceResult.result.data.forceId).forceId}`);
      
      console.log('[Debug] 测试用例创建完成');

      // const mr = MilitaryInstanceRenderer.getInstance(viewerRef.value);
      // mr.updateForceInstance();

      // // 等待5秒聚焦到红方部队
      // await new Promise(resolve => setTimeout(resolve, 5000));
      // const result = await commandDispatcher.executeCommandFromUI(CommandType.FOCUS_FORCE, { forceId: redForceResult.result.data.forceId });
      // console.log(`[Debug] 聚焦到红方部队，结果: ${result.result.message}`);
      
      // // 等待10秒后移动红方部队
      // await new Promise(resolve => setTimeout(resolve, 10000));
      // const moveResult = await commandDispatcher.executeCommandFromUI(CommandType.MOVE, { 
      //   forceId: redForceResult.result.data.forceId, 
      //   path: [
      //     `H_${centerRow}_${centerCol}`, 
      //     `H_${centerRow}_${centerCol + 1}`,
      //     `H_${centerRow + 1}_${centerCol + 1}`,
      //     `H_${centerRow + 1}_${centerCol}`,
      //     `H_${centerRow + 1}_${centerCol - 1}`,
      //     `H_${centerRow}_${centerCol - 1}`,
      //   ] 
      // });
      // console.log(`[Debug] 移动红方部队，结果: ${moveResult.result.message}`);

      // // 等待5秒后设置H_0_0六角格对双方不可见
      // await new Promise(resolve => setTimeout(resolve, 5000));
      // const hex = store.getHexCellById('H_0_0');
      // hex.setVisibleTo({ blue: false, red: false });
      // console.log(`[Debug] 设置H_0_0六角格对双方不可见`);
      // // 等待5秒后设置所有六角格对双方不可见
      // await new Promise(resolve => setTimeout(resolve, 5000));
      // hexCells.forEach(cell => {
      //   cell.setVisibleTo({ blue: false, red: false });
      // });
      // console.log(`[Debug] 设置所有六角格对双方不可见`);
      // //等待5秒后设置所有六角格对双方可见
      // await new Promise(resolve => setTimeout(resolve, 5000));
      // hexCells.forEach(cell => {
      //   cell.setVisibleTo({ blue: true, red: true });
      // });
      // console.log(`[Debug] 设置所有六角格对双方可见`);

    } catch (error) {
      console.error('[Debug] 创建测试用例失败:', error);
    }
  }
}
</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}
.cesium-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
.loading {
  position: absolute;
  z-index: 100;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  color: #333;
}
</style>
