// src/test/test.js
import { CommandType } from '@/config/CommandConfig';
import { openGameStore } from '@/store';
import { CommandDispatcher } from '@/layers/interaction-layer/CommandDispatcher';

let store;
let commandDispatcher;

/**
 * 开始运行测试
 */
export async function runTests() {
  console.log('[Test] 开始运行测试...');
  
  try {
    // 命令分发器
    commandDispatcher = CommandDispatcher.getInstance();

    // 获取Store
    store = openGameStore();
    
    // 创建各种兵种
    await createBasicUnits();
    await createAdvancedUnits();
    
    // 找到合适的测试六角格
    console.log('[Test] 查找六角格...');
    const { centerHex, neighborHexes } = await findTestHexes();
    
    console.log('[Test] 中心六角格:', centerHex ? centerHex.hexId : '未找到');
    console.log('[Test] 邻近六角格数量:', neighborHexes.length);
    
    if (centerHex && neighborHexes.length > 0) {
      // 创建部队
      console.log('[Test] 开始创建红方部队...');
      const redForceIds = await createRedForces(centerHex);
      console.log('[Test] 红方部队创建完成，数量:', redForceIds.length, '部队ID列表:', redForceIds);
      
      console.log('[Test] 开始创建蓝方部队...');
      await createBlueForces(neighborHexes);
      console.log('[Test] 蓝方部队创建完成');
      
      // 等待部队渲染完成
      console.log('[Test] 等待部队渲染完成...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 测试移动部队
      if (redForceIds.length > 0 && neighborHexes.length > 0) {
        console.log(`[Test] 红方部队ID列表:`, redForceIds);
        const firstRedForceId = redForceIds[0];
        const targetHexId = neighborHexes[0].hexId;
        
        console.log(`[Test] 准备移动红方部队 ${firstRedForceId} 到相邻六角格 ${targetHexId}`);
        
        // 检查部队是否存在
        const forceToMove = store.getForceById(firstRedForceId);
        if (forceToMove) {
          console.log(`[Test] 找到部队: ${forceToMove.forceName}, 当前位置: ${forceToMove.hexId}`);
          await testMoveForce(firstRedForceId, targetHexId);
        } else {
          console.error(`[Test] 无法找到ID为 ${firstRedForceId} 的部队`);
        }
      } else {
        console.error('[Test] 无法执行移动测试 - 没有红方部队或邻近六角格');
        if (redForceIds.length === 0) {
          console.error('[Test] 红方部队创建失败或数量为0');
        }
        if (neighborHexes.length === 0) {
          console.error('[Test] 没有找到邻近六角格');
        }
      }
    } else {
      console.error('[Test] 无法执行测试 - 没有找到合适的六角格');
      if (!centerHex) {
        console.error('[Test] 未找到中心六角格');
      }
      if (neighborHexes.length === 0) {
        console.error('[Test] 未找到邻近六角格');
      }
    }

    // 添加单独测试移动功能的调用
    // console.log('[Test] 尝试单独测试移动功能...');
    // await testMoveSingleForce();
    
  } catch (error) {
    console.error('[Test] 测试过程出错:', error);
  } finally {
    console.log('[Test] 测试完成');
  }
}

/**
 * 创建基本兵种
 * 包括：步兵、坦克、直升机、炮兵、巡洋舰、战斗机、侦察无人机
 * @returns {Promise<Object>} 返回包含所有兵种ID的对象
 */
export async function createBasicUnits() {
  console.log('[Test] 开始创建基本兵种...');
  
  const unitIds = {};
  
  try {
    // 1. 普通步兵
    const infantry = {
      unitId: null,  // 自动生成ID
      unitName: '超级无敌牛逼的普通步兵一批',
      service: ['land'],
      category: '步兵',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 20000000,
        domainFactor: { land: 1.0, sea: 0.2, air: 0.5 },
        terrainFactor: { plain: 1.0, hill: 0.8, mountain: 0.6, water: 0.1 }
      },
      defensePowerComposition: {
        baseDefensePower: 15000000,
        domainFactor: { land: 1.0, sea: 0.2, air: 0.3 },
        terrainFactor: { plain: 1.0, hill: 1.2, mountain: 1.5, water: 0.1 }
      },
      visibilityRadius: 8,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.5, mountain: 2.0, water: 5.0 }
      },
      recoveryRate: 1000000,
      commandCapability: 1.2,
      commandRange: 1,
      renderingKey: "soldier"
    };
    
    // 2. 坦克
    const tank = {
      unitId: null,
      unitName: '坦克',
      service: ['land'],
      category: '装甲',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 40000000,
        domainFactor: { land: 1.0, sea: 0.1, air: 0.7 },
        terrainFactor: { plain: 1.0, hill: 0.8, mountain: 0.4, water: 0 }
      },
      defensePowerComposition: {
        baseDefensePower: 30000000,
        domainFactor: { land: 1.0, sea: 0.1, air: 0.5 },
        terrainFactor: { plain: 1.0, hill: 0.9, mountain: 0.7, water: 0 }
      },
      visibilityRadius: 7,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.8, mountain: 3.0, water: 10.0 }
      },
      recoveryRate: 5,
      commandCapability: 1.5,
      commandRange: 3,
      renderingKey: "missiletank"
    };
    
    // 3. 直升机
    const helicopter = {
      unitId: null,
      unitName: '武装直升机',
      service: ['land'],
      category: '直升机',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 35000000000,
        domainFactor: { land: 1.0, sea: 0.8, air: 1.2 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      defensePowerComposition: {
        baseDefensePower: 20000000000,
        domainFactor: { land: 0.5, sea: 0.5, air: 1.0 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      visibilityRadius: 10,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      recoveryRate: 8,
      commandCapability: 1.8,
      commandRange: 4,
      renderingKey: "helicopter1"
    };
    
    // 4. 野战炮兵
    const artillery = {
      unitId: null,
      unitName: '野战炮兵',
      service: ['land'],
      category: '炮兵',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 5000000000,
        domainFactor: { land: 1.2, sea: 0.6, air: 0.3 },
        terrainFactor: { plain: 1.0, hill: 0.9, mountain: 0.7, water: 0 }
      },
      defensePowerComposition: {
        baseDefensePower: 150000000,
        domainFactor: { land: 1.0, sea: 0.1, air: 0.2 },
        terrainFactor: { plain: 1.0, hill: 1.1, mountain: 1.3, water: 0 }
      },
      visibilityRadius: 6,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.6, mountain: 2.5, water: 10.0 }
      },
      recoveryRate: 6,
      commandCapability: 1.0,
      commandRange: 5,
      renderingKey: "tank"
    };
    
    // 5. 巡洋舰
    const warship = {
      unitId: null,
      unitName: '巡洋舰',
      service: ['land'],
      category: '舰艇',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 600000,
        domainFactor: { land: 0.7, sea: 1.0, air: 0.8 },
        terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
      },
      defensePowerComposition: {
        baseDefensePower: 450000,
        domainFactor: { land: 0.5, sea: 1.0, air: 0.7 },
        terrainFactor: { plain: 0, hill: 0, mountain: 0, water: 1.0 }
      },
      visibilityRadius: 8,
      actionPointCostComposition: {
        baseActionPointCost: 2,
        terrainFactor: { plain: 10.0, hill: 10.0, mountain: 10.0, water: 1.0 }
      },
      recoveryRate: 4,
      commandCapability: 2.0,
      commandRange: 6,
      renderingKey: "warship"
    };
    
    // 6. 战斗机
    const jet = {
      unitId: null,
      unitName: '战斗机',
      service: ['land'],
      category: '战机',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 45000000000001,
        domainFactor: { land: 0.8, sea: 0.8, air: 1.5 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      defensePowerComposition: {
        baseDefensePower: 25000000000002,
        domainFactor: { land: 0.3, sea: 0.3, air: 1.2 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      visibilityRadius: 10,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      recoveryRate: 7,
      commandCapability: 1.6,
      commandRange: 5,
      renderingKey: "jet"
    };
    
    // 7. 侦察无人机
    const spyDrone = {
      unitId: null,
      unitName: '侦察无人机',
      service: ['land'],
      category: '无人机',
      factionAvailability: ['red', 'blue'],
      attackPowerComposition: {
        baseAttackPower: 100000,
        domainFactor: { land: 0.5, sea: 0.5, air: 0.5 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      defensePowerComposition: {
        baseDefensePower: 100000,
        domainFactor: { land: 0.3, sea: 0.3, air: 0.8 },
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      visibilityRadius: 10,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      recoveryRate: 10,
      commandCapability: 1.2,
      commandRange: 3,
      renderingKey: "spydrone"
    };
    
    // 创建兵种
    const infantryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: infantry });
    unitIds.infantryId = infantryResult.result.data.unitId;
    console.log(`[Test] 步兵兵种创建成功，ID: ${unitIds.infantryId}`);
    
    const tankResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: tank });
    unitIds.tankId = tankResult.result.data.unitId;
    console.log(`[Test] 坦克兵种创建成功，ID: ${unitIds.tankId}`);
    
    const helicopterResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: helicopter });
    unitIds.helicopterId = helicopterResult.result.data.unitId;
    console.log(`[Test] 直升机兵种创建成功，ID: ${unitIds.helicopterId}`);
    
    const artilleryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: artillery });
    unitIds.artilleryId = artilleryResult.result.data.unitId;
    console.log(`[Test] 炮兵兵种创建成功，ID: ${unitIds.artilleryId}`);
    
    const warshipResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: warship });
    unitIds.warshipId = warshipResult.result.data.unitId;
    console.log(`[Test] 巡洋舰兵种创建成功，ID: ${unitIds.warshipId}`);
    
    const jetResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: jet });
    unitIds.jetId = jetResult.result.data.unitId;
    console.log(`[Test] 战斗机兵种创建成功，ID: ${unitIds.jetId}`);
    
    const spyDroneResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: spyDrone });
    unitIds.spyDroneId = spyDroneResult.result.data.unitId;
    console.log(`[Test] 侦察无人机兵种创建成功，ID: ${unitIds.spyDroneId}`);
    
    console.log('[Test] 基本兵种创建完成');
    return unitIds;
  } catch (error) {
    console.error('[Test] 创建基本兵种失败:', error);
    return unitIds;
  }
}

