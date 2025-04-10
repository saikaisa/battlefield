package com.military.simulation.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

/**
 * 部队实体类
 * 对应数据库中的force表
 */
@Data
public class Force {
    /**
     * 部队ID
     */
    private Long forceId;
    
    /**
     * 部队名称
     */
    private String forceName;
    
    /**
     * 隶属阵营
     */
    private String faction;
    
    /**
     * 军种类型
     */
    private String service;
    
    /**
     * 当前位置
     */
    private String hexId;
    
    /**
     * 兵力值
     */
    private BigDecimal troopStrength;
    
    /**
     * 士气值
     */
    private BigDecimal morale;
    
    /**
     * 进攻火力值，JSON格式
     */
    private Map<String, Object> attackFirepower;
    
    /**
     * 防御火力值，JSON格式
     */
    private Map<String, Object> defenseFirepower;
    
    /**
     * 剩余战斗次数
     */
    private Integer remainingCombatTimes;
    
    /**
     * 疲劳系数
     */
    private BigDecimal fatigueFactor;
    
    /**
     * 可视范围
     */
    private Integer visibilityRadius;
    
    /**
     * 行动力
     */
    private Integer actionPoints;
    
    /**
     * 兵力值恢复速率
     */
    private BigDecimal recoveryRate;
    
    /**
     * 指挥能力
     */
    private BigDecimal commandCapability;
    
    /**
     * 指挥范围
     */
    private Integer commandRange;
    
    /**
     * 创建时间
     */
    private Date createdAt;
    
    /**
     * 更新时间
     */
    private Date updatedAt;
}
