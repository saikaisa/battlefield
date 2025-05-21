<!-- src\components\hud\DetailInfoPanel.vue
  底部详细信息栏，包括：
  - 六角格详细信息
  - 六角格部队列表
  - 部队详细信息
-->
<template>
  <teleport to="body">
    <div class="detail-info-panel" v-if="store.gameMode !== GameMode.PANORAMA" :class="{ 'disabled': isPanelDisabled }">
      <!-- 左侧：六角格详细信息 -->
      <div class="hex-info-section">
        <div class="section-header">
          <h4>六角格详细信息</h4>
        </div>
        <div class="info-content" v-if="selectedHex">
          <div class="info-row">
            <span class="info-label">ID:</span>
            <span class="info-value">{{ selectedHex.hexId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">位置:</span>
            <span class="info-value" v-if="selectedHexCenter">
              ({{ selectedHexCenter.latitude.toFixed(3) > 0 ? selectedHexCenter.latitude.toFixed(3) + '°N' : Math.abs(selectedHexCenter.latitude.toFixed(3)) + '°S' }}, 
              {{ selectedHexCenter.longitude.toFixed(3) > 0 ? selectedHexCenter.longitude.toFixed(3) + '°E' : Math.abs(selectedHexCenter.longitude.toFixed(3)) + '°W' }})
            </span>
            <span class="info-value" v-else>未知位置</span>
          </div>
          <div class="info-row">
            <span class="info-label">地形高度:</span>
            <span class="info-value">{{ getTerrainType(selectedHex) }} ({{ selectedHex.terrainAttributes?.elevation.toFixed(2) || 0 }}m)</span>
          </div>
          <div class="info-row">
            <span class="info-label">可通行军种:</span>
            <span class="info-value">{{ getPassableTypes(selectedHex) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">隶属方:</span>
            <span class="info-value" :class="`faction-${selectedHex.battlefieldState?.controlFaction || 'neutral'}`">
              {{ getFactionName(selectedHex.battlefieldState?.controlFaction) }} 
              <span v-if="hexForces.length > 0">({{ hexForces.length }} 支部队)</span>
            </span>
          </div>
        </div>
        <div class="info-content empty-info" v-else>
          <div class="empty-message">未选中六角格</div>
        </div>
      </div>

      <!-- 中间：六角格部队列表 -->
      <div class="hex-forces-section">
        <div class="section-header">
          <h4>六角格部队列表 {{ selectedHex ? `(${selectedHex.hexId})` : '' }}</h4>
        </div>
        <div class="forces-table" v-if="hexForces.length > 0">
          <div class="forces-table-header">
            <div class="column id-column">编号</div>
            <div class="column name-column">名称</div>
            <div class="column strength-column">兵力</div>
            <div class="column action-column">行动力</div>
          </div>
          <div class="forces-table-body custom-scrollbar">
            <div 
              v-for="force in hexForces" 
              :key="force.forceId"
              class="forces-table-row"
              :class="{
                'selected-row': isForceSelected(force.forceId),
                'disabled-row': force.combatChance <= 0 || force.actionPoints <= 0
              }"
              @click="toggleForceSelection(force.forceId)"
            >
              <div class="column id-column">{{ getForceNumber(force.forceId) }}</div>
              <div class="column name-column" :title="force.forceName">{{ force.forceName }}</div>
              <div class="column strength-column">{{ force.troopStrength }}</div>
              <div class="column action-column">{{ force.actionPoints }}</div>
            </div>
          </div>
        </div>
        <div class="empty-forces" v-else>
          <div class="empty-message">该六角格中没有部队</div>
        </div>
      </div>

      <!-- 右侧：部队详细信息 -->
      <div class="force-detail-section">
        <div class="section-header">
          <h4>{{ selectedForce ? `${selectedForce.forceName} 详细信息` : '部队详细信息' }}</h4>
        </div>
        
        <div class="force-detail-content" v-if="selectedForce">
          <!-- 三栏布局：火力值、属性和兵种组成 -->
          <div class="detail-columns">
            <!-- 第一栏：火力值表格 -->
            <div class="detail-column firepower-column">
              <div class="column-header">火力值</div>
              <table class="firepower-table">
                <thead>
                  <tr class="firepower-header">
                    <th class="col-empty"></th>
                    <th class="col-header">进攻</th>
                    <th class="col-header">防御</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- 陆地火力行 -->
                  <tr class="firepower-row land-row">
                    <td class="row-header">陆</td>
                    <td class="col-value" :title="getFirepowerValue('attack', 'land')">
                      {{ formatNumber(getFirepowerValue('attack', 'land')) }}
                    </td>
                    <td class="col-value" :title="getFirepowerValue('defense', 'land')">
                      {{ formatNumber(getFirepowerValue('defense', 'land')) }}
                    </td>
                  </tr>
                  <!-- 海洋火力行 -->
                  <tr class="firepower-row sea-row">
                    <td class="row-header">海</td>
                    <td class="col-value" :title="getFirepowerValue('attack', 'sea')">
                      {{ formatNumber(getFirepowerValue('attack', 'sea')) }}
                    </td>
                    <td class="col-value" :title="getFirepowerValue('defense', 'sea')">
                      {{ formatNumber(getFirepowerValue('defense', 'sea')) }}
                    </td>
                  </tr>
                  <!-- 空中火力行 -->
                  <tr class="firepower-row air-row">
                    <td class="row-header">空</td>
                    <td class="col-value" :title="getFirepowerValue('attack', 'air')">
                      {{ formatNumber(getFirepowerValue('attack', 'air')) }}
                    </td>
                    <td class="col-value" :title="getFirepowerValue('defense', 'air')">
                      {{ formatNumber(getFirepowerValue('defense', 'air')) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 第二栏：部队属性 -->
            <div class="detail-column attributes-column">
              <div class="column-header">属性</div>
              <div class="attr-groups-container">
                <!-- 第一组：战斗机会、士气值 -->
                <div class="attr-group">
                  <div class="attr-row">
                    <span class="attr-label">战斗机会:</span>
                    <span class="attr-value">{{ selectedForce.combatChance }}</span>
                  </div>
                  <div class="attr-row">
                    <span class="attr-label">士气值:</span>
                    <span class="attr-value">{{ selectedForce.morale || 0 }}</span>
                  </div>
                </div>
                
                <div class="attr-divider"></div>
                
                <!-- 第二组：兵力恢复速率、疲劳系数 -->
                <div class="attr-group">
                  <div class="attr-row">
                    <span class="attr-label">恢复速率:</span>
                    <span class="attr-value">{{ selectedForce.recoveryRate || 0 }}</span>
                  </div>
                  <div class="attr-row">
                    <span class="attr-label">疲劳系数:</span>
                    <span class="attr-value">{{ selectedForce.fatigueFactor || 0 }}</span>
                  </div>
                </div>
                
                <div class="attr-divider"></div>
                
                <!-- 第三组：指挥能力、指挥范围、可视范围 -->
                <div class="attr-group">
                  <div class="attr-row">
                    <span class="attr-label">指挥能力:</span>
                    <span class="attr-value">{{ selectedForce.commandCapability || 0 }}</span>
                  </div>
                  <div class="attr-row">
                    <span class="attr-label">指挥范围:</span>
                    <span class="attr-value">{{ selectedForce.commandRange || 0 }}</span>
                  </div>
                  <div class="attr-row">
                    <span class="attr-label">可视范围:</span>
                    <span class="attr-value">{{ selectedForce.visibilityRadius || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 第三栏：兵种组成 -->
            <div class="detail-column composition-column">
              <div class="composition-header">部队组成</div>
              <div class="units-table" v-if="forceUnits.length > 0">
                <div class="units-row header">
                  <div class="unit-type">兵种</div>
                  <div class="unit-count">基数</div>
                </div>
                <div class="units-table-body custom-scrollbar">
                  <div class="units-row" v-for="unit in forceUnits" :key="unit.unitId" 
                      :title="getUnitDetailsTooltip(unit)">
                    <div class="unit-type">{{ unit.name }}</div>
                    <div class="unit-count">{{ unit.count }}</div>
                  </div>
                </div>
              </div>
              <div class="empty-units" v-else>
                <div class="empty-message">未获取到兵种数据</div>
              </div>
            </div>
          </div>
        </div>
        <div class="empty-force" v-else>
          <div class="empty-message">未选中部队</div>
        </div>
      </div>

      <!-- 最右侧：战斗命令按钮栏 -->
      <div class="command-buttons-section">
        <!-- 移动按钮 -->
        <div class="command-button" 
             :class="{
               'disabled': isButtonDisabled(GameButtons.MOVE),
               'cancel': inMoveMode
             }"
             @click="handleMoveButtonClick"
             :title="inMoveMode ? '取消移动' : '移动部队'">
          <img :src="inMoveMode ? '/assets/icons/cancel.png' : '/assets/icons/march.png'" alt="移动" />
        </div>
        
        <!-- 攻击按钮 -->
        <div class="command-button" 
             :class="{
               'disabled': isButtonDisabled(GameButtons.ATTACK),
               'cancel': inAttackMode
             }"
             @click="handleAttackButtonClick"
             :title="inAttackMode ? '取消攻击' : '发起进攻'">
          <img :src="inAttackMode ? '/assets/icons/cancel.png' : '/assets/icons/attack.png'" alt="攻击" />
        </div>
        
        <!-- 部队管理按钮 -->
        <div class="command-button" 
             :class="{'disabled': isButtonDisabled(GameButtons.MANAGE_FORCE)}"
             @click="openForceManagement"
             title="部队管理">
          <img src="/assets/icons/force.png" alt="部队管理" />
        </div>
        
        <!-- 兵种管理按钮 -->
        <div class="command-button" 
             :class="{'disabled': isButtonDisabled(GameButtons.MANAGE_UNIT)}"
             @click="openUnitManagement"
             title="兵种管理">
          <img src="/assets/icons/unit.png" alt="兵种管理" />
        </div>
      </div>
    </div>
  </teleport>
  
  <!-- 使用单独的teleport将确认按钮放在body上 -->
  <teleport to="body">
    <div class="floating-confirm move-confirm" v-if="inMoveMode" @click="executeCommand(CommandType.MOVE)">
      <img src="/assets/icons/confirm.png" alt="确认" />
      <span>发起移动</span>
    </div>
    
    <div class="floating-attack-controls" v-if="inAttackMode">
      <div class="attack-phase-indicator">{{ attackPhaseText }}</div>
      
      <div class="attack-buttons">
        <!-- 第一阶段退出按钮 -->
        <div v-if="attackState.phase === 'selectTarget'" 
             class="attack-button exit-button" 
             @click="handleAttackButtonClick" 
             title="退出攻击模式">
          <img src="/assets/icons/cancel.png" alt="退出" />
          <span>退出攻击</span>
        </div>
        
        <!-- 第二阶段重置按钮 -->
        <div v-if="attackState.phase === 'selectSupport'" 
             class="attack-button reset-button" 
             @click="resetAttackPhase" 
             title="重置选择">
          <img src="/assets/icons/reset.png" alt="重置" />
          <span>重置选择</span>
        </div>
        
        <div class="attack-button confirm-button" 
             :class="{
               'phase-select-target': attackState.phase === 'selectTarget',
               'phase-select-support': attackState.phase === 'selectSupport'
             }"
             @click="handleAttackNextStep" 
             :title="attackButtonTitle">
          <img src="/assets/icons/confirm.png" alt="确认" />
          <span>{{ attackButtonText }}</span>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, watch, ref, onMounted } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showInfo, showSuccess, showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import { CommandType } from '@/config/CommandConfig';
import { GameButtons, GameMode, GamePanels } from '@/config/GameModeConfig';
import { gameModeService } from '@/layers/interaction-layer/GameModeManager';
// import { HexSelectValidator } from '@/layers/interaction-layer/utils/HexSelectValidator';

// 状态管理
const store = openGameStore();

// 检查当前游戏模式下详细信息面板是否应该禁用
const isPanelDisabled = computed(() => {
  return store.isPanelDisabled(GamePanels.DETAIL_INFO_PANEL);
});

// 模式管理
const inMoveMode = ref(false); 
const inAttackMode = ref(false);

// 监听游戏模式变化
watch(() => gameModeService.getCurrentMode(), (newMode) => {
  console.log('游戏模式变化:', newMode);
  inMoveMode.value = newMode === GameMode.MOVE_PREPARE;
  inAttackMode.value = newMode === GameMode.ATTACK_PREPARE;
}, { immediate: true });

// 初始化模式状态
onMounted(() => {
  const currentMode = gameModeService.getCurrentMode();
  inMoveMode.value = currentMode === GameMode.MOVE_PREPARE;
  inAttackMode.value = currentMode === GameMode.ATTACK_PREPARE;
});

// 计算属性：获取所选六角格信息
const selectedHex = computed(() => {
  // 获取最后一个选中的六角格
  const hexIds = Array.from(store.selectedHexIds);
  if (hexIds.length === 0) return null;
  
  return store.getHexCellById(hexIds[hexIds.length - 1]);
});

// 计算属性：获取六角格中心点
const selectedHexCenter = computed(() => {
  if (!selectedHex.value || !selectedHex.value.position || !selectedHex.value.position.points || selectedHex.value.position.points.length === 0) {
    return null;
  }
  return selectedHex.value.position.points[0];
});

// 计算属性：获取六角格中的部队
const hexForces = computed(() => {
  if (!selectedHex.value) return [];
  
  const forces = [];
  const forceIds = selectedHex.value.forcesIds || [];
  
  forceIds.forEach(forceId => {
    const force = store.getForceById(forceId);
    if (force) forces.push(force);
  });
  
  // 按兵力值排序
  return forces.sort((a, b) => b.troopStrength - a.troopStrength);
});

// 计算属性：获取当前选中的部队
const selectedForce = computed(() => {
  const forceIds = Array.from(store.selectedForceIds);
  if (forceIds.length === 0) return null;
  
  // 获取最后一个选中的部队
  return store.getForceById(forceIds[forceIds.length - 1]);
});

// 计算属性：获取当前选中部队的兵种组成
const forceUnits = computed(() => {
  if (!selectedForce.value || !selectedForce.value.composition) return [];
  
  const units = [];
  
  // 处理部队组成数据结构
  for (const comp of selectedForce.value.composition) {
    if (comp && comp.unitId) {
      const unit = store.getUnitById(comp.unitId);
      if (unit) {
        units.push({
          unitId: comp.unitId,
          name: unit.unitName || '未知兵种',
          count: comp.unitCount || 0
        });
      }
    }
  }
  
  return units;
});

// 辅助函数：获取部队编号（去除F_前缀）
function getForceNumber(forceId) {
  if (!forceId) return '';
  return forceId.replace('F_', '');
}

// 辅助函数：判断部队是否被选中
function isForceSelected(forceId) {
  return store.selectedForceIds.has(forceId);
}

// 辅助函数：切换部队选择状态
function toggleForceSelection(forceId) {
  if (isForceSelected(forceId)) {
    store.removeSelectedForceId(forceId);
  } else {
    store.addSelectedForceId(forceId);
  }
}

// 辅助函数：获取地形类型
function getTerrainType(hex) {
  if (!hex || !hex.terrainAttributes) return '未知';
  
  const terrainType = hex.terrainAttributes.terrainType;
  const terrainMap = {
    'plain': '平原',
    'hill': '丘陵',
    'mountain': '山地',
    'water': '水域'
  };
  
  return terrainMap[terrainType] || terrainType || '未知';
}

// 辅助函数：获取可通行军种
function getPassableTypes(hex) {
  if (!hex || !hex.terrainAttributes || !hex.terrainAttributes.passability) return '无';
  
  const passability = hex.terrainAttributes.passability;
  const types = [];
  
  if (passability.land) types.push('陆军');
  if (passability.naval) types.push('海军');
  if (passability.air) types.push('空军');
  
  return types.length > 0 ? types.join('、') : '无';
}

// 格式化大数字，使用m表示百万级，b表示十亿级
function formatNumber(num) {
  if (!num || isNaN(num)) return '0';
  
  // 转为数字确保格式化正确
  num = Number(num);
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'b';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'm';
  } else {
    // 百万以下数字精确显示
    return String(num);
  }
}

// 辅助函数：获取火力值
function getFirepowerValue(type, dimension) {
  if (!selectedForce.value) return 'N/A';
  
  try {
    // 进攻火力值获取
    if (type === 'attack') {
      if (!selectedForce.value.attackFirepower) return '0';
      
      // 从字符串解析或直接获取对象
      let attackData;
      if (typeof selectedForce.value.attackFirepower === 'string') {
        try {
          attackData = JSON.parse(selectedForce.value.attackFirepower);
        } catch (e) {
          return '0';
        }
      } else if (typeof selectedForce.value.attackFirepower === 'object') {
        attackData = selectedForce.value.attackFirepower;
      }
      
      // 返回格式化后的值
      if (dimension === 'land') return attackData?.land || 0;
      if (dimension === 'sea') return attackData?.sea || 0;
      if (dimension === 'air') return attackData?.air || 0;
    }
    
    // 防御火力值获取
    if (type === 'defense') {
      if (!selectedForce.value.defenseFirepower) return '0';
      
      // 从字符串解析或直接获取对象
      let defenseData;
      if (typeof selectedForce.value.defenseFirepower === 'string') {
        try {
          defenseData = JSON.parse(selectedForce.value.defenseFirepower);
        } catch (e) {
          return '0';
        }
      } else if (typeof selectedForce.value.defenseFirepower === 'object') {
        defenseData = selectedForce.value.defenseFirepower;
      }
      
      // 返回格式化后的值
      if (dimension === 'land') return defenseData?.land || 0;
      if (dimension === 'sea') return defenseData?.sea || 0;
      if (dimension === 'air') return defenseData?.air || 0;
    }
    
    return '0';
  } catch (error) {
    console.error('获取火力值出错:', error);
    return 'Error';
  }
}

// 辅助函数：获取阵营名称
function getFactionName(faction) {
  if (!faction || faction === 'neutral') return '中立';
  return faction === 'blue' ? '蓝方' : '红方';
}

// 按钮禁用状态检查
function isButtonDisabled(buttonType) {
  // 如果正处于移动/进攻准备模式，则相应的按钮可用
  if ((inMoveMode.value && buttonType === GameButtons.MOVE) || 
      (inAttackMode.value && buttonType === GameButtons.ATTACK)) {
    return false;
  }

  // 没有选中部队，或者选中的是敌方部队时禁用移动和进攻按钮
  if (buttonType === GameButtons.MOVE || buttonType === GameButtons.ATTACK) {
    if (!selectedForce.value || selectedForce.value.faction !== store.currentFaction) {
      return true;
    }
  }

  // 战斗机会小于等于0时禁用进攻按钮
  if (buttonType === GameButtons.ATTACK) {
    if (selectedForce.value && selectedForce.value.combatChance <= 0) {
      return true;
    }
  }

  // 行动力小于等于0时禁用移动按钮
  if (buttonType === GameButtons.MOVE) {
    if (selectedForce.value && selectedForce.value.actionPoints <= 0) {
      return true;
    }
  }

  // 没有选中六角格，或者选中的六角格是敌方阵营时禁用创建部队按钮
  if (buttonType === GameButtons.MANAGE_FORCE) {
    if (!selectedHex.value || (selectedHex.value.battlefieldState.controlFaction !== store.currentFaction && selectedHex.value.battlefieldState.controlFaction !== 'neutral')) {
      return true;
    }
  }

  // 命令执行中禁用所有按钮
  if (store.isExecuting) {
    return true;
  }

  // 游戏模式禁用的按钮
  if (store.disabledButtons.has(buttonType)) {
    return true;
  }

  return false;
}

// 处理移动按钮点击
function handleMoveButtonClick() {
  if (inMoveMode.value) {
    showInfo('退出移动准备');
    // 已经在移动准备模式，点击取消
    executeCommand(CommandType.MOVE_PREPARE);
  } else {
    showInfo('进入移动准备');
    // 进入移动准备模式
    executeCommand(CommandType.MOVE_PREPARE);
  }
}

// 处理攻击按钮点击
function handleAttackButtonClick() {
  if (inAttackMode.value) {
    showInfo('退出攻击准备');
    // 已经在攻击准备模式，点击取消
    executeCommand(CommandType.ATTACK_PREPARE);
  } else {
    showInfo('进入攻击准备');
    // 进入攻击准备模式
    executeCommand(CommandType.ATTACK_PREPARE);
  }
}

// 打开部队管理模态框
function openForceManagement() {
  if (isButtonDisabled(GameButtons.MANAGE_FORCE)) {
    return;
  }
  
  // 设置军事管理面板的选项卡为"部队管理"，并显示面板
  store.setActiveMilitaryTab('force');
  store.showPanel(GamePanels.MILITARY_MANAGE_PANEL);
}

// 打开兵种管理模态框
function openUnitManagement() {
  if (isButtonDisabled(GameButtons.MANAGE_UNIT)) {
    return;
  }
  
  // 设置军事管理面板的选项卡为"兵种管理"，并显示面板
  store.setActiveMilitaryTab('unit');
  store.showPanel(GamePanels.MILITARY_MANAGE_PANEL);
}

// 计算属性：获取攻击按钮文本
const attackButtonText = computed(() => {
  const attackState = store.attackState;
  if (!attackState.phase) return '选择目标';
  
  if (attackState.phase === 'selectTarget') {
    return '锁定目标';
  } else if (attackState.phase === 'selectSupport') {
    return '发起攻击';
  }
  
  return '选择目标';
});

// 计算属性：获取攻击按钮提示文本
const attackButtonTitle = computed(() => {
  const attackState = store.attackState;
  if (!attackState.phase) return '选择敌方目标六角格';
  
  if (attackState.phase === 'selectTarget') {
    return '锁定当前选择的敌方目标';
  } else if (attackState.phase === 'selectSupport') {
    return '确认发起攻击';
  }
  
  return '选择敌方目标六角格';
});

// 计算属性：获取攻击阶段状态文本
const attackPhaseText = computed(() => {
  const attackState = store.attackState;
  if (!attackState.phase) return '';
  
  if (attackState.phase === 'selectTarget') {
    return '第一阶段：选择敌方目标';
  } else if (attackState.phase === 'selectSupport') {
    return '第二阶段：选择支援部队';
  }
  
  return '';
});

// 重置攻击阶段
function resetAttackPhase() {
  // 在攻击准备模式下重置攻击状态
  if (inAttackMode.value) {
    const attackState = store.attackState;
    
    // 第二阶段：清空选中的支援部队，返回到选择目标阶段
    if (attackState.phase === 'selectSupport') {
      // 获取指挥部队
      const commandForce = store.getForceById(attackState.commandForceId);
      if (!commandForce) return;
      
      // 清空锁定和选中的六角格和部队
      store.clearLockedSelection();
      store.clearSelectedHexIds();
      store.clearSelectedForceIds();
      
      // 回到选择目标阶段
      attackState.phase = 'selectTarget';
      
      // 清空敌方指挥部队和支援部队
      attackState.enemyCommandForceId = null;
      attackState.enemySupportForceIds = [];
      showInfo('重新选择敌方目标');

      // // 手动触发战斗群预览更新
      // try {
      //   const validator = HexSelectValidator.getInstance();
      //   validator.previewBattlegroups(commandForce, null);
      // } catch (error) {
      //   console.error('无法更新战斗群预览:', error);
      // }
    }
  }
}

// 进入支援部队选择阶段
function enterSupportSelectionPhase() {
  const attackState = store.attackState;
  
  // 获取敌方部队所在六角格
  const enemyForce = store.getForceById(attackState.enemyCommandForceId);
  if (!enemyForce) {
    showWarning('无法获取敌方指挥部队信息');
    return;
  }
  
  // 获取指挥部队
  const commandForce = store.getForceById(attackState.commandForceId);
  if (!commandForce) {
    showWarning('无法获取指挥部队信息');
    return;
  }
  
  // 切换到支援部队选择阶段
  attackState.phase = 'selectSupport';

  // 将友方指挥部队及所在六角格锁定高亮
  store.setSelectedHexIds([commandForce.hexId]);
  store.setLockedSelection([commandForce.hexId]);
}

// 处理攻击下一步
function handleAttackNextStep() {
  const attackState = store.attackState;
  
  // 如果没有攻击状态或者不在攻击模式，不处理
  if (!attackState.phase || !inAttackMode.value) {
    return;
  }
  
  // 根据当前阶段执行不同操作
  if (attackState.phase === 'selectTarget') {
    // 第一阶段：检查是否已选择敌方指挥部队
    if (attackState.enemyCommandForceId) {
      // 进入支援部队选择阶段
      enterSupportSelectionPhase();
      showSuccess('已锁定敌方目标，请选择参战部队');
    } else {
      // 还没选择目标，提示用户选择
      showWarning('请先选择一个敌方六角格作为攻击目标');
    }
  } else if (attackState.phase === 'selectSupport') {
    // 第二阶段：已选择目标六角格，执行攻击命令
    executeAttackCommand();
  }
}

// 执行攻击命令
function executeAttackCommand() {
  const attackState = store.attackState;
  
  // 检查是否有敌方指挥部队
  if (!attackState.enemyCommandForceId) {
    showWarning('请先选择一个敌方六角格作为攻击目标');
    return;
  }
  
  // 获取敌方指挥部队所在的六角格作为目标
  const enemyForce = store.getForceById(attackState.enemyCommandForceId);
  if (!enemyForce) {
    showWarning('无法获取敌方指挥部队信息');
    return;
  }

  showSuccess('开始攻击');
  // console.log(`supportForceIds: ${attackState.supportForceIds}`);
  // console.log(`selectedHexIds: ${store.selectedHexIds}`);
  // console.log(`目标六角格: ${enemyForce.hexId}`);
  
  // 执行攻击命令
  executeCommand(CommandType.ATTACK, {
    commandForceId: attackState.commandForceId,
    targetHexId: enemyForce.hexId,
    supportForceIds: attackState.supportForceIds,
    enemyCommandForceId: attackState.enemyCommandForceId,
    enemySupportForceIds: attackState.enemySupportForceIds
  });
  
  // 清空锁定选择
  store.clearLockedSelection();
  
  // 清空选中的六角格和部队
  store.clearSelectedHexIds();
  store.clearSelectedForceIds();
}

// 执行命令
function executeCommand(commandType, params = {}) {
  console.log('执行命令:', commandType, params);
  
  // 根据命令类型执行对应操作
  switch (commandType) {
    case CommandType.MOVE_PREPARE:
      CommandService.executeCommandFromUI(commandType, params)
        .then(() => {
          console.log('移动准备命令已发送');
        })
        .catch(error => {
          console.error('移动准备失败:', error);
          showWarning(`无法准备移动: ${error.message}`);
        });
      break;
      
    case CommandType.ATTACK_PREPARE:
      CommandService.executeCommandFromUI(commandType, params)
        .then(() => {
          console.log('攻击准备命令已发送');
        })
        .catch(error => {
          console.error('攻击准备失败:', error);
          showWarning(`无法准备攻击: ${error.message}`);
        });
      break;
      
    case CommandType.MOVE: {
      // 移动命令需要路径参数
      if (!store.selectedHexIds || store.selectedHexIds.size < 2) {
        showWarning('请先选择移动路径');
        return;
      }
      
      // 提取选中的六角格作为路径
      const path = Array.from(store.selectedHexIds);
      console.log('执行移动，路径:', path);

      // 移动的部队id应为第一个选中的部队
      const forceId = Array.from(store.selectedForceIds)[0];
      
      CommandService.executeCommandFromUI(commandType, { 
        forceId: forceId,
        path: path
      }).then(() => {
        console.log('移动命令已执行');
        inMoveMode.value = false; // 执行完成后重置模式
      }).catch(error => {
        console.error('移动失败:', error);
        showWarning(`无法执行移动: ${error.message}`);
      });
      break;
    }
      
    case CommandType.ATTACK: {
      // 检查参数是否完整
      if (!params.commandForceId || !params.targetHexId) {
        showWarning('攻击参数不完整');
        return;
      }
      console.log(`执行攻击命令: ${commandType}, params: ${JSON.stringify(params)}`);
      
      CommandService.executeCommandFromUI(commandType, params)
      .then(() => {
        console.log('攻击命令已执行');
        inAttackMode.value = false; // 执行完成后重置模式
      }).catch(error => {
        console.error('攻击失败:', error);
        showWarning(`无法执行攻击: ${error.message}`);
      });
      break;
    }
  }
}

// 监听选中六角格变化，当没有选中六角格时清空部队选择
watch(() => store.selectedHexIds.size, (newSize) => {
  if (newSize === 0) {
    store.clearSelectedForceIds();
  }
});

// 添加getUnitDetailsTooltip函数
function getUnitDetailsTooltip(unit) {
  if (!unit || !unit.unitId) return '';
  
  const unitObj = store.getUnitById(unit.unitId);
  if (!unitObj) return unit.name;
  
  let tooltip = `${unitObj.unitName || '未知兵种'}\n`;
  tooltip += `军种: ${serviceMap[unitObj.service] || '未知'}\n`;
  tooltip += `类型: ${unitObj.category || '未知'}\n`;
  
  const attackPower = unitObj.getAttackPower();
  const defensePower = unitObj.getDefensePower();
  if (unitObj.attackPowerComposition) {
    tooltip += `攻击力(陆/海/空): ${attackPower.land || 0}/${attackPower.sea || 0}/${attackPower.air || 0}\n`;
  }
  
  if (unitObj.defensePowerComposition) {
    tooltip += `防御力(陆/海/空): ${defensePower.land || 0}/${defensePower.sea || 0}/${defensePower.air || 0}\n`;
  }

  tooltip += `在该格的行动力消耗: ${unitObj.getActionPointCost() || 0}\n`;
  tooltip += `恢复速率: ${unitObj.recoveryRate || 0}\n`;
  tooltip += `指挥能力: ${unitObj.commandCapability || 0}\n`;
  tooltip += `指挥范围: ${unitObj.commandRange || 0}\n`;
  tooltip += `可视范围: ${unitObj.visibilityRadius || 0}\n`;
  
  return tooltip;
}

// 军种名称映射
const serviceMap = {
  'land': '陆军',
  'sea': '海军',
  'air': '空军'
}

// 添加攻击状态的访问
const attackState = computed(() => store.attackState);
</script>

<style scoped>
.detail-info-panel {
  display: flex;
  width: auto;
  min-width: 1000px;
  max-width: 1200px;
  height: 220px;
  background-color: rgba(169, 140, 102, 0.9);
  color: #f0f0f0;
  border: 6px solid rgba(80, 60, 40, 0.8);
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  position: fixed;
  left: 50%;
  bottom: 0px;
  transform: translateX(-50%);
  z-index: 101;
  overflow: hidden;
}

.detail-info-panel.disabled {
  pointer-events: none;
  filter: grayscale(50%);
}

/* 太窄了就隐藏面板 */
@media screen and (max-width: 1280px) {
  .detail-info-panel {
    display: none;
  }
}

/* 公共样式 */
.section-header {
  background-color: rgba(80, 60, 40, 0.5);
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.section-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  color: #f0eadd;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

.empty-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

/* 六角格详细信息区 */
.hex-info-section {
  width: 220px;
  flex-shrink: 0;
  height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.info-content {
  padding: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  font-size: 12px;
}

.info-row {
  display: flex;
  margin-bottom: 3px;
}

.info-label {
  width: 80px;
  color: rgba(255, 255, 255, 0.7);
}

.info-value {
  flex: 1;
}

.faction-blue {
  color: #4a90e2;
}

.faction-red {
  color: #e24a4a;
}

.faction-neutral {
  color: #ccc;
}

/* 六角格部队列表区 */
.hex-forces-section {
  flex: 1;
  min-width: 280px;
  max-width: none;
  height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.forces-table {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  height: calc(100% - 30px);
  overflow: hidden;
}

.forces-table-header {
  display: flex;
  background-color: rgba(0, 0, 0, 0.3);
  font-weight: bold;
  padding: 6px 0;
  position: sticky;
  top: 0;
  z-index: 1;
}

.forces-table-body {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100% - 30px);
  box-sizing: border-box;
  padding-right: 0;
  margin-right: 0;
}

.forces-table-row {
  display: flex;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background-color 0.2s;
}

.forces-table-row:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.forces-table-row.selected-row {
  background-color: rgba(74, 144, 226, 0.3);
}

.forces-table-row.disabled-row {
  background-color: rgba(255, 255, 255, 0.1);
  opacity: 0.5;
}

.column {
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.id-column {
  width: 25px;
}

.name-column {
  flex: 1;
}

.strength-column {
  width: 25px;
}

.action-column {
  width: 40px;
}

.empty-forces {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100% - 30px);
  border-radius: 3px;
}

/* 部队详细信息区 */
.force-detail-section {
  width: 450px;
  flex-shrink: 0;
  height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-force {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.force-detail-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.detail-columns {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
  width: 100%;
}

.detail-column {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  padding: 5px;
  box-sizing: border-box;
}

.firepower-column {
  flex: 0 0 40%;
  width: 40%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.attributes-column {
  flex: 0 0 30%;
  width: 30%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.composition-column {
  flex: 0 0 30%;
  width: 30%;
  overflow-y: auto;
}

.firepower-table {
  width: 100%;
  height: calc(100% - 26px);
  border-collapse: collapse;
  table-layout: fixed;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  margin: 0;
}

.firepower-header {
  background-color: rgba(0, 0, 0, 0.2);
  height: 20px;
}

.land-row, .sea-row, .air-row {
  height: calc((100% - 20px) / 3);
}

.land-row {
  background-color: rgba(74, 226, 74, 0.15); /* 陆地绿色 */
}

.sea-row {
  background-color: rgba(74, 144, 226, 0.15); /* 海洋蓝色 */
}

.air-row {
  background-color: rgba(226, 74, 74, 0.15); /* 空中红色 */
}

.firepower-row td {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.attr-groups-container {
  justify-content: center;
  height: calc(100% - 26px);
  width: 100%;
  padding: 6px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  box-sizing: border-box;
}

.attr-group {
  margin: 0 0 3px 0;
  padding: 0;
  width: 100%;
  box-sizing: border-box;
}

.attr-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.15);
  margin: 3px 0;
  display: block;
  width: 100%;
}

.attr-row {
  display: flex;
  margin-bottom: 2px;
  height: 15px;
  line-height: 15px;
  width: 100%;
  box-sizing: border-box;
}

.attr-label {
  min-width: 60px;
  max-width: 60px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attr-value {
  flex: 1;
  font-size: 11px;
  text-align: right;
  padding-right: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.column-header, .composition-header {
  font-weight: bold;
  background-color: rgba(80, 60, 40, 0.4);
  padding: 4px 8px;
  border-radius: 3px;
  margin-bottom: 4px;
  text-align: center;
  font-size: 13px;
  color: #f0eadd;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
  width: 100%;
  box-sizing: border-box;
}

.units-table {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  height: calc(100% - 26px);
}

.units-table-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 0;
  margin-right: 0;
}

.units-row {
  display: flex;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  width: 100%;
}

.units-row:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.units-row.header {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.2);
  position: sticky;
  top: 0;
  z-index: 1;
}

.unit-type {
  flex: 1;
  padding-left: 8px;
  padding-right: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  box-sizing: border-box;
}

.unit-count {
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  text-align: right;
  padding-right: 8px;
  font-size: 11px;
  box-sizing: border-box;
  overflow: visible;
}

/* 命令按钮区 */
.command-buttons-section {
  width: 50px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.command-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(251, 233, 184, 0.915);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  margin: 7px 0;
}

.command-button:hover {
  background-color: rgba(251, 233, 184, 0.6);
  transform: scale(1.1);
}

.command-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.command-button.cancel {
  background-color: rgba(255, 200, 21, 0.8);
}

.command-button img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* 悬浮确认按钮 */
.floating-confirm {
  position: fixed;
  display: flex;
  align-items: center;
  background-color: rgba(60, 179, 113, 0.9);
  border-radius: 16px;
  padding: 8px 12px 8px 10px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  white-space: nowrap;
  border: 2px solid rgba(255, 255, 255, 0.7);
  bottom: 420px;
  right: 20px;
}

.floating-confirm:hover {
  background-color: rgba(60, 179, 113, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  transform: translateY(-2px);
}

.floating-confirm img {
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.floating-confirm span {
  font-size: 14px;
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 0;
  display: none;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: transparent;
}

::-webkit-scrollbar-thumb:hover {
  background: transparent;
}

/* 自定义滚动条样式 */
.custom-scrollbar {
  scrollbar-width: none; /* 针对Firefox */
  -ms-overflow-style: none; /* 针对IE和Edge */
  padding-right: 0;
  margin-right: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 0; /* 对Webkit浏览器隐藏滚动条 */
  display: none; /* 完全隐藏滚动条 */
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: transparent;
}

.col-empty, .col-header, .row-header {
  text-align: center;
  font-weight: bold;
  font-size: 12px;
  padding: 6px 4px;
  color: rgba(255, 255, 255, 0.9);
}

.row-header {
  width: 20px;
  padding: 6px 2px;
}

.col-empty {
  width: 20px;
}

.col-header {
  width: calc(50% - 10px);
}

.col-value {
  text-align: center;
  font-size: 12px;
  padding: 2px 2px;
  color: rgba(255, 255, 255, 0.85);
}

.empty-units {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100% - 26px);
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

/* 攻击控制按钮 */
.floating-attack-controls {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1000;
  bottom: 420px;
  right: 20px;
  gap: 8px;
}

.attack-phase-indicator {
  background-color: rgba(30, 30, 30, 0.8);
  color: white;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-weight: bold;
}

.attack-buttons {
  display: flex;
  gap: 12px;
}

.attack-button {
  display: flex;
  align-items: center;
  padding: 8px 12px 8px 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.reset-button {
  background-color: rgba(180, 180, 180, 0.9);
}

.reset-button:hover {
  background-color: rgba(180, 180, 180, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  transform: translateY(-2px);
}

.exit-button {
  background-color: rgba(204, 85, 85, 0.9);
}

.exit-button:hover {
  background-color: rgba(204, 85, 85, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  transform: translateY(-2px);
}

/* 第一阶段锁定按钮样式（黄色） */
.attack-button.confirm-button.phase-select-target {
  background-color: rgba(255, 193, 7, 0.9);
}

.attack-button.confirm-button.phase-select-target:hover {
  background-color: rgba(255, 193, 7, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  transform: translateY(-2px);
}

/* 第二阶段确认按钮样式（红色） */
.attack-button.confirm-button.phase-select-support {
  background-color: rgba(204, 0, 0, 0.9);
}

.attack-button.confirm-button.phase-select-support:hover {
  background-color: rgba(204, 0, 0, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  transform: translateY(-2px);
}

.attack-button img {
  width: 24px;
  height: 24px;
  margin-right: 8px;
}

.attack-button span {
  font-size: 14px;
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
</style>
