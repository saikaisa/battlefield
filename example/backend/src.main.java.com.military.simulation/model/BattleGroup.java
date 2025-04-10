package com.military.simulation.model;

import lombok.Data;

import java.util.Date;
import java.util.Map;

/**
 * 战斗群实体类
 * 对应数据库中的battle_group表
 */
@Data
public class BattleGroup {
    /**
     * 战斗群ID
     */
    private String battlegroupId;
    
    /**
     * 隶属阵营
     */
    private String faction;
    
    /**
     * 指挥主体部队ID
     */
    private Long commandForceId;
    
    /**
     * 联合攻击火力值，JSON格式
     */
    private Map<String, Object> jointAttackFirepower;
    
    /**
     * 联合防御火力值，JSON格式
     */
    private Map<String, Object> jointDefenseFirepower;
    
    /**
     * 创建时间
     */
    private Date createdAt;
}
