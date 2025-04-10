package com.military.simulation.repository;

import com.military.simulation.model.BattleGroup;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 战斗群数据访问接口
 */
@Mapper
public interface BattleGroupRepository {
    
    /**
     * 根据ID查询战斗群
     * @param battlegroupId 战斗群ID
     * @return 战斗群对象
     */
    BattleGroup findById(@Param("battlegroupId") String battlegroupId);
    
    /**
     * 查询所有战斗群
     * @return 战斗群列表
     */
    List<BattleGroup> findAll();
    
    /**
     * 根据阵营查询战斗群
     * @param faction 阵营
     * @return 战斗群列表
     */
    List<BattleGroup> findByFaction(@Param("faction") String faction);
    
    /**
     * 根据指挥部队ID查询战斗群
     * @param commandForceId 指挥部队ID
     * @return 战斗群列表
     */
    List<BattleGroup> findByCommandForceId(@Param("commandForceId") Long commandForceId);
    
    /**
     * 插入战斗群
     * @param battleGroup 战斗群对象
     * @return 影响行数
     */
    int insert(BattleGroup battleGroup);
    
    /**
     * 更新战斗群
     * @param battleGroup 战斗群对象
     * @return 影响行数
     */
    int update(BattleGroup battleGroup);
    
    /**
     * 删除战斗群
     * @param battlegroupId 战斗群ID
     * @return 影响行数
     */
    int delete(@Param("battlegroupId") String battlegroupId);
    
    /**
     * 批量插入战斗群
     * @param battleGroupList 战斗群列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<BattleGroup> battleGroupList);
}
