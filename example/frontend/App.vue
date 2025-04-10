<template>
  <div class="app-container">
    <div id="cesiumContainer" class="cesium-container"></div>
    <router-view></router-view>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, provide } from 'vue';
import { CesiumViewer } from './services/cesium-service';

// 创建Cesium Viewer实例
let viewer = null;

// 初始化Cesium
onMounted(() => {
  // 延迟初始化Cesium，确保DOM已经渲染
  setTimeout(() => {
    viewer = new CesiumViewer('cesiumContainer');
    // 将viewer实例提供给子组件
    provide('cesiumViewer', viewer);
  }, 100);
});

// 组件卸载时清理资源
onUnmounted(() => {
  if (viewer) {
    viewer.destroy();
    viewer = null;
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
