<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 在 Viewer 初始化完成后再渲染 UI 组件 -->
    <div v-if="viewerReady">
      <InfoPanel />
      <router-view />
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { MapInitializer } from './layers/geo-render/MapInitializer';
import InfoPanel from './components/hud/InfoPanel.vue';
import { useViewerStore } from './store';

const viewerStore = useViewerStore();

const viewerReady = computed(() => viewerStore.viewer !== null);

onMounted(async () => {
  const mapInit = new MapInitializer('cesiumContainer');
  const viewer = await mapInit.init();
  viewerStore.setViewer(viewer);
});

onUnmounted(() => {
  if (viewerStore.viewer) {
    viewerStore.viewer.destroy();
    viewerStore.setViewer(null);
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
