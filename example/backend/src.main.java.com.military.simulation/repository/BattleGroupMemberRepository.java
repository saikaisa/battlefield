package com.military.simulation.repository;

import com.military.simulation.model.BattleGroupMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 战斗群成员数据访问接口
 */
@Mapper
public interface BattleGroupMemberRepository {
    
    /**
     * 根据ID查询战斗群成员
     * @param id 主键ID
     * @return 战斗群成员对象
     */
    BattleGroupMember findById(@Param("id") Long id);
    
    /**
     * 根据战斗群ID查询战斗群成员
     * @param battlegroupId 战斗群ID
     * @return 战斗群成员列表
     */
    List<BattleGroupMember> findByBattlegroupId(@Param("battlegroupId") String battlegroupId);
    
    /**
     * 根据部队ID查询战斗群成员
     * @param forceId 部队ID
     * @return 战斗群成员列表
     */
    List<BattleGroupMember> findByForceId(@Param("forceId") Long forceId);
    
    /**
     * 根据战斗群ID和部队ID查询战斗群成员
     * @param battlegroupId 战斗群ID
     * @param forceId 部队ID
     * @return 战斗群成员对象
     */
    BattleGroupMember findByBattlegroupIdAndForceId(
            @Param("battlegroupId") String battlegroupId, 
            @Param("forceId") Long forceId);
    
    /**
     * 插入战斗群成员
     * @param battleGroupMember 战斗群成员对象
     * @return 影响行数
     */
    int insert(BattleGroupMember battleGroupMember);
    
    /**
     * 删除战斗群成员
     * @param id 主键ID
     * @return 影响行数
     */
    int delete(@Param("id") Long id);
    
    /**
     * 根据战斗群ID删除战斗群成员
     * @param battlegroupId 战斗群ID
     * @return 影响行数
     */
    int deleteByBattlegroupId(@Param("battlegroupId") String battlegroupId);
    
    /**
     * 根据部队ID删除战斗群成员
     * @param forceId 部队ID
     * @return 影响行数
     */
    int deleteByForceId(@Param("forceId") Long forceId);
    
    /**
     * 批量插入战斗群成员
     * @param battleGroupMemberList 战斗群成员列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<BattleGroupMember> battleGroupMemberList);
}
