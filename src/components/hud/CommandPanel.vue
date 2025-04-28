<!-- src/components/hud/CommandPanel.vue -->
<template>
  <div class="command-panel">
    <!-- 主面板卡片 -->
    <el-card>
      <!-- 面板头部 -->
      <template #header>
        <div class="panel-header">
          <h3>命令控制面板</h3>
          <!-- 自动/手动模式切换开关 -->
          <el-switch
            v-model="autoMode"
            active-text="自动模式"
            inactive-text="手动模式"
            :disabled="isExecuting && !autoMode"
          />
        </div>
      </template>
    
      <!-- 标签页容器 -->
      <el-tabs v-model="activeTab">
        <!-- 命令队列标签页 -->
        <el-tab-pane label="命令队列" name="queue">
          <!-- 队列标题和过滤器 -->
          <div class="section-header">
            <h4>命令队列 ({{ filteredQueueCommands.length }} / {{ CommandLimit.QUEUE_LIMIT }})</h4>
            <!-- 命令来源过滤器（单选） -->
            <div class="source-filters">
              <el-radio-group v-model="queueSourceSelected" @change="handleQueueSourceChange">
                <el-radio label="API">API</el-radio>
                <el-radio label="FILE">文件</el-radio>
                <el-radio label="MANUAL">手动</el-radio>
              </el-radio-group>
            </div>
          </div>
          
          <!-- 空队列提示 -->
          <el-empty v-if="filteredQueueCommands.length === 0" description="暂无待执行命令" />
          
          <!-- 可拖拽的命令列表 -->
          <draggable
            v-else
            v-model="draggedQueueCommands"
            item-key="id"
            handle=".drag-handle"
            ghost-class="ghost"
            :disabled="autoMode || isExecuting"
            @end="handleDragEnd"
          >
            <!-- 单个命令项模板 -->
            <template #item="{ element }">
              <!-- 命令项的status样式 -->
              <div 
                class="command-item"
                :class="commandStatusClass(element.status)"
              >
                <!-- 拖拽手柄 -->
                <div class="drag-handle" v-if="!autoMode && !isExecuting">
                  <i class="el-icon-menu"></i>
                </div>
                <!-- 命令信息区域 -->
                <div class="command-info">
                  <!-- 命令类型 -->
                  <div class="command-header">
                    <span class="command-type">{{ commandTypeText(element.type) }}</span>
                  </div>
                  <!-- 命令描述 -->
                  <div class="command-description">
                    {{ getCommandSummary(element) }}
                  </div>
                  <!-- 命令执行间隔 -->
                  <div class="command-detail" v-if="element.interval !== undefined">
                    <span>{{ element.interval < 0 ? '停止' : element.interval + 'ms' }}</span>
                  </div>
                </div>
                <!-- 命令操作按钮组 -->
                <div class="command-actions" v-if="!autoMode && !isExecuting">
                  <el-button 
                    type="primary" 
                    size="small" 
                    icon="el-icon-video-play" 
                    circle
                    @click="executeCommand(element.id)"
                    title="执行"
                  ></el-button>
                  <el-button 
                    type="warning" 
                    size="small" 
                    icon="el-icon-edit" 
                    circle
                    @click="editCommand(element)"
                    title="编辑"
                  ></el-button>
                  <el-button 
                    type="danger" 
                    size="small" 
                    icon="el-icon-delete" 
                    circle
                    @click="removeCommand(element.id)"
                    title="删除"
                  ></el-button>
                </div>
              </div>
            </template>
          </draggable>
        </el-tab-pane>
        
        <!-- 命令历史标签页 -->
        <el-tab-pane label="命令历史" name="history">
          <!-- 历史标题和操作 -->
          <div class="section-header">
            <h4>命令历史 ({{ filteredHistoryCommands.length }} / {{ CommandLimit.HISTORY_LIMIT }})</h4>
            <div class="history-actions">
              <!-- 命令来源过滤器（多选） -->
              <div class="source-filters">
                <el-checkbox v-model="historyFilters.UI" @change="handleHistoryFilterChange">UI</el-checkbox>
                <el-checkbox v-model="historyFilters.API" @change="handleHistoryFilterChange">API</el-checkbox>
                <el-checkbox v-model="historyFilters.FILE" @change="handleHistoryFilterChange">文件</el-checkbox>
                <el-checkbox v-model="historyFilters.MANUAL" @change="handleHistoryFilterChange">手动</el-checkbox>
              </div>
              <el-button type="danger" size="small" @click="clearHistory" :disabled="store.commandHistory.length === 0">
                清空历史
              </el-button>
            </div>
          </div>
          
          <!-- 空历史提示 -->
          <el-empty v-if="filteredHistoryCommands.length === 0" description="暂无命令历史" />
          
          <!-- 历史命令列表 -->
          <div v-else>
            <div 
              v-for="item in filteredHistoryCommands" 
              :key="item.command.id"
              class="command-item"
              :class="commandStatusClass(item.command.status)"
            >
              <!-- 命令信息区域 -->
              <div class="command-info">
                <!-- 命令类型和来源 -->
                <div class="command-header">
                  <span class="command-type">{{ commandTypeText(item.command.type) }}</span>
                  <el-tag size="small" :type="commandSourceTag(item.command.source)">
                    {{ commandSourceText(item.command.source) }}
                  </el-tag>
                  <span class="timestamp">{{ calDuration(item.command.startTime, item.command.endTime) }}</span>
                </div>
                <!-- 命令描述 -->
                <div class="command-description">
                  {{ getCommandSummary(item.command) }}
                </div>
                <!-- 结果信息 -->
                <div class="result-info" v-if="item.result">
                  <span>{{ item.result.message }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <!-- 底部操作按钮区域 -->
      <div class="action-buttons">
        <el-button type="primary" @click="showCommandEditor()" :disabled="autoMode || isExecuting">
          添加命令
        </el-button>
        <el-button type="success" @click="uploadFile" :disabled="autoMode || isExecuting">
          从文件导入
        </el-button>
        <el-button type="info" @click="showApiDialog" :disabled="autoMode || isExecuting">
          从API获取
        </el-button>
        <el-button type="danger" @click="clearQueue" :disabled="autoMode || isExecuting">
          清空队列
        </el-button>
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
  "type": "MOVE",
  "params": {
    "forceId": "F_1",
    "path": ["H_1_1", "H_1_2"]
  },
  "interval": 1000
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
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showError, showWarning } from '@/layers/interaction-layer/MessageBox';
import draggable from 'vuedraggable';
import { CommandLimit, CommandType, CommandTypeMap, CommandSource, CommandStatus, ApiConfig } from '@/config/CommandConfig';


