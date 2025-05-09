<!-- src/components/hud/CommandPanel.vue
  命令管理面板
-->
<template>
  <teleport to="body">
    <div class="command-panel" :class="{ 'collapsed': isPanelCollapsed }">
      <!-- 折叠/展开按钮 -->
      <div class="toggle-panel-button" @click="togglePanelCollapse">
        <el-icon><ArrowLeft v-if="!isPanelCollapsed" /><ArrowRight v-else /></el-icon>
      </div>

      <!-- 主面板卡片 -->
      <el-card v-show="!isPanelCollapsed" class="command-panel-card">
        <!-- 面板标题 -->
        <div class="panel-title">
          <h3>命令管理面板</h3>
        </div>
        
        <!-- 面板控制行 -->
        <div class="panel-controls">
          <!-- 自动/手动模式切换开关 -->
          <el-switch
            v-model="autoMode"
            :active-text="autoMode ? '自动模式' : '手动模式'"
            :disabled="isButtonDisabled('auto-mode')"
            size="small"
          />
          <!-- 清空列表链接 -->
          <a 
            class="clear-list-link" 
            @click="activeTab === 'queue' ? clearQueue() : clearHistory()"
            :class="{ 'disabled': isButtonDisabled('clear-list') || 
                      (activeTab === 'queue' && filteredQueueCommands.length === 0) || 
                      (activeTab === 'history' && filteredHistoryCommands.length === 0) }"
          >
            清空列表
          </a>
        </div>

        <!-- 自定义标签栏 -->
        <div class="custom-tabs">
          <!-- 标签头部 -->
          <div class="custom-tabs-header">
            <div 
              class="custom-tab" 
              :class="{ 'active': activeTab === 'queue' }"
              @click="activeTab = 'queue'"
            >
              命令队列
            </div>
            <div 
              class="custom-tab" 
              :class="{ 'active': activeTab === 'history' }"
              @click="activeTab = 'history'"
            >
              命令历史
            </div>
          </div>
        
          <!-- 标签内容区域 -->
          <div class="custom-tabs-content">
            <!-- 命令队列面板 -->
            <div v-if="activeTab === 'queue'" class="custom-tab-pane">
              <!-- 命令来源过滤器（单选） -->
              <div class="filter-container">
                <el-radio-group 
                  v-model="queueSourceSelected" 
                  @change="handleQueueSourceChange"
                  :disabled="autoMode || isExecuting"
                  size="small"
                >
                  <el-radio :label="CommandSource.MANUAL">手动</el-radio>
                  <el-radio :label="CommandSource.API">API</el-radio>
                  <el-radio :label="CommandSource.FILE">文件</el-radio>
                </el-radio-group>
                <div class="count-badge">
                  {{ filteredQueueCommands.length }} / {{ CommandLimit.QUEUE_LIMIT }}
                </div>
              </div>
              
              <!-- 内容区域（固定高度可滚动区域） -->
              <div class="tab-content-area">
                <!-- 空队列提示 -->
                <el-empty v-if="filteredQueueCommands.length === 0" description="暂无待执行命令" :image-size="60">
                  <el-button type="primary" size="small" @click="handleAddCommand('manual')" :disabled="autoMode || isExecuting">
                    添加命令
                  </el-button>
                </el-empty>
                
                <!-- 命令表格 -->
                <div v-else class="command-table-container" :class="{'command-table-container-queue': activeTab === 'queue'}">
                  <!-- 表格头部 -->
                  <div class="command-table-header">
                    <div class="column type-column">类型</div>
                    <div class="column desc-column">描述</div>
                    <div class="column interval-column">间隔</div>
                    <div class="column handle-column"></div>
                  </div>
                
                  <!-- 可拖拽的命令列表 -->
                  <draggable
                    v-model="draggedQueueCommands"
                    item-key="id"
                    handle=".drag-handle"
                    ghost-class="ghost"
                    :disabled="autoMode || isExecuting"
                    class="command-table-body"
                    :animation="150"
                  >
                    <template #item="{ element }">
                      <div 
                        class="command-table-row"
                        :class="[
                          commandStatusClass(element.status),
                          { 'selected-row': selectedCommandId === element.id }
                        ]"
                        @click="selectCommand(element.id)"
                      >
                        <!-- 命令类型 -->
                        <div class="column type-column" :title="commandTypeText(element.type)">
                          <el-tooltip :content="element.status === CommandStatus.EXECUTING ? '执行中' : ''" placement="top" :disabled="element.status !== CommandStatus.EXECUTING">
                            <span>{{ commandTypeText(element.type) }}</span>
                            <i v-if="element.status === CommandStatus.EXECUTING" class="el-icon-loading"></i>
                          </el-tooltip>
                        </div>
                        
                        <!-- 命令描述 -->
                        <div class="column desc-column" :title="getCommandSummary(element)">
                          {{ getCommandSummary(element) }}
                        </div>
                        
                        <!-- 命令执行间隔 -->
                        <div class="column interval-column" :title="element.interval !== undefined ? (element.interval < 0 ? '停止' : element.interval + 'ms') : ''">
                          {{ element.interval !== undefined ? (element.interval < 0 ? '停止' : element.interval + 'ms') : '' }}
                        </div>
                        
                        <!-- 拖拽手柄 -->
                        <div class="column handle-column">
                          <div class="drag-handle" v-if="!autoMode && !isExecuting">
                            <el-icon><Menu /></el-icon>
                          </div>
                        </div>
                      </div>
                    </template>
                  </draggable>
                </div>
              </div>
            </div>
            
            <!-- 命令历史面板 -->
            <div v-if="activeTab === 'history'" class="custom-tab-pane">
              <!-- 命令来源过滤器（多选） -->
              <div class="filter-container">
                <div class="history-filters">
                  <el-checkbox v-model="historyFilters[CommandSource.UI]" @change="handleHistoryFilterChange" size="small">UI</el-checkbox>
                  <el-checkbox v-model="historyFilters[CommandSource.API]" @change="handleHistoryFilterChange" size="small">API</el-checkbox>
                  <el-checkbox v-model="historyFilters[CommandSource.FILE]" @change="handleHistoryFilterChange" size="small">文件</el-checkbox>
                  <el-checkbox v-model="historyFilters[CommandSource.MANUAL]" @change="handleHistoryFilterChange" size="small">手动</el-checkbox>
                </div>
                <div class="count-badge">
                  {{ filteredHistoryCommands.length }} / {{ CommandLimit.HISTORY_LIMIT }}
                </div>
              </div>
              
              <!-- 内容区域（固定高度可滚动区域） -->
              <div class="tab-content-area">
                <!-- 空历史提示 -->
                <el-empty v-if="filteredHistoryCommands.length === 0" description="暂无命令历史" :image-size="60">
                  <el-button v-if="store.commandQueue.length > 0" type="primary" size="small" @click="activeTab = 'queue'">
                    查看命令队列
                  </el-button>
                </el-empty>
                
                <!-- 历史命令表格 -->
                <div v-else class="command-table-container" :class="{'command-table-container-history': activeTab === 'history'}">
                  <!-- 表格头部 -->
                  <div class="command-table-header">
                    <div class="column type-column">类型</div>
                    <div class="column desc-column">结果信息</div>
                    <div class="column interval-column">执行时间</div>
                    <div class="column handle-column">来源</div>
                  </div>
                
                  <!-- 历史命令列表 -->
                  <div class="command-table-body">
                    <div 
                      v-for="item in filteredHistoryCommands" 
                      :key="item.command.id"
                      class="command-table-row"
                      :class="[
                        commandStatusClass(item.command.status),
                        { 'selected-row': selectedCommandId === item.command.id }
                      ]"
                      @click="selectCommand(item.command.id)"
                    >
                      <!-- 命令类型 -->
                      <div class="column type-column" :title="commandTypeText(item.command.type)">
                        {{ commandTypeText(item.command.type) }}
                      </div>
                      
                      <!-- 结果信息 -->
                      <div class="column desc-column" :title="item.result?.message || ''">
                        {{ item.result?.message || '' }}
                      </div>
                      
                      <!-- 执行时间 -->
                      <div class="column interval-column" :title="calDuration(item.command.startTime, item.command.endTime)">
                        {{ calDuration(item.command.startTime, item.command.endTime) }}
                      </div>
                      
                      <!-- 命令来源 -->
                      <div class="column handle-column" :title="commandSourceText(item.command.source)">
                        {{ commandSourceText(item.command.source) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 底部操作按钮区域 -->
        <div class="action-buttons" v-if="activeTab === 'queue'">
          <div class="command-actions">
            <el-button 
              type="primary" 
              size="small" 
              @click="executeCommand(selectedCommandId)"
              :disabled="!selectedCommandId || isButtonDisabled('execute')"
            >
              执行
            </el-button>
            <el-button 
              type="warning" 
              size="small" 
              @click="editSelectedCommand"
              :disabled="!selectedCommandId || isButtonDisabled('edit')"
            >
              编辑
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              @click="removeCommand(selectedCommandId)"
              :disabled="!selectedCommandId || isButtonDisabled('delete')"
            >
              删除
            </el-button>
          </div>
          
          <el-dropdown @command="handleAddCommand" trigger="click">
            <el-button 
              type="success" 
              size="small"
              :disabled="isButtonDisabled('add')">
              新增<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="manual">手动添加</el-dropdown-item>
                <el-dropdown-item command="file">从文件导入</el-dropdown-item>
                <el-dropdown-item command="api">从API获取</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 隐藏的文件上传输入框 -->
        <input 
          type="file" 
          ref="fileInput" 
          style="display: none" 
          accept=".json"
          @change="handleFileUpload"
        />
      </el-card>
      
      <!-- 命令编辑弹窗 -->
      <el-dialog
        v-model="commandEditorVisible"
        :title="isEditMode ? '编辑命令' : '添加命令'"
        width="600px"
      >
        <!-- 命令编辑表单 -->
        <el-form :model="commandForm" label-position="top">
          <el-form-item label="命令格式">
            <!-- 命令格式说明 -->
            <el-alert
              type="info"
              show-icon
              title="请输入JSON格式的命令"
              description="格式: { 'type': '命令类型', 'params': {命令参数}, 'interval': 间隔时间(ms) }"
              :closable="false"
            />
            <!-- 命令JSON输入框 -->
            <el-input
              v-model="commandForm.json"
              type="textarea"
              :rows="10"
              :autosize="{ minRows: 10, maxRows: 20 }"
              placeholder='{
  "type": "PANORAMA_MODE",
  "params": {
    "enabled": true
  },
  "interval": 0
}'
            ></el-input>
          </el-form-item>
        </el-form>
        <!-- 弹窗底部按钮 -->
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="commandEditorVisible = false">取消</el-button>
            <el-button type="primary" @click="submitCommand" :disabled="!commandForm.json.trim()">确定</el-button>
          </span>
        </template>
      </el-dialog>
      
      <!-- API获取弹窗 -->
      <el-dialog
        v-model="apiDialogVisible"
        title="从API获取命令"
        width="500px"
      >
        <!-- API表单 -->
        <el-form :model="apiForm" label-position="top">
          <el-form-item label="API地址">
            <el-input v-model="apiForm.url" :placeholder="`请输入API地址，默认为：${ApiConfig.URL}`"></el-input>
          </el-form-item>
        </el-form>
        <!-- 弹窗底部按钮 -->
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="apiDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="fetchFromAPI" :disabled="!apiForm.url.trim()">获取</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showError, showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import draggable from 'vuedraggable';
import { CommandLimit, CommandType, CommandName, CommandSource, CommandStatus, ApiConfig } from '@/config/CommandConfig';
import { GameMode } from '@/config/GameModeConfig';
// 导入Element Plus图标
import { ArrowLeft, ArrowRight, ArrowDown, Menu } from '@element-plus/icons-vue';

// 表单状态
const commandEditorVisible = ref(false); // 命令编辑器弹窗是否可见
const apiDialogVisible = ref(false); // API获取弹窗是否可见
const isEditMode = ref(false); // 是否处于编辑模式（区分新增和编辑命令）
const editingCommandId = ref(null); // 当前正在编辑的命令ID
// 命令编辑表单数据
const commandForm = ref({
  json: '' // 命令的JSON字符串
});
// API获取表单数据
const apiForm = ref({
  url: ApiConfig.URL // 默认使用配置中的API地址
});
// 文件上传输入框引用
const fileInput = ref(null);
const activeTab = ref('queue');  // 默认显示命令队列标签页
const selectedCommandId = ref(null);  // 当前选中的命令ID
const isPanelCollapsed = ref(false); // 面板是否折叠
// 防抖控制
const isSubmitting = ref(false); // 是否正在提交命令，防止重复提交

// 过滤器状态
const historyFilters = ref({
  [CommandSource.UI]: true,
  [CommandSource.API]: true,
  [CommandSource.FILE]: true,
  [CommandSource.MANUAL]: true
});

// 队列源选择（单选）
const queueSourceSelected = ref(CommandSource.MANUAL); // 默认选中"手动"源

// Store 相关
const store = openGameStore();
const commandQueue = computed(() => store.commandQueue);
const commandHistory = computed(() => store.commandHistory);
const autoMode = computed({
  get: () => store.autoMode,
  set: (value) => {
    if (value) {
      CommandService.startAutoMode();
    } else {
      CommandService.stopAutoMode();
    }
  }
});
const isExecuting = computed(() => store.isExecuting)

// 过滤后的命令队列
const filteredQueueCommands = computed(() => {
  // 检查队列是否为空
  if (commandQueue.value.length === 0) return [];
  if (activeTab.value === 'queue') {
    console.log('队列中的命令数量:', commandQueue.value.length);
  }
  return commandQueue.value.filter(cmd => {
    // 排除UI来源，只显示符合当前选择的来源
    return cmd.source !== CommandSource.UI && cmd.source === queueSourceSelected.value;
  });
});

// 过滤出已完成和失败的命令（历史）
const filteredHistoryCommands = computed(() => {
  return commandHistory.value.filter(item => {
    // 根据历史记录过滤器显示选中的来源
    return historyFilters.value[item.command.source];
  });
});

// 可拖拽排序的命令队列
const draggedQueueCommands = computed({
  get: () => {
    // 确保返回有效的数组，过滤掉可能的null或undefined值
    return filteredQueueCommands.value.filter(cmd => cmd && cmd.id);
  },
  set: (value) => {
    // 拖拽结束后会触发这里，我们直接在handleDragEnd中处理排序
    // 但需要确保value是有效的，防止vuedraggable内部错误
    if (Array.isArray(value) && value.length > 0) {
      const validIds = value.filter(cmd => cmd && cmd.id).map(cmd => cmd.id);
      if (validIds.length > 0) {
        store.reorderCommandQueue(validIds);
      }
    }
  }
});

// 按钮禁用状态检查
function isButtonDisabled(buttonId) {
  // 如果队列为空，禁用执行按钮
  if (commandQueue.value.length === 0) {
    return buttonId === 'execute';
  }
  
  // 自动模式下禁用的按钮
  if (store.autoMode && 
      (buttonId === 'edit' || buttonId === 'delete' || buttonId === 'add' || buttonId === 'clear-list')) {
    return true;
  }

  // 如果在当前游戏模式下被禁用
  if (store.gameMode !== GameMode.FREE && store.disabledButtons.has(buttonId)) {
    return true;
  }
  
  // 历史标签页时禁用编辑和执行按钮
  if (activeTab.value === 'history' && 
      (buttonId === 'execute' || buttonId === 'edit' || buttonId === 'delete')) {
    return true;
  }
  
  // 命令执行中禁用的按钮
  if (store.isExecuting && !store.autoMode && 
      (buttonId === 'execute' || buttonId === 'edit' || buttonId === 'delete' || 
       buttonId === 'add' || buttonId === 'clear-list')) {
    return true;
  }
  
  return false;
}

// 监听自动模式变化
watch(() => store.autoMode, (newValue) => {
  if (newValue) {
    showSuccess('自动模式已开启，系统将自动执行选中类型的命令');
  } else {
    showSuccess('自动模式已关闭');
  }
});

// 监听命令执行状态变化
watch(() => store.isExecuting, (isExecuting) => {
  if (!isExecuting && store.autoMode) {
    // 命令执行完毕且处于自动模式，继续执行下一条
    // 自动执行逻辑由CommandDispatcher负责
  }
});

// 监听标签页切换，清除选中状态
watch(activeTab, () => {
  selectedCommandId.value = null;
});

// 初始化过滤器状态与store同步
handleQueueSourceChange(queueSourceSelected.value);
handleHistoryFilterChange();

// 在挂载时处理一些初始化逻辑
onMounted(() => {
  // 确认过滤器已正确同步到store
  handleQueueSourceChange(queueSourceSelected.value);
  handleHistoryFilterChange();
  
  // 如果有自动模式设置，确保UI状态同步
  autoMode.value = store.autoMode;
});

// 方法
/** 命令类型-中文映射 */
function commandTypeText(type) {
  return CommandName[type] || type;
}

/** 命令来源-中文映射 */
function commandSourceText(source) {
  switch (source) {
    case CommandSource.UI: return 'UI';
    case CommandSource.API: return 'API';
    case CommandSource.FILE: return '文件';
    case CommandSource.MANUAL: return '手动';
    default: return source;
  }
}

/** 命令状态-样式映射 */
function commandStatusClass(status) {
  switch (status) {
    case CommandStatus.PENDING: return 'status-pending';
    case CommandStatus.EXECUTING: return 'status-executing';
    case CommandStatus.FINISHED: return 'status-finished';
    case CommandStatus.FAILED: return 'status-failed';
    default: return '';
  }
}

/** 计算命令执行时间（毫秒） */
function calDuration(startTime, endTime) {
  if (!startTime || !endTime || startTime === 0 || endTime === 0) return '未完成';
  const duration = new Date(endTime) - new Date(startTime);
  return `${duration}ms`;
}

/** 命令摘要 */
function getCommandSummary(command) {
  switch (command.type) {
    case CommandType.MOVE:
      return `移动部队 ${command.params.forceId} 到路径终点`;
    case CommandType.ATTACK:
      return `部队 ${command.params.commandForceId} 攻击目标 ${command.params.targetHex}`;
    case CommandType.CREATE_FORCE:
      return `在 ${command.params.hexId} 创建 ${command.params.faction} 阵营部队`;
    case CommandType.MERGE_FORCES:
      return `合并 ${command.params.forceIds?.length || 0} 个部队`;
    case CommandType.SPLIT_FORCE:
      return `拆分部队 ${command.params.forceId}`;
    case CommandType.ORBIT_MODE:
      return `${command.params.enabled ? '开启' : '关闭'}环绕模式`;
    case CommandType.PANORAMA_MODE:
      return `${command.params.enabled ? '开启' : '关闭'}俯瞰模式`;
    case CommandType.CHANGE_LAYER:
      return `切换到图层 ${command.params.layerIndex}`;
    case CommandType.STATISTIC:
      return `${command.params.enabled ? '开启' : '关闭'}统计模式`;
    case CommandType.RESET_CAMERA:
      return '重置相机位置';
    case CommandType.FOCUS_FORCE:
      return '聚焦选中部队';
    case CommandType.NEXT_FACTION:
      return '结束当前回合';
    default:
      return `命令 ${command.type}`;
  }
}

/** 选择命令 */
function selectCommand(commandId) {
  selectedCommandId.value = commandId === selectedCommandId.value ? null : commandId;
}

/** 编辑选中的命令 */
function editSelectedCommand() {
  if (!selectedCommandId.value) return;
  
  const command = store.commandQueue.find(cmd => cmd.id === selectedCommandId.value);
  if (command) {
    editCommand(command);
  }
}

/** 显示命令编辑器 */
function showCommandEditor(template = null) {
  isEditMode.value = false;
  editingCommandId.value = null;
  
  if (template) {
    // 有模板时，用户若不输入内容则使用模板
    commandForm.value.json = JSON.stringify(template, null, 2);
  } else {
    // 没有模板时，不设置默认值，让用户必须输入内容
    commandForm.value.json = '';
  }
  
  commandEditorVisible.value = true;
}

/** 编辑命令准备 */
function editCommand(command) {
  isEditMode.value = true;
  editingCommandId.value = command.id;
  
  // 转换为基础格式
  const basicFormat = {
    type: command.type,
    params: command.params,
    interval: command.interval
  };
  
  commandForm.value.json = JSON.stringify(basicFormat, null, 2);
  commandEditorVisible.value = true;
}

/** 提交命令 */
function submitCommand() {
  // 防抖机制：如果已经在提交过程中，则不重复执行
  if (isSubmitting.value) {
    return;
  }
  
  // 设置提交中状态
  isSubmitting.value = true;
  
  try {
    const commandData = JSON.parse(commandForm.value.json);
    
    // 验证命令格式
    if (!commandData.type) {
      showError('命令格式错误：缺少type字段');
      isSubmitting.value = false;
      return;
    }
    
    if (!commandData.params) {
      commandData.params = {};
    }
    
    if (isEditMode.value && editingCommandId.value) {
      // 编辑现有命令
      const commandIndex = store.commandQueue.findIndex(cmd => cmd.id === editingCommandId.value);
      if (commandIndex !== -1) {
        const command = store.commandQueue[commandIndex];
        command.type = commandData.type;
        command.params = commandData.params;
        command.interval = commandData.interval;
        showSuccess('命令已更新');
        commandEditorVisible.value = false;
      }
      
      // 延迟重置提交状态，防止快速多次点击
      setTimeout(() => {
        isSubmitting.value = false;
      }, 500);
    } else {
      // 添加新命令
      try {
        CommandService.addManualCommand(commandData)
          .then(() => {
            // 更新队列源选择
            queueSourceSelected.value = CommandSource.MANUAL;
            handleQueueSourceChange(CommandSource.MANUAL);
            showSuccess('命令已添加到队列');
            commandEditorVisible.value = false;
          })
          .catch(error => {
            showError(`添加命令失败: ${error.message}`);
          })
          .finally(() => {
            // 延迟重置提交状态，确保防抖生效
            setTimeout(() => {
              isSubmitting.value = false;
            }, 500);
          });
      } catch (error) {
        showError(`添加命令失败: ${error.message}`);
        isSubmitting.value = false;
      }
    }
  } catch (error) {
    showError(`解析命令失败: ${error.message}`);
    isSubmitting.value = false;
  }
}

/** 执行命令 */
function executeCommand(commandId) {
  if (!commandId) return;
  
  // 设置按钮状态为禁用，避免重复点击
  selectedCommandId.value = null;
  
  CommandService.executeQueuedCommand(commandId)
    .then((historyCommand) => {
      if (historyCommand && historyCommand.result) {
        showSuccess(historyCommand.result.message || '命令执行成功，但无详细信息');
      } else {
        showSuccess('命令执行成功，但无详细信息');
      }
    })
    .catch(error => {
      // 根据错误类型进行不同处理
      if (error.type === 'validation') {
        showWarning(error.message);
      } else if (error.type === 'info') {
        showSuccess(error.message);
      } else {
        showError(`命令执行失败: ${error.message}`);
      }
    });
}

/** 删除命令 */
function removeCommand(commandId) {
  if (!commandId) return;
  
  store.removeCommandFromQueue(commandId);
  // 清除选中状态
  selectedCommandId.value = null;
}

/** 清空命令队列 */
function clearQueue() {
  store.clearCommandQueue();
  // 清除选中状态
  selectedCommandId.value = null;
}

/** 清空命令历史 */
function clearHistory() {
  store.clearCommandHistory();
  // 清除选中状态
  selectedCommandId.value = null;
}

/** 上传命令文件 */
function uploadFile() {
  fileInput.value.click();
}

/** 处理命令文件上传 */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  CommandService.loadCommandsFromFile(file)
    .then(length => {
      showSuccess(`成功从文件加载 ${length} 条命令`);
      // 更新队列源选择
      queueSourceSelected.value = CommandSource.FILE;
      handleQueueSourceChange(CommandSource.FILE);
    })
    .catch(error => {
      // 根据错误类型处理
      if (error.type === 'file') {
        showWarning(`文件问题: ${error.message}`);
      } else if (error.type === 'validation') {
        showWarning(`命令格式错误: ${error.message}`);
      } else {
        showError(`加载命令文件失败: ${error.message}`);
      }
    })
    .finally(() => {
      // 重置文件输入框，允许再次选择同一文件
      fileInput.value.value = '';
    });
}

