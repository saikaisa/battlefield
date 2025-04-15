<template>
  <el-card class="control-panel">
    <el-button type="primary" @click="resetCameraView">视角居中</el-button>
    <el-button type="success" @click="focusSelectedForce">定位选中单位</el-button>
    <el-button type="warning" @click="toggleOrbitMode">{{ orbitButtonText }}</el-button>
    <div style="margin-top:10px;">
      <span>地形图层</span>
      <el-select v-model="terrainLayer" @change="toggleTerrainVisual" placeholder="选择图层">
        <el-option label="默认视觉" :value="1" />
        <el-option label="地形图层" :value="2" />
        <el-option label="清除标记" :value="3" />
      </el-select>
    </div>
    <div style="margin-top:10px;">
      <span>六角格隐藏</span>
      <el-switch v-model="hexGridHidden" @change="toggleHexGridVisibility"></el-switch>
    </div>
  </el-card>
</template>

<script setup>
import { inject, watch, ref, computed } from 'vue';
import { ElCard, ElButton, ElSwitch } from 'element-plus';
import { openGameStore } from '@/store';
import { InfoPanelManager } from '@/layers/interaction/InfoPanelManager';

// 获取 Cesium Viewer
const viewerRef = inject('cesiumViewer', ref(null));
// 从全局 store 获取数据
const store = openGameStore();
const hexCells = computed(() => store.hexCells);
const selectedForcesList = computed(() => store.selectedForcesList);

// 用于切换按钮的本地状态
const orbitEnabled = ref(false);
const terrainLayer = ref(1); // 1: 默认样式, 2: 渲染样式, 3: 清除全部
const hexGridHidden = ref(false);

const infoPanelManager = ref(null);
// 确保 viewer 初始化之后才创建 InfoPanelManager
watch(viewerRef, (v) => {
  if (v) {
    infoPanelManager.value = new InfoPanelManager(v, hexCells.value);
    console.log("INFOPANEL READY");
  }
}, { immediate: true });

// 方法
const toggleOrbitMode = () => {
  if (infoPanelManager.value) {
    // 按钮状态切换：调用 InfoPanelManager.setOrbitMode(orbitEnabled.value)
    orbitEnabled.value = !orbitEnabled.value;
    infoPanelManager.value.setOrbitMode(orbitEnabled.value);
  } else {
    console.warn("InfoPanelManager 未初始化，无法设置 Orbit 模式");
  }
};

const orbitButtonText = computed(() => orbitEnabled.value ? "退出 Orbit 模式" : "进入 Orbit 模式");

const resetCameraView = () => {
  // 视角居中：调用 InfoPanelManager 中对应方法
  orbitEnabled.value = false;
  infoPanelManager.value.resetCameraView();
};

const focusSelectedForce = () => {
  // 定位视角到选中单位：传入选中部队列表
  infoPanelManager.value.focusOnSelectedForce(selectedForcesList.value);
};

// 切换图层
const toggleTerrainVisual = () => {
  infoPanelManager.value.toggleTerrainVisual(terrainLayer.value);
};

const toggleHexGridVisibility = () => {
  // 根据开关状态隐藏或显示六角格（全取消渲染或恢复渲染）
  infoPanelManager.value.toggleHexGridVisibility(hexGridHidden.value);
};
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 250px;
  z-index: 100;
  padding: 10px;
}
</style>
