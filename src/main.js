// src\main.js
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style/index.css'
import { createPinia } from 'pinia';
import * as Cesium from 'cesium';

Cesium.Ion.defaultAccessToken = process.env.VUE_APP_CESIUM_ION_TOKEN;

// 创建并挂载应用
const app = createApp(App)
const pinia = createPinia();
app.use(ElementPlus);
app.use(pinia);
app.mount('#app')
