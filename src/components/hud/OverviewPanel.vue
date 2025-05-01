<!-- src/components/hud/OverviewPanel.vue
  总览面板，显示游戏状态和消息
-->
<template>
  <div class="overview-container">
    <!-- 工具命令栏 -->
    <div class="tool-command-bar">
      <!-- 复位按钮 -->
      <div 
        class="command-button reset-button" 
        :class="{'disabled': isButtonDisabled(GameButtons.RESET_CAMERA)}"
        @click="executeCommand('RESET_CAMERA')"
      >
        <el-tooltip content="复位视角" placement="left">
          <i class="el-icon-refresh-right"></i>
        </el-tooltip>
      </div>

      <!-- 环绕视角按钮 -->
      <div 
        class="command-button orbit-button" 
        :class="{
          'disabled': isButtonDisabled(GameButtons.ORBIT),
          'active': store.gameMode === GameMode.ORBIT
        }"
        @click="toggleOrbitMode"
      >
        <el-tooltip content="环绕视角" placement="left">
          <i class="el-icon-refresh"></i>
        </el-tooltip>
      </div>

      <!-- 统计模式按钮 -->
      <div 
        class="command-button statistics-button" 
        :class="{
          'disabled': isButtonDisabled(GameButtons.STATISTICS),
          'active': store.gameMode === GameMode.STATISTICS
        }"
        @click="toggleStatisticsMode"
      >
        <el-tooltip content="统计模式" placement="left">
          <i class="el-icon-data-analysis"></i>
        </el-tooltip>
      </div>

      <!-- 切换图层按钮 -->
      <div 
        class="command-button layer-button" 
        :class="{'disabled': isButtonDisabled(GameButtons.TOGGLE_LAYER)}"
        @click="cycleMapLayer"
      >
        <el-tooltip content="切换图层" placement="left">
          <i class="el-icon-s-operation"></i>
        </el-tooltip>
      </div>
    </div>

    <!-- 总览面板 -->
    <div class="overview-panel">
      <!-- 面板顶部信息 -->
      <div class="panel-header">
        <div class="round-info">第 {{ currentRound }} 回合</div>
        <div class="faction-info" :class="`faction-${currentFaction}`">
          {{ getFactionName(currentFaction) }}
        </div>
        <div class="game-mode-info">{{ currentGameModeName }}</div>
      </div>

      <!-- 信息框 -->
      <div class="message-container">
        <!-- 统计模式信息展示 -->
        <div v-if="store.gameMode === GameMode.STATISTICS" class="statistics-info">
          <div class="stat-header">战场态势统计</div>
          
          <div class="stat-section">
            <div class="stat-title">{{ currentRound }}回合状态</div>
            <div class="stat-row">
              <span>{{ hexSelectionSummary }}</span>
            </div>
          </div>
          
          <div class="stat-section">
            <div class="stat-title">蓝方</div>
            <div class="stat-row">
              <span>{{ blueFactionSummary }}</span>
            </div>
            <div class="stat-row">
              <span>进攻/防御火力值：{{ bluePowerSummary }}</span>
            </div>
          </div>
          
          <div class="stat-section">
            <div class="stat-title">红方</div>
            <div class="stat-row">
              <span>{{ redFactionSummary }}</span>
            </div>
            <div class="stat-row">
              <span>进攻/防御火力值：{{ redPowerSummary }}</span>
            </div>
          </div>
        </div>
        
        <!-- 消息记录显示 -->
        <div v-else class="message-list" ref="messageListRef">
          <div 
            v-for="(message, index) in messages" 
            :key="index" 
            class="message-item"
            :class="getMessageTypeClass(message.type)"
          >
            {{ message.content }}
          </div>
          <div v-if="messages.length === 0" class="empty-message">
            暂无消息
          </div>
        </div>
      </div>
      
      <!-- 底部控制栏 -->
      <div class="panel-footer" v-if="showFooterControls">
        <el-button 
          size="small" 
          type="primary" 
          @click="handleNextTurn"
          :disabled="isButtonDisabled(GameButtons.NEXT_FACTION)"
        >
          下一回合 <i class="el-icon-arrow-right el-icon--right"></i>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { GameMode, GameModeNames, GameButtons } from '@/config/GameModeConfig';
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';

// 状态管理
const store = openGameStore();
const messageListRef = ref(null);
const currentLayerIndex = ref(1); // 当前图层索引，默认从1开始

// 消息记录
const messages = computed(() => store.messages || []);

// 游戏信息
const currentRound = computed(() => store.currentRound || 1);
const currentFaction = computed(() => store.currentFaction || 'blue');
const currentGameModeName = computed(() => GameModeNames[store.gameMode] || '自由模式');

// 是否显示底部控制栏
const showFooterControls = computed(() => 
  store.gameMode === GameMode.FREE || 
  store.gameMode === GameMode.STATISTICS
);

// 统计信息计算属性
const hexSelectionSummary = computed(() => {
  const selectedHexes = store.selectedHexIds ? store.selectedHexIds.size : 0;
  const totalForces = countAllForces();
  return `${selectedHexes} 六角格选中, ${totalForces} 部队选中。`;
});

const blueFactionSummary = computed(() => {
  const count = countForcesByFaction('blue');
  return `${count}支部队`;
});

const redFactionSummary = computed(() => {
  const count = countForcesByFaction('red');
  return `${count}支部队`;
});

const bluePowerSummary = computed(() => {
  const powers = calculateFactionPower('blue');
  return `${powers.offense}/${powers.defense}`;
});

