// src\layers\military-layer\MilitaryManager.js
import * as Cesium from "cesium";
import { openGameStore } from "@/store";
import { MilitaryModelLoader } from "./components/MilitaryModelLoader";

/**
 * 军事单位管理器
 * 
 * 加载军事单位和命令处理逻辑的总管理器
 */
export class MilitaryManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.store = openGameStore();
    this.hexCells = this.store.getHexCells();
  }

  /**
   * 异步初始化地图，并在划定区域生成六角网格
   */
  async init() {
    // ---------------- 兵种系统加载开始 ----------------
    // 下面只是示例
    // 假设 hexCells 为生成的六角格数组（见 HexGridGenerator.js 中 generateGrid 方法返回的数据）
    // 此处取第一个六角格的中心点作为部队单位的放置位置
    const firstHex = this.hexCells[0];
    const centerPoint = firstHex.position.points[0];  // 第一个点为中心点

    // 将中心点（包含经纬度、高度）转换为 Cartesian3 坐标
    const unitPosition = Cesium.Cartesian3.fromDegrees(centerPoint.longitude, centerPoint.latitude, centerPoint.height+500);

    // 创建模型优化实例，传入当前 Viewer 对象
    const militaryModelLoader = new MilitaryModelLoader(this.viewer);

    // 定义用于加载 GLB 单位模型的渲染属性，其中 lod_levels 可定义不同细节级别的模型路径
    const renderingAttributes = {
      // 当未启用 LOD 动态切换时，可直接指定基础模型路径
      model_path: "../../assets/plane.gltf",
      // 定义 LOD 方案：距离越远加载越低细节的模型
      lod_levels: [
        { level: 0, distance: 0, model_path: "/assets/plane.gltf" },
        { level: 1, distance: 800, model_path: "/assets/plane.gltf" },
        { level: 2, distance: 1500, model_path: "/assets/plane.gltf" }
      ]
    };

    // 加载并渲染 GLB 模型到指定位置，返回对象包含当前模型和 dispose 方法
    const unitModelHandle = militaryModelLoader.loadUnitModelWithLOD(renderingAttributes, unitPosition);

    // 此处，你可以在控制台输出 unitModelHandle 或在调试时检查是否正确加载
    console.log("单位模型加载成功：", unitModelHandle);
    // ---------------- 兵种系统加载结束 ----------------


    return true;

  }
}