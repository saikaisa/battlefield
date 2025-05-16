<!-- src\App.vue -->
<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染面板 -->
    <div v-if="gameReady">
      <OverviewPanel /> <!-- 概览面板 -->
      <FormationPanel /> <!-- 编队列表 -->
      <CommandPanel /> <!-- 命令管理面板 -->
      <DetailInfoPanel /> <!-- 详情信息面板 -->
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>
 
<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';
import { CommandDispatcher } from '@/layers/interaction-layer/CommandDispatcher';
import OverviewPanel from '@/components/hud/OverviewPanel.vue';
import DetailInfoPanel from '@/components/hud/DetailInfoPanel.vue';
import FormationPanel from '@/components/hud/FormationPanel.vue';
import CommandPanel from '@/components/hud/CommandPanel.vue';
// eslint-disable-next-line no-unused-vars
import { runTests, runMovementTestOnly } from '@/test/test';

// viewer 引用
const viewerRef = ref(null);

// 控制 UI 是否可加载
const gameReady = ref(false);

let sceneManager;
let militaryManager;
let commandDispatcher;


onMounted(async () => {
  // 初始化场景管理器
  sceneManager = SceneManager.getInstance('cesiumContainer');
  viewerRef.value = await sceneManager.init();

  // 初始化军事单位管理器
  militaryManager = MilitaryManager.getInstance(viewerRef.value);
  await militaryManager.init();

  // 初始化命令分发器
  commandDispatcher = CommandDispatcher.getInstance(viewerRef.value);
  commandDispatcher.init(); // 初始化命令处理器和游戏模式管理器

  // 初始化完成
  gameReady.value = true;

  // 先运行完整测试（创建部队）
  console.log('[App] 开始创建部队...');
  runTests();
  
  // 等待足够时间后测试移动功能（确保地图和部队都加载完成）
  // setTimeout(() => {
  //   console.log('[App] 延时后测试移动功能...');
  //   runMovementTestOnly();
  // }, 15000);
});

onBeforeUnmount(() => {
  // sceneManager?.destroy();
  militaryManager?.destroy();
  commandDispatcher?.destroy();
});

onUnmounted(() => {
  if (viewerRef.value) {
    viewerRef.value.destroy();
    viewerRef.value = null;
  }
});
</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}
.cesium-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
.loading {
  position: absolute;
  z-index: 100;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  color: #333;
}
.test-control-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 5px;
  color: white;
}
.test-control-panel button {
  margin: 5px;
  padding: 5px 10px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.test-control-panel button:hover {
  background: #45a049;
}
.test-report {
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 3px;
}
</style>