const redPowerSummary = computed(() => {
  const powers = calculateFactionPower('red');
  return `${powers.offense}/${powers.defense}`;
});

// 辅助函数：统计特定阵营的部队数量
function countForcesByFaction(faction) {
  return store.getForces().filter(force => force.faction === faction).length;
}

// 辅助函数：统计所有部队数量
function countAllForces() {
  return store.getForces().length;
}

// 辅助函数：计算阵营总战力
function calculateFactionPower(faction) {
  const forces = store.getForces().filter(force => force.faction === faction);
  
  const totalOffense = forces.reduce((sum, force) => sum + (force.offensivePower || 0), 0);
  const totalDefense = forces.reduce((sum, force) => sum + (force.defensivePower || 0), 0);
  
  return {
    offense: totalOffense,
    defense: totalDefense
  };
}

// 辅助函数：获取阵营名称
function getFactionName(faction) {
  switch (faction) {
    case 'blue': return '蓝方';
    case 'red': return '红方';
    default: return faction || '中立';
  }
}

// 辅助函数：获取消息类型样式
function getMessageTypeClass(type) {
  switch (type) {
    case 'error': return 'message-error';
    case 'warning': return 'message-warning';
    case 'success': return 'message-success';
    case 'info': default: return 'message-info';
  }
}

// 按钮禁用状态检查
function isButtonDisabled(buttonId) {
  // 如果在当前游戏模式下被禁用
  if (store.gameMode !== GameMode.FREE && store.disabledButtons.has(buttonId)) {
    return true;
  }
  
  // 命令执行中禁用所有按钮
  if (store.isExecuting) {
    return true;
  }
  
  return false;
}

// 执行命令
function executeCommand(commandType, params = {}) {
  CommandService.executeCommandFromUI(commandType, params)
    .catch(error => {
      showWarning(`执行命令失败: ${error.message}`);
    });
}

// 切换环绕模式
function toggleOrbitMode() {
  if (isButtonDisabled(GameButtons.ORBIT)) return;
  
  const isCurrentlyInOrbitMode = store.gameMode === GameMode.ORBIT;
  executeCommand('ORBIT_MODE', { enabled: !isCurrentlyInOrbitMode });
}

// 切换统计模式
function toggleStatisticsMode() {
  if (isButtonDisabled(GameButtons.STATISTICS)) return;
  
  const isCurrentlyInStatMode = store.gameMode === GameMode.STATISTICS;
  executeCommand('STATISTIC', { enabled: !isCurrentlyInStatMode });
}

// 循环切换地图图层
function cycleMapLayer() {
  if (isButtonDisabled(GameButtons.TOGGLE_LAYER)) return;
  
  // 假设有3个图层，循环切换 1->2->3->1
  currentLayerIndex.value = (currentLayerIndex.value % 3) + 1;
  
  executeCommand('CHANGE_LAYER', { layerIndex: currentLayerIndex.value });
}

// 下一回合
function handleNextTurn() {
  if (isButtonDisabled(GameButtons.NEXT_FACTION)) return;
  
  executeCommand('NEXT_FACTION');
}

// 监听消息变化，自动滚动到底部
watch(() => messages.value.length, () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
});

// 组件挂载完成后，自动滚动消息到底部
onMounted(() => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
});
</script>

<style scoped>
.overview-container {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

/* 总览面板样式 */
.overview-panel {
  width: 260px;
  height: 220px;
  background-color: rgba(169, 140, 102, 0.9);
  color: #f0f0f0;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 面板顶部样式 */
.panel-header {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 8px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.round-info {
  font-weight: bold;
}

.faction-info {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 2px;
}

.faction-blue {
  color: #4a90e2;
}

.faction-red {
  color: #e24a4a;
}

.game-mode-info {
  font-size: 0.9em;
  opacity: 0.8;
}

/* 信息框样式 */
.message-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.message-list {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
  background-color: rgba(0, 0, 0, 0.1);
}

.message-item {
  margin-bottom: 5px;
  padding: 3px 5px;
  border-radius: 2px;
  word-break: break-word;
}

.message-error {
  color: #ff6b6b;
  background-color: rgba(255, 107, 107, 0.1);
}

.message-warning {
  color: #ffd166;
  background-color: rgba(255, 209, 102, 0.1);
}

.message-success {
  color: #6bff6b;
  background-color: rgba(107, 255, 107, 0.1);
}

.message-info {
  color: #f0f0f0;
}

.empty-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

/* 统计信息样式 */
.statistics-info {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  font-size: 12px;
}

.stat-header {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 10px;
  text-align: center;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-section {
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-row {
  margin-bottom: 3px;
  display: flex;
  justify-content: space-between;
}

/* 面板底部样式 */
.panel-footer {
  padding: 8px;
  display: flex;
  justify-content: center;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.1);
}

/* 工具命令栏样式 */
.tool-command-bar {
  display: flex;
  flex-direction: column;
  margin-right: 10px;
}

.command-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(169, 140, 102, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
}

.command-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px 0 rgba(0, 0, 0, 0.3);
}

.command-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.command-button.active {
  background-color: #4a90e2;
  color: white;
}

.command-button i {
  font-size: 20px;
  color: #f0f0f0;
}

.reset-button {
  background-color: #6c757d;
}

.orbit-button {
  background-color: #5c6bc0;
}

.statistics-button {
  background-color: #26a69a;
}

.layer-button {
  background-color: #ec407a;
}
</style>
