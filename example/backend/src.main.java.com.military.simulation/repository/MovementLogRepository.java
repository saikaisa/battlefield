package com.military.simulation.repository;

import com.military.simulation.model.MovementLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

/**
 * 移动记录数据访问接口
 */
@Mapper
public interface MovementLogRepository {
    
    /**
     * 根据ID查询移动记录
     * @param movementId 移动ID
     * @return 移动记录对象
     */
    MovementLog findById(@Param("movementId") Long movementId);
    
    /**
     * 查询所有移动记录
     * @return 移动记录列表
     */
    List<MovementLog> findAll();
    
    /**
     * 分页查询移动记录
     * @param offset 偏移量
     * @param limit 限制数
     * @return 移动记录列表
     */
    List<MovementLog> findByPage(@Param("offset") int offset, @Param("limit") int limit);
    
    /**
     * 根据部队ID查询移动记录
     * @param forceId 部队ID
     * @return 移动记录列表
     */
    List<MovementLog> findByForceId(@Param("forceId") Long forceId);
    
    /**
     * 根据时间范围查询移动记录
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 移动记录列表
     */
    List<MovementLog> findByTimeRange(
            @Param("startTime") Date startTime, 
            @Param("endTime") Date endTime);
    
    /**
     * 插入移动记录
     * @param movementLog 移动记录对象
     * @return 影响行数
     */
    int insert(MovementLog movementLog);
    
    /**
     * 删除移动记录
     * @param movementId 移动ID
     * @return 影响行数
     */
    int delete(@Param("movementId") Long movementId);
    
    /**
     * 批量插入移动记录
     * @param movementLogList 移动记录列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<MovementLog> movementLogList);
}