// 表单状态
const commandEditorVisible = ref(false);
const apiDialogVisible = ref(false);
const isEditMode = ref(false);
const editingCommandId = ref(null);
const commandForm = ref({
  json: ''
});
const apiForm = ref({
  url: ApiConfig.URL
});
const fileInput = ref(null);
const activeTab = ref('queue');  // 默认显示命令队列标签页

// 过滤器状态
const historyFilters = ref({
  UI: true,
  API: true,
  FILE: true,
  MANUAL: true
});

// 队列源选择（单选）
const queueSourceSelected = ref('API'); // 默认选中API

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
const isExecuting = computed(() => store.isExecuting);

// 过滤后的命令队列
const filteredQueueCommands = computed(() => {
  return commandQueue.value.filter(cmd => {
    // 排除UI来源，只显示符合当前选择的来源
    return cmd.source !== CommandSource.UI && cmd.source === queueSourceSelected.value;
  });
});

// 过滤出已完成和失败的命令（历史）
const filteredHistoryCommands = computed(() => {
  return commandHistory.value.filter(item => {
    // 根据历史记录过滤器显示选中的来源
    return store.commandHistoryFilter[item.command.source];
  });
});

// 可拖拽排序的命令队列
const draggedQueueCommands = computed({
  get: () => filteredQueueCommands.value,
  set: () => {
    // 拖拽结束后会触发这里，但我们在handleDragEnd中处理排序
  }
});

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

// 初始化过滤器状态与store同步
handleQueueSourceChange(queueSourceSelected.value);
handleHistoryFilterChange();

