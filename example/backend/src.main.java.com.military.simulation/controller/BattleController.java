package com.military.simulation.controller;

import com.military.simulation.model.BattleLog;
import com.military.simulation.service.BattleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 战斗控制器
 */
@RestController
@RequestMapping("/api/battle")
public class BattleController {
    
    @Autowired
    private BattleService battleService;
    
    /**
     * 执行战斗
     * @param attackerForceId 攻击方部队ID
     * @param targetHexId 目标六角格ID
     * @return 战斗结果
     */
    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> executeBattle(
            @RequestParam Long attackerForceId,
            @RequestParam String targetHexId) {
        Map<String, Object> result = battleService.executeBattle(attackerForceId, targetHexId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 执行战斗群战斗
     * @param attackerBattlegroupId 攻击方战斗群ID
     * @param targetHexId 目标六角格ID
     * @return 战斗结果
     */
    @PostMapping("/execute/group")
    public ResponseEntity<Map<String, Object>> executeBattleGroupBattle(
            @RequestParam String attackerBattlegroupId,
            @RequestParam String targetHexId) {
        Map<String, Object> result = battleService.executeBattleGroupBattle(attackerBattlegroupId, targetHexId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 预测战斗结果
     * @param attackerForceId 攻击方部队ID
     * @param targetHexId 目标六角格ID
     * @return 预测结果
     */
    @GetMapping("/predict")
    public ResponseEntity<Map<String, Object>> predictBattleResult(
            @RequestParam Long attackerForceId,
            @RequestParam String targetHexId) {
        Map<String, Object> result = battleService.predictBattleResult(attackerForceId, targetHexId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 预测战斗群战斗结果
     * @param attackerBattlegroupId 攻击方战斗群ID
     * @param targetHexId 目标六角格ID
     * @return 预测结果
     */
    @GetMapping("/predict/group")
    public ResponseEntity<Map<String, Object>> predictBattleGroupResult(
            @RequestParam String attackerBattlegroupId,
            @RequestParam String targetHexId) {
        Map<String, Object> result = battleService.predictBattleGroupResult(attackerBattlegroupId, targetHexId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 获取战斗记录
     * @param battleId 战斗ID
     * @return 战斗记录
     */
    @GetMapping("/{battleId}")
    public ResponseEntity<BattleLog> getBattleLog(@PathVariable Long battleId) {
        BattleLog battleLog = battleService.getBattleLog(battleId);
        if (battleLog == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(battleLog);
    }
    
    /**
     * 获取所有战斗记录
     * @return 战斗记录列表
     */
    @GetMapping("/logs")
    public ResponseEntity<List<BattleLog>> getAllBattleLogs() {
        List<BattleLog> battleLogs = battleService.getAllBattleLogs();
        return ResponseEntity.ok(battleLogs);
    }
    
    /**
     * 分页获取战斗记录
     * @param page 页码
     * @param size 每页大小
     * @return 战斗记录列表
     */
    @GetMapping("/logs/page")
    public ResponseEntity<List<BattleLog>> getBattleLogsByPage(
            @RequestParam int page,
            @RequestParam int size) {
        List<BattleLog> battleLogs = battleService.getBattleLogsByPage(page, size);
        return ResponseEntity.ok(battleLogs);
    }
}
