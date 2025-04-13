<template>
    <el-card class="info-panel" shadow="hover">
      <el-row gutter="10" justify="center">
        <!-- 全局显示按钮 -->
        <el-col :span="12">
          <el-button type="primary" @click="onGlobalView" style="width: 100%;">全局显示</el-button>
        </el-col>
        <!-- 视角复位按钮 -->
        <el-col :span="12">
          <el-button type="primary" @click="onResetView" style="width: 100%;">视角复位</el-button>
        </el-col>
      </el-row>
      <el-row gutter="10" style="margin-top: 10px;" justify="center">
        <!-- 2D/3D 模式切换 -->
        <el-col :span="12">
          <el-button type="primary" @click="toggle2D3D" style="width: 100%;">2D/3D 切换</el-button>
        </el-col>
        <!-- 图层可视切换 -->
        <el-col :span="12">
          <el-button type="primary" @click="toggleLayerVisibility" style="width: 100%;">图层切换</el-button>
        </el-col>
      </el-row>
    </el-card>
  </template>
  
  <script setup>
//   import { onMounted } from 'vue';
  import { useInfoPanelManager } from '../../layers/interaction/InfoPanelManager';
  
  const infoManager = useInfoPanelManager();
  
  function onGlobalView() {
    if(infoManager) {
      infoManager.globalView();
    }
  }
  function onResetView() {
    if(infoManager) {
      infoManager.resetView();
    }
  }
  function toggle2D3D() {
    if(infoManager) {
      infoManager.toggle2D3D();
    }
  }
  function toggleLayerVisibility() {
    if(infoManager) {
      infoManager.toggleLayerVisibility();
    }
  }
  </script>
  
  <style scoped>
  .info-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 300px;
    z-index: 1000;
  }
  </style>
  