<!-- src\components\hud\FormationPanel.vue
  编队列表面板，用于显示和管理军队编队
-->
<template>
  <div class="formation-panel">
    <!-- 面板顶栏 -->
    <div class="panel-header">
      <div class="add-button" @click="showCreateFormationDialog">
        <i class="el-icon-plus"></i>
      </div>
      <h3 class="panel-title">编队列表</h3>
      <div class="delete-button" @click="handleDeleteFormation" :class="{ 'disabled': !hasSelectedFormation }">
        <i class="el-icon-delete"></i>
      </div>
    </div>
    
    <!-- 面板内容区 - 编队列表 -->
    <div class="panel-content">
      <div v-if="formations.length === 0" class="empty-list">
        <div class="empty-message">暂无编队</div>
        <el-button size="small" type="primary" @click="showCreateFormationDialog">
          创建编队
        </el-button>
      </div>
      
      <div v-else class="formation-list">
        <!-- 编队和部队的嵌套列表 -->
        <div 
          v-for="formation in formations" 
          :key="formation.formationId"
          class="formation-item"
          :class="{ 'selected': selectedFormationId === formation.formationId }"
        >
          <!-- 编队行 (一级条目) -->
          <div class="formation-row" @click="toggleFormation(formation.formationId)">
            <div class="toggle-icon">
              <i :class="expandedFormations.has(formation.formationId) ? 'el-icon-arrow-down' : 'el-icon-arrow-right'"></i>
            </div>
            <div class="formation-name" :class="`faction-${formation.faction}`">
              {{ formation.name }}
            </div>
          </div>
          
          <!-- 部队列表 (二级条目) - 使用过渡动画 -->
          <transition name="expand">
            <div v-if="expandedFormations.has(formation.formationId)" class="forces-list">
              <div 
                v-for="force in getFormationForces(formation)"
                :key="force.forceId"
                class="force-item"
                :class="{ 'selected': isForceSelected(force.forceId) }"
                @click="selectForce(force.forceId, $event)"
                @dblclick="focusForce(force)"
              >
                <!-- 军种色标识 -->
                <div class="force-type-indicator" :class="getForceTypeClass(force)"></div>
                <div class="force-info">
                  <div class="force-name">{{ force.name }}</div>
                  <div class="force-location">{{ force.hexId }}</div>
                </div>
              </div>
              <div v-if="getFormationForces(formation).length === 0" class="empty-forces">
                <div class="empty-message">该编队中没有部队</div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
    
    <!-- 创建编队对话框 -->
    <el-dialog
      v-model="createFormationDialogVisible"
      title="创建新编队"
      width="360px"
    >
      <el-form :model="formationForm" label-position="top">
        <el-form-item label="编队名称">
          <el-input v-model="formationForm.name" placeholder="请输入编队名称"></el-input>
        </el-form-item>
        <el-form-item label="所属阵营">
          <el-select v-model="formationForm.faction" placeholder="请选择阵营">
            <el-option label="蓝方" value="blue"></el-option>
            <el-option label="红方" value="red"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createFormationDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="createFormation" :disabled="!formationForm.name || !formationForm.faction">
            创建
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteConfirmDialogVisible"
      title="确认删除"
      width="360px"
    >
      <div class="confirm-message">
        确定要删除编队"{{ selectedFormationName }}"吗？
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="deleteConfirmDialogVisible = false">取消</el-button>
          <el-button type="danger" @click="confirmDeleteFormation">
            确认删除
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showWarning, showError } from '@/layers/interaction-layer/utils/MessageBox';

// 状态管理
const store = openGameStore();
const expandedFormations = ref(new Set()); // 已展开的编队ID集合
const selectedFormationId = ref(null); // 当前选中的编队ID
const createFormationDialogVisible = ref(false); // 创建编队对话框可见性
const deleteConfirmDialogVisible = ref(false); // 删除确认对话框可见性

// 编队表单数据
const formationForm = ref({
  name: '',
  faction: ''
});

// 计算属性：获取所有编队
const formations = computed(() => {
  return store.getFormations();
});

// 计算属性：是否有选中的编队
const hasSelectedFormation = computed(() => {
  return selectedFormationId.value !== null;
});

// 计算属性：获取选中编队的名称
const selectedFormationName = computed(() => {
  if (!selectedFormationId.value) return '';
  const formation = formations.value.find(f => f.formationId === selectedFormationId.value);
  return formation ? formation.name : '';
});

// 获取编队中的部队
function getFormationForces(formation) {
  if (!formation || !formation.forces || formation.forces.length === 0) {
    return [];
  }
  
  const forces = [];
  formation.forces.forEach(forceId => {
    const force = store.getForceById(forceId);
    if (force) forces.push(force);
  });
  
  return forces;
}

// 切换编队展开/折叠状态
function toggleFormation(formationId) {
  if (expandedFormations.value.has(formationId)) {
    expandedFormations.value.delete(formationId);
  } else {
    expandedFormations.value.add(formationId);
  }
  
  // 记录选中的编队ID
  selectedFormationId.value = formationId;
}

// 判断部队是否被选中
function isForceSelected(forceId) {
  return store.selectedForceIds.has(forceId);
}