/** 显示API获取弹窗 */
function showApiDialog() {
  apiDialogVisible.value = true;
}

/** 从API获取命令 */
function fetchFromAPI() {
  if (!apiForm.value.url) {
    showWarning('请输入API地址');
    return;
  }
  
  CommandService.loadCommandsFromAPI(apiForm.value.url)
    .then(length => {
      apiDialogVisible.value = false;
      showSuccess(`成功从API拉取 ${length} 条命令`);
      // 更新队列源选择
      queueSourceSelected.value = CommandSource.API;
      handleQueueSourceChange(CommandSource.API);
    })
    .catch(error => {
      // 根据错误类型处理
      if (error.type === 'network') {
        showWarning(`网络问题: ${error.message}`);
      } else if (error.type === 'validation') {
        showWarning(`命令格式错误: ${error.message}`);
      } else {
        showError(`从API获取命令失败: ${error.message}`);
      }
    });
}

/** 处理命令队列源选择变化 */
function handleQueueSourceChange(value) {
  console.log('队列源选择变化:', value);
  
  // 更新store中的过滤器
  const filter = {
    [CommandSource.API]: false,
    [CommandSource.FILE]: false,
    [CommandSource.MANUAL]: false
  };
  filter[value] = true;
  
  console.log('设置队列过滤器:', filter);
  store.setCommandQueueFilter(filter);
  
  // 清除选中状态
  selectedCommandId.value = null;
}

