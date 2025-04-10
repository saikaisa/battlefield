package com.military.simulation.repository;

import com.military.simulation.model.ForceComposition;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 部队组成数据访问接口
 */
@Mapper
public interface ForceCompositionRepository {
    
    /**
     * 根据ID查询部队组成
     * @param id 主键ID
     * @return 部队组成对象
     */
    ForceComposition findById(@Param("id") Long id);
    
    /**
     * 根据部队ID查询部队组成
     * @param forceId 部队ID
     * @return 部队组成列表
     */
    List<ForceComposition> findByForceId(@Param("forceId") Long forceId);
    
    /**
     * 根据兵种ID查询部队组成
     * @param unitTypeId 兵种ID
     * @return 部队组成列表
     */
    List<ForceComposition> findByUnitTypeId(@Param("unitTypeId") String unitTypeId);
    
    /**
     * 根据部队ID和兵种ID查询部队组成
     * @param forceId 部队ID
     * @param unitTypeId 兵种ID
     * @return 部队组成对象
     */
    ForceComposition findByForceIdAndUnitTypeId(
            @Param("forceId") Long forceId, 
            @Param("unitTypeId") String unitTypeId);
    
    /**
     * 插入部队组成
     * @param forceComposition 部队组成对象
     * @return 影响行数
     */
    int insert(ForceComposition forceComposition);
    
    /**
     * 更新部队组成
     * @param forceComposition 部队组成对象
     * @return 影响行数
     */
    int update(ForceComposition forceComposition);
    
    /**
     * 更新兵种基数
     * @param id 主键ID
     * @param unitCount 兵种基数
     * @return 影响行数
     */
    int updateUnitCount(@Param("id") Long id, @Param("unitCount") Integer unitCount);
    
    /**
     * 删除部队组成
     * @param id 主键ID
     * @return 影响行数
     */
    int delete(@Param("id") Long id);
    
    /**
     * 根据部队ID删除部队组成
     * @param forceId 部队ID
     * @return 影响行数
     */
    int deleteByForceId(@Param("forceId") Long forceId);
    
    /**
     * 批量插入部队组成
     * @param forceCompositionList 部队组成列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<ForceComposition> forceCompositionList);
}
