<template>
  <el-card class="control-panel">
    <el-button type="primary" @click="resetCameraView">视角居中</el-button>
    <el-button type="success" @click="focusSelectedForce">定位选中单位</el-button>
    <el-switch v-model="terrainHidden" @change="toggleTerrainVisual">
      地形标记隐藏
    </el-switch>
    <el-switch v-model="hexGridHidden" @change="toggleHexGridVisibility">
      六角格隐藏
    </el-switch>
    <div class="info">
      <p>当前六角格数：{{ hexCells.length }}</p>
      <p>选中部队数：{{ selectedForcesList.length }}</p>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useViewerStore } from '@/store';
import { InfoPanelManager } from '@/layers/interaction/InfoPanelManager';

// 引入 Element UI 的组件（确保已安装 Element Plus）
import { ElCard, ElButton, ElSwitch } from 'element-plus';

// 从全局 store 获取数据
const viewerStore = useViewerStore();

// 使用 computed 获取当前的六角格数据和选中部队列表
const hexCells = computed(() => viewerStore.hexCells);
const selectedForcesList = computed(() => viewerStore.selectedForcesList);

// 用于切换按钮的本地状态
const terrainHidden = ref(false);
const hexGridHidden = ref(false);

// 实例化 InfoPanelManager，传入 viewer 和 hexCells
// 注意：确保 viewerStore.viewer 已经设置好了（MapInitializer 调用后会设置）
const infoPanelManager = new InfoPanelManager(viewerStore.viewer, hexCells.value);

// 方法
const resetCameraView = () => {
  // 视角居中：调用 InfoPanelManager 中对应方法
  infoPanelManager.resetCameraView();
};

const focusSelectedForce = () => {
  // 定位视角到选中单位：传入选中部队列表
  infoPanelManager.focusOnSelectedForce(selectedForcesList.value);
};

const toggleTerrainVisual = () => {
  // 根据开关状态隐藏或显示地形标记（默认半透明白色）
  infoPanelManager.toggleTerrainVisual(terrainHidden.value);
};

const toggleHexGridVisibility = () => {
  // 根据开关状态隐藏或显示六角格（全取消渲染或恢复渲染）
  infoPanelManager.toggleHexGridVisibility(hexGridHidden.value);
};
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 250px;
  z-index: 100;
}
.info {
  margin-top: 10px;
  font-size: 14px;
}
</style>
