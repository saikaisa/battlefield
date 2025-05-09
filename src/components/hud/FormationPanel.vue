<!-- src\components\hud\FormationPanel.vue
  编队列表面板，用于显示和管理军队编队
-->
<template>
  <teleport to="body">
    <div class="formation-panel">
      <!-- 面板顶栏 -->
      <div class="panel-header">
        <div class="add-button" @click="showCreateFormationDialog">
          <el-icon><Plus /></el-icon>
        </div>
        <h3 class="panel-title" :class="`faction-${currentFaction}`">编队列表 ({{ formationsInOrder.length }})</h3>
        <div class="delete-button" @click="handleDeleteFormation" :class="{ 'disabled': !hasSelectedFormation }">
          <el-icon><Delete /></el-icon>
        </div>
      </div>
      
      <!-- 面板内容区 - 编队列表 -->
      <div class="panel-content">
        <!-- 简易调试信息 -->
        <div class="debug-info" v-if="false">
          编队数量: {{ formationsInOrder.length }} | 当前阵营: {{ currentFaction }}
        </div>
        
        <div v-if="formationsInOrder.length === 0" class="empty-list">
          <div class="empty-message">暂无编队</div>
          <el-button size="small" type="primary" @click="showCreateFormationDialog">
            创建编队
          </el-button>
        </div>
        
        <div v-else class="formation-list">
          <!-- 编队和部队的嵌套列表 - 使用拖拽组件 -->
          <draggable 
            v-model="formationsInOrder" 
            handle=".drag-handle"
            item-key="formationId"
            ghost-class="ghost-formation"
            :disabled="formation => formation && formation.formationId && formation.formationId.endsWith('_default')"
            @end="handleDragEnd"
            @start="handleDragStart"
            group="formations"
            :animation="150"
            :scroll="true"
            :scrollSensitivity="100"
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
                    <el-icon v-if="expandedFormations.has(formation.formationId)"><ArrowDown /></el-icon>
                    <el-icon v-else><ArrowRight /></el-icon>
                  </div>
                  <div class="formation-name">
                    {{ formation.formationName }}
                  </div>
                  <!-- 拖拽把手图标，只有非默认编队才显示 -->
                  <div v-if="!formation.formationId.endsWith('_default')" class="formation-buttons">
                    <div 
                      class="move-btn up-btn" 
                      title="上移"
                      @click.stop="moveFormation(formation, 'up')"
                      :class="{ 'disabled': isFirstFormation(formation.formationId) }"
                    >
                      <el-icon><ArrowUp /></el-icon>
                    </div>
                    <div 
                      class="move-btn down-btn" 
                      title="下移"
                      @click.stop="moveFormation(formation, 'down')"
                      :class="{ 'disabled': isLastFormation(formation.formationId) }"
                    >
                      <el-icon><ArrowDown /></el-icon>
                    </div>
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
                      @start="handleForceDragStart"
                      :animation="150"
                      :forceFallback="true"
                      :fallbackClass="'dragging-force'"
                      :removeCloneOnHide="true"
                      :sort="true"
                    >
                      <template #item="{element: force}">
                        <div 
                          class="force-item"
                          :class="{ 'selected': isForceSelected(force.forceId) }"
                          :data-force-id="force.forceId"
                          @click.stop="selectForce(force.forceId)"
                          @dblclick.stop="focusForce(force)"
                        >
                          <!-- 军种色标识 -->
                          <div class="force-type-indicator" :class="getForceTypeClass(force)"></div>
                          <div class="force-info">
                            <div class="force-name">{{ force.name || force.forceName }}</div>
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
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showWarning, showError } from '@/layers/interaction-layer/utils/MessageBox';
import draggable from 'vuedraggable';
// 导入Element Plus图标
import { Plus, Delete, ArrowDown, ArrowRight, ArrowUp } from '@element-plus/icons-vue';
import { gameModeService } from '@/layers/interaction-layer/GameModeManager';
import { GameMode } from '@/config/GameModeConfig';
// 状态管理
const store = openGameStore();
const expandedFormations = ref(new Set()); // 已展开的编队ID集合
const selectedFormationId = ref(null); // 当前选中的编队ID
const createFormationDialogVisible = ref(false); // 创建编队对话框可见性
const deleteConfirmDialogVisible = ref(false); // 删除确认对话框可见性
const isDragging = ref(false); // 是否正在拖拽
const dragSourceFormationId = ref(null); // 拖拽源编队ID
const mousePosition = ref({ x: 0, y: 0 }); // 鼠标位置
const expandedFormationsBeforeDrag = ref(new Set()); // 拖拽前展开的编队状态

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
          // 检查是否是默认编队
          const isDefault = formation.formationId.endsWith('_default');
          if (isDefault) {
            // 默认编队放在最后
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
        const aIsDefault = a.formationId.endsWith('_default');
        const bIsDefault = b.formationId.endsWith('_default');
        if (aIsDefault && !bIsDefault) return 1;
        if (!aIsDefault && bIsDefault) return -1;
        return 0;
      });
    }
  },
  set: (value) => {
    // 当拖拽重排后，更新本地存储的排序信息
    formationsOrder.value[currentFaction.value] = value.map(f => f.formationId);
    // 强制刷新组件
    nextTick(() => {
      console.log('编队顺序已更新:', formationsOrder.value[currentFaction.value]);
    });
  }
});

