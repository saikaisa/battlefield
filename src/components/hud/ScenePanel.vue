<!-- src\components\hud\ScenePanel.vue -->
<template>
  <el-card class="control-panel">
    <!-- 回合信息区域 -->
    <div class="round-info">
      <span class="round-text">第{{ roundInfo.round }}回合</span>
      <span class="faction-text" :class="roundInfo.faction">
        {{ currentFactionName }}
      </span>
      <el-button 
        type="primary" 
        size="small" 
        @click="handleNextFaction"
        :disabled="roundInfo.isFinished">
        结束回合
      </el-button>
    </div>

    <!-- 视角控制区域 -->
    <div class="view-controls">
      <el-button type="primary" @click="resetCamera">视角居中</el-button>
      <el-button type="success" @click="focusForce">定位选中单位</el-button>
      <el-button type="warning" @click="toggleOrbitMode">{{ orbitButtonText }}</el-button>
    </div>

    <!-- 图层选择区域 -->
    <div class="layer-controls">
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
import { ref, computed, inject } from 'vue';
import { openGameStore } from '@/store';
import { RuleConfig } from '@/config/GameConfig';

const scenePanelManager = inject('scenePanelManager');
if (!scenePanelManager) {
  console.error('未找到 scenePanelManager，请在 App.vue 中 provide');
}

const store = openGameStore();

// 回合信息
const roundInfo = computed(() => store.getRoundInfo());
// 当前阵营显示名称
const currentFactionName = computed(() => RuleConfig.factionNames[roundInfo.value.faction]);

// 用于切换按钮的本地状态
const orbitEnabled = ref(false);

// 切换图层
const layerIndex = computed({
  get: () => store.layerIndex,
  set: (val) => {
    store.setLayerIndex(val);
    scenePanelManager.handleLayerChange();
  }
});

const toggleOrbitMode = () => {
  orbitEnabled.value = !orbitEnabled.value;
  scenePanelManager.handleOrbitMode(orbitEnabled.value);
};

const orbitButtonText = computed(() =>
  orbitEnabled.value ? "退出 Orbit 模式" : "进入 Orbit 模式"
);

const resetCamera = () => {
  orbitEnabled.value = false;
  scenePanelManager.handleResetCamera();
};

const focusForce = () => {
  scenePanelManager.handleFocusForce();
};

const handleNextFaction = () => {
  scenePanelManager.handleNextFaction();
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

.round-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
}

.round-text {
  font-weight: bold;
}

.faction-text {
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
}

.faction-text.blue {
  background-color: #409EFF;
}

.faction-text.red {
  background-color: #F56C6C;
}

.view-controls {
  margin-bottom: 15px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.layer-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.el-select {
  flex: 1;
}
</style>