/**
 * 创建高级兵种
 * 包括：特种部队、摩托化步兵、火箭炮兵、潜艇、武装攻击直升机
 * @returns {Promise<Object>} 返回包含所有兵种ID的对象
 */
export async function createAdvancedUnits() {
  console.log('[Test] 开始创建高级兵种...');
  
  const unitIds = {};
  
  try {
    // 1. 特种部队
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
      visibilityRadius: 6,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.1, mountain: 1.2, water: 3.0 }
      },
      recoveryRate: 12,
      commandCapability: 1.3,
      commandRange: 2,
      renderingKey: "soldier"
    };
    
    // 2. 摩托化步兵
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
      visibilityRadius: 6,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 0.8, hill: 1.3, mountain: 2.0, water: 10.0 }
      },
      recoveryRate: 9,
      commandCapability: 1.1,
      commandRange: 2,
      renderingKey: "soldier"
    };
    
    // 3. 火箭炮兵
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
      visibilityRadius: 6,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.7, mountain: 2.8, water: 10.0 }
      },
      recoveryRate: 5,
      commandCapability: 0.9,
      commandRange: 6,
      renderingKey: "tank"
    };
    
    // 4. 潜艇
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
      visibilityRadius: 5,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 10.0, hill: 10.0, mountain: 10.0, water: 1.0 }
      },
      recoveryRate: 3,
      commandCapability: 1.8,
      commandRange: 4,
      renderingKey: "warship"
    };
    
    // 5. 武装攻击直升机
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
      visibilityRadius: 10,
      actionPointCostComposition: {
        baseActionPointCost: 1,
        terrainFactor: { plain: 1.0, hill: 1.0, mountain: 1.0, water: 1.0 }
      },
      recoveryRate: 7,
      commandCapability: 1.7,
      commandRange: 4,
      renderingKey: "helicopter2"
    };
    
    // 创建兵种
    const specialForcesResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: specialForces });
    unitIds.specialForcesId = specialForcesResult.result.data.unitId;
    console.log(`[Test] 特种部队兵种创建成功，ID: ${unitIds.specialForcesId}`);
    
    const motorcycleTroopResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: motorcycleTroop });
    unitIds.motorcycleTroopId = motorcycleTroopResult.result.data.unitId;
    console.log(`[Test] 摩托化步兵兵种创建成功，ID: ${unitIds.motorcycleTroopId}`);
    
    const rocketArtilleryResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: rocketArtillery });
    unitIds.rocketArtilleryId = rocketArtilleryResult.result.data.unitId;
    console.log(`[Test] 火箭炮兵兵种创建成功，ID: ${unitIds.rocketArtilleryId}`);
    
    const submarineResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: submarine });
    unitIds.submarineId = submarineResult.result.data.unitId;
    console.log(`[Test] 潜艇兵种创建成功，ID: ${unitIds.submarineId}`);
    
    const attackHelicopterResult = await commandDispatcher.executeCommandFromUI(CommandType.EDIT_UNIT, { unitData: attackHelicopter });
    unitIds.attackHelicopterId = attackHelicopterResult.result.data.unitId;
    console.log(`[Test] 武装攻击直升机兵种创建成功，ID: ${unitIds.attackHelicopterId}`);
    
    console.log('[Test] 高级兵种创建完成');
    return unitIds;
  } catch (error) {
    console.error('[Test] 创建高级兵种失败:', error);
    return unitIds;
  }
}