// 计算属性：是否有选中的编队（且不是默认编队）
const hasSelectedFormation = computed(() => {
  // 确保有选中的编队，且不是默认编队
  return selectedFormationId.value !== null && !selectedFormationId.value.endsWith('_default');
});

// 计算属性：获取选中编队的名称
const selectedFormationName = computed(() => {
  if (!selectedFormationId.value) return '';
  const formation = store.getFormationById(selectedFormationId.value);
  return formation ? (formation.formationName) : '';
});

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
    else console.warn(`未能找到部队 ID: ${forceId}`);
  });
  
  return forces;
}

// 切换编队展开/折叠状态
function toggleFormation(formationId) {
  // 如果正在拖拽中，不处理点击事件
  if (isDragging.value) return;
  
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
  // 如果正在拖拽中，不处理点击事件
  if (isDragging.value) return;
  
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
  if (!force || !force.forceId || isDragging.value) return;

  // 如果当前是环绕模式，则切换到自由模式再聚焦部队
  const gamemode = gameModeService.getCurrentMode();
  if (gamemode === GameMode.ORBIT) {
    gameModeService.setMode(GameMode.FREE);
  }

  try {
    // 使用命令系统聚焦到部队
    CommandService.executeCommandFromUI('FOCUS_FORCE', {
      forceId: force.forceId,
      hexId: force.hexId
    }).catch(error => {
      console.error(`聚焦部队失败: ${error.message}`);
      showWarning(`无法聚焦到部队: ${error.message}`);
    });
  } catch (error) {
    console.error(`聚焦部队出错: ${error}`);
    showWarning('无法聚焦到部队，请稍后再试');
  }
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
  // 直接使用ID判断是否为默认编队
  if (selectedFormationId.value.endsWith('_default')) {
    showWarning('默认编队不能被删除');
    console.log(`阻止删除默认编队: ${selectedFormationId.value}`);
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
  // 标记为拖拽状态
  isDragging.value = true;
  
  // 保存当前编队展开状态
  expandedFormationsBeforeDrag.value = new Set(expandedFormations.value);
  
  // 拖动开始时收起所有编队列表，方便拖放到目标位置
  expandedFormations.value.clear();
}

// 处理编队拖拽结束事件
function handleDragEnd() {
  // 拖拽操作完成后已经自动更新了formationsInOrder
  
  // 恢复拖拽前的编队展开状态
  expandedFormations.value = new Set(expandedFormationsBeforeDrag.value);
  
  // 延迟重置拖拽状态，避免触发点击事件
  setTimeout(() => {
    isDragging.value = false;
  }, 100);
}

// 处理部队拖拽开始事件
function handleForceDragStart(evt) {
  // 标记为拖拽状态
  isDragging.value = true;
  
  try {
    // 保存当前鼠标位置
    if (evt.originalEvent && evt.originalEvent instanceof MouseEvent) {
      mousePosition.value = {
        x: evt.originalEvent.clientX,
        y: evt.originalEvent.clientY
      };
    }
    
    // 获取被拖拽的部队ID
    const forceId = evt.item.getAttribute('data-force-id');
    if (forceId) {
      // 查找部队所在的编队
      const sourceFormation = store.getFormationByForceId(forceId);
      if (sourceFormation) {
        dragSourceFormationId.value = sourceFormation.formationId;
        console.log(`开始拖拽部队 ${forceId}，源编队: ${dragSourceFormationId.value}`);
      }
    }
  } catch (error) {
    console.error('处理拖拽开始时出错:', error);
  }
}

// 监听全局鼠标移动事件
function setupMouseTracking() {
  const handleMouseMove = (e) => {
    if (isDragging.value) {
      mousePosition.value = {
        x: e.clientX,
        y: e.clientY
      };
    }
  };
  
  window.addEventListener('mousemove', handleMouseMove);
  
  // 组件卸载时移除事件监听
  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove);
  });
}