/** 处理历史记录过滤器变化 */
function handleHistoryFilterChange() {
  console.log('历史记录过滤器变化:', historyFilters.value);
  store.setCommandHistoryFilter(historyFilters.value);
  // 清除选中状态
  selectedCommandId.value = null;
}

/** 处理添加命令 */
function handleAddCommand(command) {
  switch (command) {
    case 'manual':
      showCommandEditor();
      break;
    case 'file':
      uploadFile();
      break;
    case 'api':
      showApiDialog();
      break;
  }
}

/** 切换面板折叠状态 */
function togglePanelCollapse() {
  isPanelCollapsed.value = !isPanelCollapsed.value;
}

// 监听对话框状态变化，确保关闭对话框时重置提交状态
watch(commandEditorVisible, (visible) => {
  if (!visible) {
    // 对话框关闭时，重置提交状态
    setTimeout(() => {
      isSubmitting.value = false;
    }, 300);
  }
});

</script>

<style scoped>
/* 命令面板样式 - 整体容器 */
.command-panel {
  width: 320px;
  max-height: 500px;
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 100;
  transition: all 0.3s ease;
}

/* 面板卡片样式 */
.command-panel-card {
  background-color: rgba(169, 140, 102, 0.9) !important;
  border: none !important;
  height: 500px;
  display: flex;
  flex-direction: column;
}

