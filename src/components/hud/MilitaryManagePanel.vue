<!-- src/components/hud/MilitaryManagePanel.vue
  兵种管理对话框 & 部队管理对话框
  -->

<template>
  <teleport to="body">
    <!-- 模态框背景 -->
    <div class="modal-backdrop" v-if="isPanelVisible" @click="closePanel"></div>
    
    <div class="military-manage-panel" v-if="isPanelVisible" :class="{ 'disabled': isPanelDisabled }">
      <!-- 标题栏 -->
      <div class="panel-header">
        <div class="title">{{ activeTab === 'unit' ? '兵种管理' : '部队管理' }}</div>
        <div class="close-button" @click="closePanel">×</div>
      </div>

      <!-- 选项卡 -->
      <div class="tab-container">
        <div class="tab" 
             :class="{ active: activeTab === 'unit' }"
             @click="switchTab('unit')">
          兵种管理
        </div>
        <div class="tab" 
             :class="{ active: activeTab === 'force' }"
             @click="switchTab('force')">
          部队管理
        </div>
      </div>

      <!-- 内容区 -->
      <div class="panel-content">
        <!-- 兵种管理面板 -->
        <div v-if="activeTab === 'unit'" class="unit-management">
          <div class="content-container">
            <!-- 左侧：兵种列表 -->
            <div class="left-section unit-list-section">
              <div class="section-header">
                <h4>兵种列表</h4>
                <button class="add-button" @click="createNewUnit">新增兵种</button>
              </div>
              <div class="unit-list formation-list custom-scrollbar">
                <div v-for="unit in availableUnits" :key="unit.unitId" class="unit-row force-item" :class="{ 'selected': selectedUnitId === unit.unitId }" @click="selectUnit(unit.unitId)">
                  <div class="force-type-indicator" :class="getForceTypeClass(unit)"></div>
                  <div class="force-info">
                    <div class="force-name">{{ unit.unitName }}</div>
                    <div class="force-location">{{ unit.category }}</div>
                  </div>
                  <div class="unit-ops">
                    <button class="edit-button" @click.stop="editUnit(unit.unitId)" :disabled="isUnitInUse(unit.unitId)">编辑</button>
                    <button class="delete-button" @click.stop="handleDeleteUnit(unit.unitId)" :disabled="isUnitInUse(unit.unitId)">删除</button>
                  </div>
                </div>
                <div v-if="availableUnits.length === 0" class="empty-forces"><div class="empty-message">暂无兵种</div></div>
              </div>
            </div>
            
            <!-- 右侧：兵种详情/编辑（表格化） -->
            <div class="right-section unit-detail-section">
              <div class="section-header">
                <h4>{{ isEditingUnit ? (editingUnit && editingUnit.unitId ? '编辑兵种' : '新增兵种') : '兵种详情' }}</h4>
                <div v-if="isEditingUnit" class="edit-actions">
                  <button class="save-button" @click="submitEditedUnit">保存</button>
                  <button class="cancel-button" @click="cancelEdit">取消</button>
                </div>
              </div>
              <div class="unit-details detail-card custom-scrollbar">
                <div v-if="!isEditingUnit && selectedUnit" class="unit-info">
                  <table class="unit-table">
                    <tbody>
                      <tr><td>兵种名称</td><td>{{ selectedUnit.unitName }}</td></tr>
                      <tr><td>军种</td><td>
                        <span v-for="service in selectedUnit.service" :key="service" class="service-tag" :class="service">{{ serviceMap[service] }}</span>
                      </td></tr>
                      <tr><td>兵种类型</td><td>{{ selectedUnit.category }}</td></tr>
                      <tr><td>可参战阵营</td><td>
                        <span v-for="faction in selectedUnit.factionAvailability" :key="faction" class="faction-tag" :class="faction">{{ faction === 'blue' ? '蓝方' : '红方' }}</span>
                      </td></tr>
                      <tr><td>基础攻击力</td><td>{{ selectedUnit.attackPowerComposition.baseAttackPower }}</td></tr>
                      <tr><td>攻击力军种系数</td><td>
                        陆: {{ selectedUnit.attackPowerComposition.domainFactor.land }}
                        海: {{ selectedUnit.attackPowerComposition.domainFactor.sea }}
                        空: {{ selectedUnit.attackPowerComposition.domainFactor.air }}
                      </td></tr>
                      <tr><td>基础防御力</td><td>{{ selectedUnit.defensePowerComposition.baseDefensePower }}</td></tr>
                      <tr><td>防御力军种系数</td><td>
                        陆: {{ selectedUnit.defensePowerComposition.domainFactor.land }}
                        海: {{ selectedUnit.defensePowerComposition.domainFactor.sea }}
                        空: {{ selectedUnit.defensePowerComposition.domainFactor.air }}
                      </td></tr>
                      <tr><td>可视范围</td><td>{{ selectedUnit.visibilityRadius }}</td></tr>
                      <tr><td>恢复速率</td><td>{{ selectedUnit.recoveryRate }}</td></tr>
                      <tr><td>指挥能力</td><td>{{ selectedUnit.commandCapability }}</td></tr>
                      <tr><td>指挥范围</td><td>{{ selectedUnit.commandRange }}</td></tr>
                      <tr><td>渲染模型</td><td>{{ getModelName(selectedUnit.renderingKey) }}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div v-else-if="isEditingUnit" class="unit-edit-form">
                  <table class="unit-table">
                    <tbody>
                      <tr>
                        <td>兵种名称</td>
                        <td><input v-model="editingUnit.unitName" required placeholder="请输入兵种名称"></td>
                      </tr>
                      <tr>
                        <td>军种</td>
                        <td>
                          <label v-for="(name, value) in serviceMap" :key="value" style="margin-right:8px;">
                            <input type="checkbox" :value="value" v-model="editingUnit.service">{{ name }}
                          </label>
                        </td>
                      </tr>
                      <tr>
                        <td>兵种类型</td>
                        <td><input v-model="editingUnit.category" required placeholder="请输入兵种类型"></td>
                      </tr>
                      <tr>
                        <td>可参战阵营</td>
                        <td>
                          <label><input type="checkbox" value="blue" v-model="editingUnit.factionAvailability">蓝方</label>
                          <label style="margin-left:8px;"><input type="checkbox" value="red" v-model="editingUnit.factionAvailability">红方</label>
                        </td>
                      </tr>
                      <tr>
                        <td>基础攻击力</td>
                        <td><input type="number" v-model.number="editingUnit.attackPowerComposition.baseAttackPower" min="0" required></td>
                      </tr>
                      <tr>
                        <td>攻击力军种系数</td>
                        <td>
                          陆: <input type="number" v-model.number="editingUnit.attackPowerComposition.domainFactor.land" min="0" max="1" step="0.1" style="width:50px;">
                          海: <input type="number" v-model.number="editingUnit.attackPowerComposition.domainFactor.sea" min="0" max="1" step="0.1" style="width:50px;">
                          空: <input type="number" v-model.number="editingUnit.attackPowerComposition.domainFactor.air" min="0" max="1" step="0.1" style="width:50px;">
                        </td>
                      </tr>
                      <tr>
                        <td>基础防御力</td>
                        <td><input type="number" v-model.number="editingUnit.defensePowerComposition.baseDefensePower" min="0" required></td>
                      </tr>
                      <tr>
                        <td>防御力军种系数</td>
                        <td>
                          陆: <input type="number" v-model.number="editingUnit.defensePowerComposition.domainFactor.land" min="0" max="1" step="0.1" style="width:50px;">
                          海: <input type="number" v-model.number="editingUnit.defensePowerComposition.domainFactor.sea" min="0" max="1" step="0.1" style="width:50px;">
                          空: <input type="number" v-model.number="editingUnit.defensePowerComposition.domainFactor.air" min="0" max="1" step="0.1" style="width:50px;">
                        </td>
                      </tr>
                      <tr>
                        <td>可视范围</td>
                        <td><input type="number" v-model.number="editingUnit.visibilityRadius" min="1" required></td>
                      </tr>
                      <tr>
                        <td>恢复速率</td>
                        <td><input type="number" v-model.number="editingUnit.recoveryRate" min="0" max="1" step="0.1" required></td>
                      </tr>
                      <tr>
                        <td>指挥能力</td>
                        <td><input type="number" v-model.number="editingUnit.commandCapability" min="1" required></td>
                      </tr>
                      <tr>
                        <td>指挥范围</td>
                        <td><input type="number" v-model.number="editingUnit.commandRange" min="1" required></td>
                      </tr>
                      <tr>
                        <td>渲染模型</td>
                        <td>
                          <select v-model="editingUnit.renderingKey">
                            <option v-for="model in availableModels" :key="model.key" :value="model.key" :disabled="!isModelServiceCompatible(model)">{{ model.name }}</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="empty-info">
                  <div class="empty-message">{{ isEditingUnit ? '请填写兵种信息' : '请选择兵种' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 部队管理面板 -->
        <div v-if="activeTab === 'force'" class="force-management">
          <div class="content-container">
            <!-- 左侧：部队列表 -->
            <div class="left-section force-list-section">
              <div class="section-header">
                <h4>部队列表</h4>
                <div class="button-group">
                  <button class="action-button" @click="createNewForce">新增部队</button>
                  <button class="action-button" @click="toggleMergeMode">{{ forcePanelMode === 'merge' ? '取消合并' : '合并部队' }}</button>
                </div>
              </div>
              <div class="force-list formation-list custom-scrollbar">
                <div v-for="force in hexForces" 
                  :key="force.forceId" 
                  class="force-row force-item" 
                  :class="{ 
                    'selected': (forcePanelMode === 'merge' ? selectedForces.has(force.forceId) : selectedForceId === force.forceId), 
                    'disabled': force.combatChance <= 0 || force.actionPoints <= 0 
                  }" 
                  @click="selectForce(force.forceId)"
                >
                  <div class="force-type-indicator" :class="getForceTypeClass(force)"></div>
                  <div class="force-info">
                    <div class="force-name">{{ force.forceName }}</div>
                    <div class="force-location">{{ force.troopStrength }}</div>
                  </div>
                  <div class="force-ops" v-if="forcePanelMode === 'view'">
                    <button class="edit-button" @click.stop="editForce(force.forceId)">编辑</button>
                    <button class="delete-button" @click.stop="handleDeleteForce(force.forceId)">删除</button>
                    <button class="split-button" @click.stop="splitForce(force.forceId)">拆分</button>
                  </div>
                </div>
                <div v-if="hexForces.length === 0" class="empty-forces"><div class="empty-message">暂无部队</div></div>
              </div>
            </div>
            
            <!-- 右侧：部队详情/编辑（表格化） -->
            <div class="right-section force-detail-section">
              <!-- 详情 -->
              <div v-if="forcePanelMode === 'view' && selectedForce" class="force-info">
                <table class="force-table">
                  <tbody>
                    <tr><td>部队名称</td><td>{{ selectedForce.forceName }}</td></tr>
                    <tr><td>军种</td><td><span class="service-tag" :class="selectedForce.service">{{ serviceMap[selectedForce.service] }}</span></td></tr>
                    <tr><td>兵力值</td><td>{{ selectedForce.troopStrength }}</td></tr>
                    <tr><td>行动力</td><td>{{ selectedForce.actionPoints }}</td></tr>
                    <tr><td>士气值</td><td>{{ formatForceAttribute(selectedForce, 'morale') }}</td></tr>
                    <tr><td>恢复速率</td><td>{{ formatForceAttribute(selectedForce, 'recoveryRate') }}</td></tr>
                    <tr><td>疲劳系数</td><td>{{ formatForceAttribute(selectedForce, 'fatigueFactor') }}</td></tr>
                    <tr><td>指挥能力</td><td>{{ formatForceAttribute(selectedForce, 'commandCapability') }}</td></tr>
                    <tr><td>指挥范围</td><td>{{ formatForceAttribute(selectedForce, 'commandRange') }}</td></tr>
                    <tr><td>可视范围</td><td>{{ formatForceAttribute(selectedForce, 'visibilityRadius') }}</td></tr>
                    <tr>
                      <td>部队组成</td>
                      <td>
                        <table class="composition-table">
                          <thead>
                            <tr><th>兵种</th><th>数量</th></tr>
                          </thead>
                          <tbody>
                            <tr v-for="comp in selectedForce.composition" :key="comp.unitId">
                              <td>{{ getUnitName(comp.unitId) }}</td>
                              <td>{{ comp.unitCount }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- 编辑/新增 -->
              <div v-else-if="forcePanelMode === 'edit'" class="force-edit-form">
                <div class="section-header">
                  <h4>新增部队</h4>
                  <div class="edit-actions">
                    <button class="save-button" @click="saveForce">保存</button>
                    <button class="cancel-button" @click="cancelEditForce">取消</button>
                  </div>
                </div>
                <table class="force-table">
                  <tbody>
                    <tr>
                      <td>部队名称</td>
                      <td><input v-model="editingForce.forceName" required placeholder="请输入部队名称"></td>
                    </tr>
                    <tr>
                      <td>军种</td>
                      <td>
                        <div>
                          <label v-for="(name, value) in serviceMap" :key="value" style="margin-right:16px;">
                            <input type="radio" :value="value" v-model="editingForce.service" :disabled="editingForce.composition.length > 0"> {{ name }}
                          </label>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>兵种组成</td>
                      <td>
                        <div style="margin-bottom:8px;">
                          <select v-model="newUnit.unitId" :disabled="!editingForce.service">
                            <option value="">请选择兵种</option>
                            <option v-for="unit in availableUnits.filter(u => u.service.includes(editingForce.service))" :key="unit.unitId" :value="unit.unitId">{{ unit.unitName }}</option>
                          </select>
                          <input type="number" v-model.number="newUnit.unitCount" min="1" placeholder="基数" style="width:60px; margin-left:8px;">
                          <button type="button" class="add-unit-button" @click="addUnitToForce" :disabled="!newUnit.unitId || !newUnit.unitCount || !editingForce.service">添加</button>
                        </div>
                        <table class="composition-table" v-if="editingForce.composition.length > 0">
                          <thead>
                            <tr><th>兵种</th><th>数量</th><th></th></tr>
                          </thead>
                          <tbody>
                            <tr v-for="(comp, index) in editingForce.composition" :key="index">
                              <td>{{ getUnitName(comp.unitId) }}</td>
                              <td>{{ comp.unitCount }}</td>
                              <td><button type="button" class="remove-unit-button" @click="removeUnitFromForce(index)">删除</button></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- 拆分 -->
              <div v-else-if="forcePanelMode === 'split'" class="split-force-panel">
                <div class="section-header">
                  <h4>拆分部队</h4>
                  <div class="edit-actions">
                    <button class="save-button" @click="confirmSplitForce">确认</button>
                    <button class="cancel-button" @click="cancelSplitForce">取消</button>
                  </div>
                </div>
                <div class="split-force-content">
                  <div class="split-source-table">
                    <div class="split-title">原部队兵种组成及剩余基数</div>
                    <table class="composition-table">
                      <thead><tr><th>兵种</th><th>原基数</th><th>剩余未分配</th></tr></thead>
                      <tbody>
                        <tr v-for="comp in splitSourceForce.composition" :key="comp.unitId">
                          <td>{{ getUnitName(comp.unitId) }}</td>
                          <td>{{ comp.unitCount }}</td>
                          <td :style="{color: splitRemainMap[comp.unitId] === 0 ? '#bfae7a' : '#e24a4a'}">{{ splitRemainMap[comp.unitId] }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="split-details-list">
                    <div class="split-title">拆分后部队</div>
                    <div v-for="(detail, idx) in splitDetails" :key="idx" class="split-detail-item">
                      <div class="split-detail-header">
                        <input v-model="detail.forceName" placeholder="新部队名称" class="split-force-name-input">
                        <button class="remove-unit-button" @click="removeSplitForce(idx)">删除</button>
                      </div>
                      <table class="composition-table">
                        <thead><tr><th>兵种</th><th>数量</th><th></th></tr></thead>
                        <tbody>
                          <tr v-for="(comp, cidx) in detail.composition" :key="cidx">
                            <td>
                              <select v-model="comp.unitId" :disabled="true">
                                <option v-for="unit in availableUnits" :key="unit.unitId" :value="unit.unitId">{{ getUnitName(unit.unitId) }}</option>
                              </select>
                            </td>
                            <td>
                              <input type="number" 
                                :min="1" 
                                :max="splitRemainMap[comp.unitId] + comp.unitCount" v-model.number="comp.unitCount" 
                                @change="updateSplitUnitCount(detail, comp, comp.unitCount)" 
                                style="width:60px;"
                              >
                            </td>
                            <td><button class="remove-unit-button" @click="removeUnitFromSplitForce(detail, cidx)">删除</button></td>
                          </tr>
                        </tbody>
                      </table>
                      <button class="add-unit-button" @click="addUnitToSplitForce(detail)" :disabled="Object.values(splitRemainMap).every(remain => remain === 0)">添加兵种</button>
                    </div>
                    <button class="add-unit-button" @click="addSplitForce">新增拆分后部队</button>
                  </div>
                </div>
              </div>
              <!-- 合并 -->
              <div v-else-if="forcePanelMode === 'merge' && selectedForces.size >= 2" class="merge-force-panel">
                <div class="section-header">
                  <h4>合并部队</h4>
                  <div class="edit-actions">
                    <button class="save-button" @click="confirmMergeForces">确认</button>
                    <button class="cancel-button" @click="cancelMergeForces">取消</button>
                  </div>
                </div>
                <div class="merge-force-content">
                  <div class="merge-title">合并后部队信息预览</div>
                  <table class="force-table">
                    <tbody>
                      <tr>
                        <td>新部队名称</td>
                        <td><input v-model="mergeForceName" placeholder="请输入新部队名称"></td>
                      </tr>
                      <tr><td>军种</td><td><span class="service-tag" :class="mergePreview?.service">{{ serviceMap[mergePreview?.service] }}</span></td></tr>
                      <tr><td>兵力值</td><td>{{ mergePreview?.troopStrength }}</td></tr>
                      <tr><td>行动力</td><td>{{ mergePreview?.actionPoints }}</td></tr>
                      <tr><td>战斗机会</td><td>{{ mergePreview?.combatChance }}</td></tr>
                      <tr>
                        <td>部队组成</td>
                        <td>
                          <table class="composition-table">
                            <thead><tr><th>兵种</th><th>数量</th></tr></thead>
                            <tbody>
                              <tr v-for="comp in mergePreview?.composition" :key="comp.unitId">
                                <td>{{ getUnitName(comp.unitId) }}</td>
                                <td>{{ comp.unitCount }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <!-- 空白/未选中 -->
              <div v-else class="empty-info">
                <div class="empty-message">
                  {{ forcePanelMode === 'edit' ? '请填写部队信息' : forcePanelMode === 'split' ? '请配置拆分方案' : forcePanelMode === 'merge' ? '请选择要合并的部队' : '请选择部队' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { openGameStore } from '@/store';
import { CommandService } from '@/layers/interaction-layer/CommandDispatcher';
import { showSuccess, showWarning } from '@/layers/interaction-layer/utils/MessageBox';
import { CommandType } from '@/config/CommandConfig';
import { GamePanels } from '@/config/GameModeConfig';
import { MilitaryConfig } from '@/config/GameConfig';
import { ElMessageBox } from 'element-plus';

// 状态管理
const store = openGameStore();

// 面板可见性控制
const isPanelVisible = computed(() => {
  return store.isPanelActive(GamePanels.MILITARY_MANAGE_PANEL);
});

// 获取当前应该显示的选项卡
const activeTab = computed({
  get: () => store.getActiveMilitaryTab(),
  set: (value) => store.setActiveMilitaryTab(value)
});

// 编辑状态控制
const isEditingUnit = ref(false);
const isEditingForce = ref(false);
const inMergeMode = ref(false);

const selectedHexIds = computed(() => Array.from(store.getSelectedHexIds()));
const hexForces = computed(() => {
  return store.getForces().filter(force => selectedHexIds.value[0] === force.hexId);
});

// 检查当前游戏模式下面板是否应该禁用
const isPanelDisabled = computed(() => {
  return store.isPanelDisabled(GamePanels.MILITARY_MANAGE_PANEL);
});

// 切换选项卡
function switchTab(tab) {
  // 面板与上一个不同时才切换
  if (activeTab.value !== tab) {
    activeTab.value = tab;
    // 切换时重置所有编辑状态
    isEditingUnit.value = false;
    isEditingForce.value = false;
    inMergeMode.value = false;
  }
}

// 关闭面板
function closePanel() {
  store.hidePanel(GamePanels.MILITARY_MANAGE_PANEL);
  // 重置所有状态
  isEditingUnit.value = false;
  isEditingForce.value = false;
  inMergeMode.value = false;
}

// 军种名称映射
const serviceMap = {
  'land': '陆军',
  'sea': '海军',
  'air': '空军'
};

// 兵种相关状态
const selectedUnitId = ref(null);
const editingUnit = ref(null);

// 获取当前阵营可用的兵种列表（去重）
const availableUnits = computed(() => {
  const seen = new Set();
  return store.getUnits().filter(unit => {
    if (!unit.factionAvailability.includes(store.currentFaction)) return false;
    if (seen.has(unit.unitId)) return false;
    seen.add(unit.unitId);
    return true;
  });
});

// 获取选中的兵种
const selectedUnit = computed(() => {
  if (!selectedUnitId.value) return null;
  return store.getUnitById(selectedUnitId.value);
});

// 获取可用的渲染模型列表
const availableModels = computed(() => {
  const models = MilitaryConfig.models;
  return Object.entries(models).map(([key, model]) => ({
    key,
    name: model.name || key,
    service: model.service
  }));
});

// 检查兵种是否在使用中
function isUnitInUse(unitId) {
  const forces = store.getForces();
  return forces.some(force => 
    force.composition.some(comp => comp.unitId === unitId)
  );
}

// 检查模型是否与当前编辑的兵种军种兼容
function isModelServiceCompatible(model) {
  if (!editingUnit.value || !editingUnit.value.service) return true;
  return editingUnit.value.service.includes(model.service);
}

// 获取模型显示名称
function getModelName(key) {
  const model = MilitaryConfig.models[key];
  return model?.name || key;
}

// 选择兵种
function selectUnit(unitId) {
  if (isEditingUnit.value) return;
  selectedUnitId.value = unitId;
}

// 创建新兵种
function createNewUnit() {
  selectedUnitId.value = null;
  isEditingUnit.value = true;
  editingUnit.value = {
    unitName: '',
    service: [],
    category: '',
    factionAvailability: [store.currentFaction],
    attackPowerComposition: {
      baseAttackPower: 0,
      domainFactor: { land: 0, sea: 0, air: 0 },
      terrainFactor: { plain: 1, hill: 1, mountain: 1, water: 1 }
    },
    defensePowerComposition: {
      baseDefensePower: 0,
      domainFactor: { land: 0, sea: 0, air: 0 },
      terrainFactor: { plain: 1, hill: 1, mountain: 1, water: 1 }
    },
    visibilityRadius: 1,
    recoveryRate: 0.1,
    commandCapability: 1,
    commandRange: 1,
    renderingKey: ''
  };
}

// 编辑兵种
function editUnit(unitId) {
  if (isUnitInUse(unitId)) {
    showWarning('该兵种正在使用中，无法编辑');
    return;
  }
  
  const unit = store.getUnitById(unitId);
  if (!unit) return;
  
  selectedUnitId.value = unitId;
  isEditingUnit.value = true;
  editingUnit.value = { ...unit };
}

// 取消编辑
function cancelEdit() {
  isEditingUnit.value = false;
  if (!selectedUnitId.value) {
    editingUnit.value = null;
  }
}

// 发送命令：新增/编辑兵种
async function submitEditedUnit() {
  try {
    if (!editingUnit.value.unitName) {
      showWarning('请输入兵种名称');
      return;
    }
    if (editingUnit.value.service.length === 0) {
      showWarning('请选择至少一个军种');
      return;
    }
    if (!editingUnit.value.category) {
      showWarning('请输入兵种类型');
      return;
    }
    if (editingUnit.value.factionAvailability.length === 0) {
      showWarning('请选择至少一个可参战阵营');
      return;
    }
    // 通过命令接口保存
    await CommandService.executeCommandFromUI(CommandType.EDIT_UNIT, {
      unitData: { ...editingUnit.value }
    });
    showSuccess('保存成功');
    isEditingUnit.value = false;
    selectedUnitId.value = editingUnit.value.unitId;
    editingUnit.value = null;
  } catch (error) {
    showWarning(`保存失败: ${error.message}`);
  }
}

// 删除兵种前的确认
function handleDeleteUnit(unitId) {
  if (isUnitInUse(unitId)) {
    showWarning('该兵种正在使用中，无法删除');
    return;
  }
  ElMessageBox.confirm('确定要删除该兵种吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    deleteUnit(unitId);
  }).catch(() => {});
}

// 发送命令：删除兵种
async function deleteUnit(unitId) {
  if (isUnitInUse(unitId)) {
    showWarning('该兵种正在使用中，无法删除');
    return;
  }
  try {
    await CommandService.executeCommandFromUI(CommandType.DELETE_UNIT, {
      unitId
    });
    showSuccess('删除成功');
    if (selectedUnitId.value === unitId) {
      selectedUnitId.value = null;
    }
  } catch (error) {
    showWarning(`删除失败: ${error.message}`);
  }
}

// 统一管理部队面板状态
const forcePanelMode = ref('view'); // 'view' | 'edit' | 'split' | 'merge'

// 进入普通详情模式
function enterForceView(forceId) {
  forcePanelMode.value = 'view';
  selectedForceId.value = forceId;
  isEditingForce.value = false;
  isSplittingForce.value = false;
  inMergeMode.value = false;
  selectedForces.value.clear();
  editingForce.value = null;
  splitSourceForce.value = null;
  splitRemainMap.value = {};
  splitDetails.value = [];
  mergeForceName.value = '';
}
// 进入编辑/新增模式
function enterForceEdit(force) {
  forcePanelMode.value = 'edit';
  isEditingForce.value = true;
  editingForce.value = force ? { ...force } : {
    forceName: '',
    faction: store.currentFaction,
    service: '',
    hexId: selectedHexIds.value[0],
    composition: [],
    troopStrength: 100,
    combatChance: 0,
    actionPoints: 0
  };
}
// 进入拆分模式
function enterForceSplit(force) {
  forcePanelMode.value = 'split';
  isSplittingForce.value = true;
  splitSourceForce.value = force;
  splitRemainMap.value = {};
  force.composition.forEach(comp => {
    splitRemainMap.value[comp.unitId] = comp.unitCount;
  });
  splitDetails.value = [];
}
// 进入合并模式
function enterForceMerge() {
  forcePanelMode.value = 'merge';
  inMergeMode.value = true;
  selectedForces.value.clear();
  mergeForceName.value = '';
}
// 关闭所有特殊模式，回到普通
function resetForcePanel() {
  forcePanelMode.value = 'view';
  isEditingForce.value = false;
  isSplittingForce.value = false;
  inMergeMode.value = false;
  editingForce.value = null;
  splitSourceForce.value = null;
  splitRemainMap.value = {};
  splitDetails.value = [];
  mergeForceName.value = '';
  selectedForces.value.clear();
}

// 左侧列表点击逻辑
function selectForce(forceId) {
  if (forcePanelMode.value === 'merge') {
    // 合并模式下多选
    if (selectedForces.value.has(forceId)) {
      selectedForces.value.delete(forceId);
    } else {
      selectedForces.value.add(forceId);
    }
  } else {
    // 其他模式下单选
    enterForceView(forceId);
  }
}

// 新建部队
function createNewForce() {
  enterForceEdit(null);
}
// 编辑部队
function editForce(forceId) {
  const force = store.getForceById(forceId);
  if (!force) return;
  enterForceEdit(force);
}
// 拆分部队
function splitForce(forceId) {
  const force = store.getForceById(forceId);
  if (!force) return;
  if (force.troopStrength < 50) {
    showWarning('部队兵力不足，无法拆分');
    return;
  }
  enterForceSplit(force);
}
// 合并部队
function toggleMergeMode() {
  if (forcePanelMode.value === 'merge') {
    resetForcePanel();
  } else {
    enterForceMerge();
  }
}
// 删除部队
function handleDeleteForce(forceId) {
  if (window.confirm('确定要删除该部队吗？')) {
    deleteForce(forceId);
    if (selectedForceId.value === forceId) {
      selectedForceId.value = null;
    }
    resetForcePanel();
  }
}
// 取消编辑/新增
function cancelEditForce() {
  resetForcePanel();
}
// 取消拆分
function cancelSplitForce() {
  resetForcePanel();
}
// 取消合并
function cancelMergeForces() {
  resetForcePanel();
}
// 发送命令：创建部队
async function saveForce() {
  try {
    if (!editingForce.value.forceName) {
      showWarning('请输入部队名称');
      return;
    }
    if (!editingForce.value.service) {
      showWarning('请选择军种');
      return;
    }
    if (editingForce.value.composition.length === 0) {
      showWarning('请添加至少一个兵种');
      return;
    }
    if (!validateForceComposition()) {
      return;
    }
    // 通过命令接口创建部队
    await CommandService.executeCommandFromUI(CommandType.CREATE_FORCE, {
      forceData: { ...editingForce.value }
    });
    showSuccess('保存成功');
    resetForcePanel();
  } catch (error) {
    showWarning(`保存失败: ${error.message}`);
  }
}

// 检查部队组成是否有效
function validateForceComposition() {
  if (!editingForce.value) return false;
  
  // 检查是否有重复的兵种
  const unitIds = new Set();
  for (const comp of editingForce.value.composition) {
    if (unitIds.has(comp.unitId)) {
      showWarning('部队组成中不能包含重复的兵种');
      return false;
    }
    unitIds.add(comp.unitId);
  }
  
  // 检查数量是否合法
  for (const comp of editingForce.value.composition) {
    if (comp.unitCount <= 0) {
      showWarning('兵种数量必须大于0');
      return false;
    }
  }
  
  return true;
}

// 格式化部队属性显示
function formatForceAttribute(force, attr) {
  if (!force) return '0';
  
  switch (attr) {
    case 'morale':
      return Math.round(force.morale);
    case 'recoveryRate':
      return Math.round(force.recoveryRate);
    case 'fatigueFactor':
      return force.fatigueFactor.toFixed(2);
    case 'commandCapability':
      return force.commandCapability.toFixed(2);
    case 'commandRange':
      return Math.round(force.commandRange);
    case 'visibilityRadius':
      return Math.round(force.visibilityRadius);
    default:
      return '0';
  }
}

// 获取兵种名称
function getUnitName(unitId) {
  const unit = store.getUnitById(unitId);
  return unit ? unit.unitName : '未知兵种';
}

// 监听选项卡变化
watch(() => isPanelVisible.value, (newValue) => {
  if (!newValue) {
    // 面板关闭时重置编辑状态
    isEditingUnit.value = false;
    isEditingForce.value = false;
    inMergeMode.value = false;
  }
});

// 工具函数：获取军种色条class
function getForceTypeClass(item) {
  if (!item || !item.service) return 'type-land';
  if (Array.isArray(item.service)) {
    if (item.service.includes('sea')) return 'type-naval';
    if (item.service.includes('air')) return 'type-air';
    return 'type-land';
  }
  switch (item.service) {
    case 'sea': return 'type-naval';
    case 'air': return 'type-air';
    default: return 'type-land';
  }
}

// 当前列表中选中的部队ID (view模式下)
const selectedForceId = ref(null);
// 是否处于拆分部队模式
const isSplittingForce = ref(false);
// 合并模式下选中的部队集合
const selectedForces = ref(new Set());
// 编辑模式下的部队数据
const editingForce = ref(null);
// 拆分模式下的源部队数据
const splitSourceForce = ref(null);
// 拆分模式下各兵种剩余未分配的数量
const splitRemainMap = ref({});
// 拆分模式下新部队的详细信息列表
const splitDetails = ref([]);
// 合并模式下新部队的名称
const mergeForceName = ref('');

// 删除部队（通过命令分发）
async function deleteForce(forceId) {
  try {
    await CommandService.executeCommandFromUI(CommandType.DELETE_FORCE, {
      forceId
    });
    showSuccess('删除成功');
    if (selectedForceId.value === forceId) {
      selectedForceId.value = null;
    }
  } catch (error) {
    showWarning(`删除失败: ${error.message}`);
  }
}

// 新增部队时用于添加兵种的临时对象
const newUnit = ref({ unitId: '', unitCount: 1 });

function addUnitToForce() {
  if (!newUnit.value.unitId || !newUnit.value.unitCount || !editingForce.value.service) return;
  // 检查是否已存在该兵种，如果存在则合并数量
  const existingUnit = editingForce.value.composition.find(c => c.unitId === newUnit.value.unitId);
  if (existingUnit) {
    existingUnit.unitCount += newUnit.value.unitCount;
  } else {
    editingForce.value.composition.push({ unitId: newUnit.value.unitId, unitCount: newUnit.value.unitCount });
  }
  newUnit.value.unitId = '';
  newUnit.value.unitCount = 1;
}

function removeUnitFromForce(index) {
  editingForce.value.composition.splice(index, 1);
}

// 发送命令：合并部队
async function confirmMergeForces() {
  if (!mergeForceName.value) {
    showWarning('请输入新部队名称');
    return;
  }
  if (selectedForces.value.size < 2) {
    showWarning('请选择至少两个部队');
    return;
  }
  try {
    await CommandService.executeCommandFromUI(CommandType.MERGE_FORCES, {
      newForceName: mergeForceName.value,
      forceIds: Array.from(selectedForces.value).map(force => force.forceId)
    });
    showSuccess('部队合并成功');
    resetForcePanel();
  } catch (error) {
    showWarning(`部队合并失败: ${error.message}`);
  }
}

// 发送命令：拆分部队
async function confirmSplitForce() {
  if (!splitSourceForce.value || splitDetails.value.length === 0) {
    showWarning('请配置拆分方案');
    return;
  }
  try {
    await CommandService.executeCommandFromUI(CommandType.SPLIT_FORCE, {
      forceId: splitSourceForce.value.forceId,
      splitDetails: splitDetails.value.map(detail => ({
        forceName: detail.forceName,
        composition: detail.composition.map(c => ({ ...c }))
      }))
    });
    showSuccess('拆分成功');
    resetForcePanel();
  } catch (error) {
    showWarning(`拆分失败: ${error.message}`);
  }
}
</script>

<style scoped>
/* 模态框背景 */
.modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 999; }

.military-manage-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 1000px; height: 600px; background-color: rgba(169, 140, 102, 0.95); border: 6px solid rgba(80, 60, 40, 0.8); border-radius: 4px; color: #f0f0f0; display: flex; flex-direction: column; z-index: 1000; }
.military-manage-panel.disabled { pointer-events: none; filter: grayscale(50%); }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background-color: rgba(80, 60, 40, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.title { font-size: 18px; font-weight: bold; color: #f0eadd; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4); }
.close-button { font-size: 24px; cursor: pointer; color: #f0eadd; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border-radius: 50%; transition: all 0.3s; }
.close-button:hover { background-color: rgba(255, 255, 255, 0.1); }

.tab-container { display: flex; background-color: rgba(80, 60, 40, 0.6); padding: 0 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.tab { padding: 10px 20px; cursor: pointer; transition: all 0.3s; color: rgba(255, 255, 255, 0.7); border-bottom: 2px solid transparent; }
.tab:hover { color: #f0eadd; background-color: rgba(255, 255, 255, 0.1); }
.tab.active { color: #f0eadd; border-bottom-color: #f0eadd; background-color: rgba(255, 255, 255, 0.1); }

.panel-content { flex: 1; overflow: hidden; }
.content-container { display: flex; height: 100%; }
.left-section, .right-section { height: 100%; display: flex; flex-direction: column; border-right: 1px solid rgba(255, 255, 255, 0.1); min-width: 0; }
.left-section { width: 40%; min-width: 280px; }
.right-section { flex: 1; min-width: 0; }
.section-header { background-color: rgba(80, 60, 40, 0.5); padding: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; }
.section-header h4 { margin: 0; font-size: 15px; color: #f0eadd; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4); }
.button-group { display: flex; gap: 10px; }
.action-button, .add-button { padding: 4px 8px; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; background-color: rgba(251, 233, 184, 0.2); color: #f0eadd; cursor: pointer; transition: all 0.3s; font-size: 12px; }
.action-button:hover, .add-button:hover { background-color: rgba(251, 233, 184, 0.3); }
.action-button:disabled { opacity: 0.5; cursor: not-allowed; }

.unit-list, .force-list, .unit-details, .force-details {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 0 0;
  background: transparent;
}
.formation-list { width: 100%; overflow-y: auto; }

.unit-row, .force-row, .force-item {
  display: flex;
  align-items: center;
  min-height: 32px;
  max-height: 32px;
  padding: 0 8px 0 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  overflow: hidden;
  position: relative;
  background: transparent;
  font-size: 13px;
}
.unit-row:hover, .force-row:hover, .force-item:hover { background-color: rgba(255,255,255,0.06); }
.unit-row.selected, .force-row.selected, .force-item.selected { background-color: rgba(74, 144, 226, 0.13); }

.force-type-indicator {
  width: 3px;
  min-width: 3px;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  border-radius: 0;
  flex-shrink: 0;
  display: block;
}
.type-land { background-color: #4ae24a; }
.type-naval { background-color: #4a90e2; }
.type-air { background-color: #e24a4a; }

.force-info {
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;
  align-items: center;
  max-width: calc(100% - 90px);
  box-sizing: border-box;
  margin-left: 8px;
}
.force-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
  font-size: 13px;
  flex-shrink: 1;
}
.force-location {
  font-size: 12px;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  margin-left: 8px;
  max-width: 50px;
  flex-shrink: 0;
}
.unit-ops, .force-ops {
  display: flex;
  gap: 4px;
  margin-left: auto;
  align-items: center;
}
.edit-button, .delete-button, .split-button {
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  outline: none;
  background-color: rgba(74, 144, 226, 0.18);
  color: #f0f0f0;
}
.delete-button { background-color: rgba(226, 74, 74, 0.18); }
.split-button { background-color: rgba(251, 233, 184, 0.18); color: #bfae7a; }
.edit-button:hover { background-color: rgba(74, 144, 226, 0.35); }
.delete-button:hover { background-color: rgba(226, 74, 74, 0.35); }
.split-button:hover { background-color: rgba(251, 233, 184, 0.35); color: #bfae7a; }
.edit-button:disabled, .delete-button:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-forces { padding: 10px 0; text-align: center; color: rgba(255, 255, 255, 0.5); font-style: italic; font-size: 14px; }

/* 右侧详情卡片分组样式 */
.detail-card { padding: 18px 18px 0 18px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }
.info-section, .form-section { background: rgba(0,0,0,0.08); border-radius: 5px; padding: 12px 16px 10px 16px; margin-bottom: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.info-section h5, .form-section h5 { margin: 0 0 10px 0; color: #f0eadd; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; }
.info-group, .power-info, .power-factors, .composition-list, .composition-table { margin-bottom: 7px; }
.info-group label { color: #bfae7a; font-size: 12px; margin-right: 6px; }
.info-group span, .faction-tag, .service-tag { font-size: 12px; }
.faction-tag.blue { color: #4a90e2; }
.faction-tag.red { color: #e24a4a; }
.faction-tag.neutral { color: #ccc; }
.service-tag.land { color: #4ae24a; }
.service-tag.sea { color: #4a90e2; }
.service-tag.air { color: #e24a4a; }

.power-table, .composition-table { width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.04); border-radius: 3px; }
.power-header, .composition-header { font-weight: bold; background: rgba(80,60,40,0.13); padding: 4px 8px; border-radius: 3px; font-size: 13px; color: #f0eadd; }
.power-row, .composition-row { border-bottom: 1px solid rgba(255,255,255,0.06); }
.power-cell, .comp-cell { padding: 2px 6px; font-size: 12px; text-align: center; }

/* 滚动条美化 */
.unit-list::-webkit-scrollbar, .force-list::-webkit-scrollbar, .formation-list::-webkit-scrollbar, .detail-card::-webkit-scrollbar {
  width: 5px;
}
.unit-list::-webkit-scrollbar-thumb, .force-list::-webkit-scrollbar-thumb, .formation-list::-webkit-scrollbar-thumb, .detail-card::-webkit-scrollbar-thumb {
  background: rgba(80, 60, 40, 0.3);
  border-radius: 3px;
}
.unit-list::-webkit-scrollbar-track, .force-list::-webkit-scrollbar-track, .formation-list::-webkit-scrollbar-track, .detail-card::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
}
.unit-list::-webkit-scrollbar-thumb:hover, .force-list::-webkit-scrollbar-thumb:hover, .formation-list::-webkit-scrollbar-thumb:hover, .detail-card::-webkit-scrollbar-thumb:hover {
  background: rgba(80, 60, 40, 0.5);
}

/* 保留更复杂的样式，只合并简单的样式 */
.unit-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 auto;
  background: transparent;
  color: #f0eadd;
  font-size: 13px;
}
.unit-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 13px;
  vertical-align: middle;
  background: transparent;
}
.unit-table tr:last-child td {
  border-bottom: none;
}
.unit-table input[type="text"], .unit-table input[type="number"], .unit-table select {
  width: 90%;
  padding: 2px 4px;
  font-size: 13px;
  border-radius: 3px;
  border: 1px solid #bfae7a;
  background: rgba(255,255,255,0.08);
  color: #f0eadd;
  outline: none;
  transition: border 0.2s;
}
.unit-table input[type="text"]:focus, .unit-table input[type="number"]:focus, .unit-table select:focus {
  border: 1.5px solid #4a90e2;
}
.unit-table input[type="checkbox"] {
  margin-right: 2px;
}
.edit-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}
.save-button, .cancel-button {
  padding: 2px 14px;
  border-radius: 3px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  outline: none;
  background-color: rgba(74, 144, 226, 0.18);
  color: #f0f0f0;
  transition: all 0.2s;
  margin-left: 4px;
}
.save-button:hover { background-color: rgba(74, 144, 226, 0.35); }
.cancel-button { background-color: rgba(226, 74, 74, 0.18); }
.cancel-button:hover { background-color: rgba(226, 74, 74, 0.35); }
.save-button:disabled, .cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.service-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  margin-right: 4px;
  font-size: 12px;
  background: rgba(74, 144, 226, 0.13);
  color: #4ae24a;
}
.service-tag.sea { color: #4a90e2; background: rgba(74, 144, 226, 0.13); }
.service-tag.air { color: #e24a4a; background: rgba(226, 74, 74, 0.13); }
.service-tag.land { color: #4ae24a; background: rgba(74, 226, 74, 0.13); }
.faction-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  margin-right: 4px;
  font-size: 12px;
  background: rgba(251, 233, 184, 0.13);
  color: #4a90e2;
}
.faction-tag.red { color: #e24a4a; background: rgba(226, 74, 74, 0.13); }
.faction-tag.blue { color: #4a90e2; background: rgba(74, 144, 226, 0.13); }
.faction-tag.neutral { color: #ccc; background: rgba(200,200,200,0.13); }
.force-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 auto;
  background: transparent;
  color: #f0eadd;
  font-size: 13px;
}
.force-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 13px;
  vertical-align: middle;
  background: transparent;
}
.force-table tr:last-child td {
  border-bottom: none;
}
.force-table input[type="text"], .force-table input[type="number"], .force-table select {
  width: 90%;
  padding: 2px 4px;
  font-size: 13px;
  border-radius: 3px;
  border: 1px solid #bfae7a;
  background: rgba(255,255,255,0.08);
  color: #f0eadd;
  outline: none;
  transition: border 0.2s;
}
.force-table input[type="text"]:focus, .force-table input[type="number"]:focus, .force-table select:focus {
  border: 1.5px solid #4a90e2;
}
.composition-scroll-container {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  background: rgba(0,0,0,0.04);
  padding: 4px 2px 4px 2px;
}
.composition-table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  font-size: 13px;
  margin-bottom: 4px;
}
.composition-table th, .composition-table td {
  padding: 4px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  text-align: left;
  background: transparent;
}
.composition-table th {
  font-weight: bold;
  color: #bfae7a;
  background: rgba(80,60,40,0.13);
}
.composition-table tr:last-child td {
  border-bottom: none;
}
.add-unit-button, .remove-unit-button {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  border: none;
  outline: none;
  background-color: rgba(251, 233, 184, 0.18);
  color: #bfae7a;
  margin-top: 4px;
  margin-bottom: 2px;
  transition: all 0.2s;
}
.add-unit-button:hover, .remove-unit-button:hover {
  background-color: rgba(251, 233, 184, 0.35);
}
.split-force-panel {
  background: rgba(80,60,40,0.08);
  border-radius: 6px;
  margin: 10px 0;
  padding: 10px 18px 18px 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.split-force-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.split-source-table, .split-details-list {
  flex: 1;
}
.split-title {
  font-weight: bold;
  color: #bfae7a;
  margin-bottom: 6px;
  font-size: 14px;
}
.split-detail-item {
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 8px 8px 4px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.split-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.split-force-name-input {
  width: 120px;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: 3px;
  border: 1px solid #bfae7a;
  background: rgba(255,255,255,0.08);
  color: #f0eadd;
}
.merge-force-panel {
  background: rgba(80,60,40,0.08);
  border-radius: 6px;
  margin: 10px 0;
  padding: 10px 18px 18px 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.merge-force-content {
  margin-top: 8px;
}
.merge-title {
  font-weight: bold;
  color: #bfae7a;
  margin-bottom: 6px;
  font-size: 14px;
}
</style>