/**
 * 查找测试用的六角格
 * @returns {Promise<Object>} 包含中心六角格和邻近六角格的对象
 */
export async function findTestHexes() {
  console.log('[Test] 开始查找测试六角格...');
  
  const result = {
    centerHex: null,
    neighborHexes: []
  };
  
  try {
    // 查找六角格网中心位置
    const hexCells = store.getHexCells();
    if (hexCells.length === 0) {
      console.error('[Test] 没有找到六角格');
      return result;
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
      console.error(`[Test] 没有找到中心六角格 ${centerHexId}`);
      return result;
    }
    
    console.log(`[Test] 找到中心六角格: ${centerHexId}`);
    result.centerHex = centerHex;
    
    // 查找多个相邻六角格
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
        result.neighborHexes.push(hex);
        console.log(`[Test] 找到邻近六角格: ${neighborId}`);
      }
    }
    
    if (result.neighborHexes.length === 0) {
      console.error('[Test] 没有找到邻近六角格');
    } else {
      console.log(`[Test] 共找到 ${result.neighborHexes.length} 个邻近六角格`);
    }
    
    return result;
  } catch (error) {
    console.error('[Test] 查找测试六角格失败:', error);
    return result;
  }
}

/**
 * 创建红方部队
 * @param {Object} centerHex 中心六角格对象
 * @returns {Promise<Array>} 创建的红方部队ID数组
 */
