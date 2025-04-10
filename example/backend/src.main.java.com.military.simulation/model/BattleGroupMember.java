package com.military.simulation.model;

import lombok.Data;

import java.util.Date;

/**
 * 战斗群成员实体类
 * 对应数据库中的battle_group_member表
 */
@Data
public class BattleGroupMember {
    /**
     * 主键ID
     */
    private Long id;
    
    /**
     * 战斗群ID
     */
    private String battlegroupId;
    
    /**
     * 部队ID
     */
    private Long forceId;
    
    /**
     * 创建时间
     */
    private Date createdAt;
}
