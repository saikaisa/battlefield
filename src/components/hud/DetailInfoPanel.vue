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
            <div class="column name-column">{{ force.forceName }}</div>
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
        <h4>部队详细信息</h4>
      </div>
      
      <div class="force-detail-tabs" v-if="selectedForce">
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
            <span class="attr-value">{{ selectedForce.attackFirepower || 0 }} / {{ selectedForce.defenseFirepower || 0 }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">兵力回复速率:</span>
            <span class="attr-value">{{ selectedForce.recoveryRate || 0 }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">士气值:</span>
            <span class="attr-value">{{ selectedForce.morale || 0 }}</span>
          </div>
          <div class="attr-row">
            <span class="attr-label">疲劳系数:</span>
            <span class="attr-value">{{ selectedForce.fatigueFactor || 0 }}</span>
          </div>
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
      <div class="empty-force" v-else>
        <div class="empty-message">未选中部队</div>
      </div>
    </div>

    <!-- 最右侧：战斗命令按钮栏 -->
    <div class="command-buttons-section">
      <div class="command-button move-button" 
           :class="{'disabled': isButtonDisabled('MOVE')}"
           @click="executeCommand('MOVE')">
        <el-tooltip content="移动部队" placement="left">
          <i class="el-icon-position"></i>
        </el-tooltip>
      </div>
      <div class="command-button attack-button" 
           :class="{'disabled': isButtonDisabled('ATTACK')}"
           @click="executeCommand('ATTACK')">
        <el-tooltip content="进攻" placement="left">
          <i class="el-icon-aim"></i>
        </el-tooltip>
      </div>
      <div class="command-button force-manage-button" 
           :class="{'disabled': isButtonDisabled('MANAGE_FORCE')}"
           @click="executeCommand('MANAGE_FORCE')">
        <el-tooltip content="部队管理" placement="left">
          <i class="el-icon-data-analysis"></i>
        </el-tooltip>
      </div>
      <div class="command-button unit-manage-button" 
           :class="{'disabled': isButtonDisabled('MANAGE_UNIT')}"
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
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';

// 状态管理
const store = openGameStore();
const activeTab = ref('attributes'); // 默认显示属性标签

// 计算属性：获取所选六角格信息
const selectedHex = computed(() => {
  // 获取第一个选中的六角格
  const hexIds = Array.from(store.selectedHexIds);
  if (hexIds.length === 0) return null;
  
  const hex = store.getHexCellById(hexIds[0]);
  return hex;
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
  
  // 获取第一个选中的部队
  return store.getForceById(forceIds[0]);
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
  if (store.selectedForceIds.has(forceId)) {
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
  if (!hex || !hex.terrainAttributes) return '无';
  
  const terrainType = hex.terrainAttributes.terrainType;
  
  if (terrainType === 'water') {
    return '海军';
  } else if (terrainType === 'mountain') {
    return '空军';
  } else if (terrainType === 'hill' || terrainType === 'plain') {
    return '陆军、空军';
  }
  
  return '未知';
}

// 辅助函数：获取阵营名称
function getFactionName(faction) {
  if (!faction || faction === 'neutral') return '中立';
  return faction === 'blue' ? '蓝方' : '红方';
}

// 按钮禁用状态检查
function isButtonDisabled(commandType) {
  // 没有选中部队时禁用所有部队相关按钮
  if (!selectedForce.value) {
    return true;
  }
  
  // 如果部队不属于当前玩家阵营，禁用按钮
  if (selectedForce.value.faction !== store.currentFaction) {
    return true;
  }
  
  // 命令执行中禁用所有按钮
  if (store.isExecuting) {
    return true;
  }
  
  // MOVE按钮特殊处理：检查部队是否有行动点数
  if (commandType === 'MOVE' && selectedForce.value.actionPoints <= 0) {
    return true;
  }
  
  // ATTACK按钮特殊处理：检查部队是否有战斗机会
  if (commandType === 'ATTACK' && selectedForce.value.combatChance <= 0) {
    return true;
  }
  
  return false;
}

// 执行命令
function executeCommand(commandType) {
  // 检查按钮是否被禁用
  if (isButtonDisabled(commandType)) {
    return;
  }
  
  switch (commandType) {
    case 'MOVE':
      CommandService.executeCommandFromUI('MOVE_PREPARE', { 
        forceId: selectedForce.value.forceId 
      }).catch(error => {
        showWarning(`无法准备移动: ${error.message}`);
      });
      break;
    case 'ATTACK':
      CommandService.executeCommandFromUI('ATTACK_PREPARE', { 
        forceId: selectedForce.value.forceId 
      }).catch(error => {
        showWarning(`无法准备攻击: ${error.message}`);
      });
      break;
    case 'MANAGE_FORCE':
      // 打开部队管理面板
      // 此处仅为示例，实际实现可能需要根据项目需求调整
      showWarning('部队管理功能尚未实现');
      break;
    case 'MANAGE_UNIT':
      // 打开兵种管理面板
      // 此处仅为示例，实际实现可能需要根据项目需求调整
      showWarning('兵种管理功能尚未实现');
      break;
  }
}

// 监听选中六角格变化，当没有选中六角格时清空部队选择
watch(() => store.selectedHexIds.size, (newSize) => {
  if (newSize === 0) {
    store.clearSelectedForceIds();
  }
});
</script>

<style scoped>
.detail-info-panel {
  display: flex;
  width: 100%;
  height: 240px;
  background-color: rgba(169, 140, 102, 0.9);
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

.empty-forces {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
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
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
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

.units-table-body {
  max-height: 180px;
  overflow-y: auto;
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

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