/* 面板折叠/展开按钮 */
.toggle-panel-button {
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background-color: rgba(169, 140, 102, 0.9);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px 0 0 4px;
  z-index: 10;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
}

/* 折叠状态的面板 */
.command-panel.collapsed .toggle-panel-button {
  left: 0;
}

/* 面板标题样式 */
.panel-title {
  text-align: center;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
  flex-shrink: 0;
}

.panel-title h3 {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

/* 面板控制行样式 */
.panel-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}

/* 清空列表链接样式 */
.clear-list-link {
  color: rgba(255, 255, 255, 0.8);
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
}

.clear-list-link:hover {
  color: #fff;
}

.clear-list-link.disabled {
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  text-decoration: none;
}

/* 自定义标签栏 */
.custom-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 标签头部 */
.custom-tabs-header {
  display: flex;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 8px;
  margin-top: -4px;
  flex-shrink: 0;
}

.custom-tab {
  padding: 8px 16px;
  margin: 0 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
  transition: all 0.3s;
  font-size: 13px;
}

.custom-tab:hover {
  color: #fff;
}

.custom-tab.active {
  color: #409EFF;
}

.custom-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #409EFF;
}

/* 标签内容 */
.custom-tabs-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.custom-tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* tab内容区域 */
.tab-content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 280px;
}

