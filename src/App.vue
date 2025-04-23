<!-- src\App.vue -->
<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染 Panel 等 UI -->
    <div v-if="gameReady">
      <ScenePanel />
      <MilitaryPanel />
      <router-view />
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onBeforeUnmount, onUnmounted } from 'vue';
import { SceneManager } from '@/layers/scene-layer/SceneManager';
import { ScenePanelManager } from '@/layers/interaction-layer/ScenePanelManager';
import ScenePanel from '@/components/hud/ScenePanel.vue';
// import { MilitaryManager } from '@/layers/military-layer/MilitaryManager';
// import MilitaryPanel from '@/components/hud/MilitaryPanel.vue';
// import { MilitaryPanelManager } from '@/layers/interaction-layer/MilitaryPanelManager';

// 创建共享组件状态
const viewerRef = ref(null);
provide('cesiumViewer', viewerRef);

// 控制 UI 是否可加载
const gameReady = ref(false);

let sceneManager;
let scenePanelManager;
// let militaryManager;
// let militaryPanelManager;

// 生命周期钩子
onMounted(async () => {
  // 初始化场景管理器
  sceneManager = SceneManager.getInstance('cesiumContainer');
  const viewer = await sceneManager.init();
  viewerRef.value = viewer;

  // 初始化场景控制面板管理器
  scenePanelManager = ScenePanelManager.getInstance(viewer);
  sceneManager.setPanelManager(scenePanelManager);
  // 提供场景面板管理器给子组件
  provide('scenePanelManager', scenePanelManager);

  // 初始化军事单位管理器
  // militaryManager = new MilitaryManager(viewer);
  // await militaryManager.init((done,total)=>console.log(`unit preload ${done}/${total}`));

  // // 初始化军事单位控制面板管理器
  // militaryPanelManager = new MilitaryPanelManager(viewer);
  // militaryManager.setPanelManager(militaryPanelManager);
  // // 提供军事面板管理器给子组件
  // provide('militaryPanelManager', militaryPanelManager);

  // 初始化完成
  gameReady.value = true;
});

onBeforeUnmount(() => {
  // militaryManager?.dispose();
  sceneManager?.destroy();
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
</style>
