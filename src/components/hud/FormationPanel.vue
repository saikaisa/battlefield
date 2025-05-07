<!-- src\components\hud\FormationPanel.vue
  编队列表面板，用于显示和管理军队编队
-->
<template>
  <teleport to="body">
    <div class="formation-panel">
      <!-- 面板顶栏 -->
      <div class="panel-header">
        <!-- 添加调试信息 -->
        <div class="debug-info" style="position: absolute; top: 0; right: 0; font-size: 10px; color: yellow; z-index: 9999;">
          编队数: {{ formationsInOrder.length }}
        </div>
        <div class="add-button" @click="showCreateFormationDialog">
          <i class="el-icon-plus"></i>
        </div>
        <h3 class="panel-title">编队列表</h3>
        <div class="delete-button" @click="handleDeleteFormation" :class="{ 'disabled': !hasSelectedFormation }">
          <i class="el-icon-delete"></i>
        </div>
      </div>
      
      <!-- 面板内容区 - 编队列表 -->
      <div class="panel-content" style="background-color: rgba(0,0,0,0.3);">
        <!-- 调试信息 -->
        <div style="color: white; padding: 5px; font-size: 12px; background-color: rgba(0,0,0,0.5);">
          编队数量: {{ formationsInOrder.length }}<br>
          当前阵营: {{ currentFaction }}<br>
          编队数据: <pre style="font-size: 10px; max-height: 100px; overflow: auto;">{{ JSON.stringify(formationsInOrder, null, 2) }}</pre>
        </div>
        
        <div v-if="formationsInOrder.length === 0" class="empty-list">
          <div class="empty-message">暂无编队</div>
          <el-button size="small" type="primary" @click="showCreateFormationDialog">
            创建编队
          </el-button>
        </div>
        
        <div v-else class="formation-list">
          <!-- 先简化渲染，直接列出所有编队 -->
          <div v-for="formation in formationsInOrder" :key="formation.formationId" 
               class="formation-item-debug"
               style="padding: 10px; margin: 5px 0; background-color: rgba(255,255,255,0.1); border-radius: 4px;">
            {{ formation.name }} ({{ formation.formationId }})
          </div>
          
          <!-- 编队和部队的嵌套列表 - 使用拖拽组件 -->
          <draggable 
            :list="formationsInOrder" 
            handle=".formation-row"
            item-key="formationId"
            ghost-class="ghost-formation"
            :disabled="isDefaultFormation"
            @end="handleDragEnd"
            @start="handleDragStart"
            group="formations"
          >
            <template #item="{element: formation}">
              <div 
                class="formation-item"
                :class="{ 'selected': selectedFormationId === formation.formationId }"
                :data-formation-id="formation.formationId"
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
                    <draggable 
                      :list="getFormationForces(formation)" 
                      group="forces"
                      item-key="forceId"
                      ghost-class="ghost-force"
                      @end="handleForceDragEnd"
                      @start="handleDragStart"
                    >
                      <template #item="{element: force}">
                        <div 
                          class="force-item"
                          :class="{ 'selected': isForceSelected(force.forceId) }"
                          :data-force-id="force.forceId"
                          @click="selectForce(force.forceId)"
                          @dblclick="focusForce(force)"
                        >
                          <!-- 军种色标识 -->
                          <div class="force-type-indicator" :class="getForceTypeClass(force)"></div>
                          <div class="force-info">
                            <div class="force-name">{{ force.name }}</div>
                            <div class="force-location">{{ force.hexId }}</div>
                          </div>
                        </div>
                      </template>
                    </draggable>
                    <div v-if="getFormationForces(formation).length === 0" class="empty-forces">
                      <div class="empty-message">该编队中没有部队</div>
                    </div>
                  </div>
                </transition>
              </div>
            </template>
          </draggable>
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
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="createFormationDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="createFormation" :disabled="!formationForm.name">
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
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showWarning, showError } from '@/layers/interaction-layer/utils/MessageBox';
import { VueDraggableNext as draggable } from 'vue-draggable-next';

// 状态管理
const store = openGameStore();
const expandedFormations = ref(new Set()); // 已展开的编队ID集合
const selectedFormationId = ref(null); // 当前选中的编队ID
const createFormationDialogVisible = ref(false); // 创建编队对话框可见性
const deleteConfirmDialogVisible = ref(false); // 删除确认对话框可见性

// 编队表单数据
const formationForm = ref({
  name: '',
});

// 当前阵营编队排序存储
const formationsOrder = ref({
  blue: [],
  red: []
});

// 计算属性：获取当前阵营
const currentFaction = computed(() => store.currentFaction);