export async function createRedForces(centerHex) {
  console.log('[Test] 开始创建红方部队...');
  
  if (!centerHex) {
    console.error('[Test] 中心六角格不存在，无法创建红方部队');
    return [];
  }
  
  const createdForceIds = [];
  
  try {
    // 获取已创建的兵种ID
    const basicUnits = await createBasicUnits();
    const advancedUnits = await createAdvancedUnits();
    
    // 合并兵种ID
    const unitIds = { ...basicUnits, ...advancedUnits };
    
    // 检查是否有足够的兵种
    if (!unitIds.infantryId || !unitIds.tankId) {
      console.error('[Test] 缺少基本兵种，无法创建红方部队');
      return createdForceIds;
    }
    
    // 创建包含多种兵种的红方部队
    const redMultiUnitForceData = {
      forceName: '红方联合特遣队',
      faction: 'red',
      service: 'land',
      hexId: centerHex.hexId,
      composition: [
        { unitId: unitIds.infantryId, unitCount: 100 },
        { unitId: unitIds.tankId, unitCount: 60 },
        { unitId: unitIds.artilleryId, unitCount: 40 },
        { unitId: unitIds.specialForcesId, unitCount: 20 },
        { unitId: unitIds.motorcycleTroopId, unitCount: 50 },
        { unitId: unitIds.helicopterId, unitCount: 15 },
        { unitId: unitIds.rocketArtilleryId, unitCount: 30 },
        { unitId: unitIds.spyDroneId, unitCount: 25 }
      ].filter(item => item.unitId), // 过滤掉不存在的兵种
      troopStrength: 100,
      combatChance: 1,
      actionPoints: 100
    };
    
    // 创建其他红方部队
    const redForces = [
      {
        forceName: '红方步兵第一师',
        faction: 'red',
        service: 'land',
        hexId: centerHex.hexId,
        composition: [
          { unitId: unitIds.infantryId, unitCount: 100 },
          { unitId: unitIds.artilleryId, unitCount: 30 }
        ].filter(item => item.unitId),
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
          { unitId: unitIds.tankId, unitCount: 80 },
          { unitId: unitIds.infantryId, unitCount: 40 }
        ].filter(item => item.unitId),
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
          { unitId: unitIds.helicopterId, unitCount: 20 },
          { unitId: unitIds.jetId, unitCount: 15 },
          { unitId: unitIds.spyDroneId, unitCount: 30 }
        ].filter(item => item.unitId),
        troopStrength: 100,
        combatChance: 1,
        actionPoints: 100
      }
    ];
    
    // 首先创建包含多种兵种的部队
    console.log('[Test] 开始创建红方联合特遣队...');
    const multiUnitResult = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
      forceData: redMultiUnitForceData,
      formationId: 'FM_red_default'
    });
    
    if (multiUnitResult.success && multiUnitResult.result?.data) {
      const forceId = multiUnitResult.result.data.forceId;
      createdForceIds.push(forceId);
      console.log(`[Test] 创建红方联合特遣队成功, ID: ${forceId}`);
    } else {
      console.error('[Test] 创建红方联合特遣队失败:', multiUnitResult.error || '未知错误');
    }
    
    // 然后创建其他红方部队
    for (let i = 0; i < redForces.length; i++) {
      const forceData = redForces[i];
      console.log(`[Test] 开始创建红方部队: ${forceData.forceName}...`);
      
      const result = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: forceData,
        formationId: 'FM_red_default'
      });
      
      if (result.success && result.result?.data) {
        const forceId = result.result.data.forceId;
        createdForceIds.push(forceId);
        console.log(`[Test] 创建红方部队成功: ${forceData.forceName}, ID: ${forceId}`);
      } else {
        console.error(`[Test] 创建红方部队失败: ${forceData.forceName}`, result.error || '未知错误');
      }
    }
    
    console.log(`[Test] 红方部队创建完成，共 ${createdForceIds.length} 支`);
    console.log('[Test] 红方部队ID列表:', createdForceIds);
    return createdForceIds;
  } catch (error) {
    console.error('[Test] 创建红方部队失败:', error);
    return createdForceIds;
  }
}

