package com.military.simulation.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;

/**
 * 战斗记录实体类
 * 对应数据库中的battle_log表
 */
@Data
public class BattleLog {
    /**
     * 战斗ID
     */
    private Long battleId;
    
    /**
     * 攻击方战斗群ID
     */
    private String attackerBattlegroupId;
    
    /**
     * 防御方战斗群ID
     */
    private String defenderBattlegroupId;
    
    /**
     * 目标六角格ID
     */
    private String targetHexId;
    
    /**
     * 战斗结果
     */
    private String battleResult;
    
    /**
     * 攻击方损失
     */
    private BigDecimal attackerLoss;
    
    /**
     * 防御方损失
     */
    private BigDecimal defenderLoss;
    
    /**
     * 战斗详情，JSON格式
     */
    private Map<String, Object> battleDetails;
    
    /**
     * 战斗时间
     */
    private Date battleTime;
}
