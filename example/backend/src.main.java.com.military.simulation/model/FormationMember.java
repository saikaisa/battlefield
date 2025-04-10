package com.military.simulation.model;

import lombok.Data;

import java.util.Date;

/**
 * 编队成员实体类
 * 对应数据库中的formation_member表
 */
@Data
public class FormationMember {
    /**
     * 主键ID
     */
    private Long id;
    
    /**
     * 编队ID
     */
    private String formationId;
    
    /**
     * 部队ID
     */
    private Long forceId;
    
    /**
     * 创建时间
     */
    private Date createdAt;
}