/**
 * 创建蓝方部队
 * @param {Array} neighborHexes 邻近六角格数组
 * @returns {Promise<Array>} 创建的蓝方部队ID数组
 */
export async function createBlueForces(neighborHexes) {
  console.log('[Test] 开始创建蓝方部队...');
  
  if (!neighborHexes || neighborHexes.length === 0) {
    console.error('[Test] 没有邻近六角格，无法创建蓝方部队');
    return [];
  }
  
  const createdForceIds = [];
  
  try {
    // 获取已创建的兵种ID
    const basicUnits = await createBasicUnits();
    const advancedUnits = await createAdvancedUnits();
    
    // 合并兵种ID
    const unitIds = { ...basicUnits, ...advancedUnits };
    
    // 检查是否有足够的兵种
    if (!unitIds.infantryId || !unitIds.tankId) {
      console.error('[Test] 缺少基本兵种，无法创建蓝方部队');
      return createdForceIds;
    }
    
    // 在相邻六角格创建多个蓝方部队
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
            { unitId: unitIds.infantryId, unitCount: 80 - (i * 10) },
            { unitId: unitIds.tankId, unitCount: 40 - (i * 5) },
            { unitId: unitIds.artilleryId, unitCount: 20 + (i * 2) }
          ].filter(item => item.unitId),
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
            { unitId: unitIds.helicopterId, unitCount: 15 + (i * 2) },
            { unitId: unitIds.jetId, unitCount: 10 + i },
            { unitId: unitIds.spyDroneId, unitCount: 25 - i }
          ].filter(item => item.unitId),
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
            { unitId: unitIds.warshipId, unitCount: 10 + i },
            { unitId: unitIds.submarineId, unitCount: 8 + (i * 2) }
          ].filter(item => item.unitId),
          troopStrength: 100,
          combatChance: 1,
          actionPoints: 100
        };
      }
      
      // 如果composition为空，则跳过创建
      if (forceData.composition.length === 0) {
        console.warn(`[Test] 蓝方部队 ${forceData.forceName} 没有有效兵种，跳过创建`);
        continue;
      }
      
      const result = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: forceData,
        formationId: 'FM_blue_default'
      });
      
      if (result.success && result.result.data) {
        createdForceIds.push(result.result.data.forceId);
        console.log(`[Test] 创建蓝方部队成功: ${forceData.forceName}, ID: ${result.result.data.forceId}`);
      }
    }
    
    console.log(`[Test] 蓝方部队创建完成，共 ${createdForceIds.length} 支`);
    return createdForceIds;
  } catch (error) {
    console.error('[Test] 创建蓝方部队失败:', error);
    return createdForceIds;
  }
}

