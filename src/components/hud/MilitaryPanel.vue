<template>
  <div class="military-panel">
    <!-- 编队列表 -->
    <section class="panel-section">
      <div class="section-header">
        <h3 class="section-title">
          编队列表
        </h3>
        <button class="add-formation-btn" @click="showCreateFormation = true">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      
      <div class="formation-list">
        <!-- 编队列表 -->
        <div v-for="formation in panelManager.formationList"
             :key="formation.formationId"
             class="formation-item"
             :class="{ 'formation-active': isDraggingOver && dragTargetId === formation.formationId }"
             @dragover.prevent="handleDragOver($event, formation.formationId)"
             @drop="handleDrop($event, formation.formationId)">
          <div class="formation-header">
            <span class="formation-name">
              {{ formation.formationName }} ({{ formation.forceIdList.length }})
            </span>
            <button v-if="formation.canDelete"
                    class="delete-formation-btn"
                    @click="panelManager.deleteFormation(formation.formationId)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="force-list">
            <div v-for="force in formation.forces"
                 :key="force.id"
                 class="force-item"
                 draggable="true"
                 @dragstart="handleDragStart($event, force.id)"
                 @dragend="handleDragEnd">
              {{ force.name }}
            </div>
          </div>
        </div>
      </div>

      <!-- 创建编队对话框 -->
      <div v-if="showCreateFormation" class="modal-overlay">
        <div class="modal-content">
          <h3>创建新编队</h3>
          <div class="form-group">
            <label>编队名称</label>
            <input v-model="newFormationName" type="text" placeholder="请输入编队名称">
          </div>
          <div class="form-group">
            <label>阵营</label>
            <div class="faction-display">{{ store.currentFaction === 'blue' ? '蓝方' : '红方' }}</div>
          </div>
          <div class="modal-actions">
            <button @click="createFormation">确定</button>
            <button @click="showCreateFormation = false">取消</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 六角格信息栏 -->
    <section v-if="selectedHex" class="panel-section">
      <h3 class="section-title">六角格信息</h3>
      <div class="hex-info">
        <div class="info-row">
          <span class="label">编号:</span>
          <span>{{ selectedHex.hexId }}</span>
        </div>
        <div class="info-row">
          <span class="label">地形:</span>
          <span>{{ selectedHex.terrainAttributes?.terrainType }}</span>
        </div>
        <div class="info-row">
          <span class="label">高度:</span>
          <span>{{ selectedHex.terrainAttributes?.elevation.toFixed(1) }}m</span>
        </div>
        <div class="info-row">
          <span class="label">可见性:</span>
          <span>{{ selectedHex.visibility?.visibleTo?.blue ? '可见' : '不可见' }}</span>
        </div>
        
        <div class="forces-in-hex">
          <h4>驻扎部队 ({{ selectedHex.forcesIds?.length || 0 }})</h4>
          <div class="force-checkbox-list">
            <label v-for="forceId in selectedHex.forcesIds" :key="forceId" class="force-checkbox">
              <input type="checkbox" 
                     :checked="selectedForceIds.includes(forceId)"
                     @change="toggleForceSelection(forceId)">
              {{ store.getForceById(forceId)?.forceName }}
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- 部队详细信息栏 -->
    <section v-if="selectedForce" class="panel-section">
      <h3 class="section-title">部队信息</h3>
      <div class="force-details">
        <div class="info-row">
          <span class="label">名称:</span>
          <span>{{ selectedForce.forceName }}</span>
        </div>
        <div class="info-row">
          <span class="label">阵营:</span>
          <span>{{ selectedForce.faction }}</span>
        </div>
        <div class="info-row">
          <span class="label">位置:</span>
          <span>{{ selectedForce.hexId }}</span>
        </div>
        <div class="info-row">
          <span class="label">兵力:</span>
          <span>{{ selectedForce.troopStrength }}</span>
        </div>
        <div class="info-row">
          <span class="label">士气:</span>
          <span>{{ selectedForce.morale?.toFixed(0) }}</span>
        </div>
        <div class="info-row">
          <span class="label">行动力:</span>
          <span>{{ selectedForce.actionPoints }}</span>
        </div>

        <div class="composition-info">
          <h4>兵种组成</h4>
          <div class="composition-list">
            <div v-for="comp in selectedForce.composition" 
                 :key="comp.unitId" 
                 class="composition-item">
              {{ store.getUnitById(comp.unitId)?.unitName }} × {{ comp.unitCount }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 命令下达区 -->
    <section class="panel-section">
      <h3 class="section-title">命令下达</h3>
      <div class="command-area">
        <!-- 移动命令 -->
        <div v-if="selectedForceIds.length === 1" class="command-group">
          <h4>移动命令</h4>
          <div class="command-input">
            <input v-model="movePathInput" 
                   placeholder="输入路径 (逗号分隔 hexId)"
                   class="input-field">
            <button @click="submitMove" class="command-button move">移动</button>
          </div>
        </div>

        <!-- 进攻命令 -->
        <div v-if="selectedForceIds.length === 1" class="command-group">
          <h4>进攻命令</h4>
          <div class="command-input">
            <input v-model="attackTarget" 
                   placeholder="目标六角格 ID"
                   class="input-field">
            <input v-model="supportForcesInput" 
                   placeholder="支援部队ID (逗号分隔)"
                   class="input-field">
            <button @click="submitAttack" class="command-button attack">进攻</button>
          </div>
        </div>

        <!-- 部队操作命令 -->
        <div class="command-group">
          <button v-if="canCreateForce" 
                  @click="showForceManagement = true"
                  class="command-button create">
            创建部队
          </button>
          <button v-if="canMergeForces" 
                  @click="submitMerge"
                  class="command-button merge">
            合并部队
          </button>
          <button v-if="canSplitForce" 
                  @click="showForceManagement = true"
                  class="command-button split">
            拆分部队
          </button>
        </div>
      </div>
    </section>

    <!-- 战斗群列表 -->
    <section v-if="battlegroups.length" class="panel-section">
      <h3 class="section-title">战斗群列表</h3>
      <div class="battlegroup-list">
        <div v-for="group in battlegroups" 
             :key="group.battlegroupId" 
             class="battlegroup-item">
          <div class="battlegroup-header">
            {{ group.battlegroupId }}
            <span class="force-count">({{ group.forceIdList.length }} 支部队)</span>
          </div>
          <div class="command-force">
            指挥主体: {{ store.getForceById(group.commandForceId)?.forceName }}
          </div>
        </div>
      </div>
    </section>

    <!-- 统计列表 -->
    <section class="panel-section">
      <h3 class="section-title">区域统计</h3>
      <button @click="startAreaSelection" 
              class="command-button stats">
        开始框选
      </button>
      <div v-if="statistics" class="statistics-info">
        <div class="faction-stats">
          <h4>己方统计</h4>
          <div class="stats-row">
            <span class="label">部队数量:</span>
            <span>{{ statistics.blue.forceCount }}</span>
          </div>
          <div class="stats-row">
            <span class="label">总兵力值:</span>
            <span>{{ statistics.blue.totalStrength }}</span>
          </div>
        </div>
        <div class="faction-stats">
          <h4>敌方统计</h4>
          <div class="stats-row">
            <span class="label">部队数量:</span>
            <span>{{ statistics.red.forceCount }}</span>
          </div>
          <div class="stats-row">
            <span class="label">总兵力值:</span>
            <span>{{ statistics.red.totalStrength }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { openGameStore } from '@/store';
import { Formation } from '@/models/MilitaryUnit';

const store = openGameStore();
const panelManager = inject('militaryPanelManager');

if (!panelManager) {
  console.error('未找到 militaryPanelManager，请在 App.vue 中 provide');
}

// ============================ 状态变量 ============================
const movePathInput = ref('');
const attackTarget = ref('');
const supportForcesInput = ref('');
const showForceManagement = ref(false);
const statistics = ref(null);

// 编队管理相关状态
const showCreateFormation = ref(false);
const newFormationName = ref('');
const isDraggingOver = ref(false);
const dragTargetId = ref(null);

// ============================ 计算属性 ============================
const selectedForceIds = computed(() => Array.from(store.selectedForceIds));
const selectedHexIds = computed(() => Array.from(store.selectedHexIds));
const battlegroups = computed(() => store.getBattlegroups());

const selectedHex = computed(() => {
  const id = store.getSelectedHexIds().values().next().value;
  return id ? store.getHexCellById(id) : null;
});

const selectedForce = computed(() => {
  const id = store.getSelectedForceIds().values().next().value;
  return id ? store.getForceById(id) : null;
});

// 命令按钮状态
const canCreateForce = computed(() => selectedHexIds.value.length === 1);
const canMergeForces = computed(() => selectedHexIds.value.length === 1 && selectedForceIds.value.length > 1);
const canSplitForce = computed(() => selectedForceIds.value.length === 1);

// ============================ 事件处理方法 ============================
function toggleForceSelection(forceId) {
  if (selectedForceIds.value.includes(forceId)) {
    store.removeSelectedForceId(forceId);
  } else {
    store.addSelectedForceId(forceId);
  }
}

// ============================ 命令处理方法 ============================
function submitMove() {
  if (selectedForceIds.value.length !== 1) return;
  const forceId = selectedForceIds.value[0];
  const path = movePathInput.value.split(',').map(s => s.trim()).filter(Boolean);
  panelManager.move(forceId, path);
  movePathInput.value = '';
}

function submitAttack() {
  if (selectedForceIds.value.length !== 1) return;
  const commandForceId = selectedForceIds.value[0];
  const targetHex = attackTarget.value.trim();
  const supportIds = supportForcesInput.value.split(',').map(s => s.trim()).filter(Boolean);
  panelManager.attack(commandForceId, targetHex, supportIds);
  attackTarget.value = '';
  supportForcesInput.value = '';
}

function submitMerge() {
  if (!canMergeForces.value) return;
  panelManager.mergeForces(selectedHexIds.value[0], selectedForceIds.value);
}

// ============================ 统计方法 ============================
function startAreaSelection() {
  panelManager.startAreaSelection().then(selectedHexes => {
    const stats = {
      blue: { forceCount: 0, totalStrength: 0 },
      red: { forceCount: 0, totalStrength: 0 }
    };
    
    selectedHexes.forEach(hexId => {
      const hex = store.getHexCellById(hexId);
      if (hex) {
        hex.forcesIds.forEach(forceId => {
          const force = store.getForceById(forceId);
          if (force) {
            const faction = force.faction;
            stats[faction].forceCount++;
            stats[faction].totalStrength += force.troopStrength;
          }
        });
      }
    });
    
    statistics.value = stats;
  });
}

// 创建新编队
function createFormation() {
  if (!newFormationName.value) return;
  
  const formation = new Formation({
    formationName: newFormationName.value,
    faction: store.currentFaction,  // 使用当前操作阵营
    forceIdList: []
  });
  
  store.formationMap.set(formation.formationId, formation);
  
  // 重置表单
  newFormationName.value = '';
  showCreateFormation.value = false;
}

// 拖拽相关方法
const handleDragStart = (event, forceId) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', forceId);
  }
};

