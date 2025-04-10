package com.military.simulation.repository;

import com.military.simulation.model.BattleLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

/**
 * 战斗记录数据访问接口
 */
@Mapper
public interface BattleLogRepository {
    
    /**
     * 根据ID查询战斗记录
     * @param battleId 战斗ID
     * @return 战斗记录对象
     */
    BattleLog findById(@Param("battleId") Long battleId);
    
    /**
     * 查询所有战斗记录
     * @return 战斗记录列表
     */
    List<BattleLog> findAll();
    
    /**
     * 分页查询战斗记录
     * @param offset 偏移量
     * @param limit 限制数
     * @return 战斗记录列表
     */
    List<BattleLog> findByPage(@Param("offset") int offset, @Param("limit") int limit);
    
    /**
     * 根据攻击方战斗群ID查询战斗记录
     * @param attackerBattlegroupId 攻击方战斗群ID
     * @return 战斗记录列表
     */
    List<BattleLog> findByAttackerBattlegroupId(@Param("attackerBattlegroupId") String attackerBattlegroupId);
    
    /**
     * 根据防御方战斗群ID查询战斗记录
     * @param defenderBattlegroupId 防御方战斗群ID
     * @return 战斗记录列表
     */
    List<BattleLog> findByDefenderBattlegroupId(@Param("defenderBattlegroupId") String defenderBattlegroupId);
    
    /**
     * 根据目标六角格ID查询战斗记录
     * @param targetHexId 目标六角格ID
     * @return 战斗记录列表
     */
    List<BattleLog> findByTargetHexId(@Param("targetHexId") String targetHexId);
    
    /**
     * 根据时间范围查询战斗记录
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 战斗记录列表
     */
    List<BattleLog> findByTimeRange(
            @Param("startTime") Date startTime, 
            @Param("endTime") Date endTime);
    
    /**
     * 插入战斗记录
     * @param battleLog 战斗记录对象
     * @return 影响行数
     */
    int insert(BattleLog battleLog);
    
    /**
     * 删除战斗记录
     * @param battleId 战斗ID
     * @return 影响行数
     */
    int delete(@Param("battleId") Long battleId);
    
    /**
     * 批量插入战斗记录
     * @param battleLogList 战斗记录列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<BattleLog> battleLogList);
}
