package com.military.simulation.controller;

import com.military.simulation.model.BattleGroup;
import com.military.simulation.model.Force;
import com.military.simulation.service.BattleGroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 战斗群控制器
 */
@RestController
@RequestMapping("/api/battlegroup")
public class BattleGroupController {
    
    @Autowired
    private BattleGroupService battleGroupService;
    
    /**
     * 获取所有战斗群
     * @return 战斗群列表
     */
    @GetMapping
    public ResponseEntity<List<BattleGroup>> getAllBattleGroups() {
        List<BattleGroup> battleGroups = battleGroupService.getAllBattleGroups();
        return ResponseEntity.ok(battleGroups);
    }
    
    /**
     * 根据ID获取战斗群
     * @param battlegroupId 战斗群ID
     * @return 战斗群对象
     */
    @GetMapping("/{battlegroupId}")
    public ResponseEntity<BattleGroup> getBattleGroupById(@PathVariable String battlegroupId) {
        BattleGroup battleGroup = battleGroupService.getBattleGroupById(battlegroupId);
        if (battleGroup == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(battleGroup);
    }
    
    /**
     * 根据阵营获取战斗群
     * @param faction 阵营
     * @return 战斗群列表
     */
    @GetMapping("/faction/{faction}")
    public ResponseEntity<List<BattleGroup>> getBattleGroupsByFaction(@PathVariable String faction) {
        List<BattleGroup> battleGroups = battleGroupService.getBattleGroupsByFaction(faction);
        return ResponseEntity.ok(battleGroups);
    }
    
    /**
     * 根据指挥部队ID获取战斗群
     * @param commandForceId 指挥部队ID
     * @return 战斗群列表
     */
    @GetMapping("/command/{commandForceId}")
    public ResponseEntity<List<BattleGroup>> getBattleGroupsByCommandForceId(@PathVariable Long commandForceId) {
        List<BattleGroup> battleGroups = battleGroupService.getBattleGroupsByCommandForceId(commandForceId);
        return ResponseEntity.ok(battleGroups);
    }
    
    /**
     * 创建战斗群
     * @param faction 阵营
     * @param commandForceId 指挥部队ID
     * @param forceIds 部队ID列表
     * @return 创建结果
     */
    @PostMapping
    public ResponseEntity<String> createBattleGroup(
            @RequestParam String faction,
            @RequestParam Long commandForceId,
            @RequestBody List<Long> forceIds) {
        String battlegroupId = battleGroupService.createBattleGroup(faction, commandForceId, forceIds);
        if (battlegroupId == null) {
            return ResponseEntity.badRequest().body("战斗群创建失败");
        }
        return ResponseEntity.ok("战斗群创建成功，ID: " + battlegroupId);
    }
    
    /**
     * 更新战斗群
     * @param battlegroupId 战斗群ID
     * @param battleGroup 战斗群对象
     * @return 更新结果
     */
    @PutMapping("/{battlegroupId}")
    public ResponseEntity<String> updateBattleGroup(@PathVariable String battlegroupId, @RequestBody BattleGroup battleGroup) {
        battleGroup.setBattlegroupId(battlegroupId);
        boolean success = battleGroupService.updateBattleGroup(battleGroup);
        if (success) {
            return ResponseEntity.ok("战斗群更新成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群更新失败");
        }
    }
    
    /**
     * 删除战斗群
     * @param battlegroupId 战斗群ID
     * @return 删除结果
     */
    @DeleteMapping("/{battlegroupId}")
    public ResponseEntity<String> deleteBattleGroup(@PathVariable String battlegroupId) {
        boolean success = battleGroupService.deleteBattleGroup(battlegroupId);
        if (success) {
            return ResponseEntity.ok("战斗群删除成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群删除失败");
        }
    }
    
    /**
     * 获取战斗群成员
     * @param battlegroupId 战斗群ID
     * @return 部队列表
     */
    @GetMapping("/{battlegroupId}/members")
    public ResponseEntity<List<Force>> getBattleGroupMembers(@PathVariable String battlegroupId) {
        List<Force> forces = battleGroupService.getBattleGroupMembers(battlegroupId);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 添加战斗群成员
     * @param battlegroupId 战斗群ID
     * @param forceId 部队ID
     * @return 添加结果
     */
    @PostMapping("/{battlegroupId}/members")
    public ResponseEntity<String> addBattleGroupMember(
            @PathVariable String battlegroupId,
            @RequestParam Long forceId) {
        boolean success = battleGroupService.addBattleGroupMember(battlegroupId, forceId);
        if (success) {
            return ResponseEntity.ok("战斗群成员添加成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群成员添加失败");
        }
    }
    
    /**
     * 移除战斗群成员
     * @param battlegroupId 战斗群ID
     * @param forceId 部队ID
     * @return 移除结果
     */
    @DeleteMapping("/{battlegroupId}/members/{forceId}")
    public ResponseEntity<String> removeBattleGroupMember(
            @PathVariable String battlegroupId,
            @PathVariable Long forceId) {
        boolean success = battleGroupService.removeBattleGroupMember(battlegroupId, forceId);
        if (success) {
            return ResponseEntity.ok("战斗群成员移除成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群成员移除失败");
        }
    }
    
    /**
     * 更新战斗群指挥部队
     * @param battlegroupId 战斗群ID
     * @param commandForceId 指挥部队ID
     * @return 更新结果
     */
    @PutMapping("/{battlegroupId}/command")
    public ResponseEntity<String> updateBattleGroupCommandForce(
            @PathVariable String battlegroupId,
            @RequestParam Long commandForceId) {
        boolean success = battleGroupService.updateBattleGroupCommandForce(battlegroupId, commandForceId);
        if (success) {
            return ResponseEntity.ok("战斗群指挥部队更新成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群指挥部队更新失败");
        }
    }
    
    /**
     * 更新战斗群火力值
     * @param battlegroupId 战斗群ID
     * @return 更新结果
     */
    @PutMapping("/{battlegroupId}/firepower")
    public ResponseEntity<String> updateBattleGroupFirepower(@PathVariable String battlegroupId) {
        boolean success = battleGroupService.updateBattleGroupFirepower(battlegroupId);
        if (success) {
            return ResponseEntity.ok("战斗群火力值更新成功");
        } else {
            return ResponseEntity.badRequest().body("战斗群火力值更新失败");
        }
    }
}
