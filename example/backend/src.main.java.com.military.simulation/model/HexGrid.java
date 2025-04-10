package com.military.simulation.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

/**
 * 六角格实体类
 * 对应数据库中的hex_grid表
 */
@Data
public class HexGrid {
    /**
     * 六角格唯一标识
     */
    private String hexId;
    
    /**
     * 经度
     */
    private BigDecimal longitude;
    
    /**
     * 纬度
     */
    private BigDecimal latitude;
    
    /**
     * 高度(米)
     */
    private BigDecimal height;
    
    /**
     * 行号
     */
    private Integer row;
    
    /**
     * 列号
     */
    private Integer col;
    
    /**
     * 主地形类型
     */
    private String terrainType;
    
    /**
     * 地形组合结构，JSON格式
     */
    private Map<String, Double> terrainComposition;
    
    /**
     * 平均高度
     */
    private BigDecimal elevation;
    
    /**
     * 可通行性，JSON格式
     */
    private Map<String, Boolean> passability;
    
    /**
     * 控制方
     */
    private String controlFaction;
    
    /**
     * 可见性状态，JSON格式
     */
    private Map<String, Boolean> visibleTo;
    
    /**
     * 是否为关键点
     */
    private Boolean isObjectivePoint;
    
    /**
     * 资源属性，JSON格式
     */
    private Map<String, Object> resource;
    
    /**
     * 创建时间
     */
    private Date createdAt;
    
    /**
     * 更新时间
     */
    private Date updatedAt;
}