/* 过滤器容器 */
.filter-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

/* 记录数量显示 */
.count-badge {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 5px;
}

/* 历史过滤器 */
.history-filters {
  display: flex;
  gap: 6px;
  justify-content: center;
}

/* 命令表格容器样式 */
.command-table-container {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.1);
  flex: 1;
  display: flex;
  flex-direction: column;
}

.command-table-container-queue {
  min-height: 280px;
  max-height: 280px;
}

.command-table-container-history {
  min-height: 320px;
  max-height: 320px;
}

/* 表格头部样式 */
.command-table-header {
  display: flex;
  background-color: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  flex-shrink: 0;
}

/* 命令表格体 */
.command-table-body {
  overflow-y: auto;
  flex: 1;
  font-size: 12px;
  min-height: 200px;
}

/* 表格行样式 */
.command-table-row {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background-color 0.2s;
  color: rgba(255, 255, 255, 0.8);
}

.command-table-row:last-child {
  border-bottom: none;
}

.command-table-row:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 选中行样式 */
.command-table-row.selected-row {
  background-color: rgba(64, 158, 255, 0.3);
}

/* 等待执行状态的命令样式 */
.command-table-row.status-pending {
  border-left: 3px solid #E6A23C;
}

/* 正在执行状态的命令样式 */
.command-table-row.status-executing {
  border-left: 3px solid #409EFF;
}

