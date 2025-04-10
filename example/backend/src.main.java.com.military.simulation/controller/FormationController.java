package com.military.simulation.controller;

import com.military.simulation.model.Formation;
import com.military.simulation.model.Force;
import com.military.simulation.service.FormationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 编队控制器
 */
@RestController
@RequestMapping("/api/formation")
public class FormationController {
    
    @Autowired
    private FormationService formationService;
    
    /**
     * 获取所有编队
     * @return 编队列表
     */
    @GetMapping
    public ResponseEntity<List<Formation>> getAllFormations() {
        List<Formation> formations = formationService.getAllFormations();
        return ResponseEntity.ok(formations);
    }
    
    /**
     * 根据ID获取编队
     * @param formationId 编队ID
     * @return 编队对象
     */
    @GetMapping("/{formationId}")
    public ResponseEntity<Formation> getFormationById(@PathVariable String formationId) {
        Formation formation = formationService.getFormationById(formationId);
        if (formation == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(formation);
    }
    
    /**
     * 根据阵营获取编队
     * @param faction 阵营
     * @return 编队列表
     */
    @GetMapping("/faction/{faction}")
    public ResponseEntity<List<Formation>> getFormationsByFaction(@PathVariable String faction) {
        List<Formation> formations = formationService.getFormationsByFaction(faction);
        return ResponseEntity.ok(formations);
    }
    
    /**
     * 根据名称获取编队
     * @param formationName 编队名称
     * @return 编队列表
     */
    @GetMapping("/name/{formationName}")
    public ResponseEntity<List<Formation>> getFormationsByName(@PathVariable String formationName) {
        List<Formation> formations = formationService.getFormationsByName(formationName);
        return ResponseEntity.ok(formations);
    }
    
    /**
     * 创建编队
     * @param formationName 编队名称
     * @param faction 阵营
     * @param forceIds 部队ID列表
     * @return 创建结果
     */
    @PostMapping
    public ResponseEntity<String> createFormation(
            @RequestParam String formationName,
            @RequestParam String faction,
            @RequestBody List<Long> forceIds) {
        String formationId = formationService.createFormation(formationName, faction, forceIds);
        if (formationId == null) {
            return ResponseEntity.badRequest().body("编队创建失败");
        }
        return ResponseEntity.ok("编队创建成功，ID: " + formationId);
    }
    
    /**
     * 更新编队
     * @param formationId 编队ID
     * @param formation 编队对象
     * @return 更新结果
     */
    @PutMapping("/{formationId}")
    public ResponseEntity<String> updateFormation(@PathVariable String formationId, @RequestBody Formation formation) {
        formation.setFormationId(formationId);
        boolean success = formationService.updateFormation(formation);
        if (success) {
            return ResponseEntity.ok("编队更新成功");
        } else {
            return ResponseEntity.badRequest().body("编队更新失败");
        }
    }
    
    /**
     * 删除编队
     * @param formationId 编队ID
     * @return 删除结果
     */
    @DeleteMapping("/{formationId}")
    public ResponseEntity<String> deleteFormation(@PathVariable String formationId) {
        boolean success = formationService.deleteFormation(formationId);
        if (success) {
            return ResponseEntity.ok("编队删除成功");
        } else {
            return ResponseEntity.badRequest().body("编队删除失败");
        }
    }
    
    /**
     * 获取编队成员
     * @param formationId 编队ID
     * @return 部队列表
     */
    @GetMapping("/{formationId}/members")
    public ResponseEntity<List<Force>> getFormationMembers(@PathVariable String formationId) {
        List<Force> forces = formationService.getFormationMembers(formationId);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 添加编队成员
     * @param formationId 编队ID
     * @param forceId 部队ID
     * @return 添加结果
     */
    @PostMapping("/{formationId}/members")
    public ResponseEntity<String> addFormationMember(
            @PathVariable String formationId,
            @RequestParam Long forceId) {
        boolean success = formationService.addFormationMember(formationId, forceId);
        if (success) {
            return ResponseEntity.ok("编队成员添加成功");
        } else {
            return ResponseEntity.badRequest().body("编队成员添加失败");
        }
    }
    
    /**
     * 移除编队成员
     * @param formationId 编队ID
     * @param forceId 部队ID
     * @return 移除结果
     */
    @DeleteMapping("/{formationId}/members/{forceId}")
    public ResponseEntity<String> removeFormationMember(
            @PathVariable String formationId,
            @PathVariable Long forceId) {
        boolean success = formationService.removeFormationMember(formationId, forceId);
        if (success) {
            return ResponseEntity.ok("编队成员移除成功");
        } else {
            return ResponseEntity.badRequest().body("编队成员移除失败");
        }
    }
}
