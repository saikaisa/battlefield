package com.military.simulation.model;

import lombok.Data;

import java.util.Date;

/**
 * 部队组成实体类
 * 对应数据库中的force_composition表
 */
@Data
public class ForceComposition {
    /**
     * 主键ID
     */
    private Long id;
    
    /**
     * 部队ID
     */
    private Long forceId;
    
    /**
     * 兵种ID
     */
    private String unitTypeId;
    
    /**
     * 兵种基数
     */
    private Integer unitCount;
    
    /**
     * 创建时间
     */
    private Date createdAt;
    
    /**
     * 更新时间
     */
    private Date updatedAt;
}
