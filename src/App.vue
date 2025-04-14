<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- Viewer 初始化完成后再渲染 InfoPanel 等 UI -->
    <div v-if="gameReady">
      <InfoPanel />
      <router-view />
    </div>

    <div v-else class="loading">
      地图加载中，请稍候...
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue';
import { MapInitializer } from '@/layers/geo-render/MapInitializer';
import InfoPanel from '@/components/hud/InfoPanel.vue';

// 创建并全局提供 viewer 实例
const viewerRef = ref(null);
provide('cesiumViewer', viewerRef);

// 控制 UI 是否可加载
const gameReady = ref(false);

// 生命周期钩子
onMounted(async () => {
  const mapInit = new MapInitializer('cesiumContainer');
  const viewer = await mapInit.init();
  viewerRef.value = viewer;
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
