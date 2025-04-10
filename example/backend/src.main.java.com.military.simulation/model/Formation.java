package com.military.simulation.model;

import lombok.Data;

import java.util.Date;

/**
 * 编队实体类
 * 对应数据库中的formation表
 */
@Data
public class Formation {
    /**
     * 编队ID
     */
    private String formationId;
    
    /**
     * 编队名称
     */
    private String formationName;
    
    /**
     * 隶属阵营
     */
    private String faction;
    
    /**
     * 创建时间
     */
    private Date createdAt;
    
    /**
     * 更新时间
     */
    private Date updatedAt;
}
