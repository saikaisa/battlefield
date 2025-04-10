package com.military.simulation.service;

import com.military.simulation.model.BattleLog;
import com.military.simulation.model.Force;
import com.military.simulation.model.BattleGroup;
import com.military.simulation.repository.BattleLogRepository;
import com.military.simulation.repository.ForceRepository;
import com.military.simulation.repository.BattleGroupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * 战斗裁决服务实现类
 */
@Service
public class BattleService {
    
    @Autowired
    private BattleLogRepository battleLogRepository;
    
    @Autowired
    private ForceRepository forceRepository;
    
    @Autowired
    private BattleGroupRepository battleGroupRepository;
    
    @Autowired
    private BattleGroupService battleGroupService;
    
    @Autowired
    private ForceService forceService;
    
    @Autowired
    private UnitTypeService unitTypeService;
    
    @Autowired
    private HexGridService hexGridService;
    
    /**
     * 执行战斗
     * @param attackerForceId 攻击方部队ID
     * @param targetHexId 目标六角格ID
     * @return 战斗结果
     */
    @Transactional
    public Map<String, Object> executeBattle(Long attackerForceId, String targetHexId) {
        // 获取攻击方部队
        Force attackerForce = forceRepository.findById(attackerForceId);
        if (attackerForce == null) {
            return createErrorResult("攻击方部队不存在");
        }
        
        // 检查攻击方部队是否有剩余战斗次数
        if (attackerForce.getRemainingCombatTimes() <= 0) {
            return createErrorResult("攻击方部队没有剩余战斗次数");
        }
        
        // 获取目标六角格上的部队
        List<Force> targetForces = forceRepository.findByHexId(targetHexId);
        if (targetForces.isEmpty()) {
            return createErrorResult("目标六角格上没有部队");
        }
        
        // 检查目标部队是否是敌方
        Force targetForce = targetForces.get(0);
        if (targetForce.getFaction().equals(attackerForce.getFaction())) {
            return createErrorResult("不能攻击己方部队");
        }
        
        // 计算战斗结果
        Map<String, Object> battleResult = calculateBattleResult(attackerForce, targetForces);
        
        // 更新部队状态
        updateForcesAfterBattle(attackerForce, targetForces, battleResult);
        
        // 记录战斗日志
        recordBattleLog(attackerForce, targetForces, targetHexId, battleResult);
        
        return battleResult;
    }
    
    /**
     * 执行战斗群战斗
     * @param attackerBattlegroupId 攻击方战斗群ID
     * @param targetHexId 目标六角格ID
     * @return 战斗结果
     */
    @Transactional
    public Map<String, Object> executeBattleGroupBattle(String attackerBattlegroupId, String targetHexId) {
        // 获取攻击方战斗群
        BattleGroup attackerBattleGroup = battleGroupRepository.findById(attackerBattlegroupId);
        if (attackerBattleGroup == null) {
            return createErrorResult("攻击方战斗群不存在");
        }
        
        // 获取攻击方战斗群成员
        List<Force> attackerForces = battleGroupService.getBattleGroupMembers(attackerBattlegroupId);
        if (attackerForces.isEmpty()) {
            return createErrorResult("攻击方战斗群没有成员");
        }
        
        // 检查攻击方战斗群是否有剩余战斗次数
        boolean hasRemainingCombatTimes = false;
        for (Force force : attackerForces) {
            if (force.getRemainingCombatTimes() > 0) {
                hasRemainingCombatTimes = true;
                break;
            }
        }
        
        if (!hasRemainingCombatTimes) {
            return createErrorResult("攻击方战斗群没有剩余战斗次数");
        }
        
        // 获取目标六角格上的部队
        List<Force> targetForces = forceRepository.findByHexId(targetHexId);
        if (targetForces.isEmpty()) {
            return createErrorResult("目标六角格上没有部队");
        }
        
        // 检查目标部队是否是敌方
        Force targetForce = targetForces.get(0);
        if (targetForce.getFaction().equals(attackerBattleGroup.getFaction())) {
            return createErrorResult("不能攻击己方部队");
        }
        
        // 计算战斗结果
        Map<String, Object> battleResult = calculateBattleGroupResult(attackerBattleGroup, attackerForces, targetForces);
        
        // 更新部队状态
        updateForcesAfterBattleGroup(attackerForces, targetForces, battleResult);
        
        // 记录战斗日志
        recordBattleGroupLog(attackerBattleGroup, targetForces, targetHexId, battleResult);
        
        return battleResult;
    }
    
