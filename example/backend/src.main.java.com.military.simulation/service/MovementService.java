package com.military.simulation.service;

import com.military.simulation.model.Force;
import com.military.simulation.model.HexGrid;
import com.military.simulation.model.MovementLog;
import com.military.simulation.repository.ForceRepository;
import com.military.simulation.repository.HexGridRepository;
import com.military.simulation.repository.MovementLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 移动控制服务实现类
 */
@Service
public class MovementService {
    
    @Autowired
    private ForceRepository forceRepository;
    
    @Autowired
    private HexGridRepository hexGridRepository;
    
    @Autowired
    private MovementLogRepository movementLogRepository;
    
    @Autowired
    private HexGridService hexGridService;
    
    /**
     * 执行移动
     * @param forceId 部队ID
     * @param path 移动路径
     * @return 移动结果
     */
    @Transactional
    public Map<String, Object> executeMovement(Long forceId, List<String> path) {
        // 获取部队
        Force force = forceRepository.findById(forceId);
        if (force == null) {
            return createErrorResult("部队不存在");
        }
        
        // 检查路径是否有效
        if (path == null || path.isEmpty()) {
            return createErrorResult("移动路径为空");
        }
        
        // 检查起点是否是部队当前位置
        String startHexId = path.get(0);
        if (!startHexId.equals(force.getHexId())) {
            return createErrorResult("移动起点不是部队当前位置");
        }
        
        // 检查路径是否连续
        if (!isPathContinuous(path)) {
            return createErrorResult("移动路径不连续");
        }
        
        // 计算移动消耗
        int actionPointsCost = calculateMovementCost(path);
        
        // 检查部队是否有足够的行动力
        if (force.getActionPoints() < actionPointsCost) {
            return createErrorResult("部队行动力不足");
        }
        
        // 检查路径是否可通行
        if (!isPathPassable(path, force.getService())) {
            return createErrorResult("移动路径不可通行");
        }
        
        // 执行移动
        String targetHexId = path.get(path.size() - 1);
        force.setHexId(targetHexId);
        force.setActionPoints(force.getActionPoints() - actionPointsCost);
        
        forceRepository.update(force);
        
        // 记录移动日志
        recordMovementLog(forceId, path, actionPointsCost);
        
        // 构建结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("forceId", forceId);
        result.put("path", path);
        result.put("actionPointsCost", actionPointsCost);
        result.put("remainingActionPoints", force.getActionPoints());
        
        return result;
    }
    
    /**
     * 计算移动路径
     * @param forceId 部队ID
     * @param targetHexId 目标六角格ID
     * @return 移动路径
     */
    public Map<String, Object> calculateMovementPath(Long forceId, String targetHexId) {
        // 获取部队
        Force force = forceRepository.findById(forceId);
        if (force == null) {
            return createErrorResult("部队不存在");
        }
        
        // 获取目标六角格
        HexGrid targetHex = hexGridRepository.findById(targetHexId);
        if (targetHex == null) {
            return createErrorResult("目标六角格不存在");
        }
        
        // 计算最短路径
        List<String> path = findShortestPath(force.getHexId(), targetHexId, force.getService());
        if (path == null || path.isEmpty()) {
            return createErrorResult("无法找到有效路径");
        }
        
        // 计算移动消耗
        int actionPointsCost = calculateMovementCost(path);
        
        // 检查部队是否有足够的行动力
        boolean hasEnoughActionPoints = force.getActionPoints() >= actionPointsCost;
        
        // 如果行动力不足，计算可行进的最远路径
        List<String> truncatedPath = path;
        if (!hasEnoughActionPoints) {
            truncatedPath = truncatePath(path, force.getActionPoints());
        }
        
        // 构建结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("forceId", forceId);
        result.put("originalPath", path);
        result.put("path", truncatedPath);
        result.put("actionPointsCost", actionPointsCost);
        result.put("hasEnoughActionPoints", hasEnoughActionPoints);
        result.put("remainingActionPoints", force.getActionPoints());
        
        return result;
    }
    