// 处理部队拖拽结束事件
function handleForceDragEnd(evt) {
  try {
    // 获取最终鼠标位置
    let finalMouseX = mousePosition.value.x;
    let finalMouseY = mousePosition.value.y;
    
    // 如果可以从原始事件获取更准确的位置，则使用原始事件位置
    if (evt.originalEvent && evt.originalEvent instanceof MouseEvent) {
      finalMouseX = evt.originalEvent.clientX;
      finalMouseY = evt.originalEvent.clientY;
    }
    
    console.log('部队拖拽结束时鼠标位置:', { x: finalMouseX, y: finalMouseY });
    
    // 延迟重置拖拽状态，避免触发点击事件
    setTimeout(() => {
      isDragging.value = false;
      dragSourceFormationId.value = null;
    }, 100);
    
    // 调试日志
    console.log('部队拖拽结束:', evt);
    console.log('拖拽元素:', evt.item);
    console.log('源容器:', evt.from);
    console.log('目标容器:', evt.to);
    
    // 获取被拖拽的部队ID
    const forceId = evt.item.getAttribute('data-force-id');
    if (!forceId) {
      console.warn('找不到拖拽的部队ID');
      return;
    }
    
    // 确认源编队
    let sourceFormationId = dragSourceFormationId.value;
    if (!sourceFormationId) {
      const currentFormation = store.getFormationByForceId(forceId);
      if (currentFormation) {
        sourceFormationId = currentFormation.formationId;
      } else {
        console.warn(`找不到部队 ${forceId} 所在的编队`);
        return;
      }
    }
    
    console.log(`拖拽部队 ${forceId} 的源编队: ${sourceFormationId}`);
    
    // 使用鼠标位置确定目标编队
    let targetFormationId = null;
    
    // 根据鼠标位置找到下面的元素
    const elementsAtPoint = document.elementsFromPoint(finalMouseX, finalMouseY);
    console.log('鼠标位置下的元素:', elementsAtPoint);
    
    // 在鼠标位置下的元素中查找formation-item元素
    for (const el of elementsAtPoint) {
      // 直接检查是否有data-formation-id属性
      if (el.hasAttribute && el.hasAttribute('data-formation-id')) {
        targetFormationId = el.getAttribute('data-formation-id');
        console.log('直接找到目标编队:', targetFormationId);
        break;
      }
      
      // 检查元素是否有formation-item类
      if (el.classList && el.classList.contains('formation-item')) {
        targetFormationId = el.getAttribute('data-formation-id');
        console.log('通过class找到目标编队:', targetFormationId);
        break;
      }
      
      // 查找最近的编队父元素
      if (el.closest) {
        const formationParent = el.closest('.formation-item');
        if (formationParent) {
          targetFormationId = formationParent.getAttribute('data-formation-id');
          console.log('通过父元素找到目标编队:', targetFormationId);
          break;
        }
      }
    }
    
    // 如果还是找不到目标编队，尝试使用扩展范围搜索
    if (!targetFormationId) {
      // 扩大搜索范围 - 获取所有编队元素，检查鼠标位置是否在某个编队的范围内
      const allFormationItems = document.querySelectorAll('.formation-item');
      console.log('所有编队元素:', allFormationItems);
      
      // 遍历所有编队元素，检查鼠标位置是否在编队范围内
      allFormationItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        if (
          finalMouseX >= rect.left && 
          finalMouseX <= rect.right && 
          finalMouseY >= rect.top && 
          finalMouseY <= rect.bottom
        ) {
          targetFormationId = item.getAttribute('data-formation-id');
          console.log('通过位置范围找到目标编队:', targetFormationId);
        }
      });
    }
    
    // 如果还是没有找到目标编队，使用展开的编队
    if (!targetFormationId) {
      // 获取当前展开的编队
      const expandedFormationIds = Array.from(expandedFormations.value);
      for (const formationId of expandedFormationIds) {
        if (formationId !== sourceFormationId) {
          targetFormationId = formationId;
          console.log('使用展开的非源编队作为目标:', targetFormationId);
          break;
        }
      }
    }
    
    // 如果仍然找不到目标编队，使用第一个非源编队作为目标
    if (!targetFormationId) {
      for (const formation of formationsInOrder.value) {
        if (formation.formationId !== sourceFormationId) {
          targetFormationId = formation.formationId;
          console.log('使用第一个非源编队作为目标:', targetFormationId);
          break;
        }
      }
    }
    
    // 确认源编队和目标编队不同
    if (!targetFormationId || targetFormationId === sourceFormationId) {
      console.log('源编队和目标编队相同或无法确定目标编队，不处理');
      return;
    }
    
    console.log(`部队 ${forceId} 将从编队 ${sourceFormationId} 移动到编队 ${targetFormationId}`);
    
    // 调用命令将部队加入目标编队
    CommandService.executeCommandFromUI('ADD_FORCE_TO_FORMATION', {
      forceId: forceId,
      formationId: targetFormationId
    }).then(() => {
      showSuccess(`部队已移动到编队 ${targetFormationId}`);
      // 确保目标编队展开，方便查看
      expandedFormations.value.add(targetFormationId);
    }).catch(error => {
      showError(`添加部队到编队失败: ${error.message}`);
    });
  } catch (error) {
    console.error('部队拖拽处理错误:', error);
    showError('部队拖拽操作失败');
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
  console.log('编队面板已挂载，开始检查数据');
  // 初始化当前阵营的编队排序
  if (!formationsOrder.value[currentFaction.value]) {
    const formations = store.getFormationsByFaction(currentFaction.value);
    console.log('当前阵营编队数据:', formations);
    
    if (formations && formations.length > 0) {
      formationsOrder.value[currentFaction.value] = formations
        .filter(f => !f.formationId.endsWith('_default'))
        .map(f => f.formationId);
        
      // 将默认编队添加到最后
      const defaultFormation = formations.find(f => f.formationId.endsWith('_default'));
      if (defaultFormation) {
        formationsOrder.value[currentFaction.value].push(defaultFormation.formationId);
      }
    } else {
      console.warn('当前阵营没有编队数据');
      formationsOrder.value[currentFaction.value] = [];
    }
  }
  
  // 默认展开所有编队
  nextTick(() => {
    const allFormations = store.getFormationsByFaction(currentFaction.value);
    if (allFormations && allFormations.length > 0) {
      allFormations.forEach(formation => {
        expandedFormations.value.add(formation.formationId);
      });
    } else {
      console.warn('无法展开编队：没有找到编队数据');
    }
  });
  
  // 设置鼠标跟踪
  setupMouseTracking();
});