    /**
     * 预测战斗结果
     * @param attackerForceId 攻击方部队ID
     * @param targetHexId 目标六角格ID
     * @return 预测结果
     */
    public Map<String, Object> predictBattleResult(Long attackerForceId, String targetHexId) {
        // 获取攻击方部队
        Force attackerForce = forceRepository.findById(attackerForceId);
        if (attackerForce == null) {
            return createErrorResult("攻击方部队不存在");
        }
        
        // 获取目标六角格上的部队
        List<Force> targetForces = forceRepository.findByHexId(targetHexId);
        if (targetForces.isEmpty()) {
            return createErrorResult("目标六角格上没有部队");
        }
        
        // 检查目标部队是否是敌方
        Force targetForce = targetForces.get(0);
        if (targetForce.getFaction().equals(attackerForce.getFaction())) {
            return createErrorResult("不能攻击己方部队");
        }
        
        // 计算预测结果
        return predictBattleOutcome(attackerForce, targetForces);
    }
    
    /**
     * 预测战斗群战斗结果
     * @param attackerBattlegroupId 攻击方战斗群ID
     * @param targetHexId 目标六角格ID
     * @return 预测结果
     */
    public Map<String, Object> predictBattleGroupResult(String attackerBattlegroupId, String targetHexId) {
        // 获取攻击方战斗群
        BattleGroup attackerBattleGroup = battleGroupRepository.findById(attackerBattlegroupId);
        if (attackerBattleGroup == null) {
            return createErrorResult("攻击方战斗群不存在");
        }
        
        // 获取攻击方战斗群成员
        List<Force> attackerForces = battleGroupService.getBattleGroupMembers(attackerBattlegroupId);
        if (attackerForces.isEmpty()) {
            return createErrorResult("攻击方战斗群没有成员");
        }
        
        // 获取目标六角格上的部队
        List<Force> targetForces = forceRepository.findByHexId(targetHexId);
        if (targetForces.isEmpty()) {
            return createErrorResult("目标六角格上没有部队");
        }
        
        // 检查目标部队是否是敌方
        Force targetForce = targetForces.get(0);
        if (targetForce.getFaction().equals(attackerBattleGroup.getFaction())) {
            return createErrorResult("不能攻击己方部队");
        }
        
        // 计算预测结果
        return predictBattleGroupOutcome(attackerBattleGroup, attackerForces, targetForces);
    }
    
    /**
     * 获取战斗记录
     * @param battleId 战斗ID
     * @return 战斗记录
     */
    public BattleLog getBattleLog(Long battleId) {
        return battleLogRepository.findById(battleId);
    }
    
    /**
     * 获取所有战斗记录
     * @return 战斗记录列表
     */
    public List<BattleLog> getAllBattleLogs() {
        return battleLogRepository.findAll();
    }
    
    /**
     * 分页获取战斗记录
     * @param page 页码
     * @param size 每页大小
     * @return 战斗记录列表
     */
    public List<BattleLog> getBattleLogsByPage(int page, int size) {
        int offset = (page - 1) * size;
        return battleLogRepository.findByPage(offset, size);
    }
    
