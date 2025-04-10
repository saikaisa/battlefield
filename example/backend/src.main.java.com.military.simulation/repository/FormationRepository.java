package com.military.simulation.repository;

import com.military.simulation.model.Formation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 编队数据访问接口
 */
@Mapper
public interface FormationRepository {
    
    /**
     * 根据ID查询编队
     * @param formationId 编队ID
     * @return 编队对象
     */
    Formation findById(@Param("formationId") String formationId);
    
    /**
     * 查询所有编队
     * @return 编队列表
     */
    List<Formation> findAll();
    
    /**
     * 根据阵营查询编队
     * @param faction 阵营
     * @return 编队列表
     */
    List<Formation> findByFaction(@Param("faction") String faction);
    
    /**
     * 根据名称查询编队
     * @param formationName 编队名称
     * @return 编队列表
     */
    List<Formation> findByName(@Param("formationName") String formationName);
    
    /**
     * 插入编队
     * @param formation 编队对象
     * @return 影响行数
     */
    int insert(Formation formation);
    
    /**
     * 更新编队
     * @param formation 编队对象
     * @return 影响行数
     */
    int update(Formation formation);
    
    /**
     * 删除编队
     * @param formationId 编队ID
     * @return 影响行数
     */
    int delete(@Param("formationId") String formationId);
    
    /**
     * 批量插入编队
     * @param formationList 编队列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<Formation> formationList);
}
