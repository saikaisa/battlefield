import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CameraView } from '@/models/CameraView';
import { HexCell } from '@/models/HexCell';

export const openGameStore = defineStore('gameStore', () => {
  // 存储视角历史记录的队列
  const viewHistory = ref([]);
  const MAX_HISTORY = 10;
  // 存储生成的六角网格数据，数组
  const hexCells = ref([]);
  // 存储当前选中的六角格ID集合
  const selectedHexIds = ref(new Set());
  // 存储当前选中的部队列表
  const selectedForcesList = ref([]);
  
  // 添加一条视角历史记录
  function addViewHistory(obj) {
    viewHistory.value.push(obj instanceof CameraView ? 
      obj.toPlainObject() : obj);
    if (viewHistory.value.length > MAX_HISTORY) {
      viewHistory.value.shift();
    }
  }

  // 获取最近一条视角历史记录
  function getLatestViewPlain() {
    return viewHistory.value.length > 0
      ? CameraView.fromPlainObject(viewHistory.value[viewHistory.value.length - 1])
      : null;
  }

  // 更新六角网格数据
  function setHexCells(newHexCells) {
    hexCells.value = newHexCells.map(cell =>
      cell instanceof HexCell ? cell.toPlainObject() : cell
    );
  }

  // 获取所有六角格
  function getHexCells() {
    return hexCells.value.map(HexCell.fromPlainObject);
  }

  // 添加某个选中的六角格ID
  function addSelectedHexId(hexId) {
    selectedHexIds.value.add(hexId);
  }
  
  // 移除某个选中的六角格ID
  function removeSelectedHexId(hexId) {
    selectedHexIds.value.delete(hexId);
  }
  
  // 清空选中的六角格ID
  function clearSelectedHexIds() {
    selectedHexIds.value.clear();
  }
  
  // 获取所有选中的六角格ID
  function getSelectedHexIds() {
    return selectedHexIds.value;
  }

  return {
    viewHistory,
    hexCells,
    selectedHexIds,
    selectedForcesList,
    addViewHistory,
    getLatestViewPlain,
    setHexCells,
    getHexCells,
    addSelectedHexId,
    removeSelectedHexId,
    clearSelectedHexIds,
    getSelectedHexIds,
  };
});