// 计算属性：获取当前阵营的编队（已排序）
const formationsInOrder = computed({
  get: () => {
    // 获取当前阵营的所有编队
    const formationList = store.getFormationsByFaction(currentFaction.value);
    console.log('获取到编队列表:', formationList);
    
    if (!formationList || formationList.length === 0) {
      console.warn('没有找到编队数据！');
      return [];
    }
    
    // 详细记录每个编队的信息
    formationList.forEach((formation, index) => {
      console.log(`编队 ${index+1}:`, 
        JSON.stringify({
          id: formation.formationId,
          name: formation.name,
          faction: formation.faction,
          forceCount: formation.forceIdList ? formation.forceIdList.length : 0
        })
      );
    });
    
    // 如果本地存储有排序信息，则使用排序信息
    const orderIds = formationsOrder.value[currentFaction.value];
    
    if (orderIds && orderIds.length > 0) {
      // 按照本地存储的顺序排序
      const ordered = [];
      
      // 首先添加有序列表中的编队
      orderIds.forEach(id => {
        const formation = formationList.find(f => f.formationId === id);
        if (formation) {
          ordered.push(formation);
        }
      });
      
      // 添加任何新添加的编队（不在排序列表中的）
      formationList.forEach(formation => {
        if (!orderIds.includes(formation.formationId)) {
          // 一般来说默认编队一直在有序列表内，如果没有，则再次将默认编队放在最后
          if (formation.name.includes('default')) {
            ordered.push(formation);
          } else {
            // 其他新编队放在非默认编队的最前面
            ordered.unshift(formation);
          }
        }
      });
      
      return ordered;
    } else {
      // 如果没有排序信息，则将默认编队放在最后
      return formationList.sort((a, b) => {
        const aIsDefault = a.name.includes('default');
        const bIsDefault = b.name.includes('default');
        if (aIsDefault && !bIsDefault) return 1;
        if (!aIsDefault && bIsDefault) return -1;
        return 0;
      });
    }
  },
  set: (value) => {
    // 当拖拽重排后，更新本地存储的排序信息
    formationsOrder.value[currentFaction.value] = value.map(f => f.formationId);
  }
});

// 计算属性：是否有选中的编队（且不是默认编队）
const hasSelectedFormation = computed(() => {
  return selectedFormationId.value !== null && !isDefaultFormation(selectedFormationId.value);
});

// 计算属性：获取选中编队的名称
const selectedFormationName = computed(() => {
  if (!selectedFormationId.value) return '';
  const formation = store.getFormationById(selectedFormationId.value);
  return formation ? formation.name : '';
});

// 判断是否为默认编队（不可删除，不可拖动）
function isDefaultFormation(formationId) {
  if (!formationId) return false;
  const formation = store.getFormationById(formationId);
  return formation ? formation.name.includes('default') : false;
}

