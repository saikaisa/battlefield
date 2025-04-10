package com.military.simulation.controller;

import com.military.simulation.model.UnitType;
import com.military.simulation.service.UnitTypeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 兵种控制器
 */
@RestController
@RequestMapping("/api/unittype")
public class UnitTypeController {
    
    @Autowired
    private UnitTypeService unitTypeService;
    
    /**
     * 获取所有兵种
     * @return 兵种列表
     */
    @GetMapping
    public ResponseEntity<List<UnitType>> getAllUnitTypes() {
        List<UnitType> unitTypes = unitTypeService.getAllUnitTypes();
        return ResponseEntity.ok(unitTypes);
    }
    
    /**
     * 根据ID获取兵种
     * @param unitTypeId 兵种ID
     * @return 兵种对象
     */
    @GetMapping("/{unitTypeId}")
    public ResponseEntity<UnitType> getUnitTypeById(@PathVariable String unitTypeId) {
        UnitType unitType = unitTypeService.getUnitTypeById(unitTypeId);
        if (unitType == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(unitType);
    }
    
    /**
     * 根据类别获取兵种
     * @param category 兵种类别
     * @return 兵种列表
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<UnitType>> getUnitTypesByCategory(@PathVariable String category) {
        List<UnitType> unitTypes = unitTypeService.getUnitTypesByCategory(category);
        return ResponseEntity.ok(unitTypes);
    }
    
    /**
     * 根据军种获取兵种
     * @param service 军种
     * @return 兵种列表
     */
    @GetMapping("/service/{service}")
    public ResponseEntity<List<UnitType>> getUnitTypesByService(@PathVariable String service) {
        List<UnitType> unitTypes = unitTypeService.getUnitTypesByService(service);
        return ResponseEntity.ok(unitTypes);
    }
    
    /**
     * 根据阵营获取可用兵种
     * @param faction 阵营
     * @return 兵种列表
     */
    @GetMapping("/faction/{faction}")
    public ResponseEntity<List<UnitType>> getUnitTypesByFaction(@PathVariable String faction) {
        List<UnitType> unitTypes = unitTypeService.getUnitTypesByFaction(faction);
        return ResponseEntity.ok(unitTypes);
    }
    
    /**
     * 根据名称获取兵种
     * @param unitName 兵种名称
     * @return 兵种列表
     */
    @GetMapping("/name/{unitName}")
    public ResponseEntity<List<UnitType>> getUnitTypesByName(@PathVariable String unitName) {
        List<UnitType> unitTypes = unitTypeService.getUnitTypesByName(unitName);
        return ResponseEntity.ok(unitTypes);
    }
    
    /**
     * 创建兵种
     * @param unitType 兵种对象
     * @return 创建结果
     */
    @PostMapping
    public ResponseEntity<String> createUnitType(@RequestBody UnitType unitType) {
        boolean success = unitTypeService.createUnitType(unitType);
        if (success) {
            return ResponseEntity.ok("兵种创建成功");
        } else {
            return ResponseEntity.badRequest().body("兵种创建失败");
        }
    }
    
    /**
     * 更新兵种
     * @param unitTypeId 兵种ID
     * @param unitType 兵种对象
     * @return 更新结果
     */
    @PutMapping("/{unitTypeId}")
    public ResponseEntity<String> updateUnitType(@PathVariable String unitTypeId, @RequestBody UnitType unitType) {
        unitType.setUnitTypeId(unitTypeId);
        boolean success = unitTypeService.updateUnitType(unitType);
        if (success) {
            return ResponseEntity.ok("兵种更新成功");
        } else {
            return ResponseEntity.badRequest().body("兵种更新失败");
        }
    }
    
    /**
     * 删除兵种
     * @param unitTypeId 兵种ID
     * @return 删除结果
     */
    @DeleteMapping("/{unitTypeId}")
    public ResponseEntity<String> deleteUnitType(@PathVariable String unitTypeId) {
        boolean success = unitTypeService.deleteUnitType(unitTypeId);
        if (success) {
            return ResponseEntity.ok("兵种删除成功");
        } else {
            return ResponseEntity.badRequest().body("兵种删除失败");
        }
    }
    
    /**
     * 批量创建兵种
     * @param unitTypeList 兵种列表
     * @return 创建结果
     */
    @PostMapping("/batch")
    public ResponseEntity<String> batchCreateUnitTypes(@RequestBody List<UnitType> unitTypeList) {
        boolean success = unitTypeService.batchCreateUnitTypes(unitTypeList);
        if (success) {
            return ResponseEntity.ok("兵种批量创建成功");
        } else {
            return ResponseEntity.badRequest().body("兵种批量创建失败");
        }
    }
    
    /**
     * 计算兵种对抗关系
     * @param attackerTypeId 攻击方兵种ID
     * @param defenderTypeId 防御方兵种ID
     * @return 优势系数
     */
    @GetMapping("/counter")
    public ResponseEntity<Double> calculateCounterRelationship(
            @RequestParam String attackerTypeId,
            @RequestParam String defenderTypeId) {
        double counterValue = unitTypeService.calculateCounterRelationship(attackerTypeId, defenderTypeId);
        return ResponseEntity.ok(counterValue);
    }
}