/**
 * 测试部队移动功能
 * @param {string} forceId 需要移动的部队ID
 * @param {string} targetHexId 目标六角格ID
 * @returns {Promise<boolean>} 移动是否成功
 */
export async function testMoveForce(forceId, targetHexId) {
  console.log('[Test] 开始测试部队移动...');
  
  if (!forceId || !targetHexId) {
    console.error('[Test] 移动测试失败: 缺少部队ID或目标六角格ID');
    return false;
  }
  
  try {
    // 获取要移动的部队信息
    const force = store.getForceById(forceId);
    if (!force) {
      console.error(`[Test] 未找到ID为 ${forceId} 的部队`);
      return false;
    }
    
    const sourceHexId = force.hexId;
    console.log(`[Test] 部队 "${force.forceName}"(${forceId}) 当前位于 ${sourceHexId}`);
    console.log(`[Test] 准备移动到目标六角格: ${targetHexId}`);
    
    // 添加小延时确保前面的操作完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[Test] 发送移动命令: ${forceId} -> ${targetHexId}`);
    
    // 创建路径数组 - CommandProcessor.move要求path是一个数组，至少包含起点和终点
    const path = [sourceHexId, targetHexId];
    
    // 调用移动命令
    const moveResult = await commandDispatcher.executeCommandFromUI(CommandType.MOVE, {
      forceId: forceId,
      path: path
    });
    
    console.log(`[Test] 移动命令执行结果:`, moveResult);
    
    if (moveResult.success) {
      console.log(`[Test] 部队移动成功: ${force.forceName} 从 ${sourceHexId} 移动到 ${targetHexId}`);
      
      // 检查部队位置是否已更新
      const updatedForce = store.getForceById(forceId);
      console.log(`[Test] 移动后部队位置: ${updatedForce.hexId}`);
      
      return true;
    } else {
      console.error(`[Test] 部队移动失败:`, moveResult.error || '未知错误');
      return false;
    }
  } catch (error) {
    console.error('[Test] 测试部队移动时发生错误:', error);
    return false;
  }
}

