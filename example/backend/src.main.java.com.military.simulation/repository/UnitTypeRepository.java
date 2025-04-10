package com.military.simulation.repository;

import com.military.simulation.model.UnitType;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 兵种数据访问接口
 */
@Mapper
public interface UnitTypeRepository {
    
    /**
     * 根据ID查询兵种
     * @param unitTypeId 兵种ID
     * @return 兵种对象
     */
    UnitType findById(@Param("unitTypeId") String unitTypeId);
    
    /**
     * 查询所有兵种
     * @return 兵种列表
     */
    List<UnitType> findAll();
    
    /**
     * 根据类别查询兵种
     * @param category 兵种类别
     * @return 兵种列表
     */
    List<UnitType> findByCategory(@Param("category") String category);
    
    /**
     * 根据军种查询兵种
     * @param service 军种
     * @return 兵种列表
     */
    List<UnitType> findByService(@Param("service") String service);
    
    /**
     * 根据阵营查询可用兵种
     * @param faction 阵营
     * @return 兵种列表
     */
    List<UnitType> findByFaction(@Param("faction") String faction);
    
    /**
     * 根据名称查询兵种
     * @param unitName 兵种名称
     * @return 兵种列表
     */
    List<UnitType> findByName(@Param("unitName") String unitName);
    
    /**
     * 插入兵种
     * @param unitType 兵种对象
     * @return 影响行数
     */
    int insert(UnitType unitType);
    
    /**
     * 更新兵种
     * @param unitType 兵种对象
     * @return 影响行数
     */
    int update(UnitType unitType);
    
    /**
     * 删除兵种
     * @param unitTypeId 兵种ID
     * @return 影响行数
     */
    int delete(@Param("unitTypeId") String unitTypeId);
    
    /**
     * 批量插入兵种
     * @param unitTypeList 兵种列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<UnitType> unitTypeList);
}
