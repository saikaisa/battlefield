package com.military.simulation.repository;

import com.military.simulation.model.HexGrid;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 六角格数据访问接口
 */
@Mapper
public interface HexGridRepository {
    
    /**
     * 根据ID查询六角格
     * @param hexId 六角格ID
     * @return 六角格对象
     */
    HexGrid findById(@Param("hexId") String hexId);
    
    /**
     * 查询所有六角格
     * @return 六角格列表
     */
    List<HexGrid> findAll();
    
    /**
     * 根据行列范围查询六角格
     * @param minRow 最小行
     * @param maxRow 最大行
     * @param minCol 最小列
     * @param maxCol 最大列
     * @return 六角格列表
     */
    List<HexGrid> findByRowColRange(
            @Param("minRow") int minRow, 
            @Param("maxRow") int maxRow, 
            @Param("minCol") int minCol, 
            @Param("maxCol") int maxCol);
    
    /**
     * 根据控制方查询六角格
     * @param faction 控制方
     * @return 六角格列表
     */
    List<HexGrid> findByControlFaction(@Param("faction") String faction);
    
    /**
     * 根据地形类型查询六角格
     * @param terrainType 地形类型
     * @return 六角格列表
     */
    List<HexGrid> findByTerrainType(@Param("terrainType") String terrainType);
    
    /**
     * 查询关键点六角格
     * @return 六角格列表
     */
    List<HexGrid> findObjectivePoints();
    
    /**
     * 插入六角格
     * @param hexGrid 六角格对象
     * @return 影响行数
     */
    int insert(HexGrid hexGrid);
    
    /**
     * 更新六角格
     * @param hexGrid 六角格对象
     * @return 影响行数
     */
    int update(HexGrid hexGrid);
    
    /**
     * 更新六角格控制方
     * @param hexId 六角格ID
     * @param faction 控制方
     * @return 影响行数
     */
    int updateControlFaction(@Param("hexId") String hexId, @Param("faction") String faction);
    
    /**
     * 更新六角格可见性
     * @param hexId 六角格ID
     * @param visibleTo 可见性状态
     * @return 影响行数
     */
    int updateVisibility(@Param("hexId") String hexId, @Param("visibleTo") String visibleTo);
    
    /**
     * 删除六角格
     * @param hexId 六角格ID
     * @return 影响行数
     */
    int delete(@Param("hexId") String hexId);
    
    /**
     * 批量插入六角格
     * @param hexGridList 六角格列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<HexGrid> hexGridList);
}