/**
 * 单独测试移动功能
 * 这个函数可以在确保已有部队时直接调用，不依赖前面的部队创建逻辑
 */
export async function testMoveSingleForce() {
  console.log('[Test] 开始单独测试移动功能...');
  
  try {
    // 获取Store和命令分发器
    store = openGameStore();
    commandDispatcher = CommandDispatcher.getInstance();
    
    // 获取所有部队ID
    let forces = store.getForces();
    if (!forces || forces.length === 0) {
      console.log('[Test] 没有现有部队，尝试创建测试部队...');
      
      // 查找六角格
      const hexCells = store.getHexCells();
      if (!hexCells || hexCells.length === 0) {
        console.error('[Test] 没有可用的六角格，无法创建部队');
        return;
      }
      
      // 选择一个六角格作为中心
      const centerHex = hexCells[Math.floor(hexCells.length / 2)];
      console.log(`[Test] 选择六角格 ${centerHex.hexId} 作为中心点`);
      
      // 创建基本兵种
      const unitIds = await createBasicUnits();
      
      if (!unitIds.infantryId) {
        console.error('[Test] 创建兵种失败，无法继续');
        return;
      }
      
      // 创建一个简单的红方部队
      const redForceData = {
        forceName: '红方测试部队',
        faction: 'red',
        service: 'land',
        hexId: centerHex.hexId,
        composition: [
          { unitId: unitIds.infantryId, unitCount: 100 }
        ],
        troopStrength: 100,
        combatChance: 1,
        actionPoints: 100
      };
      
      console.log('[Test] 创建红方测试部队...');
      const result = await commandDispatcher.executeCommandFromUI(CommandType.CREATE_FORCE, { 
        forceData: redForceData,
        formationId: 'FM_red_default'
      });
      
      if (!result.success || !result.result?.data) {
        console.error('[Test] 创建红方测试部队失败:', result.error || '未知错误');
        return;
      }
      
      console.log(`[Test] 红方测试部队创建成功，ID: ${result.result.data.forceId}`);
      
      // 等待部队渲染
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 重新获取部队列表
      forces = store.getForces();
    }
    
    console.log(`[Test] 找到 ${forces.length} 支部队`);
    
    // 选择第一支红方部队
    const redForces = forces.filter(force => force.faction === 'red');
    if (redForces.length === 0) {
      console.error('[Test] 没有找到红方部队');
      return;
    }
    
    const redForce = redForces[0];
    console.log(`[Test] 选择红方部队: ${redForce.forceName} (${redForce.forceId})`);
    
    // 获取部队当前所在六角格
    const currentHexId = redForce.hexId;
    const currentHex = store.getHexCellById(currentHexId);
    if (!currentHex) {
      console.error(`[Test] 找不到部队当前所在六角格: ${currentHexId}`);
      return;
    }
    
    // 获取周围六角格
    console.log(`[Test] 查找 ${currentHexId} 周围的六角格...`);
    const neighborHexes = currentHex.neighbors;
    console.log(`[Test] 周围六角格: ${neighborHexes}`);
    
    if (!neighborHexes) {
      console.error('[Test] 没有找到邻近六角格');
      return;
    }
    
    // 测试移动
    console.log(`[Test] 开始移动部队 ${redForce.forceId} 从 ${currentHexId} 到 ${neighborHexes[0].hexId}`);
    await testMoveForce(redForce.forceId, neighborHexes[0].hexId);
    
  } catch (error) {
    console.error('[Test] 单独测试移动功能出错:', error);
  }
}

export async function runMovementTestOnly() {
  console.log('[Test] 开始单独移动测试...');
  try {
    await testMoveSingleForce();
  } catch (error) {
    console.error('[Test] 单独移动测试失败:', error);
  } finally {
    console.log('[Test] 单独移动测试完成');
  }
}