    /**
     * 计算战斗结果
     * @param attackerForce 攻击方部队
     * @param targetForces 目标部队列表
     * @return 战斗结果
     */
    private Map<String, Object> calculateBattleResult(Force attackerForce, List<Force> targetForces) {
        Map<String, Object> result = new HashMap<>();
        
        // 获取攻击方战斗力
        Map<String, Object> attackerCombatPower = forceService.calculateForceCombatPower(attackerForce.getForceId());
        double attackerPower = (double) attackerCombatPower.get("finalCombatPower");
        
        // 获取防御方战斗力
        double defenderPower = 0.0;
        for (Force targetForce : targetForces) {
            Map<String, Object> defenderCombatPower = forceService.calculateForceCombatPower(targetForce.getForceId());
            defenderPower += (double) defenderCombatPower.get("finalCombatPower");
        }
        
        // 计算战斗力比
        double powerRatio = attackerPower / defenderPower;
        
        // 计算地形修正
        double terrainModifier = calculateTerrainModifier(targetForces.get(0).getHexId());
        
        // 计算最终战斗力比
        double finalPowerRatio = powerRatio * terrainModifier;
        
        // 计算战斗结果
        String battleOutcome;
        double attackerLossRate;
        double defenderLossRate;
        
        if (finalPowerRatio >= 3.0) {
            // 攻击方压倒性优势
            battleOutcome = "decisive_victory";
            attackerLossRate = 0.05;
            defenderLossRate = 0.5;
        } else if (finalPowerRatio >= 2.0) {
            // 攻击方明显优势
            battleOutcome = "major_victory";
            attackerLossRate = 0.1;
            defenderLossRate = 0.4;
        } else if (finalPowerRatio >= 1.5) {
            // 攻击方轻微优势
            battleOutcome = "minor_victory";
            attackerLossRate = 0.15;
            defenderLossRate = 0.3;
        } else if (finalPowerRatio >= 0.67) {
            // 势均力敌
            battleOutcome = "draw";
            attackerLossRate = 0.2;
            defenderLossRate = 0.2;
        } else if (finalPowerRatio >= 0.5) {
            // 防御方轻微优势
            battleOutcome = "minor_defeat";
            attackerLossRate = 0.3;
            defenderLossRate = 0.15;
        } else if (finalPowerRatio >= 0.33) {
            // 防御方明显优势
            battleOutcome = "major_defeat";
            attackerLossRate = 0.4;
            defenderLossRate = 0.1;
        } else {
            // 防御方压倒性优势
            battleOutcome = "decisive_defeat";
            attackerLossRate = 0.5;
            defenderLossRate = 0.05;
        }
        
        // 添加随机因素
        Random random = new Random();
        attackerLossRate += (random.nextDouble() - 0.5) * 0.1;
        defenderLossRate += (random.nextDouble() - 0.5) * 0.1;
        
        // 确保损失率在合理范围内
        attackerLossRate = Math.max(0.01, Math.min(0.9, attackerLossRate));
        defenderLossRate = Math.max(0.01, Math.min(0.9, defenderLossRate));
        
        // 计算具体损失
        BigDecimal attackerLoss = attackerForce.getTroopStrength().multiply(BigDecimal.valueOf(attackerLossRate));
        
        // 构建结果
        result.put("success", true);
        result.put("battle_outcome", battleOutcome);
        result.put("attacker_force_id", attackerForce.getForceId());
        result.put("defender_forces", targetForces.stream().map(Force::getForceId).toArray());
        result.put("power_ratio", finalPowerRatio);
        result.put("attacker_loss", attackerLoss);
        result.put("attacker_loss_rate", attackerLossRate);
        result.put("defender_loss_rate", defenderLossRate);
        
        return result;
    }
    
