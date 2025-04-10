package com.military.simulation.model;

import lombok.Data;

import java.util.Date;
import java.util.Map;

/**
 * 指令日志实体类
 * 对应数据库中的command_log表
 */
@Data
public class CommandLog {
    /**
     * 指令ID
     */
    private Long commandId;
    
    /**
     * 指令类型
     */
    private String commandType;
    
    /**
     * 指令内容，JSON格式
     */
    private Map<String, Object> commandContent;
    
    /**
     * 指令来源
     */
    private String source;
    
    /**
     * 执行状态
     */
    private String status;
    
    /**
     * 执行结果，JSON格式
     */
    private Map<String, Object> result;
    
    /**
     * 错误信息
     */
    private String errorMessage;
    
    /**
     * 指令时间
     */
    private Date commandTime;
}
