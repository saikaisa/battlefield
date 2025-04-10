package com.military.simulation.model;

import lombok.Data;

/**
 * 系统配置实体类
 * 对应数据库中的system_config表
 */
@Data
public class SystemConfig {
    /**
     * 配置键
     */
    private String configKey;
    
    /**
     * 配置值
     */
    private String configValue;
    
    /**
     * 配置描述
     */
    private String configDesc;
    
    /**
     * 创建时间
     */
    private java.util.Date createdAt;
    
    /**
     * 更新时间
     */
    private java.util.Date updatedAt;
}
