package com.military.simulation.model;

import lombok.Data;

import java.util.Date;
import java.util.Map;

/**
 * 移动记录实体类
 * 对应数据库中的movement_log表
 */
@Data
public class MovementLog {
    /**
     * 移动ID
     */
    private Long movementId;
    
    /**
     * 部队ID
     */
    private Long forceId;
    
    /**
     * 移动路径，JSON格式
     */
    private String[] path;
    
    /**
     * 行动力消耗
     */
    private Integer actionPointsCost;
    
    /**
     * 原始路径，JSON格式
     */
    private String[] originalPath;
    
    /**
     * 是否被截断
     */
    private Boolean truncated;
    
    /**
     * 截断原因
     */
    private String truncateReason;
    
    /**
     * 移动时间
     */
    private Date movementTime;
}
