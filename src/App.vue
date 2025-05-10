<!-- src\App.vue -->
<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染面板 -->
    <div v-if="gameReady">
      <OverviewPanel /> <!-- 概览面板 -->
      <FormationPanel /> <!-- 编队列表 -->
      <CommandPanel /> <!-- 命令管理面板 -->
      <DetailInfoPanel /> <!-- 详情信息面板 -->
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
import DetailInfoPanel from '@/components/hud/DetailInfoPanel.vue';
import FormationPanel from '@/components/hud/FormationPanel.vue';
import CommandPanel from '@/components/hud/CommandPanel.vue';

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
  
  // 创建多个测试兵种
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
  
  // 新增兵种类型
  const helicopter = {
    unitId: null,
    unitName: '武装直升机',
    service: ['land'],
    category: '直升机',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 35,
      domainFactor: { land: 1.0, sea: 0.8, air: 1.2 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 20,
      domainFactor: { land: 0.5, sea: 0.5, air: 1.0 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    visibilityRadius: 4,
    actionPointCostComposition: {
      baseActionPointCost: 8,
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    recoveryRate: 8,
    commandCapability: 1.8,
    commandRange: 4,
    renderingKey: "helicopter1"
  };
  
  const artillery = {
    unitId: null,
    unitName: '野战炮兵',
    service: ['land'],
    category: '炮兵',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 50,
      domainFactor: { land: 1.2, sea: 0.6, air: 0.3 },
      terrainFactor: { plain: 1.0, hill: 0.9, mountain: 0.7, water: 0 }
    },
    defensePowerComposition: {
      baseDefensePower: 15,
      domainFactor: { land: 1.0, sea: 0.1, air: 0.2 },
      terrainFactor: { plain: 1.0, hill: 1.1, mountain: 1.3, water: 0 }
    },
    visibilityRadius: 3,
    actionPointCostComposition: {
      baseActionPointCost: 12,
      terrainFactor: { plain: 1.0, hill: 1.6, mountain: 2.5, water: 10.0 }
    },
    recoveryRate: 6,
    commandCapability: 1.0,
    commandRange: 5,
    renderingKey: "tank"
  };
  
  const warship = {
    unitId: null,
    unitName: '巡洋舰',
    service: ['land'],
    category: '舰艇',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 60,
      domainFactor: { land: 0.7, sea: 1.0, air: 0.8 },
      terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 45,
      domainFactor: { land: 0.5, sea: 1.0, air: 0.7 },
      terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
    },
    visibilityRadius: 5,
    actionPointCostComposition: {
      baseActionPointCost: 20,
      terrainFactor: { plain: 10.0, hill: 10.0, mountain: 10.0, water: 1.0 }
    },
    recoveryRate: 4,
    commandCapability: 2.0,
    commandRange: 6,
    renderingKey: "warship"
  };
  
  const jet = {
    unitId: null,
    unitName: '战斗机',
    service: ['land'],
    category: '战机',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 45,
      domainFactor: { land: 0.8, sea: 0.8, air: 1.5 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 25,
      domainFactor: { land: 0.3, sea: 0.3, air: 1.2 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    visibilityRadius: 6,
    actionPointCostComposition: {
      baseActionPointCost: 10,
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    recoveryRate: 7,
    commandCapability: 1.6,
    commandRange: 5,
    renderingKey: "jet"
  };
  
  const spyDrone = {
    unitId: null,
    unitName: '侦察无人机',
    service: ['land'],
    category: '无人机',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 10,
      domainFactor: { land: 0.5, sea: 0.5, air: 0.5 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 10,
      domainFactor: { land: 0.3, sea: 0.3, air: 0.8 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    visibilityRadius: 8,
    actionPointCostComposition: {
      baseActionPointCost: 5,
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    recoveryRate: 10,
    commandCapability: 1.2,
    commandRange: 3,
    renderingKey: "spydrone"
  };
  
  // 添加更多兵种以测试滚动条
  const specialForces = {
    unitId: null,
    unitName: '特种部队',
    service: ['land'],
    category: '特种兵',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 30,
      domainFactor: { land: 1.2, sea: 0.6, air: 0.5 },
      terrainFactor: { plain: 1.0, hill: 1.1, mountain: 1.2, water: 0.3 }
    },
    defensePowerComposition: {
      baseDefensePower: 20,
      domainFactor: { land: 1.1, sea: 0.4, air: 0.5 },
      terrainFactor: { plain: 1.0, hill: 1.2, mountain: 1.3, water: 0.3 }
    },
    visibilityRadius: 3,
    actionPointCostComposition: {
      baseActionPointCost: 8,
      terrainFactor: { plain: 1.0, hill: 1.1, mountain: 1.2, water: 3.0 }
    },
    recoveryRate: 12,
    commandCapability: 1.3,
    commandRange: 2,
    renderingKey: "soldier"
  };
  
  const motorcycleTroop = {
    unitId: null,
    unitName: '摩托化步兵',
    service: ['land'],
    category: '摩托兵',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 25,
      domainFactor: { land: 1.1, sea: 0.2, air: 0.4 },
      terrainFactor: { plain: 1.2, hill: 0.9, mountain: 0.5, water: 0.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 18,
      domainFactor: { land: 1.0, sea: 0.2, air: 0.4 },
      terrainFactor: { plain: 1.1, hill: 0.9, mountain: 0.6, water: 0.0 }
    },
    visibilityRadius: 3,
    actionPointCostComposition: {
      baseActionPointCost: 7,
      terrainFactor: { plain: 0.8, hill: 1.3, mountain: 2.0, water: 10.0 }
    },
    recoveryRate: 9,
    commandCapability: 1.1,
    commandRange: 2,
    renderingKey: "soldier"
  };
  
  const rocketArtillery = {
    unitId: null,
    unitName: '火箭炮兵',
    service: ['land'],
    category: '火炮',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 55,
      domainFactor: { land: 1.3, sea: 0.7, air: 0.4 },
      terrainFactor: { plain: 1.0, hill: 0.9, mountain: 0.6, water: 0.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 12,
      domainFactor: { land: 0.9, sea: 0.1, air: 0.2 },
      terrainFactor: { plain: 0.9, hill: 1.0, mountain: 1.1, water: 0.0 }
    },
    visibilityRadius: 3,
    actionPointCostComposition: {
      baseActionPointCost: 14,
      terrainFactor: { plain: 1.0, hill: 1.7, mountain: 2.8, water: 10.0 }
    },
    recoveryRate: 5,
    commandCapability: 0.9,
    commandRange: 6,
    renderingKey: "tank"
  };
  
  const submarine = {
    unitId: null,
    unitName: '潜艇',
    service: ['land'],
    category: '潜艇',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 50,
      domainFactor: { land: 0.0, sea: 1.5, air: 0.3 },
      terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 35,
      domainFactor: { land: 0.0, sea: 1.2, air: 0.5 },
      terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
    },
    visibilityRadius: 4,
    actionPointCostComposition: {
      baseActionPointCost: 18,
      terrainFactor: { plain: 10.0, hill: 10.0, mountain: 10.0, water: 1.0 }
    },
    recoveryRate: 3,
    commandCapability: 1.8,
    commandRange: 4,
    renderingKey: "warship"
  };
  
  const attackHelicopter = {
    unitId: null,
    unitName: '武装攻击直升机',
    service: ['land'],
    category: '攻击机',
    factionAvailability: ['red', 'blue'],
    attackPowerComposition: {
      baseAttackPower: 40,
      domainFactor: { land: 1.2, sea: 0.9, air: 1.0 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    defensePowerComposition: {
      baseDefensePower: 22,
      domainFactor: { land: 0.6, sea: 0.6, air: 1.1 },
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    visibilityRadius: 5,
    actionPointCostComposition: {
      baseActionPointCost: 9,
      terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
    },
    recoveryRate: 7,
    commandCapability: 1.7,
    commandRange: 4,
    renderingKey: "helicopter2"
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
  
  // 查找多个相邻六角格
  const neighborHexes = [];
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
      neighborHexes.push(hex);
      console.log(`[Debug] 找到邻近六角格: ${neighborId}`);
    }
  }
  
  if (neighborHexes.length === 0) {
    console.error('[Debug] 没有找到邻近六角格');
    return;
  }
  
  // 按顺序创建兵种和部队
  createUnitAndForces();
  
  // 异步创建兵种和部队（确保按顺序执行）
  async function createUnitAndForces() {
    try {
      // 1. 创建所有兵种
      console.log('[Debug] 开始创建兵种...');
      
      const infantryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: infantry });
      const infantryId = infantryResult.result.data.unitId;
      console.log(`[Debug] 步兵兵种创建成功，ID: ${infantryId}`);
      
      const tankResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: tank });
      const tankId = tankResult.result.data.unitId;
      console.log(`[Debug] 坦克兵种创建成功，ID: ${tankId}`);
      
      const helicopterResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: helicopter });
      const helicopterId = helicopterResult.result.data.unitId;
      console.log(`[Debug] 直升机兵种创建成功，ID: ${helicopterId}`);
      
      const artilleryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: artillery });
      const artilleryId = artilleryResult.result.data.unitId;
      console.log(`[Debug] 炮兵兵种创建成功，ID: ${artilleryId}`);
      
      const warshipResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: warship });
      const warshipId = warshipResult.result.data.unitId;
      console.log(`[Debug] 巡洋舰兵种创建成功，ID: ${warshipId}`);
      
      const jetResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: jet });
      const jetId = jetResult.result.data.unitId;
      console.log(`[Debug] 战斗机兵种创建成功，ID: ${jetId}`);
      
      const spyDroneResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: spyDrone });
      const spyDroneId = spyDroneResult.result.data.unitId;
      console.log(`[Debug] 侦察无人机兵种创建成功，ID: ${spyDroneId}`);
      
      // 创建额外的兵种
      const specialForcesResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: specialForces });
      const specialForcesId = specialForcesResult.result.data.unitId;
      console.log(`[Debug] 特种部队兵种创建成功，ID: ${specialForcesId}`);
      
      const motorcycleTroopResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: motorcycleTroop });
      const motorcycleTroopId = motorcycleTroopResult.result.data.unitId;
      console.log(`[Debug] 摩托化步兵兵种创建成功，ID: ${motorcycleTroopId}`);
      
      const rocketArtilleryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: rocketArtillery });
      const rocketArtilleryId = rocketArtilleryResult.result.data.unitId;
      console.log(`[Debug] 火箭炮兵兵种创建成功，ID: ${rocketArtilleryId}`);
      
      const submarineResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: submarine });
      const submarineId = submarineResult.result.data.unitId;
      console.log(`[Debug] 潜艇兵种创建成功，ID: ${submarineId}`);
      
      const attackHelicopterResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: attackHelicopter });
      const attackHelicopterId = attackHelicopterResult.result.data.unitId;
      console.log(`[Debug] 武装攻击直升机兵种创建成功，ID: ${attackHelicopterId}`);
      
      // 2. 在中心六角格创建8支红方部队
      console.log('[Debug] 开始创建红方部队...');
      
      // 创建包含8个兵种的红方部队
      const redMultiUnitForceData = {
        forceName: '红方联合特遣队',
        faction: 'red',
        service: 'land',
        hexId: centerHex.hexId,
        composition: [
          { unitId: infantryId, unitCount: 100 },
          { unitId: tankId, unitCount: 60 },
          { unitId: artilleryId, unitCount: 40 },
          { unitId: specialForcesId, unitCount: 20 },
          { unitId: motorcycleTroopId, unitCount: 50 },
          { unitId: helicopterId, unitCount: 15 },
          { unitId: rocketArtilleryId, unitCount: 30 },
          { unitId: spyDroneId, unitCount: 25 }
        ],
        troopStrength: 100,
        combatChance: 1,
        actionPoints: 100
      };
      
      // 创建其他7支红方部队
      const redForces = [
        {
          forceName: '红方步兵第一师',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: infantryId, unitCount: 100 },
            { unitId: artilleryId, unitCount: 30 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方装甲第二师',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: tankId, unitCount: 80 },
            { unitId: infantryId, unitCount: 40 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方空军第一航空队',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: helicopterId, unitCount: 20 },
            { unitId: jetId, unitCount: 15 },
            { unitId: spyDroneId, unitCount: 30 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方特种部队A组',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: specialForcesId, unitCount: 40 },
            { unitId: helicopterId, unitCount: 10 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方机动部队',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: motorcycleTroopId, unitCount: 70 },
            { unitId: tankId, unitCount: 30 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方火箭炮团',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: rocketArtilleryId, unitCount: 50 },
            { unitId: infantryId, unitCount: 30 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        },
        {
          forceName: '红方海军陆战队',
          faction: 'red',
          service: 'land',
          hexId: centerHex.hexId,
          composition: [
            { unitId: infantryId, unitCount: 60 },
            { unitId: specialForcesId, unitCount: 40 }
          ],
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        }
      ];
      
      // 首先创建包含8个兵种的部队
      await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: redMultiUnitForceData,
        formationId: 'FM_red_default'
      });
      
      // 然后创建其他7支部队
      for (const forceData of redForces) {
        await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
          forceData: forceData,
          formationId: 'FM_red_default'
        });
      }
      
      console.log(`[Debug] 红方部队创建成功`);
      
      // 在相邻六角格创建多个蓝方部队
      console.log('[Debug] 开始创建蓝方部队...');
      
      for (let i = 0; i < Math.min(neighborHexes.length, 6); i++) {
        const neighborHex = neighborHexes[i];
        
        // 创建不同类型的部队
        let forceData;
        
        if (i % 3 === 0) {
          // 陆军部队
          forceData = {
            forceName: `蓝方陆军第${i+1}师`,
            faction: 'blue',
            service: 'land',
            hexId: neighborHex.hexId,
            composition: [
              { unitId: infantryId, unitCount: 80 - (i * 10) },
              { unitId: tankId, unitCount: 40 - (i * 5) },
              { unitId: artilleryId, unitCount: 20 + (i * 2) }
            ],
            troopStrength: 100,
            combatChance: 1,
            actionPoints: 100
          };
        } else if (i % 3 === 1) {
          // 空军部队
          forceData = {
            forceName: `蓝方空军第${i+1}航空队`,
            faction: 'blue',
            service: 'land',
            hexId: neighborHex.hexId,
            composition: [
              { unitId: helicopterId, unitCount: 15 + (i * 2) },
              { unitId: jetId, unitCount: 10 + i },
              { unitId: spyDroneId, unitCount: 25 - i }
            ],
            troopStrength: 100,
            combatChance: 1,
            actionPoints: 100
          };
        } else {
          // 海军部队
          forceData = {
            forceName: `蓝方海军第${i+1}舰队`,
            faction: 'blue',
            service: 'land',
            hexId: neighborHex.hexId,
            composition: [
              { unitId: warshipId, unitCount: 10 + i },
              { unitId: submarineId, unitCount: 8 + (i * 2) }
            ],
            troopStrength: 100,
            combatChance: 1,
            actionPoints: 100
          };
        }
        
        await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
          forceData: forceData,
          formationId: 'FM_blue_default'
        });
      }
      
      console.log(`[Debug] 蓝方部队创建成功`);
      console.log('[Debug] 测试用例创建完成');
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
