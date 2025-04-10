package com.military.simulation.repository;

import com.military.simulation.model.CommandLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

/**
 * 指令日志数据访问接口
 */
@Mapper
public interface CommandLogRepository {
    
    /**
     * 根据ID查询指令日志
     * @param commandId 指令ID
     * @return 指令日志对象
     */
    CommandLog findById(@Param("commandId") Long commandId);
    
    /**
     * 查询所有指令日志
     * @return 指令日志列表
     */
    List<CommandLog> findAll();
    
    /**
     * 分页查询指令日志
     * @param offset 偏移量
     * @param limit 限制数
     * @return 指令日志列表
     */
    List<CommandLog> findByPage(@Param("offset") int offset, @Param("limit") int limit);
    
    /**
     * 根据指令类型查询指令日志
     * @param commandType 指令类型
     * @return 指令日志列表
     */
    List<CommandLog> findByCommandType(@Param("commandType") String commandType);
    
    /**
     * 根据指令来源查询指令日志
     * @param source 指令来源
     * @return 指令日志列表
     */
    List<CommandLog> findBySource(@Param("source") String source);
    
    /**
     * 根据执行状态查询指令日志
     * @param status 执行状态
     * @return 指令日志列表
     */
    List<CommandLog> findByStatus(@Param("status") String status);
    
    /**
     * 根据时间范围查询指令日志
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 指令日志列表
     */
    List<CommandLog> findByTimeRange(
            @Param("startTime") Date startTime, 
            @Param("endTime") Date endTime);
    
    /**
     * 插入指令日志
     * @param commandLog 指令日志对象
     * @return 影响行数
     */
    int insert(CommandLog commandLog);
    
    /**
     * 更新指令日志状态
     * @param commandId 指令ID
     * @param status 执行状态
     * @param result 执行结果
     * @param errorMessage 错误信息
     * @return 影响行数
     */
    int updateStatus(
            @Param("commandId") Long commandId, 
            @Param("status") String status, 
            @Param("result") String result, 
            @Param("errorMessage") String errorMessage);
    
    /**
     * 删除指令日志
     * @param commandId 指令ID
     * @return 影响行数
     */
    int delete(@Param("commandId") Long commandId);
    
    /**
     * 批量插入指令日志
     * @param commandLogList 指令日志列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<CommandLog> commandLogList);
}
