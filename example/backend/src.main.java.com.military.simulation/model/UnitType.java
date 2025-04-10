package com.military.simulation.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

/**
 * 兵种实体类
 * 对应数据库中的unit_type表
 */
@Data
public class UnitType {
    /**
     * 兵种ID
     */
    private String unitTypeId;
    
    /**
     * 兵种名称
     */
    private String unitName;
    
    /**
     * 兵种军种，JSON格式
     */
    private String[] service;
    
    /**
     * 兵种类别
     */
    private String category;
    
    /**
     * 可用阵营，JSON格式
     */
    private String[] unitAvailability;
    
    /**
     * 战斗属性，JSON格式
     */
    private Map<String, Object> combatAttributes;
    
    /**
     * 生存属性，JSON格式
     */
    private Map<String, Object> survivalAttributes;
    
    /**
     * 指挥属性，JSON格式
     */
    private Map<String, Object> commandAttributes;
    
    /**
     * 渲染属性，JSON格式
     */
    private Map<String, Object> renderingAttributes;
    
    /**
     * 创建时间
     */
    private Date createdAt;
    
    /**
     * 更新时间
     */
    private Date updatedAt;
}