    /**
     * 获取移动记录
     * @param movementId 移动ID
     * @return 移动记录
     */
    public MovementLog getMovementLog(Long movementId) {
        return movementLogRepository.findById(movementId);
    }
    
    /**
     * 获取部队移动记录
     * @param forceId 部队ID
     * @return 移动记录列表
     */
    public List<MovementLog> getForceMovementLogs(Long forceId) {
        return movementLogRepository.findByForceId(forceId);
    }
    
    /**
     * 分页获取移动记录
     * @param page 页码
     * @param size 每页大小
     * @return 移动记录列表
     */
    public List<MovementLog> getMovementLogsByPage(int page, int size) {
        int offset = (page - 1) * size;
        return movementLogRepository.findByPage(offset, size);
    }
    
    /**
     * 检查路径是否连续
     * @param path 路径
     * @return 是否连续
     */
    private boolean isPathContinuous(List<String> path) {
        for (int i = 0; i < path.size() - 1; i++) {
            String currentHexId = path.get(i);
            String nextHexId = path.get(i + 1);
            
            // 获取当前六角格的邻居
            List<HexGrid> neighbors = hexGridService.getNeighbors(currentHexId);
            if (neighbors == null) {
                return false;
            }
            
            // 检查下一个六角格是否是当前六角格的邻居
            boolean isNeighbor = false;
            for (HexGrid neighbor : neighbors) {
                if (neighbor.getHexId().equals(nextHexId)) {
                    isNeighbor = true;
                    break;
                }
            }
            
            if (!isNeighbor) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 计算移动消耗
     * @param path 路径
     * @return 行动力消耗
     */
    private int calculateMovementCost(List<String> path) {
        int cost = 0;
        
        for (int i = 0; i < path.size() - 1; i++) {
            String currentHexId = path.get(i);
            String nextHexId = path.get(i + 1);
            
            // 获取当前六角格和下一个六角格
            HexGrid currentHex = hexGridRepository.findById(currentHexId);
            HexGrid nextHex = hexGridRepository.findById(nextHexId);
            
            if (currentHex == null || nextHex == null) {
                continue;
            }
            
            // 计算基础消耗
            int baseCost = 1;
            
            // 计算地形消耗
            int terrainCost = calculateTerrainCost(nextHex.getTerrainType());
            
            // 计算高度消耗
            int elevationCost = calculateElevationCost(currentHex.getElevation(), nextHex.getElevation());
            
            // 累加消耗
            cost += baseCost + terrainCost + elevationCost;
        }
        
        return cost;
    }
    
    /**
     * 计算地形消耗
     * @param terrainType 地形类型
     * @return 地形消耗
     */
    private int calculateTerrainCost(String terrainType) {
        // 简化实现，实际项目中应根据地形类型计算消耗
        switch (terrainType) {
            case "plain":
                return 0;
            case "forest":
                return 1;
            case "mountain":
                return 2;
            case "river":
                return 3;
            case "swamp":
                return 4;
            default:
                return 1;
        }
    }
    
    /**
     * 计算高度消耗
     * @param currentElevation 当前高度
     * @param nextElevation 下一个高度
     * @return 高度消耗
     */
    private int calculateElevationCost(BigDecimal currentElevation, BigDecimal nextElevation) {
        // 简化实现，实际项目中应根据高度差计算消耗
        if (currentElevation == null || nextElevation == null) {
            return 0;
        }
        
        BigDecimal elevationDiff = nextElevation.subtract(currentElevation);
        
        if (elevationDiff.compareTo(BigDecimal.ZERO) <= 0) {
            return 0; // 下坡或平路不额外消耗
        } else if (elevationDiff.compareTo(BigDecimal.valueOf(100)) <= 0) {
            return 1; // 小坡
        } else if (elevationDiff.compareTo(BigDecimal.valueOf(300)) <= 0) {
            return 2; // 中坡
        } else {
            return 3; // 陡坡
        }
    }
    
    /**
     * 检查路径是否可通行
     * @param path 路径
     * @param service 军种
     * @return 是否可通行
     */
    private boolean isPathPassable(List<String> path, String service) {
        for (String hexId : path) {
            HexGrid hex = hexGridRepository.findById(hexId);
            if (hex == null) {
                return false;
            }
            
            // 检查六角格是否可通行
            Map<String, Boolean> passability = hex.getPassability();
            if (passability == null) {
                continue;
            }
            
            Boolean isPassable = passability.get(service);
            if (isPassable != null && !isPassable) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 查找最短路径
     * @param startHexId 起点六角格ID
     * @param targetHexId 目标六角格ID
     * @param service 军种
     * @return 最短路径
     */
    private List<String> findShortestPath(String startHexId, String targetHexId, String service) {
        // 简化实现，实际项目中应使用A*算法等寻路算法
        // 这里只是一个示例，返回一个简单的路径
        List<String> path = new ArrayList<>();
        path.add(startHexId);
        
        // 获取起点和终点六角格
        HexGrid startHex = hexGridRepository.findById(startHexId);
        HexGrid targetHex = hexGridRepository.findById(targetHexId);
        
        if (startHex == null || targetHex == null) {
            return path;
        }
        
        // 计算距离
        int distance = hexGridService.calculateDistance(startHexId, targetHexId);
        
        // 如果距离为1，直接返回起点和终点
        if (distance == 1) {
            path.add(targetHexId);
            return path;
        }
        
        // 简化实现，实际项目中应使用寻路算法
        // 这里只是一个示例，返回一个简单的路径
        path.add(targetHexId);
        
        return path;
    }
    
    /**
     * 截断路径
     * @param path 路径
     * @param availableActionPoints 可用行动力
     * @return 截断后的路径
     */
    private List<String> truncatePath(List<String> path, int availableActionPoints) {
        List<String> truncatedPath = new ArrayList<>();
        truncatedPath.add(path.get(0)); // 添加起点
        
        int cost = 0;
        
        for (int i = 0; i < path.size() - 1; i++) {
            String currentHexId = path.get(i);
            String nextHexId = path.get(i + 1);
            
            // 获取当前六角格和下一个六角格
            HexGrid currentHex = hexGridRepository.findById(currentHexId);
            HexGrid nextHex = hexGridRepository.findById(nextHexId);
            
            if (currentHex == null || nextHex == null) {
                continue;
            }
            
            // 计算基础消耗
            int baseCost = 1;
            
            // 计算地形消耗
            int terrainCost = calculateTerrainCost(nextHex.getTerrainType());
            
            // 计算高度消耗
            int elevationCost = calculateElevationCost(currentHex.getElevation(), nextHex.getElevation());
            
            // 累加消耗
            int stepCost = baseCost + terrainCost + elevationCost;
            
            // 检查是否超出可用行动力
            if (cost + stepCost > availableActionPoints) {
                break;
            }
            
            // 添加下一个六角格
            truncatedPath.add(nextHexId);
            cost += stepCost;
        }
        
        return truncatedPath;
    }
    
    /**
     * 记录移动日志
     * @param forceId 部队ID
     * @param path 移动路径
     * @param actionPointsCost 行动力消耗
     */
    private void recordMovementLog(Long forceId, List<String> path, int actionPointsCost) {
        MovementLog movementLog = new MovementLog();
        
        movementLog.setForceId(forceId);
        movementLog.setPath(path.toArray(new String[0]));
        movementLog.setActionPointsCost(actionPointsCost);
        movementLog.setOriginalPath(path.toArray(new String[0]));
        movementLog.setTruncated(false);
        movementLog.setTruncateReason(null);
        movementLog.setMovementTime(new Date());
        
        movementLogRepository.insert(movementLog);
    }
    
    /**
     * 创建错误结果
     * @param errorMessage 错误信息
     * @return 错误结果
     */
    private Map<String, Object> createErrorResult(String errorMessage) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("error", errorMessage);
        return result;
    }
}