// 选择部队（单击）
function selectForce(forceId, event) {
  // 阻止冒泡，防止触发编队点击事件
  event.stopPropagation();
  
  // 如果按住Ctrl键，则进行多选
  if (event.ctrlKey) {
    if (store.selectedForceIds.has(forceId)) {
      store.removeSelectedForceId(forceId);
    } else {
      store.addSelectedForceId(forceId);
    }
  } else {
    // 否则清除已选，进行单选
    store.clearSelectedForceIds();
    store.addSelectedForceId(forceId);
  }
}

// 聚焦部队（双击）
function focusForce(force) {
  if (!force || !force.forceId) return;
  
  // 使用命令系统聚焦到部队
  CommandService.executeCommandFromUI('FOCUS_FORCE', {
    forceId: force.forceId,
    hexId: force.hexId
  }).catch(error => {
    showWarning(`无法聚焦到部队: ${error.message}`);
  });
}

// 根据部队类型获取样式类名
function getForceTypeClass(force) {
  if (!force || !force.type) return 'type-land'; // 默认陆军
  
  // 根据部队类型返回对应的CSS类名
  switch (force.type.toLowerCase()) {
    case 'naval':
    case 'navy':
    case 'sea':
      return 'type-naval';
    case 'air':
    case 'aviation':
      return 'type-air';
    case 'land':
    case 'army':
    default:
      return 'type-land';
  }
}

// 显示创建编队对话框
function showCreateFormationDialog() {
  // 重置表单
  formationForm.value = {
    name: '',
    faction: ''
  };
  createFormationDialogVisible.value = true;
}

// 创建编队
function createFormation() {
  if (!formationForm.value.name || !formationForm.value.faction) {
    showWarning('请填写完整的编队信息');
    return;
  }
  
  // 调用命令服务创建编队
  CommandService.executeCommandFromUI('CREATE_FORMATION', {
    name: formationForm.value.name,
    faction: formationForm.value.faction
  }).then(() => {
    showSuccess('编队创建成功');
    createFormationDialogVisible.value = false;
  }).catch(error => {
    showError(`创建编队失败: ${error.message}`);
  });
}

// 处理删除编队
function handleDeleteFormation() {
  if (!selectedFormationId.value) {
    showWarning('请先选择一个编队');
    return;
  }
  
  // 显示确认对话框
  deleteConfirmDialogVisible.value = true;
}

// 确认删除编队
function confirmDeleteFormation() {
  if (!selectedFormationId.value) return;
  
  // 调用命令服务删除编队
  CommandService.executeCommandFromUI('DELETE_FORMATION', {
    formationId: selectedFormationId.value
  }).then(() => {
    showSuccess('编队已删除');
    deleteConfirmDialogVisible.value = false;
    selectedFormationId.value = null;
  }).catch(error => {
    showError(`删除编队失败: ${error.message}`);
  });
}

// 组件挂载时，展开第一个编队（如果有）
onMounted(() => {
  if (formations.value.length > 0) {
    expandedFormations.value.add(formations.value[0].formationId);
  }
});
</script>

<style scoped>
.formation-panel {
  width: 320px;
  height: 100%;
  background-color: rgba(169, 140, 102, 0.9);
  color: #f0f0f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(0, 0, 0, 0.2);
}

/* 面板顶栏 */
.panel-header {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
}

.add-button,
.delete-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, transform 0.2s;
}

.add-button:hover,
.delete-button:hover {
  opacity: 1;
  transform: scale(1.1);
}

.add-button i,
.delete-button i {
  font-size: 20px;
}

.delete-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* 面板内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* 空列表状态 */
.empty-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.empty-message {
  margin-bottom: 15px;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}

/* 编队列表 */
.formation-list {
  width: 100%;
}

/* 编队项 */
.formation-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.formation-item.selected .formation-row {
  background-color: rgba(255, 255, 255, 0.15);
}

/* 编队行 */
.formation-row {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.formation-row:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.toggle-icon {
  margin-right: 10px;
  width: 20px;
  text-align: center;
}

.formation-name {
  flex: 1;
  font-weight: bold;
}

/* 阵营颜色 */
.faction-blue {
  color: #4a90e2;
}

.faction-red {
  color: #e24a4a;
}

/* 部队列表 */
.forces-list {
  padding: 0 0 10px 34px;
  background-color: rgba(0, 0, 0, 0.05);
}

.empty-forces {
  padding: 10px 0;
  text-align: center;
}

/* 部队项 */
.force-item {
  display: flex;
  padding: 8px 10px;
  margin-bottom: 1px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.force-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.force-item.selected {
  background-color: rgba(74, 144, 226, 0.2);
}

/* 军种颜色标识 */
.force-type-indicator {
  width: 4px;
  margin-right: 10px;
  border-radius: 2px;
}

.type-land {
  background-color: #4ae24a; /* 陆军绿色 */
}

.type-naval {
  background-color: #4a90e2; /* 海军蓝色 */
}

.type-air {
  background-color: #e24a4a; /* 空军红色 */
}

/* 部队信息 */
.force-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.force-name {
  font-weight: 500;
}

.force-location {
  font-size: 12px;
  opacity: 0.8;
}

/* 展开/折叠动画 */
.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

/* 确认对话框样式 */
.confirm-message {
  padding: 20px 0;
  text-align: center;
}
</style>
  