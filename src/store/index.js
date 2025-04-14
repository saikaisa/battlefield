import { defineStore } from 'pinia';
import { ref } from 'vue';

export const openGameStore = defineStore('gameStore', () => {
  // 存储视角历史记录的队列
  const viewHistory = ref([]);
  const MAX_HISTORY = 10;
  // 存储生成的六角网格数据，数组
  const hexCells = ref([]);
  // 存储当前选中的部队列表
  const selectedForcesList = ref([]);
  
  // 添加一条视角历史记录
  function addViewHistory(viewObj) {
    viewHistory.value.push(viewObj);
    if (viewHistory.value.length > MAX_HISTORY) {
      viewHistory.value.shift();
    }
  }

  // 获取最近一条视角历史记录
  function getLatestView() {
    return viewHistory.value.length > 0
      ? viewHistory.value[viewHistory.value.length - 1]
      : null;
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
    viewHistory,
    hexCells,
    selectedForcesList,
    addViewHistory,
    getLatestView,
    setHexCells,
    setSelectedForcesList,
    addSelectedForce,
    clearSelectedForces,
  };
});