// 方法
/** 命令类型-中文映射 */
function commandTypeText(type) {
  return CommandTypeMap[type] || type;
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

/** 命令来源-标签颜色映射 */
function commandSourceTag(source) {
  switch (source) {
    case CommandSource.UI: return 'info'; // 蓝色
    case CommandSource.API: return 'success'; // 绿色
    case CommandSource.FILE: return 'warning'; // 黄色
    case CommandSource.MANUAL: return 'danger'; // 红色
    default: return 'info';
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
  if (!startTime || !endTime) return '';
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
      return `${command.params.enabled ? '开启' : '关闭'}轨道模式`;
    case CommandType.CHANGE_LAYER:
      return `切换到图层 ${command.params.layerIndex}`;
    case CommandType.SELECTION_MODE:
      return `切换到${command.params.isMultiSelect ? '多选' : '单选'}模式`;
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

/** 编辑命令 */
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
  try {
    const commandData = JSON.parse(commandForm.value.json);
    
    // 验证命令格式
    if (!commandData.type) {
      showError('命令格式错误：缺少type字段');
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
      }
    } else {
      // 添加新命令
      const command = {
        type: commandData.type,
        params: commandData.params,
        interval: commandData.interval !== undefined ? commandData.interval : 0,
        source: CommandSource.MANUAL,  // 手动输入的命令
      };
      store.addCommandToQueue(command);
      showSuccess('命令已添加到队列');
    }
    
    commandEditorVisible.value = false;
  } catch (error) {
    showError(`解析命令失败: ${error.message}`);
  }
}

/** 执行命令 */
function executeCommand(commandId) {
  if (isExecuting.value) {
    showWarning('有命令正在执行，请稍候再试');
    return;
  }
  
  CommandService.executeQueuedCommand(commandId)
    .then((historyItem) => {
      if (historyItem && historyItem.result) {
        showSuccess(historyItem.result.message || '命令执行成功，但无详细信息');
      } else {
        showSuccess('命令执行成功，但无详细信息');
      }
    })
    .catch(error => {
      showError(`命令执行失败: ${error.message}`);
    });
}

/** 删除命令 */
function removeCommand(commandId) {
  store.removeCommandFromQueue(commandId);
}

/** 清空命令队列 */
function clearQueue() {
  store.clearCommandQueue();
}

/** 清空命令历史 */
function clearHistory() {
  store.clearCommandHistory();
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
    .catch(error => {
      showError(`加载命令文件失败: ${error.message}`);
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
  
  CommandService.fetchCommandsFromAPI(apiForm.value.url)
    .then(() => {
      apiDialogVisible.value = false;
    })
    .catch(error => {
      showError(`从API获取命令失败: ${error.message}`);
    });
}

/** 拖拽结束处理 */ 
function handleDragEnd() {
  // 获取所有命令ID的新顺序
  const newOrder = draggedQueueCommands.value.map(cmd => cmd.id);
  store.reorderCommandQueue(newOrder);
}

/** 处理命令队列源选择变化 */
function handleQueueSourceChange(value) {
  // 更新store中的过滤器
  const filter = {
    API: false,
    FILE: false,
    MANUAL: false
  };
  filter[value] = true;
  store.setCommandQueueFilter(filter);
}

/** 处理历史记录过滤器变化 */
function handleHistoryFilterChange() {
  store.setCommandHistoryFilter(historyFilters.value);
}

</script>

<style scoped>
/* 命令面板样式 - 整体容器 */
.command-panel {
  max-width: 800px;
  margin: 0 auto;
}

/* 面板头部样式 - 标题和自动模式开关的容器 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 面板标题样式 */
.panel-header h3 {
  margin: 0;
}

/* 区域头部样式 - 标题和过滤器的容器 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

/* 区域标题样式 */
.section-header h4 {
  margin: 0;
}

/* 来源过滤器容器样式 */
.source-filters {
  display: flex;
  gap: 10px;
}

/* 命令队列标签页样式 */
.el-tab-pane {
  max-height: 400px;
  overflow-y: auto;
}

/* 命令项样式 - 每个命令的卡片 */
.command-item {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  border-left: 4px solid #909399;
  background-color: #f5f7fa;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

/* 等待执行状态的命令样式 */
.command-item.status-pending {
  border-left-color: #E6A23C;
}

/* 正在执行状态的命令样式 */
.command-item.status-executing {
  border-left-color: #409EFF;
  background-color: #ecf5ff;
}

/* 执行完成状态的命令样式 */
.command-item.status-finished {
  border-left-color: #67C23A;
}

/* 执行失败状态的命令样式 */
.command-item.status-failed {
  border-left-color: #F56C6C;
  background-color: #fef0f0;
}

/* 拖拽手柄样式 - 用于拖动排序 */
.drag-handle {
  width: 20px;
  margin-right: 10px;
  cursor: move;
  opacity: 0.6;
}

/* 拖拽手柄悬停效果 */
.drag-handle:hover {
  opacity: 1;
}

/* 命令信息容器样式 */
.command-info {
  flex: 1;
}

/* 命令头部样式 - 类型和标签的容器 */
.command-header {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

/* 命令类型文本样式 */
.command-type {
  font-weight: bold;
  margin-right: 10px;
}

/* 时间戳样式 */
.timestamp {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

/* 命令描述文本样式 */
.command-description {
  font-size: 14px;
  color: #606266;
  margin-bottom: 5px;
}

/* 命令详情文本样式 - 如执行间隔 */
.command-detail {
  font-size: 12px;
  color: #909399;
}

/* 结果信息样式 */
.result-info {
  font-size: 12px;
  color: #67C23A;
  margin-top: 5px;
}

/* 错误信息样式 */
.error-info {
  font-size: 12px;
  color: #F56C6C;
  margin-top: 5px;
}

/* 命令操作按钮容器样式 */
.command-actions {
  display: flex;
  gap: 8px;
}

/* 底部操作按钮容器样式 */
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

/* 拖拽时的占位元素样式 */
.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

/* 响应式布局 - 移动设备适配 */
@media (max-width: 576px) {
  /* 移动设备下面板头部改为垂直排列 */
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  /* 移动设备下区域头部改为垂直排列 */
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  /* 移动设备下命令项改为垂直排列 */
  .command-item {
    flex-direction: column;
  }
  
  /* 移动设备下操作按钮位置调整 */
  .command-actions {
    margin-top: 10px;
    align-self: flex-end;
  }
  
  /* 移动设备下底部按钮均匀分布 */
  .action-buttons {
    justify-content: space-between;
  }
}
</style> 