<!-- src\components\hud\DetailInfoPanel.vue
  底部详细信息栏，包括：
  - 六角格详细信息
  - 六角格部队列表
  - 部队详细信息
-->
<template>
  <div class="detail-info-panel">
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
          <span class="info-value">({{ selectedHex.latitude.toFixed(3) }}°, {{ selectedHex.longitude.toFixed(3) }}°)</span>
        </div>
        <div class="info-row">
          <span class="info-label">地形高度:</span>
          <span class="info-value">{{ getTerrainType(selectedHex) }} ({{ selectedHex.elevation.toFixed(2) }}m)</span>
        </div>
        <div class="info-row">
          <span class="info-label">可通行军种:</span>
          <span class="info-value">{{ getPassableTypes(selectedHex) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">隶属方:</span>
          <span class="info-value" :class="`faction-${selectedHex.controlFaction || 'neutral'}`">
            {{ getFactionName(selectedHex.controlFaction) }} 
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
        <h4>六角格部队列表</h4>
      </div>
      <div class="forces-table" v-if="hexForces.length > 0">
        <div class="forces-table-header">
          <div class="column id-column">编号</div>
          <div class="column name-column">名称</div>
          <div class="column strength-column">兵力</div>
          <div class="column action-column">行动力</div>
        </div>
        <div class="forces-table-body">
          <div 
            v-for="force in hexForces" 
            :key="force.forceId"
            class="forces-table-row"
            :class="{'selected-row': isForceSelected(force.forceId)}"
            @click="toggleForceSelection(force.forceId)"
          >
            <div class="column id-column">{{ getForceNumber(force.forceId) }}</div>
            <div class="column name-column">{{ force.name }}</div>
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
    <div class="force-detail-section" v-if="selectedForce">
      <div class="section-header">
        <h4>部队详细信息</h4>
      </div>
      
      <div class="force-detail-tabs">
        <!-- 标签切换 -->
        <div class="tabs-header">
          <div 
            class="tab-item" 
            :class="{'active': activeTab === 'attributes'}"
            @click="activeTab = 'attributes'"
          >
            属性
          </div>
          <div 
            class="tab-item"
            :class="{'active': activeTab === 'composition'}"
            @click="activeTab = 'composition'"
          >
            兵种组成
          </div>
        </div>
        
        <!-- 属性标签内容 -->
        <div class="tab-content attributes-content" v-show="activeTab === 'attributes'">
          <div class="attr-row">
            <span class="attr-label">战斗机会数:</span>
            <span class="attr-value">{{ selectedForce.combatChance }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">进攻/防御火力值:</span>
            <span class="attr-value">{{ selectedForce.offensivePower }} / {{ selectedForce.defensivePower }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">兵力回复速率:</span>
            <span class="attr-value">{{ selectedForce.recoveryRate }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">士气值:</span>
            <span class="attr-value">{{ selectedForce.morale }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">疲劳系数:</span>
            <span class="attr-value">{{ selectedForce.fatigue }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">指挥能力:</span>
            <span class="attr-value">{{ selectedForce.commandPower }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">指挥范围:</span>
            <span class="attr-value">{{ selectedForce.commandRange }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">可视范围:</span>
            <span class="attr-value">{{ selectedForce.visibilityRange }}</span>
          </div>
        </div>
        
        <!-- 兵种组成标签内容 -->
        <div class="tab-content composition-content" v-show="activeTab === 'composition'">
          <div class="units-table" v-if="forceUnits.length > 0">
            <div class="units-row header">
              <div class="unit-type">兵种</div>
              <div class="unit-count">数量</div>
            </div>
            <div class="units-table-body">
              <div class="units-row" v-for="unit in forceUnits" :key="unit.unitId">
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
    <div class="force-detail-section empty-force" v-else>
      <div class="section-header">
        <h4>部队详细信息</h4>
      </div>
      <div class="empty-message">未选中部队</div>
    </div>

    <!-- 最右侧：战斗命令按钮栏 -->
    <div class="command-buttons-section">
      <div class="command-button move-button" 
           :class="{'disabled': isButtonDisabled(GameButtons.MOVE)}"
           @click="executeCommand('MOVE')">
        <el-tooltip content="移动部队" placement="left">
          <i class="el-icon-position"></i>
        </el-tooltip>
      </div>
      <div class="command-button attack-button" 
           :class="{'disabled': isButtonDisabled(GameButtons.ATTACK)}"
           @click="executeCommand('ATTACK')">
        <el-tooltip content="进攻" placement="left">
          <i class="el-icon-aim"></i>
        </el-tooltip>
      </div>
      <div class="command-button force-manage-button" 
           :class="{'disabled': isButtonDisabled(GameButtons.MANAGE_FORCE)}"
           @click="executeCommand('MANAGE_FORCE')">
        <el-tooltip content="部队管理" placement="left">
          <i class="el-icon-data-analysis"></i>
        </el-tooltip>
      </div>
      <div class="command-button unit-manage-button" 
           :class="{'disabled': isButtonDisabled(GameButtons.MANAGE_UNIT)}"
           @click="executeCommand('MANAGE_UNIT')">
        <el-tooltip content="兵种管理" placement="left">
          <i class="el-icon-edit-outline"></i>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { GameMode, GameButtons } from '@/config/GameModeConfig';
import { RuleConfig } from '@/config/GameConfig';
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';

// 状态管理
const store = openGameStore();
const activeTab = ref('attributes'); // 默认显示属性标签

// 计算属性：获取所选六角格信息
const selectedHex = computed(() => {
  // 获取第一个选中的六角格
  const hexIds = Array.from(store.selectedHexIds);
  if (hexIds.length === 0) return null;
  return store.getHexCellById(hexIds[0]);
});

// 计算属性：获取六角格中的部队
const hexForces = computed(() => {
  if (!selectedHex.value) return [];
  
  const forces = [];
  if (selectedHex.value.forcesIds) {
    selectedHex.value.forcesIds.forEach(forceId => {
      const force = store.getForceById(forceId);
      if (force) forces.push(force);
    });
  }
  
  // 按战斗力排序
  return forces.sort((a, b) => b.troopStrength - a.troopStrength);
});

// 计算属性：获取当前选中的部队
const selectedForce = computed(() => {
  const forceIds = Array.from(store.selectedForceIds);
  if (forceIds.length === 0) return null;
  return store.getForceById(forceIds[0]);
});

// 计算属性：当前选中部队的兵种组成
const forceUnits = computed(() => {
  if (!selectedForce.value) return [];
  
  const units = [];
  const composition = selectedForce.value.composition;
  if (!composition) return [];
  
  // 解析兵种组成 (unitId: count)
  Object.entries(composition).forEach(([unitId, count]) => {
    const unit = store.getUnitById(unitId);
    if (unit) {
      units.push({
        unitId,
        name: unit.name,
        count
      });
    }
  });
  
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
  if (store.selectedForceIds.has(forceId)) {
    store.removeSelectedForceId(forceId);
  } else {
    store.addSelectedForceId(forceId);
  }
}

// 辅助函数：获取地形类型
function getTerrainType(hex) {
  if (!hex) return '未知';
  
  // 根据高程判断地形类型
  if (hex.elevation < 10) return '平原';
  if (hex.elevation < 50) return '丘陵';
  if (hex.elevation < 200) return '山地';
  return '高山';
}

// 辅助函数：获取可通行军种
function getPassableTypes(hex) {
  if (!hex) return '无';
  
  // 简化处理，假设有passableTypes属性
  if (hex.passableTypes) {
    return hex.passableTypes.join('、');
  }
  
  // 根据海拔判断（简化逻辑）
  if (hex.elevation < 0) return '海军';
  if (hex.elevation < 100) return '陆军、空军';
  return '空军';
}

// 辅助函数：获取阵营名称
function getFactionName(faction) {
  if (!faction) return '中立';
  return RuleConfig.factionNames[faction] || faction;
}

// 按钮禁用状态检查
function isButtonDisabled(buttonId) {
  // 如果在当前游戏模式下被禁用
  if (store.gameMode !== GameMode.FREE && store.disabledButtons.has(buttonId)) {
    return true;
  }
  
  // 没有选中部队时禁用所有部队相关按钮
  const hasSelectedForce = store.selectedForceIds.size > 0;
  if (!hasSelectedForce && 
      (buttonId === GameButtons.MOVE || 
       buttonId === GameButtons.ATTACK || 
       buttonId === GameButtons.MANAGE_FORCE)) {
    return true;
  }
  
  // 命令执行中禁用所有按钮
  if (store.isExecuting) {
    return true;
  }
  
  return false;
}

// 执行命令
function executeCommand(commandType) {
  // 检查按钮是否被禁用
  if (isButtonDisabled(GameButtons[commandType])) {
    return;
  }
  
  if (!selectedForce.value) {
    showWarning('请先选择一个部队');
    return;
  }
  
  switch (commandType) {
    case 'MOVE':
      CommandService.executeCommandFromUI('MOVE_PREPARE', { 
        forceId: selectedForce.value.forceId 
      });
      break;
    case 'ATTACK':
      CommandService.executeCommandFromUI('ATTACK_PREPARE', { 
        forceId: selectedForce.value.forceId 
      });
      break;
    case 'MANAGE_FORCE':
      // 打开部队管理面板
      CommandService.executeCommandFromUI('MANAGE_FORCE', { 
        forceId: selectedForce.value.forceId 
      });
      break;
    case 'MANAGE_UNIT':
      // 打开兵种管理面板
      CommandService.executeCommandFromUI('MANAGE_UNIT', {});
      break;
  }
}

// 监听选中六角格变化
watch(() => store.selectedHexIds, () => {
  // 如果没有选中的六角格，清空部队选择
  if (store.selectedHexIds.size === 0) {
    store.clearSelectedForceIds();
  }
}, { deep: true });
</script>

<style scoped>
.detail-info-panel {
  display: flex;
  width: 100%;
  height: 240px;
  background-color: rgba(158, 133, 98, 0.9);
  color: #f0f0f0;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
}

/* 公共样式 */
.section-header {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: bold;
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
  width: 260px;
  height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.info-content {
  padding: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.info-row {
  display: flex;
  margin-bottom: 5px;
}

.info-label {
  width: 90px;
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
}

.forces-table-header {
  display: flex;
  background-color: rgba(0, 0, 0, 0.3);
  font-weight: bold;
  padding: 8px 0;
}

.forces-table-body {
  flex: 1;
  overflow-y: auto;
}

.forces-table-row {
  display: flex;
  padding: 8px 0;
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

.column {
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-column {
  width: 70px;
}

.name-column {
  flex: 1;
}

.strength-column, .action-column {
  width: 70px;
  text-align: right;
}

/* 部队详细信息区 */
.force-detail-section {
  width: 350px;
  height: 100%;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-force {
  display: flex;
  flex-direction: column;
}

.force-detail-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-item {
  padding: 10px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tab-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tab-item.active {
  border-bottom: 2px solid #4a90e2;
  background-color: rgba(74, 144, 226, 0.1);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.attributes-content {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.attr-row {
  display: flex;
  margin-bottom: 5px;
}

.attr-label {
  width: 140px;
  color: rgba(255, 255, 255, 0.7);
}

.attr-value {
  flex: 1;
}

.units-table {
  width: 100%;
}

.units-row {
  display: flex;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.units-row.header {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.1);
}

.unit-type {
  flex: 1;
  padding: 0 10px;
}

.unit-count {
  width: 60px;
  text-align: right;
  padding: 0 10px;
}

/* 命令按钮区 */
.command-buttons-section {
  width: 60px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding: 10px 0;
}

.command-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.command-button:hover {
  background-color: rgba(0, 0, 0, 0.4);
}

.command-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.command-button i {
  font-size: 20px;
  color: white;
}

.move-button {
  background-color: #4a90e2;
}

.attack-button {
  background-color: #e24a4a;
}

.force-manage-button {
  background-color: #e2a14a;
}

.unit-manage-button {
  background-color: #4ae24a;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .detail-info-panel {
    flex-wrap: wrap;
    height: auto;
    min-height: 240px;
  }
  
  .hex-info-section,
  .force-detail-section {
    width: 50%;
  }
  
  .hex-forces-section {
    width: 100%;
    order: 3;
  }
  
  .command-buttons-section {
    position: absolute;
    right: 0;
    top: 0;
    height: 240px;
  }
}
</style>
