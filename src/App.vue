<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染 InfoPanel 等 UI -->
    <div v-if="gameReady">
      <InfoPanel :infoPanelManager="infoPanelManager" />
      <router-view />
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue';
import { SceneManager } from '@/layers/geo-render/SceneManager';
import { InfoPanelManager } from '@/layers/interaction/InfoPanelManager';
import InfoPanel from '@/components/hud/InfoPanel.vue';

// 创建共享组件状态
const viewerRef = ref(null);
provide('cesiumViewer', viewerRef);

const infoPanelManager = ref(null);

// 控制 UI 是否可加载
const gameReady = ref(false);

// 生命周期钩子
onMounted(async () => {
  // 初始化场景管理器
  const sceneManager = new SceneManager('cesiumContainer');

  const viewer = await sceneManager.init();
  viewerRef.value = viewer;

  // 初始化信息面板管理器
  infoPanelManager.value = new InfoPanelManager(viewer, sceneManager);

  gameReady.value = true;

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
