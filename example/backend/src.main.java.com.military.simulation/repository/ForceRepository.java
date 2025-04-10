package com.military.simulation.repository;

import com.military.simulation.model.Force;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 部队数据访问接口
 */
@Mapper
public interface ForceRepository {
    
    /**
     * 根据ID查询部队
     * @param forceId 部队ID
     * @return 部队对象
     */
    Force findById(@Param("forceId") Long forceId);
    
    /**
     * 查询所有部队
     * @return 部队列表
     */
    List<Force> findAll();
    
    /**
     * 根据阵营查询部队
     * @param faction 阵营
     * @return 部队列表
     */
    List<Force> findByFaction(@Param("faction") String faction);
    
    /**
     * 根据军种查询部队
     * @param service 军种
     * @return 部队列表
     */
    List<Force> findByService(@Param("service") String service);
    
    /**
     * 根据六角格ID查询部队
     * @param hexId 六角格ID
     * @return 部队列表
     */
    List<Force> findByHexId(@Param("hexId") String hexId);
    
    /**
     * 根据名称查询部队
     * @param forceName 部队名称
     * @return 部队列表
     */
    List<Force> findByName(@Param("forceName") String forceName);
    
    /**
     * 插入部队
     * @param force 部队对象
     * @return 影响行数
     */
    int insert(Force force);
    
    /**
     * 更新部队
     * @param force 部队对象
     * @return 影响行数
     */
    int update(Force force);
    
    /**
     * 更新部队位置
     * @param forceId 部队ID
     * @param hexId 六角格ID
     * @return 影响行数
     */
    int updatePosition(@Param("forceId") Long forceId, @Param("hexId") String hexId);
    
    /**
     * 更新部队兵力值
     * @param forceId 部队ID
     * @param troopStrength 兵力值
     * @return 影响行数
     */
    int updateTroopStrength(@Param("forceId") Long forceId, @Param("troopStrength") java.math.BigDecimal troopStrength);
    
    /**
     * 更新部队士气值
     * @param forceId 部队ID
     * @param morale 士气值
     * @return 影响行数
     */
    int updateMorale(@Param("forceId") Long forceId, @Param("morale") java.math.BigDecimal morale);
    
    /**
     * 更新部队行动力
     * @param forceId 部队ID
     * @param actionPoints 行动力
     * @return 影响行数
     */
    int updateActionPoints(@Param("forceId") Long forceId, @Param("actionPoints") Integer actionPoints);
    
    /**
     * 更新部队剩余战斗次数
     * @param forceId 部队ID
     * @param remainingCombatTimes 剩余战斗次数
     * @return 影响行数
     */
    int updateRemainingCombatTimes(@Param("forceId") Long forceId, @Param("remainingCombatTimes") Integer remainingCombatTimes);
    
    /**
     * 删除部队
     * @param forceId 部队ID
     * @return 影响行数
     */
    int delete(@Param("forceId") Long forceId);
    
    /**
     * 批量插入部队
     * @param forceList 部队列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<Force> forceList);
}
