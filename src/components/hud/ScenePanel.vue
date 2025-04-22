<!-- src\components\hud\ScenePanel.vue -->
<template>
  <el-card class="control-panel">
    <el-button type="primary" @click="resetCamera">视角居中</el-button>
    <el-button type="success" @click="focusForce">定位选中单位</el-button>
    <el-button type="warning" @click="toggleOrbitMode">{{ orbitButtonText }}</el-button>
    <div style="margin-top:10px;">
      <span>地形图层</span>
      <el-select v-model="layerIndex" placeholder="选择图层">
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
  scenePanelManager: Object
});

const store = openGameStore();

// 用于切换按钮的本地状态
const orbitEnabled = ref(false);

// 切换图层
const layerIndex = computed({
  get: () => store.layerIndex,
  set: (val) => {
    store.setLayerIndex(val);
    props.scenePanelManager.handleLayerChange();
  }
});

const toggleOrbitMode = () => {
  orbitEnabled.value = !orbitEnabled.value;
  props.scenePanelManager.handleOrbitMode(orbitEnabled.value);
};

const orbitButtonText = computed(() =>
  orbitEnabled.value ? "退出 Orbit 模式" : "进入 Orbit 模式"
);

const resetCamera = () => {
  orbitEnabled.value = false;
  props.scenePanelManager.handleResetCamera();
};

const focusForce = () => {
  props.scenePanelManager.handleFocusForce();
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