// 获取编队中的部队
function getFormationForces(formation) {
  if (!formation) {
    console.warn('无效的编队对象:', formation);
    return [];
  }
  
  if (!formation.forceIdList) {
    console.warn('编队对象没有forceIdList属性:', formation);
    // 尝试兼容旧的数据结构
    if (formation.forces && Array.isArray(formation.forces)) {
      console.log('使用旧的forces数组:', formation.forces);
      const forceIds = formation.forces;
      const forces = [];
      forceIds.forEach(forceId => {
        const force = store.getForceById(forceId);
        if (force) forces.push(force);
      });
      return forces;
    }
    return [];
  }
  
  if (formation.forceIdList.length === 0) {
    return [];
  }
  
  const forces = [];
  const forceIds = formation.forceIdList;
  
  forceIds.forEach(forceId => {
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
function selectForce(forceId) {
  // 不需要阻止冒泡，允许点击部队时也触发编队点击事件
  
  // 如果部队已经被选中，不做任何处理
  if (store.selectedForceIds.has(forceId)) {
    return;
  }
  
  // 添加部队到选中列表
  store.addSelectedForceId(forceId);
  
  // 自动选中部队所在的编队
  const force = store.getForceById(forceId);
  if (force) {
    const formation = store.getFormationByForceId(forceId);
    if (formation) {
      selectedFormationId.value = formation.formationId;
    }
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
  if (!force || !force.service) return 'type-land'; // 默认陆军
  
  // 根据部队类型返回对应的CSS类名
  switch (force.service.toLowerCase()) {
    case 'sea':
      return 'type-naval';
    case 'air':
      return 'type-air';
    case 'land':
    default:
      return 'type-land';
  }
}

// 显示创建编队对话框
function showCreateFormationDialog() {
  // 重置表单
  formationForm.value = {
    name: '',
  };
  createFormationDialogVisible.value = true;
}

// 创建编队
function createFormation() {
  if (!formationForm.value.name) {
    showWarning('请填写完整的编队名称');
    return;
  }
  
  // 调用命令服务创建编队
  CommandService.executeCommandFromUI('CREATE_FORMATION', {
    name: formationForm.value.name,
    faction: currentFaction.value  // 确保添加到当前阵营
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
  
  // 检查是否是默认编队（不允许删除）
  if (isDefaultFormation(selectedFormationId.value)) {
    showWarning('默认编队不能被删除');
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
    
    // 从本地排序中也删除此编队
    const factionOrder = formationsOrder.value[currentFaction.value];
    const index = factionOrder.indexOf(selectedFormationId.value);
    if (index > -1) {
      factionOrder.splice(index, 1);
    }
  }).catch(error => {
    showError(`删除编队失败: ${error.message}`);
  });
}

// 处理拖拽开始事件
function handleDragStart() {
  // 拖动开始时收起所有编队列表，方便拖放到目标位置
  expandedFormations.value.clear();
}

// 处理拖拽结束事件
function handleDragEnd() {
  // 拖拽操作完成后已经自动更新了formationsInOrder
  console.log('编队排序已更新:', formationsOrder.value[currentFaction.value]);
}

// 处理部队拖拽结束事件
function handleForceDragEnd(evt) {
  // 如果是在同一个编队内拖拽，不做任何操作
  if (evt.from === evt.to) return;
  
  // 获取被拖拽的部队ID
  const forceId = evt.item.getAttribute('data-force-id');
  
  // 获取目标编队ID（从父元素获取）
  const targetFormationId = evt.to.closest('.formation-item').getAttribute('data-formation-id');
  
  if (forceId && targetFormationId) {
    // 调用命令将部队加入目标编队
    CommandService.executeCommandFromUI('ADD_FORCE_TO_FORMATION', {
      forceId: forceId,
      formationId: targetFormationId
    }).then(() => {
      showSuccess('部队已加入编队');
    }).catch(error => {
      showError(`添加部队到编队失败: ${error.message}`);
    });
  }
}

// 监听当前阵营变化，更新UI
watch(currentFaction, () => {
  // 切换阵营时清空选中状态
  selectedFormationId.value = null;
  expandedFormations.value.clear();
});

// 初始化：当组件挂载时，为当前阵营初始化排序数组（如果不存在）
onMounted(() => {
  // 初始化当前阵营的编队排序
  if (!formationsOrder.value[currentFaction.value]) {
    const formations = store.getFormationsByFaction(currentFaction.value);
    formationsOrder.value[currentFaction.value] = formations
      .filter(f => !f.name.includes('default'))
      .map(f => f.formationId);
      
    // 将默认编队添加到最后
    const defaultFormation = formations.find(f => f.name.includes('default'));
    if (defaultFormation) {
      formationsOrder.value[currentFaction.value].push(defaultFormation.formationId);
    }
  }
  
  // 添加调试日志
  console.log('编队面板已挂载');
  console.log('当前阵营:', currentFaction.value);
  console.log('编队数据:', formationsInOrder.value);
  console.log('Store中的编队:', store.getFormationsByFaction(currentFaction.value));
  
  // 立即展开所有编队以便调试
  const allFormations = store.getFormationsByFaction(currentFaction.value);
  allFormations.forEach(formation => {
    expandedFormations.value.add(formation.formationId);
  });
});
</script>

<style scoped>
.formation-panel {
  width: 320px;
  background-color: rgba(169, 140, 102, 0.9);
  color: #f0f0f0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border: 2px solid rgba(255, 0, 0, 0.5);
  position: fixed;
  left: 20px;
  top: 20px;
  z-index: 9999;
  max-height: none;
  min-height: 300px;
  pointer-events: auto;
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

.add-button, .delete-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, transform 0.2s;
}

.add-button:hover, .delete-button:hover {
  opacity: 1;
  transform: scale(1.1);
}

.add-button i, .delete-button i { font-size: 20px; }

.delete-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* 面板内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  max-height: none;
  min-height: 250px;
  display: block;
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
.formation-list { width: 100%; }

/* 编队项 */
.formation-item { 
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(255,255,255,0.05);
  margin-bottom: 5px;
}
.formation-item.selected .formation-row { background-color: rgba(255, 255, 255, 0.15); }

/* 编队行 */
.formation-row {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.formation-row:hover { background-color: rgba(255, 255, 255, 0.1); }

/* 拖拽时的虚影样式 */
.ghost-formation, .ghost-force {
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.2);
  border: 1px dashed rgba(255, 255, 255, 0.3);
}

.toggle-icon { margin-right: 10px; width: 20px; text-align: center; }
.formation-name { flex: 1; font-weight: bold; }

/* 阵营颜色 */
.faction-blue { color: #4a90e2; }
.faction-red { color: #e24a4a; }

/* 部队列表 */
.forces-list {
  padding: 0 0 10px 34px;
  background-color: rgba(0, 0, 0, 0.05);
}

.empty-forces { padding: 10px 0; text-align: center; }

/* 部队项 */
.force-item {
  display: flex;
  padding: 8px 10px;
  margin-bottom: 1px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.force-item:hover { background-color: rgba(255, 255, 255, 0.1); }
.force-item.selected { background-color: rgba(74, 144, 226, 0.2); }

/* 军种颜色标识 */
.force-type-indicator {
  width: 4px;
  margin-right: 10px;
  border-radius: 2px;
}

.type-land { background-color: #4ae24a; } /* 陆军绿色 */
.type-naval { background-color: #4a90e2; } /* 海军蓝色 */
.type-air { background-color: #e24a4a; } /* 空军红色 */

/* 部队信息 */
.force-info { flex: 1; display: flex; flex-direction: column; }
.force-name { font-weight: 500; }
.force-location { font-size: 12px; opacity: 0.8; }

/* 展开/折叠动画 */
.expand-enter-active, .expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; }

/* 确认对话框样式 */
.confirm-message { padding: 20px 0; text-align: center; }
</style>
  