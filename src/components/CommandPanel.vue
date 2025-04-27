<!-- src\components\CommandPanel.vue -->
<template>
  <div class="command-panel">
    <div class="command-panel-header">
      <h3>命令控制面板</h3>
    </div>

    <div class="command-panel-body">
      <!-- 命令加载选项 -->
      <div class="command-input-section">
        <h4>加载命令</h4>
        <div class="command-input-options">
          <div class="option-group">
            <label class="file-upload-btn">
              从文件加载
              <input
                type="file"
                accept=".json"
                @change="handleFileUpload"
                ref="fileInput"
              />
            </label>
            <span class="help-text">上传JSON格式命令文件</span>
          </div>

          <div class="option-group">
            <div class="api-input-group">
              <input
                v-model="apiUrl"
                type="text"
                placeholder="API地址"
                class="api-input"
              />
              <button
                @click="fetchFromAPI"
                :disabled="!isValidUrl || isLoading"
                class="fetch-btn"
              >
                拉取命令
              </button>
            </div>
            <span class="help-text">从远程API拉取命令</span>
          </div>
        </div>
      </div>

      <!-- 当前执行命令 -->
      <div class="current-command-section" v-if="currentCommand">
        <h4>当前执行命令</h4>
        <div class="command-card current">
          <div class="command-header">
            <span class="command-type">{{ currentCommand.type }}</span>
            <span class="command-status">{{ commandStatusText(currentCommand.status) }}</span>
          </div>
          <div class="command-body">
            <pre>{{ JSON.stringify(currentCommand.params, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- 命令队列 -->
      <div class="queue-section" v-if="commandQueue.length > 0">
        <div class="section-header">
          <h4>命令队列 ({{ commandQueue.length }})</h4>
          <button @click="clearQueue" class="clear-btn">清空队列</button>
        </div>
        <div class="command-list">
          <div v-for="cmd in commandQueue" :key="cmd.id" class="command-card queue">
            <div class="command-header">
              <span class="command-type">{{ cmd.type }}</span>
              <span class="command-source">{{ commandSourceText(cmd.source) }}</span>
            </div>
            <div class="command-summary">
              {{ getCommandSummary(cmd) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 执行历史 -->
      <div class="history-section" v-if="executionHistory.length > 0">
        <div class="section-header">
          <h4>执行历史 ({{ executionHistory.length }})</h4>
          <button @click="clearHistory" class="clear-btn">清空历史</button>
        </div>
        <div class="command-list">
          <div
            v-for="item in executionHistory"
            :key="item.command.id"
            class="command-card history"
            :class="{ success: item.status === 'success', error: item.status === 'error' }"
          >
            <div class="command-header">
              <span class="command-type">{{ item.command.type }}</span>
              <span class="command-status">{{ commandStatusText(item.status) }}</span>
            </div>
            <div class="command-summary">
              {{ getCommandSummary(item.command) }}
            </div>
            <div v-if="item.error" class="command-error">
              {{ item.error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载指示器 -->
    <div class="loading-overlay" v-if="isLoading">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { 
  commandService, 
  loadCommandsFromFile, 
  fetchCommandsFromAPI 
} from '@/layers/interaction-layer/CommandService';
import { showSuccess, showError } from '@/layers/interaction-layer/MessageBox';

// 响应式状态
const fileInput = ref(null);
const apiUrl = ref('');
const isLoading = ref(false);
const loadingText = ref('加载中...');
const executionHistory = ref([]);
const currentCommand = ref(null);
const commandQueue = ref([]);

// URL 验证
const isValidUrl = computed(() => {
  try {
    new URL(apiUrl.value);
    return true;
  } catch {
    return false;
  }
});

// 事件监听器清理函数
let unsubscribeExecuted = null;
let unsubscribeError = null;

// 生命周期钩子
onMounted(() => {
  // 监听命令状态变化
  updateCommandState();
  
  // 订阅命令执行事件
  unsubscribeExecuted = commandService.addEventListener('onCommandExecuted', ({ command, result }) => {
    executionHistory.value.unshift({
      command,
      result,
      status: 'success',
      timestamp: Date.now()
    });
    updateCommandState();
  });
  
  // 订阅命令错误事件
  unsubscribeError = commandService.addEventListener('onCommandError', ({ command, error }) => {
    executionHistory.value.unshift({
      command,
      error: error.message,
      status: 'error',
      timestamp: Date.now()
    });
    updateCommandState();
  });
  
  // 定期更新命令状态
  const intervalId = setInterval(updateCommandState, 500);
  
  onUnmounted(() => {
    clearInterval(intervalId);
    if (unsubscribeExecuted) unsubscribeExecuted();
    if (unsubscribeError) unsubscribeError();
  });
});

// 方法
function updateCommandState() {
  currentCommand.value = commandService.state.currentCommand;
  commandQueue.value = [...commandService.state.commandQueue];
}

// 从文件加载命令
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  isLoading.value = true;
  loadingText.value = '正在加载命令文件...';
  
  try {
    const results = await loadCommandsFromFile(file);
    showSuccess(`成功加载 ${results.length} 个命令`);
    
    // 重置文件输入框，允许重复选择同一文件
    fileInput.value.value = '';
  } catch (error) {
    showError(`加载命令文件失败: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
}

// 从API拉取命令
async function fetchFromAPI() {
  if (!isValidUrl.value) return;
  
  isLoading.value = true;
  loadingText.value = '正在从API拉取命令...';
  
  try {
    const results = await fetchCommandsFromAPI(apiUrl.value);
    showSuccess(`成功拉取 ${results.length} 个命令`);
  } catch (error) {
    showError(`从API拉取命令失败: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
}

// 清空命令队列
function clearQueue() {
  commandService.clearCommandQueue();
  updateCommandState();
}

// 清空执行历史
function clearHistory() {
  executionHistory.value = [];
}

// 获取命令摘要
function getCommandSummary(command) {
  switch (command.type) {
    case 'MOVE':
      return `移动部队 ${command.params.force_id} 到路径终点`;
    case 'ATTACK':
      return `部队 ${command.params.command_force_id} 攻击目标 ${command.params.target_hex}`;
    case 'CREATE_FORCE':
      return `在 ${command.params.hex_id} 创建 ${command.params.faction} 阵营部队`;
    case 'MERGE_FORCES':
      return `合并 ${command.params.force_ids.length} 个部队`;
    case 'SPLIT_FORCE':
      return `拆分部队 ${command.params.force_id}`;
    case 'QUERY':
      return `查询${command.params.query_type}信息`;
    default:
      return `${command.type} 命令`;
  }
}

// 命令状态文本
function commandStatusText(status) {
  switch (status) {
    case 'pending': return '等待中';
    case 'success': return '成功';
    case 'error': return '失败';
    default: return status;
  }
}

// 命令来源文本
function commandSourceText(source) {
  switch (source) {
    case 'ui': return 'UI界面';
    case 'file': return '文件导入';
    case 'api': return 'API拉取';
    default: return source;
  }
}
</script>

<style scoped>
.command-panel {
  background-color: #f5f7fa;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

.command-panel-header {
  background-color: #2c3e50;
  color: white;
  padding: 12px 16px;
}

.command-panel-header h3 {
  margin: 0;
  font-size: 16px;
}

.command-panel-body {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.command-input-section,
.current-command-section,
.queue-section,
.history-section {
  margin-bottom: 24px;
}

.command-input-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.option-group {
  display: flex;
  flex-direction: column;
}

.file-upload-btn {
  background-color: #3498db;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-block;
  font-size: 14px;
  transition: background-color 0.3s;
  width: fit-content;
}

.file-upload-btn:hover {
  background-color: #2980b9;
}

.file-upload-btn input {
  display: none;
}

.api-input-group {
  display: flex;
  gap: 8px;
}

.api-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.fetch-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.fetch-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.fetch-btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.help-text {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-header h4 {
  margin: 0;
}

.clear-btn {
  background-color: transparent;
  color: #e74c3c;
  border: 1px solid #e74c3c;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.clear-btn:hover {
  background-color: #e74c3c;
  color: white;
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.command-card {
  background-color: white;
  border-radius: 4px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.command-card.current {
  border-left: 4px solid #f39c12;
}

.command-card.queue {
  border-left: 4px solid #3498db;
}

.command-card.history.success {
  border-left: 4px solid #2ecc71;
}

.command-card.history.error {
  border-left: 4px solid #e74c3c;
}

.command-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.command-type {
  font-weight: bold;
  font-size: 14px;
}

.command-status,
.command-source {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  background-color: #f5f7fa;
}

.command-summary {
  font-size: 14px;
  color: #34495e;
}

.command-body pre {
  margin: 0;
  overflow-x: auto;
  font-size: 13px;
  background-color: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
}

.command-error {
  margin-top: 8px;
  color: #e74c3c;
  font-size: 13px;
  background-color: #ffeeee;
  padding: 6px 8px;
  border-radius: 4px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: #2c3e50;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (min-width: 768px) {
  .command-input-options {
    flex-direction: row;
    gap: 16px;
  }
  
  .option-group {
    flex: 1;
  }
}
</style> 