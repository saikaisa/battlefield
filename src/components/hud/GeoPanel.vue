<!-- src\components\hud\GeoPanel.vue -->
<template>
  <el-card class="control-panel">
    <el-button type="primary" @click="resetCameraView">视角居中</el-button>
    <el-button type="success" @click="focusSelectedForce">定位选中单位</el-button>
    <el-button type="warning" @click="toggleOrbitMode">{{ orbitButtonText }}</el-button>
    <div style="margin-top:10px;">
      <span>地形图层</span>
      <el-select v-model="layerIndex" @change="toggleLayers" placeholder="选择图层">
        <el-option label="默认图层" :value="1" />
        <el-option label="地形图层" :value="2" />
        <el-option label="无六角格图层" :value="3" />
      </el-select>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, defineProps } from 'vue';
import { openGameStore } from '@/store';

const props = defineProps({
  geoPanelManager: Object
});

const store = openGameStore();
const selectedForcesList = computed(() => store.selectedForcesList);

// 用于切换按钮的本地状态
const orbitEnabled = ref(false);
const layerIndex = ref(1); // 1: 默认图层, 2: 地形图层, 3: 无六角格图层

const toggleOrbitMode = () => {
  orbitEnabled.value = !orbitEnabled.value;
  props.geoPanelManager.setOrbitMode(orbitEnabled.value);
};

const orbitButtonText = computed(() =>
  orbitEnabled.value ? "退出 Orbit 模式" : "进入 Orbit 模式"
);

const resetCameraView = () => {
  orbitEnabled.value = false;
  props.geoPanelManager.resetCameraView();
};

const toggleLayers = () => {
  props.geoPanelManager.toggleLayers(layerIndex.value);
};

const focusSelectedForce = () => {
  props.geoPanelManager.focusOnSelectedForce(selectedForcesList.value);
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
