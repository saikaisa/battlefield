<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>
    <!-- 直接引入 InfoPanel 组件 -->
    <InfoPanel />
    <router-view></router-view>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide } from 'vue';
import { MapInitializer } from './layers/geo-render/MapInitializer';
import InfoPanel from './components/hud/InfoPanel.vue';  // 根据项目路径引入组件

// 使用 ref 保存 Cesium Viewer 实例
const cesiumViewer = ref(null);
// 立即 provide 全局变量到子组件中（这里提供的是 ref）
provide('cesiumViewer', cesiumViewer);

onMounted(async () => {
  const mapInit = new MapInitializer('cesiumContainer');
  const viewer = await mapInit.init();
  cesiumViewer.value = viewer;
});

onUnmounted(() => {
  if (cesiumViewer.value) {
    cesiumViewer.value.destroy();
    cesiumViewer.value = null;
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
}
</style>
