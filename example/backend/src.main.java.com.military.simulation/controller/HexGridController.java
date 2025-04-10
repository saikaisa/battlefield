package com.military.simulation.controller;

import com.military.simulation.model.HexGrid;
import com.military.simulation.service.HexGridService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 六角格控制器
 */
@RestController
@RequestMapping("/api/hexgrid")
public class HexGridController {
    
    @Autowired
    private HexGridService hexGridService;
    
    /**
     * 获取所有六角格
     * @return 六角格列表
     */
    @GetMapping
    public ResponseEntity<List<HexGrid>> getAllHexGrids() {
        List<HexGrid> hexGrids = hexGridService.getAllHexGrids();
        return ResponseEntity.ok(hexGrids);
    }
    
    /**
     * 根据ID获取六角格
     * @param hexId 六角格ID
     * @return 六角格对象
     */
    @GetMapping("/{hexId}")
    public ResponseEntity<HexGrid> getHexGridById(@PathVariable String hexId) {
        HexGrid hexGrid = hexGridService.getHexGridById(hexId);
        if (hexGrid == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(hexGrid);
    }
    
    /**
     * 根据行列范围获取六角格
     * @param minRow 最小行
     * @param maxRow 最大行
     * @param minCol 最小列
     * @param maxCol 最大列
     * @return 六角格列表
     */
    @GetMapping("/range")
    public ResponseEntity<List<HexGrid>> getHexGridsByRowColRange(
            @RequestParam int minRow,
            @RequestParam int maxRow,
            @RequestParam int minCol,
            @RequestParam int maxCol) {
        List<HexGrid> hexGrids = hexGridService.getHexGridsByRowColRange(minRow, maxRow, minCol, maxCol);
        return ResponseEntity.ok(hexGrids);
    }
    
    /**
     * 根据控制方获取六角格
     * @param faction 控制方
     * @return 六角格列表
     */
    @GetMapping("/faction/{faction}")
    public ResponseEntity<List<HexGrid>> getHexGridsByControlFaction(@PathVariable String faction) {
        List<HexGrid> hexGrids = hexGridService.getHexGridsByControlFaction(faction);
        return ResponseEntity.ok(hexGrids);
    }
    
    /**
     * 根据地形类型获取六角格
     * @param terrainType 地形类型
     * @return 六角格列表
     */
    @GetMapping("/terrain/{terrainType}")
    public ResponseEntity<List<HexGrid>> getHexGridsByTerrainType(@PathVariable String terrainType) {
        List<HexGrid> hexGrids = hexGridService.getHexGridsByTerrainType(terrainType);
        return ResponseEntity.ok(hexGrids);
    }
    
    /**
     * 获取关键点六角格
     * @return 六角格列表
     */
    @GetMapping("/objectives")
    public ResponseEntity<List<HexGrid>> getObjectivePoints() {
        List<HexGrid> hexGrids = hexGridService.getObjectivePoints();
        return ResponseEntity.ok(hexGrids);
    }
    
    /**
     * 创建六角格
     * @param hexGrid 六角格对象
     * @return 创建结果
     */
    @PostMapping
    public ResponseEntity<String> createHexGrid(@RequestBody HexGrid hexGrid) {
        boolean success = hexGridService.createHexGrid(hexGrid);
        if (success) {
            return ResponseEntity.ok("六角格创建成功");
        } else {
            return ResponseEntity.badRequest().body("六角格创建失败");
        }
    }
    
    /**
     * 更新六角格
     * @param hexId 六角格ID
     * @param hexGrid 六角格对象
     * @return 更新结果
     */
    @PutMapping("/{hexId}")
    public ResponseEntity<String> updateHexGrid(@PathVariable String hexId, @RequestBody HexGrid hexGrid) {
        hexGrid.setHexId(hexId);
        boolean success = hexGridService.updateHexGrid(hexGrid);
        if (success) {
            return ResponseEntity.ok("六角格更新成功");
        } else {
            return ResponseEntity.badRequest().body("六角格更新失败");
        }
    }
    
    /**
     * 更新六角格控制方
     * @param hexId 六角格ID
     * @param faction 控制方
     * @return 更新结果
     */
    @PutMapping("/{hexId}/control")
    public ResponseEntity<String> updateHexGridControlFaction(
            @PathVariable String hexId,
            @RequestParam String faction) {
        boolean success = hexGridService.updateHexGridControlFaction(hexId, faction);
        if (success) {
            return ResponseEntity.ok("六角格控制方更新成功");
        } else {
            return ResponseEntity.badRequest().body("六角格控制方更新失败");
        }
    }
    
    /**
     * 更新六角格可见性
     * @param hexId 六角格ID
     * @param visibleTo 可见性状态
     * @return 更新结果
     */
    @PutMapping("/{hexId}/visibility")
    public ResponseEntity<String> updateHexGridVisibility(
            @PathVariable String hexId,
            @RequestBody Map<String, Boolean> visibleTo) {
        boolean success = hexGridService.updateHexGridVisibility(hexId, visibleTo);
        if (success) {
            return ResponseEntity.ok("六角格可见性更新成功");
        } else {
            return ResponseEntity.badRequest().body("六角格可见性更新失败");
        }
    }
    
    /**
     * 删除六角格
     * @param hexId 六角格ID
     * @return 删除结果
     */
    @DeleteMapping("/{hexId}")
    public ResponseEntity<String> deleteHexGrid(@PathVariable String hexId) {
        boolean success = hexGridService.deleteHexGrid(hexId);
        if (success) {
            return ResponseEntity.ok("六角格删除成功");
        } else {
            return ResponseEntity.badRequest().body("六角格删除失败");
        }
    }
    
    /**
     * 批量创建六角格
     * @param hexGridList 六角格列表
     * @return 创建结果
     */
    @PostMapping("/batch")
    public ResponseEntity<String> batchCreateHexGrids(@RequestBody List<HexGrid> hexGridList) {
        boolean success = hexGridService.batchCreateHexGrids(hexGridList);
        if (success) {
            return ResponseEntity.ok("六角格批量创建成功");
        } else {
            return ResponseEntity.badRequest().body("六角格批量创建失败");
        }
    }
    
    /**
     * 计算两个六角格之间的距离
     * @param hexId1 六角格1的ID
     * @param hexId2 六角格2的ID
     * @return 距离
     */
    @GetMapping("/distance")
    public ResponseEntity<Integer> calculateDistance(
            @RequestParam String hexId1,
            @RequestParam String hexId2) {
        int distance = hexGridService.calculateDistance(hexId1, hexId2);
        if (distance < 0) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(distance);
    }
    
    /**
     * 获取六角格的邻居
     * @param hexId 六角格ID
     * @return 邻居六角格列表
     */
    @GetMapping("/{hexId}/neighbors")
    public ResponseEntity<List<HexGrid>> getNeighbors(@PathVariable String hexId) {
        List<HexGrid> neighbors = hexGridService.getNeighbors(hexId);
        if (neighbors == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(neighbors);
    }
}
