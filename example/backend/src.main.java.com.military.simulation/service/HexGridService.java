package com.military.simulation.service;

import com.military.simulation.model.HexGrid;
import com.military.simulation.repository.HexGridRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 六角格服务实现类
 */
@Service
public class HexGridService {
    
    @Autowired
    private HexGridRepository hexGridRepository;
    
    /**
     * 根据ID查询六角格
     * @param hexId 六角格ID
     * @return 六角格对象
     */
    public HexGrid getHexGridById(String hexId) {
        return hexGridRepository.findById(hexId);
    }
    
    /**
     * 查询所有六角格
     * @return 六角格列表
     */
    public List<HexGrid> getAllHexGrids() {
        return hexGridRepository.findAll();
    }
    
    /**
     * 根据行列范围查询六角格
     * @param minRow 最小行
     * @param maxRow 最大行
     * @param minCol 最小列
     * @param maxCol 最大列
     * @return 六角格列表
     */
    public List<HexGrid> getHexGridsByRowColRange(int minRow, int maxRow, int minCol, int maxCol) {
        return hexGridRepository.findByRowColRange(minRow, maxRow, minCol, maxCol);
    }
    
    /**
     * 根据控制方查询六角格
     * @param faction 控制方
     * @return 六角格列表
     */
    public List<HexGrid> getHexGridsByControlFaction(String faction) {
        return hexGridRepository.findByControlFaction(faction);
    }
    
    /**
     * 根据地形类型查询六角格
     * @param terrainType 地形类型
     * @return 六角格列表
     */
    public List<HexGrid> getHexGridsByTerrainType(String terrainType) {
        return hexGridRepository.findByTerrainType(terrainType);
    }
    
    /**
     * 查询关键点六角格
     * @return 六角格列表
     */
    public List<HexGrid> getObjectivePoints() {
        return hexGridRepository.findObjectivePoints();
    }
    
    /**
     * 创建六角格
     * @param hexGrid 六角格对象
     * @return 是否成功
     */
    @Transactional
    public boolean createHexGrid(HexGrid hexGrid) {
        return hexGridRepository.insert(hexGrid) > 0;
    }
    
    /**
     * 更新六角格
     * @param hexGrid 六角格对象
     * @return 是否成功
     */
    @Transactional
    public boolean updateHexGrid(HexGrid hexGrid) {
        return hexGridRepository.update(hexGrid) > 0;
    }
    
    /**
     * 更新六角格控制方
     * @param hexId 六角格ID
     * @param faction 控制方
     * @return 是否成功
     */
    @Transactional
    public boolean updateHexGridControlFaction(String hexId, String faction) {
        return hexGridRepository.updateControlFaction(hexId, faction) > 0;
    }
    
    /**
     * 更新六角格可见性
     * @param hexId 六角格ID
     * @param visibleTo 可见性状态
     * @return 是否成功
     */
    @Transactional
    public boolean updateHexGridVisibility(String hexId, Map<String, Boolean> visibleTo) {
        // 将Map转换为JSON字符串
        String visibleToJson = convertMapToJson(visibleTo);
        return hexGridRepository.updateVisibility(hexId, visibleToJson) > 0;
    }
    
    /**
     * 删除六角格
     * @param hexId 六角格ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteHexGrid(String hexId) {
        return hexGridRepository.delete(hexId) > 0;
    }
    
    /**
     * 批量创建六角格
     * @param hexGridList 六角格列表
     * @return 是否成功
     */
    @Transactional
    public boolean batchCreateHexGrids(List<HexGrid> hexGridList) {
        return hexGridRepository.batchInsert(hexGridList) > 0;
    }
    
    /**
     * 计算两个六角格之间的距离
     * @param hexId1 六角格1的ID
     * @param hexId2 六角格2的ID
     * @return 距离
     */
    public int calculateDistance(String hexId1, String hexId2) {
        HexGrid hex1 = hexGridRepository.findById(hexId1);
        HexGrid hex2 = hexGridRepository.findById(hexId2);
        
        if (hex1 == null || hex2 == null) {
            return -1;
        }
        
        // 使用六角格坐标系计算距离
        int q1 = hex1.getCol();
        int r1 = hex1.getRow();
        int q2 = hex2.getCol();
        int r2 = hex2.getRow();
        
        // 计算立方体坐标
        int x1 = q1;
        int z1 = r1;
        int y1 = -x1 - z1;
        
        int x2 = q2;
        int z2 = r2;
        int y2 = -x2 - z2;
        
        // 计算立方体距离
        return (Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2)) / 2;
    }
    
    /**
     * 获取六角格的邻居
     * @param hexId 六角格ID
     * @return 邻居六角格列表
     */
    public List<HexGrid> getNeighbors(String hexId) {
        HexGrid hex = hexGridRepository.findById(hexId);
        
        if (hex == null) {
            return null;
        }
        
        int row = hex.getRow();
        int col = hex.getCol();
        
        // 六角格的六个方向偏移量
        int[][] directions = {
            {-1, 0}, {-1, 1}, {0, 1},
            {1, 0}, {1, -1}, {0, -1}
        };
        
        // 查询所有可能的邻居
        return hexGridRepository.findByRowColRange(
                row - 1, row + 1,
                col - 1, col + 1
        );
    }
    
    /**
     * 将Map转换为JSON字符串
     * @param map Map对象
     * @return JSON字符串
     */
    private String convertMapToJson(Map<String, Boolean> map) {
        // 简化实现，实际项目中应使用JSON库
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        
        for (Map.Entry<String, Boolean> entry : map.entrySet()) {
            if (!first) {
                json.append(",");
            }
            json.append("\"").append(entry.getKey()).append("\":")
                .append(entry.getValue());
            first = false;
        }
        
        json.append("}");
        return json.toString();
    }
}
