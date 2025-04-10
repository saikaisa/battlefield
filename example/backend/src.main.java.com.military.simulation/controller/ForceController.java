package com.military.simulation.controller;

import com.military.simulation.model.Force;
import com.military.simulation.model.ForceComposition;
import com.military.simulation.service.ForceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 部队控制器
 */
@RestController
@RequestMapping("/api/force")
public class ForceController {
    
    @Autowired
    private ForceService forceService;
    
    /**
     * 获取所有部队
     * @return 部队列表
     */
    @GetMapping
    public ResponseEntity<List<Force>> getAllForces() {
        List<Force> forces = forceService.getAllForces();
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 根据ID获取部队
     * @param forceId 部队ID
     * @return 部队对象
     */
    @GetMapping("/{forceId}")
    public ResponseEntity<Force> getForceById(@PathVariable Long forceId) {
        Force force = forceService.getForceById(forceId);
        if (force == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(force);
    }
    
    /**
     * 根据阵营获取部队
     * @param faction 阵营
     * @return 部队列表
     */
    @GetMapping("/faction/{faction}")
    public ResponseEntity<List<Force>> getForcesByFaction(@PathVariable String faction) {
        List<Force> forces = forceService.getForcesByFaction(faction);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 根据军种获取部队
     * @param service 军种
     * @return 部队列表
     */
    @GetMapping("/service/{service}")
    public ResponseEntity<List<Force>> getForcesByService(@PathVariable String service) {
        List<Force> forces = forceService.getForcesByService(service);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 根据六角格ID获取部队
     * @param hexId 六角格ID
     * @return 部队列表
     */
    @GetMapping("/hex/{hexId}")
    public ResponseEntity<List<Force>> getForcesByHexId(@PathVariable String hexId) {
        List<Force> forces = forceService.getForcesByHexId(hexId);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 根据名称获取部队
     * @param forceName 部队名称
     * @return 部队列表
     */
    @GetMapping("/name/{forceName}")
    public ResponseEntity<List<Force>> getForcesByName(@PathVariable String forceName) {
        List<Force> forces = forceService.getForcesByName(forceName);
        return ResponseEntity.ok(forces);
    }
    
    /**
     * 创建部队
     * @param force 部队对象
     * @return 创建结果
     */
    @PostMapping
    public ResponseEntity<String> createForce(@RequestBody Force force) {
        boolean success = forceService.createForce(force);
        if (success) {
            return ResponseEntity.ok("部队创建成功");
        } else {
            return ResponseEntity.badRequest().body("部队创建失败");
        }
    }
    
    /**
     * 更新部队
     * @param forceId 部队ID
     * @param force 部队对象
     * @return 更新结果
     */
    @PutMapping("/{forceId}")
    public ResponseEntity<String> updateForce(@PathVariable Long forceId, @RequestBody Force force) {
        force.setForceId(forceId);
        boolean success = forceService.updateForce(force);
        if (success) {
            return ResponseEntity.ok("部队更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队更新失败");
        }
    }
    
    /**
     * 更新部队位置
     * @param forceId 部队ID
     * @param hexId 六角格ID
     * @return 更新结果
     */
    @PutMapping("/{forceId}/position")
    public ResponseEntity<String> updateForcePosition(
            @PathVariable Long forceId,
            @RequestParam String hexId) {
        boolean success = forceService.updateForcePosition(forceId, hexId);
        if (success) {
            return ResponseEntity.ok("部队位置更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队位置更新失败");
        }
    }
    
    /**
     * 更新部队兵力值
     * @param forceId 部队ID
     * @param troopStrength 兵力值
     * @return 更新结果
     */
    @PutMapping("/{forceId}/troopstrength")
    public ResponseEntity<String> updateForceTroopStrength(
            @PathVariable Long forceId,
            @RequestParam BigDecimal troopStrength) {
        boolean success = forceService.updateForceTroopStrength(forceId, troopStrength);
        if (success) {
            return ResponseEntity.ok("部队兵力值更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队兵力值更新失败");
        }
    }
    
    /**
     * 更新部队士气值
     * @param forceId 部队ID
     * @param morale 士气值
     * @return 更新结果
     */
    @PutMapping("/{forceId}/morale")
    public ResponseEntity<String> updateForceMorale(
            @PathVariable Long forceId,
            @RequestParam BigDecimal morale) {
        boolean success = forceService.updateForceMorale(forceId, morale);
        if (success) {
            return ResponseEntity.ok("部队士气值更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队士气值更新失败");
        }
    }
    
    /**
     * 更新部队行动力
     * @param forceId 部队ID
     * @param actionPoints 行动力
     * @return 更新结果
     */
    @PutMapping("/{forceId}/actionpoints")
    public ResponseEntity<String> updateForceActionPoints(
            @PathVariable Long forceId,
            @RequestParam Integer actionPoints) {
        boolean success = forceService.updateForceActionPoints(forceId, actionPoints);
        if (success) {
            return ResponseEntity.ok("部队行动力更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队行动力更新失败");
        }
    }
    
    /**
     * 更新部队剩余战斗次数
     * @param forceId 部队ID
     * @param remainingCombatTimes 剩余战斗次数
     * @return 更新结果
     */
    @PutMapping("/{forceId}/combattimes")
    public ResponseEntity<String> updateForceRemainingCombatTimes(
            @PathVariable Long forceId,
            @RequestParam Integer remainingCombatTimes) {
        boolean success = forceService.updateForceRemainingCombatTimes(forceId, remainingCombatTimes);
        if (success) {
            return ResponseEntity.ok("部队剩余战斗次数更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队剩余战斗次数更新失败");
        }
    }
    
    /**
     * 删除部队
     * @param forceId 部队ID
     * @return 删除结果
     */
    @DeleteMapping("/{forceId}")
    public ResponseEntity<String> deleteForce(@PathVariable Long forceId) {
        boolean success = forceService.deleteForce(forceId);
        if (success) {
            return ResponseEntity.ok("部队删除成功");
        } else {
            return ResponseEntity.badRequest().body("部队删除失败");
        }
    }
    
    /**
     * 批量创建部队
     * @param forceList 部队列表
     * @return 创建结果
     */
    @PostMapping("/batch")
    public ResponseEntity<String> batchCreateForces(@RequestBody List<Force> forceList) {
        boolean success = forceService.batchCreateForces(forceList);
        if (success) {
            return ResponseEntity.ok("部队批量创建成功");
        } else {
            return ResponseEntity.badRequest().body("部队批量创建失败");
        }
    }
    
    /**
     * 获取部队组成
     * @param forceId 部队ID
     * @return 部队组成列表
     */
    @GetMapping("/{forceId}/composition")
    public ResponseEntity<List<ForceComposition>> getForceComposition(@PathVariable Long forceId) {
        List<ForceComposition> compositions = forceService.getForceComposition(forceId);
        return ResponseEntity.ok(compositions);
    }
    
    /**
     * 添加部队组成
     * @param forceId 部队ID
     * @param unitTypeId 兵种ID
     * @param unitCount 兵种基数
     * @return 添加结果
     */
    @PostMapping("/{forceId}/composition")
    public ResponseEntity<String> addForceComposition(
            @PathVariable Long forceId,
            @RequestParam String unitTypeId,
            @RequestParam Integer unitCount) {
        boolean success = forceService.addForceComposition(forceId, unitTypeId, unitCount);
        if (success) {
            return ResponseEntity.ok("部队组成添加成功");
        } else {
            return ResponseEntity.badRequest().body("部队组成添加失败");
        }
    }
    
    /**
     * 更新部队组成
     * @param id 主键ID
     * @param unitCount 兵种基数
     * @return 更新结果
     */
    @PutMapping("/composition/{id}")
    public ResponseEntity<String> updateForceComposition(
            @PathVariable Long id,
            @RequestParam Integer unitCount) {
        boolean success = forceService.updateForceComposition(id, unitCount);
        if (success) {
            return ResponseEntity.ok("部队组成更新成功");
        } else {
            return ResponseEntity.badRequest().body("部队组成更新失败");
        }
    }
    
    /**
     * 删除部队组成
     * @param id 主键ID
     * @return 删除结果
     */
    @DeleteMapping("/composition/{id}")
    public ResponseEntity<String> deleteForceComposition(@PathVariable Long id) {
        boolean success = forceService.deleteForceComposition(id);
        if (success) {
            return ResponseEntity.ok("部队组成删除成功");
        } else {
            return ResponseEntity.badRequest().body("部队组成删除失败");
        }
    }
    
    /**
     * 计算部队战斗力
     * @param forceId 部队ID
     * @return 战斗力值
     */
    @GetMapping("/{forceId}/combatpower")
    public ResponseEntity<Map<String, Object>> calculateForceCombatPower(@PathVariable Long forceId) {
        Map<String, Object> combatPower = forceService.calculateForceCombatPower(forceId);
        if (combatPower == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(combatPower);
    }
    
    /**
     * 计算部队可视范围内的六角格
     * @param forceId 部队ID
     * @return 可视六角格ID列表
     */
    @GetMapping("/{forceId}/visiblehexes")
    public ResponseEntity<List<String>> calculateVisibleHexes(@PathVariable Long forceId) {
        List<String> visibleHexes = forceService.calculateVisibleHexes(forceId);
        if (visibleHexes == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(visibleHexes);
    }
}