// 判断是否是第一个可移动的编队
function isFirstFormation(formationId) {
  const nonDefaultFormations = formationsInOrder.value.filter(f => !f.formationId.endsWith('_default'));
  return nonDefaultFormations.length > 0 && nonDefaultFormations[0].formationId === formationId;
}

// 判断是否是最后一个可移动的编队
function isLastFormation(formationId) {
  const nonDefaultFormations = formationsInOrder.value.filter(f => !f.formationId.endsWith('_default'));
  return nonDefaultFormations.length > 0 && 
         nonDefaultFormations[nonDefaultFormations.length - 1].formationId === formationId;
}

// 移动编队位置
function moveFormation(formation, direction) {
  // 获取当前编队索引
  const currentIndex = formationsInOrder.value.findIndex(f => f.formationId === formation.formationId);
  if (currentIndex === -1) return;
  
  // 计算目标索引
  let targetIndex;
  
  if (direction === 'up') {
    // 向上移动，找到前一个非默认编队
    targetIndex = currentIndex - 1;
    while (targetIndex >= 0 && formationsInOrder.value[targetIndex].formationId.endsWith('_default')) {
      targetIndex--;
    }
    if (targetIndex < 0) return; // 已经是第一个，不移动
  } else {
    // 向下移动，找到后一个非默认编队
    targetIndex = currentIndex + 1;
    while (targetIndex < formationsInOrder.value.length && 
           formationsInOrder.value[targetIndex].formationId.endsWith('_default')) {
      targetIndex++;
    }
    if (targetIndex >= formationsInOrder.value.length) return; // 已经是最后一个，不移动
  }
  
  // 交换位置
  const temp = {...formationsInOrder.value[currentIndex]};
  formationsInOrder.value[currentIndex] = {...formationsInOrder.value[targetIndex]};
  formationsInOrder.value[targetIndex] = temp;
  
  // 更新存储的排序信息
  formationsOrder.value[currentFaction.value] = formationsInOrder.value.map(f => f.formationId);
}
</script>

