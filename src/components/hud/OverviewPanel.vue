<!-- src/components/hud/OverviewPanel.vue
  总览面板，显示游戏状态和消息
-->
<template>
  <div class="overview-container">
    <!-- 左侧：圆形按钮栏 -->
    <div class="side-buttons">
      <!-- 复位视角按钮 -->
      <div class="command-button" 
           :class="{'disabled': isButtonDisabled(GameButtons.RESET_CAMERA)}"
           @click="executeCommand(CommandType.RESET_CAMERA)"
           title="复位视角">
        <img src="/assets/icons/reset.png" alt="复位视角" />
      </div>
      
      <!-- 俯瞰模式按钮 -->
      <div class="command-button" 
           :class="{
             'disabled': isButtonDisabled(GameButtons.PANORAMA),
             'active': store.gameMode === GameMode.PANORAMA
           }"
           @click="togglePanoramaMode"
           title="俯瞰模式">
        <img src="/assets/icons/panorama.png" alt="俯瞰模式" />
      </div>

      <!-- 环绕视角按钮 -->
      <div class="command-button" 
           :class="{
             'disabled': isButtonDisabled(GameButtons.ORBIT),
             'active': store.gameMode === GameMode.ORBIT
           }"
           @click="toggleOrbitMode"
           title="环绕视角">
        <img src="/assets/icons/orbit.png" alt="环绕视角" />
      </div>

      <!-- 统计模式按钮 -->
      <div class="command-button" 
           :class="{
             'disabled': isButtonDisabled(GameButtons.STATISTICS),
             'active': store.gameMode === GameMode.STATISTICS
           }"
           @click="toggleStatisticsMode"
           title="统计模式">
        <img src="/assets/icons/multiSelect.png" alt="统计模式" />
      </div>

      <!-- 切换图层按钮 -->
      <div class="command-button" 
           :class="{
             'disabled': isButtonDisabled(GameButtons.TOGGLE_LAYER),
             'terrain-layer': currentLayerName === '地形图层',
             'no-hex-layer': currentLayerName === '无六角格图层',
           }"
           @click="cycleMapLayer"
           :title="`图层: ${currentLayerName}`">
        <img src="/assets/icons/layer.png" alt="切换图层" />
      </div>
    </div>

    <!-- 总览面板 -->
    <div class="overview-panel">
      <!-- 面板顶部信息和控制按钮 -->
      <div class="panel-header">
        <div class="header-left">
          <div class="round-info">第 {{ currentRound }} 回合</div>
          <div class="faction-info" :class="`faction-${currentFaction}`">
            {{ getFactionName(currentFaction) }}
          </div>
          <div class="game-mode-info">{{ currentGameModeName }}</div>
        </div>

        <div class="header-right">
          <!-- 结束回合按钮 -->
          <div class="next-turn-button" 
               :class="{'disabled': isButtonDisabled(GameButtons.NEXT_FACTION)}"
               @click="handleNextTurn"
               title="结束回合">
            <span>结束回合</span>
            <img src="/assets/icons/next.png" alt="结束回合" />
          </div>
        </div>
      </div>

      <!-- 主要信息显示区域（控制台效果） -->
      <div class="console-area">
        <div class="console-header">
          <span>战场指挥控制台</span>
          <div class="console-actions">
            <div class="console-action" @click="clearConsole" title="清空控制台">
              <img src="/assets/icons/delete.png" alt="清空" />
            </div>
          </div>
        </div>
        <div class="console-wrapper">
          <div class="console-container" ref="consoleContainerRef">
            <div v-for="(line, index) in consoleLines" :key="index" 
                class="console-line" 
                :class="line.type">
              {{ line.content }}
            </div>
            <div v-if="consoleLines.length === 0" class="console-empty">
              暂无信息
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { GameMode, GameModeNames, GameButtons } from '@/config/GameModeConfig';
import { CommandType } from '@/config/CommandConfig';
import { showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import { OverviewConsole } from '@/layers/interaction-layer/utils/OverviewConsole';
import { BattleConfig } from '@/config/GameConfig';

// 状态管理
const store = openGameStore();
const consoleContainerRef = ref(null);
const currentLayerIndex = ref(1); // 当前图层索引，默认从1开始

// 图层名称映射
const layerNames = {
  1: '默认图层',
  2: '地形图层',
  3: '无六角格图层'
};

// 控制台行数据
const consoleLines = ref(OverviewConsole.getLines());

// 游戏信息
const currentRound = computed(() => store.currentRound || 1);
const currentFaction = computed(() => store.currentFaction || 'blue');
const currentGameModeName = computed(() => GameModeNames[store.gameMode] || '自由模式');
const currentLayerName = computed(() => layerNames[currentLayerIndex.value] || '未知图层');

// 辅助函数：获取阵营名称
function getFactionName(faction) {
  switch (faction) {
    case 'blue': return '蓝方';
    case 'red': return '红方';
    default: return faction || '中立';
  }
}

// 按钮禁用状态检查
function isButtonDisabled(buttonId) {
  // 命令执行中禁用所有按钮
  if (store.isExecuting) {
    return true;
  }

  // 检查当前游戏模式定义的禁用按钮
  if (store.disabledButtons.has(buttonId)) {
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

// 切换俯瞰模式
function togglePanoramaMode() {
  if (isButtonDisabled(GameButtons.PANORAMA)) return;
  
  const isCurrentlyInPanoramaMode = store.gameMode === GameMode.PANORAMA;

  executeCommand(CommandType.PANORAMA_MODE, { enabled: !isCurrentlyInPanoramaMode });
}

// 切换环绕模式
function toggleOrbitMode() {
  if (isButtonDisabled(GameButtons.ORBIT)) return;
  
  const isCurrentlyInOrbitMode = store.gameMode === GameMode.ORBIT;
  executeCommand(CommandType.ORBIT_MODE, { enabled: !isCurrentlyInOrbitMode });
}

// 切换统计模式
function toggleStatisticsMode() {
  if (isButtonDisabled(GameButtons.STATISTICS)) return;
  
  const isCurrentlyInStatMode = store.gameMode === GameMode.STATISTICS;
  executeCommand(CommandType.STATISTIC, { enabled: !isCurrentlyInStatMode });
}

// 循环切换地图图层
function cycleMapLayer() {
  if (isButtonDisabled(GameButtons.TOGGLE_LAYER)) return;
  
  // 假设有3个图层，循环切换 1->2->3->1
  currentLayerIndex.value = (currentLayerIndex.value % 3) + 1;
  
  executeCommand(CommandType.CHANGE_LAYER, { layerIndex: currentLayerIndex.value });
}

// 下一回合
function handleNextTurn() {
  if (isButtonDisabled(GameButtons.NEXT_FACTION)) return;
  
  executeCommand(CommandType.NEXT_FACTION);
}

// 清空控制台
function clearConsole() {
  OverviewConsole.clear();
}

// 监听控制台内容变化，自动滚动到底部
watch(() => OverviewConsole.getLines().length, () => {
  consoleLines.value = OverviewConsole.getLines();
  nextTick(() => {
    if (consoleContainerRef.value) {
      consoleContainerRef.value.scrollTop = consoleContainerRef.value.scrollHeight;
    }
  });
});

// 初始化时插入示例信息
onMounted(() => {
  if (OverviewConsole.getLines().length === 0) {
    OverviewConsole.log('欢迎进入战场指挥系统!');
    OverviewConsole.success('系统初始化完成，可以开始操作');
    OverviewConsole.log(`当前战场位置: ${BattleConfig.locationName} (${BattleConfig.center.lon}°, ${BattleConfig.center.lat}°)`);
  }
});
</script>

<style scoped>
.overview-container {
  position: fixed;
  right: 0px;
  bottom: 0px;
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

/* 左侧按钮栏样式 */
.side-buttons {
  display: flex;
  flex-direction: column;
  margin-right: 8px;
  margin-bottom: 10px;
  gap: 0px;
}

/* 圆形命令按钮样式 */
.command-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(251, 233, 184, 0.915);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  margin: 7px 0;
}

.command-button:hover {
  background-color: rgba(251, 233, 184, 0.6);
  transform: scale(1.1);
}

.command-button.active {
  background-color: rgba(255, 200, 21, 0.8);
}

.command-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.command-button.terrain-layer {
  background-color: rgba(162, 255, 62, 0.716);
}

.command-button.no-hex-layer {
  background-color: rgba(202, 202, 202, 0.785);
}

.command-button img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* 总览面板样式 */
.overview-panel {
  width: 360px;
  height: 400px;
  background-color: rgba(169, 140, 102, 0.9);
  border: 2px solid rgba(80, 60, 40, 0.8);
  color: #f0f0f0;
  border-radius: 4px 0 0 0;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 面板顶部样式 */
.panel-header {
  background-color: rgba(56, 44, 31, 0.7);
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
}

.round-info {
  font-weight: bold;
  font-size: 15px;
}

.faction-info {
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.2);
  font-size: 15px;
}

.faction-blue {
  color: #4a90e2;
}

.faction-red {
  color: #e24a4a;
}

.game-mode-info {
  font-size: 13px;
  opacity: 0.8;
}

/* 下一回合按钮样式 */
.next-turn-button {
  display: flex;
  align-items: center;
  background-color: rgba(172, 117, 8, 0.8);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.next-turn-button:hover {
  background-color: rgb(202, 162, 0);
}

.next-turn-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.next-turn-button span {
  font-weight: bold;
  margin-right: 8px;
  font-size: 14px;
}

.next-turn-button img {
  width: 16px;
  height: 16px;
}

/* 控制台区域样式 */
.console-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  background-color: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.console-header span {
  font-weight: bold;
  font-size: 14px;
}

.console-actions {
  display: flex;
  gap: 8px;
}

.console-action {
  width: 22px;
  height: 22px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.console-action:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.console-action img {
  width: 16px;
  height: 16px;
}

.console-wrapper {
  flex: 1;
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.console-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  background-color: rgba(54, 40, 26, 0.8);
  color: #f0f0f0;
  line-height: 1.4;
  border: 1px solid rgba(80, 60, 40, 0.8);
  border-radius: 4px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(169, 140, 102, 0.5) rgba(0, 0, 0, 0.2);
}

.console-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.2), transparent);
  pointer-events: none;
  z-index: 1;
}

.console-container::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.2), transparent);
  pointer-events: none;
  z-index: 1;
}

.console-line {
  margin-bottom: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.console-line.info {
  color: #a6e1fa;
}

.console-line.warning {
  color: #ffd166;
}

.console-line.error {
  color: #ff6b6b;
}

.console-line.success {
  color: #6bff6b;
}

.console-line.stat {
  color: #e4c1f9;
}

.console-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(169, 140, 102, 0.5);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(169, 140, 102, 0.7);
}
</style>
