// src/store/index.js
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useViewerStore = defineStore('viewerStore', () => {
  // 存储 Cesium Viewer 实例
  const viewer = ref(null);
  // 存储生成的六角网格数据，数组
  const hexCells = ref([]);
  // 存储当前选中的部队列表（例如 selected_forces_list ）
  const selectedForcesList = ref([]);

  // 设置 Viewer 实例
  function setViewer(newViewer) {
    viewer.value = newViewer;
  }

  // 更新六角网格数据
  function setHexCells(newHexCells) {
    hexCells.value = newHexCells;
  }

  // 更新选中部队列表
  function setSelectedForcesList(newSelectedForces) {
    selectedForcesList.value = newSelectedForces;
  }

  // 添加单个选中的部队
  function addSelectedForce(force) {
    selectedForcesList.value.push(force);
  }

  // 清空选中部队列表
  function clearSelectedForces() {
    selectedForcesList.value = [];
  }

  return {
    viewer,
    hexCells,
    selectedForcesList,
    setViewer,
    setHexCells,
    setSelectedForcesList,
    addSelectedForce,
    clearSelectedForces,
  };
});