    /**
     * 计算战斗群战斗结果
     * @param attackerBattleGroup 攻击方战斗群
     * @param attackerForces 攻击方部队列表
     * @param targetForces 目标部队列表
     * @return 战斗结果
     */
    private Map<String, Object> calculateBattleGroupResult(BattleGroup attackerBattleGroup, List<Force> attackerForces, List<Force> targetForces) {
        Map<String, Object> result = new HashMap<>();
        
        // 获取攻击方战斗力
        double attackerPower = 0.0;
        for (Force force : attackerForces) {
            if (force.getRemainingCombatTimes() > 0) {
                Map<String, Object> forceCombatPower = forceService.calculateForceCombatPower(force.getForceId());
                attackerPower += (double) forceCombatPower.get("finalCombatPower");
            }
        }
        
        // 获取防御方战斗力
        double defenderPower = 0.0;
        for (Force targetForce : targetForces) {
            Map<String, Object> defenderCombatPower = forceService.calculateForceCombatPower(targetForce.getForceId());
            defenderPower += (double) defenderCombatPower.get("finalCombatPower");
        }
        
        // 计算战斗力比
        double powerRatio = attackerPower / defenderPower;
        
        // 计算地形修正
        double terrainModifier = calculateTerrainModifier(targetForces.get(0).getHexId());
        
        // 计算指挥修正
        double commandModifier = calculateCommandModifier(attackerBattleGroup.getCommandForceId());
        
        // 计算最终战斗力比
        double finalPowerRatio = powerRatio * terrainModifier * commandModifier;
        
        // 计算战斗结果
        String battleOutcome;
        double attackerLossRate;
        double defenderLossRate;
        
        if (finalPowerRatio >= 3.0) {
            // 攻击方压倒性优势
            battleOutcome = "decisive_victory";
            attackerLossRate = 0.05;
            defenderLossRate = 0.5;
        } else if (finalPowerRatio >= 2.0) {
            // 攻击方明显优势
            battleOutcome = "major_victory";
            attackerLossRate = 0.1;
            defenderLossRate = 0.4;
        } else if (finalPowerRatio >= 1.5) {
            // 攻击方轻微优势
            battleOutcome = "minor_victory";
            attackerLossRate = 0.15;
            defenderLossRate = 0.3;
        } else if (finalPowerRatio >= 0.67) {
            // 势均力敌
            battleOutcome = "draw";
            attackerLossRate = 0.2;
            defenderLossRate = 0.2;
        } else if (finalPowerRatio >= 0.5) {
            // 防御方轻微优势
            battleOutcome = "minor_defeat";
            attackerLossRate = 0.3;
            defenderLossRate = 0.15;
        } else if (finalPowerRatio >= 0.33) {
            // 防御方明显优势
            battleOutcome = "major_defeat";
            attackerLossRate = 0.4;
            defenderLossRate = 0.1;
        } else {
            // 防御方压倒性优势
            battleOutcome = "decisive_defeat";
            attackerLossRate = 0.5;
            defenderLossRate = 0.05;
        }
        
        // 添加随机因素
        Random random = new Random();
        attackerLossRate += (random.nextDouble() - 0.5) * 0.1;
        defenderLossRate += (random.nextDouble() - 0.5) * 0.1;
        
        // 确保损失率在合理范围内
        attackerLossRate = Math.max(0.01, Math.min(0.9, attackerLossRate));
        defenderLossRate = Math.max(0.01, Math.min(0.9, defenderLossRate));
        
        // 构建结果
        result.put("success", true);
        result.put("battle_outcome", battleOutcome);
        result.put("attacker_battlegroup_id", attackerBattleGroup.getBattlegroupId());
        result.put("attacker_forces", attackerForces.stream().map(Force::getForceId).toArray());
        result.put("defender_forces", targetForces.stream().map(Force::getForceId).toArray());
        result.put("power_ratio", finalPowerRatio);
        result.put("attacker_loss_rate", attackerLossRate);
        result.put("defender_loss_rate", defenderLossRate);
        
        return result;
    }
    
    /**
     * 预测战斗结果
     * @param attackerForce 攻击方部队
     * @param targetForces 目标部队列表
     * @return 预测结果
     */
    private Map<String, Object> predictBattleOutcome(Force attackerForce, List<Force> targetForces) {
        Map<String, Object> result = new HashMap<>();
        
        // 获取攻击方战斗力
        Map<String, Object> attackerCombatPower = forceService.calculateForceCombatPower(attackerForce.getForceId());
        double attackerPower = (double) attackerCombatPower.get("finalCombatPower");
        
        // 获取防御方战斗力
        double defenderPower = 0.0;
        for (Force targetForce : targetForces) {
            Map<String, Object> defenderCombatPower = forceService.calculateForceCombatPower(targetForce.getForceId());
            defenderPower += (double) defenderCombatPower.get("finalCombatPower");
        }
        
        // 计算战斗力比
        double powerRatio = attackerPower / defenderPower;
        
        // 计算地形修正
        double terrainModifier = calculateTerrainModifier(targetForces.get(0).getHexId());
        
        // 计算最终战斗力比
        double fina
(Content truncated due to size limit. Use line ranges to read in chunks)