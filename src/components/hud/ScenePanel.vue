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
import { CommandService, CommandType } from '@/layers/interaction-layer/CommandDispatcher';
import { showError } from '@/layers/interaction-layer/MessageBox';

// 保留旧的panelManager引用，用于兼容过渡
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
    // 使用命令系统执行
    CommandService.executeCommand(CommandType.CHANGE_LAYER, { layerIndex: val })
      .catch(error => {
        console.error('切换图层失败:', error);
      });
  }
});

const toggleOrbitMode = async () => {
  try {
    // 切换轨道模式状态
    orbitEnabled.value = !orbitEnabled.value;
    
    // 使用命令系统执行
    await CommandService.executeCommand(CommandType.ORBIT_MODE, { 
      enabled: orbitEnabled.value 
    });
  } catch (error) {
    // 如果执行失败，恢复状态
  orbitEnabled.value = !orbitEnabled.value;
    showError('切换轨道模式失败: ' + error.message);
  }
};

const orbitButtonText = computed(() =>
  orbitEnabled.value ? "退出 Orbit 模式" : "进入 Orbit 模式"
);

const resetCamera = async () => {
  try {
    // 使用命令系统执行
    await CommandService.executeCommand(CommandType.RESET_CAMERA, {});
    
    // 如果重置成功，关闭轨道模式
  orbitEnabled.value = false;
  } catch (error) {
    showError('重置视角失败: ' + error.message);
  }
};

const focusForce = async () => {
  try {
    // 使用命令系统执行
    await CommandService.executeCommand(CommandType.FOCUS_FORCE, {});
  } catch (error) {
    showError('定位部队失败: ' + error.message);
  }
};

const handleNextFaction = async () => {
  try {
    // 使用命令系统执行
    await CommandService.executeCommand(CommandType.NEXT_FACTION, {});
  } catch (error) {
    showError('切换回合失败: ' + error.message);
  }
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
