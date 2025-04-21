<template>
  <div class="military-panel p-4 bg-white shadow-lg rounded-lg">
    <!-- 编队列表 -->
    <section class="mb-4">
      <h3 class="text-lg font-semibold">编队列表</h3>
      <ul>
        <li
          v-for="formation in formations"
          :key="formation.formationId"
          class="cursor-pointer hover:text-blue-500"
          @click="onFormationClick(formation)"
        >
          {{ formation.formationName }}
        </li>
      </ul>
    </section>

    <!-- 部队列表 -->
    <section class="mb-4">
      <h3 class="text-lg font-semibold">部队列表</h3>
      <ul>
        <li
          v-for="force in forces"
          :key="force.forceId"
          class="cursor-pointer hover:text-blue-500"
          @click="onForceClick(force)"
        >
          {{ force.forceName }} ({{ force.forceId }})
        </li>
      </ul>
    </section>

    <!-- 命令下达区 -->
    <section class="mb-4">
      <h3 class="text-lg font-semibold">命令下达</h3>
      <!-- 移动 -->
      <div v-if="selectedForceIds.length === 1" class="mb-2">
        <label class="block mb-1">移动路径 (逗号分隔 hexId)</label>
        <input v-model="movePathInput" placeholder="H_0_0,H_0_1,.." class="w-full p-1 border rounded" />
        <button
          class="mt-1 px-3 py-1 bg-green-500 text-white rounded"
          @click="submitMove"
        >移动</button>
      </div>
      <!-- 攻击 -->
      <div v-if="selectedForceIds.length === 1" class="mb-2">
        <label class="block mb-1">攻击目标 hexId</label>
        <input v-model="attackTarget" placeholder="H_0_1" class="w-full p-1 border rounded" />
        <label class="block mb-1">支援部队 (逗号分隔 forceId)</label>
        <input v-model="supportForcesInput" placeholder="F_1,F_2" class="w-full p-1 border rounded" />
        <button
          class="mt-1 px-3 py-1 bg-red-500 text-white rounded"
          @click="submitAttack"
        >攻击</button>
      </div>
      <!-- 创建部队 -->
      <div v-if="selectedHexIds.length === 1" class="mb-2">
        <label class="block mb-1">创建部队 Composition (JSON)</label>
        <textarea v-model="createComposition" placeholder='[{ "unitId": "U_1", "unitCount": 5 }]' class="w-full p-1 border rounded h-20"></textarea>
        <button
          class="mt-1 px-3 py-1 bg-blue-500 text-white rounded"
          @click="submitCreate"
        >创建部队</button>
      </div>
      <!-- 合并部队 -->
      <div v-if="selectedHexIds.length === 1 && selectedForceIds.length > 1" class="mb-2">
        <button
          class="px-3 py-1 bg-yellow-500 text-white rounded"
          @click="submitMerge"
        >合并部队</button>
      </div>
      <!-- 拆分部队 -->
      <div v-if="selectedForceIds.length === 1" class="mb-2">
        <label class="block mb-1">拆分详情 (JSON 数组)</label>
        <textarea v-model="splitDetails" placeholder='[{ "newForceName": "A", "composition": [...] }]' class="w-full p-1 border rounded h-20"></textarea>
        <button
          class="mt-1 px-3 py-1 bg-indigo-500 text-white rounded"
          @click="submitSplit"
        >拆分部队</button>
      </div>
    </section>

    <!-- 六角格信息栏 -->
    <section v-if="selectedHex" class="mb-4">
      <h3 class="text-lg font-semibold">六角格信息</h3>
      <p>编号: {{ selectedHex.hexId }}</p>
      <p>地形: {{ selectedHex.terrainAttributes.terrainType }}</p>
      <p>高度: {{ selectedHex.terrainAttributes.elevation.toFixed(1) }} m</p>
      <p>可见: {{ selectedHex.visibility.visibleTo.blue ? '是' : '否' }}</p>
      <h4 class="mt-2 font-medium">部队 ({{ selectedHex.forcesIds.length }})</h4>
      <ul class="pl-4 list-disc">
        <li
          v-for="fid in selectedHex.forcesIds"
          :key="fid"
          class="cursor-pointer hover:text-blue-500"
          @click="onForceClick(store.getForceById(fid))"
        >
          {{ forceName(fid) }}
        </li>
      </ul>
    </section>

    <!-- 部队详细信息栏 -->
    <section v-if="selectedForce" class="mb-4">
      <h3 class="text-lg font-semibold">部队信息</h3>
      <p>名称: {{ selectedForce.forceName }}</p>
      <p>阵营: {{ selectedForce.faction }}</p>
      <p>位置: {{ selectedForce.hexId }}</p>
      <p>兵力: {{ selectedForce.troopStrength }}</p>
      <p>士气: {{ selectedForce.morale.toFixed(0) }}</p>
      <p>行动力: {{ selectedForce.actionPoints }}</p>
      <h4 class="mt-2 font-medium">兵种组成</h4>
      <ul class="pl-4 list-disc">
        <li
          v-for="comp in selectedForce.composition"
          :key="comp.unitId"
        >
          {{ unitName(comp.unitId) }} × {{ comp.unitCount }}
        </li>
      </ul>
    </section>

    <!-- 战斗群列表 -->
    <section v-if="battlegroups.length" class="mb-4">
      <h3 class="text-lg font-semibold">战斗群列表</h3>
      <ul>
        <li v-for="bg in battlegroups" :key="bg.battlegroupId" class="mb-2">
          <p class="font-medium">{{ bg.battlegroupId }} ({{ bg.forceIdList.length }} 支部队)</p>
          <p class="text-sm">指挥主体: {{ forceName(bg.commandForceId) }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { openGameStore } from '@/store';

const store = openGameStore();
// 获取在 App.vue 中 provide 的实例
const panelManager = inject('militaryPanelManager');
if (!panelManager) {
  console.error('未找到 militaryPanelManager，请在 App.vue 中 provide');
}

// ============================ 输入字段 ============================
const movePathInput = ref('');
const attackTarget = ref('');
const supportForcesInput = ref('');
const createComposition = ref('');
const splitDetails = ref('');

// ============================ 计算属性 ============================
const selectedForceIds = computed(() => Array.from(store.selectedForceIds));
const selectedHexIds   = computed(() => Array.from(store.selectedHexIds));
// 实时获取所有部队列表，用于渲染“部队列表”区域
const forces           = computed(() => store.getForces());
// 实时获取所有编队列表，用于渲染“编队列表”区域
const formations       = computed(() => store.getFormations());
// 实时获取所有当前战斗群列表，用于渲染“战斗群列表”区域
const battlegroups     = computed(() => store.getBattlegroups());
// 获取当前选中的单个六角格对象，用于渲染“六角格信息栏”
const selectedHex      = computed(() => {
  const id = store.getSelectedHexIds().values().next().value;
  return id ? store.getHexCellById(id) : null;
});
// 获取当前选中的单个部队对象，用于渲染“部队详细信息栏”
const selectedForce    = computed(() => {
  const id = store.getSelectedForceIds().values().next().value;
  return id ? store.getForceById(id) : null;
});

// ============================ 名称助手 ============================
const forceName = (fid) => store.getForceById(fid)?.forceName || fid;
const unitName  = (uid) => store.getUnitById(uid)?.unitName || uid;

// ============================ 事件处理 ============================
/** 处理用户点击某个编队标题，聚焦并高亮该编队内所有部队对应的六角格 */
function onFormationClick(formation) {
  panelManager.onFormationClick(formation);
}

/** 处理用户点击某个部队名称，选中并定位该支部队所在六角格 */
function onForceClick(force) {
  panelManager.onForceClick(force);
}

/** 
 * 提交移动命令
 * - 验证当前仅选中一个部队
 * - 解析 movePathInput 输入字符串为 hexId 数组
 * - 调用 panelManager.move 发起移动命令
 * - 清空输入框
 */
function submitMove() {
  if (selectedForceIds.value.length !== 1) return;
  const forceId = selectedForceIds.value[0];
  const path = movePathInput.value.split(',').map(s => s.trim()).filter(Boolean);
  panelManager.move(forceId, path);
  movePathInput.value = '';
}

/**
 * 提交攻击命令
 * - 验证当前仅选中一个部队
 * - 读取 attackTarget 和 supportForcesInput 输入
 * - 解析为目标 hexId 与支援部队列表
 * - 调用 panelManager.attack 发起攻击命令
 * - 清空输入框
 */
function submitAttack() {
  if (selectedForceIds.value.length !== 1) return;
  const commandForceId = selectedForceIds.value[0];
  const targetHex = attackTarget.value.trim();
  const supportIds = supportForcesInput.value.split(',').map(s => s.trim()).filter(Boolean);
  panelManager.attack(commandForceId, targetHex, supportIds);
  attackTarget.value = '';
  supportForcesInput.value = '';
}

/**
 * 提交创建部队命令
 * - 验证当前仅选中一个六角格
 * - 解析 createComposition 为 JSON 数组
 * - 从选中六角格获取其 controlFaction，作为新部队阵营
 * - 调用 panelManager.createForce 发起创建部队命令
 * - 清空输入区
 */
function submitCreate() {
  if (selectedHexIds.value.length !== 1) return;
  const hexId = selectedHexIds.value[0];
  let comp;
  try { comp = JSON.parse(createComposition.value); } catch { return alert('JSON 格式错误'); }
  const cell = store.getHexCellById(hexId);
  const faction = cell?.battlefieldState.controlFaction || 'blue';
  panelManager.createForce(hexId, faction, comp);
  createComposition.value = '';
}

/**
 * 提交合并部队命令
 * - 验证当前选中一个六角格且至少选中多支部队
 * - 调用 panelManager.mergeForces 发起合并命令
 */
function submitMerge() {
  if (selectedHexIds.value.length !== 1) return;
  panelManager.mergeForces(selectedHexIds.value[0], selectedForceIds.value);
}

/**
 * 提交拆分部队命令
 * - 验证当前仅选中一个部队
 * - 解析 splitDetails 为 JSON 数组
 * - 调用 panelManager.splitForce 发起拆分部队命令
 * - 清空输入区
 */
function submitSplit() {
  if (selectedForceIds.value.length !== 1) return;
  let details;
  try { details = JSON.parse(splitDetails.value); } catch { return alert('JSON 格式错误'); }
  panelManager.splitForce(selectedForceIds.value[0], details);
  splitDetails.value = '';
}

</script>

<style scoped>
.military-panel { max-width: 300px; }
</style>
