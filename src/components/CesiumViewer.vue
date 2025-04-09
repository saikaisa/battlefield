<template>
    <div id="cesiumContainer" style="width: 100%; height: 100vh;"></div>
</template>

<script>
import { onMounted, onBeforeUnmount } from 'vue';
import { Ion, Viewer, Cartesian3 } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// 设置 Cesium Ion AccessToken
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTg3Y2VmZC0wNGZlLTQyMWEtOTE3Yi0zMjA5ZTI3NTdiZjAiLCJpZCI6MjY1NzI5LCJpYXQiOjE3MzU1NTgyOTB9.5x2ohLt9GlRLXbH2LqoLBzH0olwpOm3XwavbkDNeQSQ';

export default {
    name: 'CesiumMap',
    setup() {
        let viewer;
        onMounted(() => {
            viewer = new Viewer('cesiumContainer', {
                animation: true,          // 显示动画控件
                baseLayerPicker: true,    // 显示图层选择器
                fullscreenButton: true,   // 显示全屏按钮
                geocoder: true,           // 显示搜索按钮
                homeButton: true,         // 显示Home按钮
                infoBox: true,            // 显示信息框
                sceneModePicker: true,    // 显示三维/二维切换器
                selectionIndicator: true, // 显示选取指示器
                timeline: true,           // 显示时间线
                navigationHelpButton: false, // 隐藏帮助提示按钮
            });

            // 设置初始视角，定位到北京地区
            viewer.camera.setView({
                destination: Cartesian3.fromDegrees(116.407394, 39.904211, 1500)
            });

            // 隐藏 Cesium 的版权信息
            viewer._cesiumWidget._creditContainer.style.display = 'none';
        });

        onBeforeUnmount(() => {
            if (viewer) {
                viewer.destroy();
            }
        });

        return {};
    }
}
</script>

<style scoped>
#cesiumContainer {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
}
</style>