/* 执行完成状态的命令样式 */
.command-table-row.status-finished {
  border-left: 3px solid #67C23A;
}

/* 执行失败状态的命令样式 */
.command-table-row.status-failed {
  border-left: 3px solid #F56C6C;
}

/* 表格列样式 */
.column {
  padding: 8px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 类型列 */
.type-column {
  width: 20%;
  flex-shrink: 0;
  min-width: 40px;
}

/* 描述列 */
.desc-column {
  flex-grow: 1;
  width: 50%;
}

/* 间隔列 */
.interval-column {
  width: 20%;
  flex-shrink: 0;
  min-width: 40px;
}

/* 拖拽列 */
.handle-column {
  width: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 拖拽手柄样式 - 用于拖动排序 */
.drag-handle {
  width: 16px;
  height: 16px;
  cursor: move;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 拖拽手柄悬停效果 */
.drag-handle:hover {
  opacity: 1;
}

/* 命令来源色块样式 */
.source-color-block {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

/* 底部操作按钮容器样式 */
.action-buttons {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
}

/* 游戏模式信息显示 */
.game-mode-info {
  margin-top: 6px;
  font-size: 11px;
  padding: 3px 6px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
}

.mode-label {
  opacity: 0.7;
}

.mode-value {
  font-weight: bold;
  margin-left: 4px;
}

/* 拖拽时的占位元素样式 */
.ghost {
  opacity: 0.5;
  background: rgba(64, 158, 255, 0.2);
}

/* 滚动条样式美化 */
.command-table-body::-webkit-scrollbar {
  width: 6px;
}

.command-table-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.command-table-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.command-table-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 修改Element组件样式 */
:deep(.el-switch__label) {
  font-size: 12px !important;
}

:deep(.el-switch__label--right) {
  margin-left: 6px !important;
}

:deep(.el-radio), :deep(.el-checkbox) {
  font-size: 12px;
  margin-right: 0;
}

:deep(.el-radio + .el-radio) {
  margin-left: 12px;
}

:deep(.el-checkbox + .el-checkbox) {
  margin-left: 12px;
}

:deep(.el-checkbox__label), :deep(.el-radio__label) {
  font-size: 12px;
}

:deep(.el-button--small) {
  font-size: 12px;
  padding: 6px 10px;
}

/* 空状态小一点 */
:deep(.el-empty__description p) {
  font-size: 12px;
}

/* 响应式布局 - 移动设备适配 */
@media (max-width: 576px) {
  /* 移动设备下操作按钮均匀分布 */
  .action-buttons {
    flex-direction: column;
  }
  
  /* 命令面板最小宽度 */
  .command-panel {
    width: 280px;
  }
}
</style> 