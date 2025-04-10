import * as Cesium from 'cesium';

/**
 * TerrainLoader 模块：提供 DEM 地形数据加载功能
 */
export class TerrainLoader {
  /**
   * 为指定 viewer 加载自定义地形数据
   * @param {Cesium.Viewer} viewer - Cesium Viewer 实例
   * @param {string} terrainUrl - 地形数据的 URL
   */
  static loadTerrain(viewer, terrainUrl) {
    if (terrainUrl) {
      const terrainProvider = new Cesium.CesiumTerrainProvider({
        url: terrainUrl
      });
      viewer.terrainProvider = terrainProvider;
    }
  }
}