<style scoped>
.formation-panel {
  width: 320px;
  background-color: rgba(169, 140, 102, 0.9);
  color: #f0f0f0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border: 2px solid rgba(80, 60, 40, 0.8);
  position: fixed;
  left: 20px;
  top: 20px;
  z-index: 9999;
  max-height: 40vh; /* 限制最大高度为视窗高度的40% */
  min-height: 40vh;
  pointer-events: auto;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* 调试信息 */
.debug-info {
  font-size: 12px;
  padding: 5px 10px;
  background-color: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 2px;
  margin-bottom: 10px;
}

/* 面板顶栏 */
.panel-header {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
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
  max-height: calc(80vh - 60px); /* 减去头部高度 */
  min-height: 250px;
  display: block;
  background-color: rgba(0, 0, 0, 0.1);
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
  overflow-y: auto;
}

/* 编队项 */
.formation-item { 
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(255,255,255,0.05);
  margin-bottom: 8px;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.formation-item.selected .formation-row { background-color: rgba(255, 255, 255, 0.15); }

/* 编队行 */
.formation-row {
  display: flex;
  align-items: center;
  padding: 6px 10px; /* 减小上下内边距 */
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
  overflow: visible;
  width: 100%;
  box-sizing: border-box;
}

.formation-row:hover { background-color: rgba(255, 255, 255, 0.1); }

/* 拖拽把手样式 */
.drag-handle {
  margin-left: auto;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  opacity: 0.6;
  transition: opacity 0.2s;
  border-radius: 4px;
  color: #f0f0f0;
  user-select: none;
  z-index: 100;
  touch-action: none; /* 防止触摸设备上的默认行为 */
  position: relative;
  background-color: rgba(0, 0, 0, 0.1);
}

.drag-handle:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.2);
}

.drag-handle:active {
  cursor: grabbing;
  background-color: rgba(255, 255, 255, 0.3);
}

/* 拖拽时的虚影样式 */
.ghost-formation, .ghost-force {
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.2);
  border: 1px dashed rgba(255, 255, 255, 0.3);
}

.dragging-force {
  background-color: rgba(50, 50, 50, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  z-index: 10000;
}

.toggle-icon { margin-right: 10px; width: 20px; text-align: center; }
.formation-name { 
  flex: 1; 
  font-weight: bold; 
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%; /* 减小部队名称最大宽度 */
  font-size: 12px;
  flex-shrink: 1;
}

/* 阵营颜色 */
.faction-blue { color: #4a90e2; }
.faction-red { color: #e24a4a; }

/* 部队列表 */
.forces-list {
  padding: 0;
  background-color: transparent;
}

.empty-forces { 
  padding: 10px 0; 
  text-align: center; 
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
  font-size: 14px;
}

/* 部队项 */
.force-item {
  display: flex;
  padding: 5px 10px 5px 10px;
  margin: 0;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: transparent;
  user-select: none;
  overflow: visible;
  width: 100%;
  align-items: center;
  box-sizing: border-box;
  position: relative;
  min-height: 24px;
}

.force-info {
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;
  align-items: center;
  max-width: 100%;
  box-sizing: border-box;
  margin-left: 8px;
}

.force-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
  font-size: 12px;
  flex-shrink: 1;
}

.force-location {
  font-size: 11px;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  margin-left: 8px;
  max-width: 50px;
  flex-shrink: 0;
}

/* 部队项悬停时的背景色 */
.force-item:hover { 
  background-color: rgba(255, 255, 255, 0.05); /* 减淡背景色 */
}
.force-item.selected { 
  background-color: rgba(74, 144, 226, 0.1); /* 减淡选中背景色 */
}

/* 军种颜色标识 */
.force-type-indicator {
  width: 3px;
  min-width: 3px;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  border-radius: 0;
  flex-shrink: 0;
  display: block;
}

.type-land { background-color: #4ae24a; } /* 陆军绿色 */
.type-naval { background-color: #4a90e2; } /* 海军蓝色 */
.type-air { background-color: #e24a4a; } /* 空军红色 */

/* 展开/折叠动画 */
.expand-enter-active, .expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; }

/* 确认对话框样式 */
.confirm-message { padding: 20px 0; text-align: center; }

.formation-buttons {
  display: flex;
  margin-left: auto;
  min-width: 45px; /* 减小按钮组宽度 */
  justify-content: flex-end;
}

.move-btn {
  width: 18px; /* 减小按钮宽度 */
  height: 18px; /* 减小按钮高度 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s;
  border-radius: 3px;
  margin-left: 2px; /* 减小间距 */
  background-color: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.move-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.2);
}

.move-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
  