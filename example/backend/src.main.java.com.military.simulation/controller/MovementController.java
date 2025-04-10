package com.military.simulation.controller;

import com.military.simulation.model.MovementLog;
import com.military.simulation.service.MovementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 移动控制器
 */
@RestController
@RequestMapping("/api/movement")
public class MovementController {
    
    @Autowired
    private MovementService movementService;
    
    /**
     * 执行移动
     * @param forceId 部队ID
     * @param path 移动路径
     * @return 移动结果
     */
    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> executeMovement(
            @RequestParam Long forceId,
            @RequestBody List<String> path) {
        Map<String, Object> result = movementService.executeMovement(forceId, path);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 计算移动路径
     * @param forceId 部队ID
     * @param targetHexId 目标六角格ID
     * @return 移动路径
     */
    @GetMapping("/calculate")
    public ResponseEntity<Map<String, Object>> calculateMovementPath(
            @RequestParam Long forceId,
            @RequestParam String targetHexId) {
        Map<String, Object> result = movementService.calculateMovementPath(forceId, targetHexId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 获取移动记录
     * @param movementId 移动ID
     * @return 移动记录
     */
    @GetMapping("/{movementId}")
    public ResponseEntity<MovementLog> getMovementLog(@PathVariable Long movementId) {
        MovementLog movementLog = movementService.getMovementLog(movementId);
        if (movementLog == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(movementLog);
    }
    
    /**
     * 获取部队移动记录
     * @param forceId 部队ID
     * @return 移动记录列表
     */
    @GetMapping("/force/{forceId}")
    public ResponseEntity<List<MovementLog>> getForceMovementLogs(@PathVariable Long forceId) {
        List<MovementLog> movementLogs = movementService.getForceMovementLogs(forceId);
        return ResponseEntity.ok(movementLogs);
    }
    
    /**
     * 分页获取移动记录
     * @param page 页码
     * @param size 每页大小
     * @return 移动记录列表
     */
    @GetMapping("/logs/page")
    public ResponseEntity<List<MovementLog>> getMovementLogsByPage(
            @RequestParam int page,
            @RequestParam int size) {
        List<MovementLog> movementLogs = movementService.getMovementLogsByPage(page, size);
        return ResponseEntity.ok(movementLogs);
    }
}