const handleDragEnd = () => {
  // 清理拖拽状态
};

const handleDrop = (event, targetFormationId) => {
  event.preventDefault();
  if (event.dataTransfer) {
    const forceId = event.dataTransfer.getData('text/plain');
    panelManager.moveForceToFormation(forceId, targetFormationId);
  }
};

function handleDragOver(event, targetFormationId) {
  isDraggingOver.value = true;
  dragTargetId.value = targetFormationId;
}
</script>

<style scoped>
.military-panel {
  width: 300px;
  max-height: 90vh;
  overflow-y: auto;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 16px;
}

.panel-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.add-formation-btn {
  padding: 4px 8px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.faction-group {
  margin-bottom: 16px;
}

.faction-header {
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.formation-item {
  border: 1px solid transparent;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.formation-active {
  border-color: #1890ff;
  background-color: rgba(24, 144, 255, 0.1);
}

.formation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.delete-formation-btn {
  padding: 2px 6px;
  background-color: transparent;
  color: #ff4d4f;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s;
}

.formation-header:hover .delete-formation-btn {
  opacity: 1;
}

.force-item {
  cursor: move;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 24px;
  border-radius: 8px;
  width: 300px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-actions button {
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.modal-actions button:first-child {
  background-color: #1890ff;
  color: white;
  border: none;
}

.modal-actions button:last-child {
  background-color: white;
  border: 1px solid #d9d9d9;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

/* 编队列表样式 */
.formation-item {
  margin-bottom: 8px;
}

.formation-header {
  padding: 8px;
  background-color: #f5f5f5;
  cursor: pointer;
  border-radius: 4px;
}

.formation-header:hover {
  background-color: #e0e0e0;
}

.force-list {
  padding-left: 16px;
}

.force-item {
  padding: 4px 8px;
  cursor: pointer;
  color: #666;
}

.force-item:hover {
  color: #1890ff;
}

/* 信息展示样式 */
.info-row {
  display: flex;
  margin-bottom: 4px;
}

.label {
  width: 80px;
  color: #666;
}

/* 命令区域样式 */
.command-group {
  margin-bottom: 12px;
}

.command-input {
  margin-bottom: 8px;
}

.input-field {
  width: 100%;
  padding: 6px;
  margin-bottom: 4px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.command-button {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  color: white;
  margin-right: 8px;
}

.command-button.move { background-color: #1890ff; }
.command-button.attack { background-color: #f5222d; }
.command-button.create { background-color: #52c41a; }
.command-button.merge { background-color: #faad14; }
.command-button.split { background-color: #722ed1; }
.command-button.stats { background-color: #13c2c2; }

/* 战斗群列表样式 */
.battlegroup-item {
  padding: 8px;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  border-radius: 4px;
}

.battlegroup-header {
  font-weight: 500;
  margin-bottom: 4px;
}

.force-count {
  color: #666;
  font-size: 0.9em;
}

/* 统计信息样式 */
.statistics-info {
  margin-top: 12px;
}

.faction-stats {
  margin-bottom: 12px;
}

.stats-row {
  display: flex;
  margin-bottom: 4px;
}

/* 复选框样式 */
.force-checkbox {
  display: block;
  margin-bottom: 4px;
  cursor: pointer;
}

.force-checkbox input {
  margin-right: 8px;
}

.round-info {
  font-size: 0.9em;
  color: #666;
  font-weight: normal;
}

.faction-display {
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  color: #666;
}
</style>
