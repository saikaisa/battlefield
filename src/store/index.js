// src\store\index.js
import { defineStore } from "pinia";
import { reactive, ref, isReactive } from "vue";
import { CameraView } from "@/models/CameraView";
import { HexCell } from "@/models/HexCell";
import { Unit, Force, Battlegroup, Formation } from "@/models/MilitaryUnit";

/** 把传入对象转成“已 reactive 的指定类实例” */
function Rea(input, ClassCtor) {
  let inst = input instanceof ClassCtor ? input : new ClassCtor(input);
  return isReactive(inst) ? inst : reactive(inst);
}

export const openGameStore = defineStore("gameStore", () => {
  /* 1. 全局状态 */
  const viewHistory = ref([]); // CameraView的PlainObject形式，只读
  const MAX_HISTORY = 10;
  const layerIndex = ref(1); // 当前六角格图层：1=默认，2=地形，3=隐藏
  
  /* 2. 主数据容器 */
  const hexCellMap     = reactive(new Map());  // Map<hexId, HexCell>
  const unitMap        = reactive(new Map());  // Map<unitId, Unit>
  const forceMap       = reactive(new Map());  // Map<forceId, Force>
  const battlegroupMap = reactive(new Map());  // Map<battlegroupId , Battlegroup>
  const formationMap   = reactive(new Map());  // Map<formationId , Formation>

  /* 3. 选中状态 */
  const selectedHexIds   = reactive(new Set());
  const selectedForceIds = reactive(new Set());

  /* ==================== 全局状态 ==================== */
  // 添加一条视角历史记录
  function addViewHistory(view) {
    viewHistory.value.push(view instanceof CameraView ? view.toPlainObject() : view);
    if (viewHistory.value.length > MAX_HISTORY) {
      viewHistory.value.shift();
    }
  }
  // 获取最近一条视角历史记录
  function getLatestView() {
    return viewHistory.value.length > 0 ? 
      CameraView.fromPlainObject(viewHistory.value[viewHistory.value.length - 1]) : 
      null; 
  }
  // 设置图层编号
  function setLayerIndex(idx) {
    layerIndex.value = idx;
  }
  
  /* ==================== HexCell 相关 ==================== */
  // 插入单个六角格
  function addHexCell(data) {
    const cell = Rea(data, HexCell);
    hexCellMap.set(cell.hexId, cell);
    // console.log('reactive:', isReactive(cell));
    return cell;
  }
  // 批量加载六角格 (会清空原有的)
  function setHexCells(newHexCells) { 
    hexCellMap.clear();
    newHexCells.forEach(data => { addHexCell(data); });
  }

  function getHexCells() { return Array.from(hexCellMap.values()); }
  function getHexCellById(id) { return hexCellMap.get(id) || null; }
  function removeHexCellById(id) { hexCellMap.delete(id); }

  function addSelectedHexId(id) { selectedHexIds.add(id); }
  function removeSelectedHexId(id) {selectedHexIds.delete(id); }
  function clearSelectedHexIds() { selectedHexIds.clear(); }
  function getSelectedHexIds() { return selectedHexIds; }

   /* ==================== MilitaryUnit 相关 ==================== */
   // 插入军事单位
   function addUnit(data)        { const u = Rea(data, Unit);        unitMap.set(u.unitId, u); return u; }
   function addForce(data)       { const f = Rea(data, Force);       forceMap.set(f.forceId, f); return f; }
   function addBattlegroup(data) { const b = Rea(data, Battlegroup); battlegroupMap.set(b.battlegroupId, b); return b; }
   function addFormation(data)   { const f = Rea(data, Formation);   formationMap.set(f.formationId, f); return f; }
 
   // 通过ID获取单个军事单位
   const getUnitById        = (id) => unitMap.get(id)        || null;
   const getForceById       = (id) => forceMap.get(id)       || null;
   const getBattlegroupById = (id) => battlegroupMap.get(id) || null;
   const getFormationById   = (id) => formationMap.get(id)   || null;
 
   // 批量获取军事单位
   const getUnits        = () => Array.from(unitMap.values());
   const getForces       = () => Array.from(forceMap.values());
   const getBattlegroups = () => Array.from(battlegroupMap.values());
   const getFormations   = () => Array.from(formationMap.values());

   function addSelectedForceId(id) { selectedForceIds.add(id); }
   function removeSelectedForceId(id) {selectedForceIds.delete(id); }
   function clearSelectedForceIds() { selectedForceIds.clear(); }
   function getSelectedForceIds() { return selectedForceIds; }


   return {
    // 视角历史
    viewHistory,
    addViewHistory,
    getLatestView,

    // 全局图层控制
    layerIndex,
    setLayerIndex,

    // 六角格
    hexCellMap,
    addHexCell,
    setHexCells,
    getHexCells,
    getHexCellById,
    removeHexCellById,

    // 六角格选中状态
    selectedHexIds,
    addSelectedHexId,
    removeSelectedHexId,
    clearSelectedHexIds,
    getSelectedHexIds,

    // 军事单位
    unitMap,
    forceMap,
    battlegroupMap,
    formationMap,
    addUnit,
    addForce,
    addBattlegroup,
    addFormation,
    getUnitById,
    getForceById,
    getBattlegroupById,
    getFormationById,
    getUnits,
    getForces,
    getBattlegroups,
    getFormations,

    // 军事单位选中状态
    selectedForceIds,
    addSelectedForceId,
    removeSelectedForceId,
    clearSelectedForceIds,
    getSelectedForceIds
  };
});
