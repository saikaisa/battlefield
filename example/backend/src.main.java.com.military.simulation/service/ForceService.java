package com.military.simulation.service;

import com.military.simulation.model.Force;
import com.military.simulation.model.ForceComposition;
import com.military.simulation.model.UnitType;
import com.military.simulation.repository.ForceCompositionRepository;
import com.military.simulation.repository.ForceRepository;
import com.military.simulation.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 部队服务实现类
 */
@Service
public class ForceService {
    
    @Autowired
    private ForceRepository forceRepository;
    
    @Autowired
    private ForceCompositionRepository forceCompositionRepository;
    
    @Autowired
    private UnitTypeRepository unitTypeRepository;
    
    @Autowired
    private HexGridService hexGridService;
    
    /**
     * 根据ID查询部队
     * @param forceId 部队ID
     * @return 部队对象
     */
    public Force getForceById(Long forceId) {
        return forceRepository.findById(forceId);
    }
    
    /**
     * 查询所有部队
     * @return 部队列表
     */
    public List<Force> getAllForces() {
        return forceRepository.findAll();
    }
    
    /**
     * 根据阵营查询部队
     * @param faction 阵营
     * @return 部队列表
     */
    public List<Force> getForcesByFaction(String faction) {
        return forceRepository.findByFaction(faction);
    }
    
    /**
     * 根据军种查询部队
     * @param service 军种
     * @return 部队列表
     */
    public List<Force> getForcesByService(String service) {
        return forceRepository.findByService(service);
    }
    
    /**
     * 根据六角格ID查询部队
     * @param hexId 六角格ID
     * @return 部队列表
     */
    public List<Force> getForcesByHexId(String hexId) {
        return forceRepository.findByHexId(hexId);
    }
    
    /**
     * 根据名称查询部队
     * @param forceName 部队名称
     * @return 部队列表
     */
    public List<Force> getForcesByName(String forceName) {
        return forceRepository.findByName(forceName);
    }
    
    /**
     * 创建部队
     * @param force 部队对象
     * @return 是否成功
     */
    @Transactional
    public boolean createForce(Force force) {
        return forceRepository.insert(force) > 0;
    }
    
    /**
     * 更新部队
     * @param force 部队对象
     * @return 是否成功
     */
    @Transactional
    public boolean updateForce(Force force) {
        return forceRepository.update(force) > 0;
    }
    
    /**
     * 更新部队位置
     * @param forceId 部队ID
     * @param hexId 六角格ID
     * @return 是否成功
     */
    @Transactional
    public boolean updateForcePosition(Long forceId, String hexId) {
        return forceRepository.updatePosition(forceId, hexId) > 0;
    }
    
    /**
     * 更新部队兵力值
     * @param forceId 部队ID
     * @param troopStrength 兵力值
     * @return 是否成功
     */
    @Transactional
    public boolean updateForceTroopStrength(Long forceId, BigDecimal troopStrength) {
        return forceRepository.updateTroopStrength(forceId, troopStrength) > 0;
    }
    
    /**
     * 更新部队士气值
     * @param forceId 部队ID
     * @param morale 士气值
     * @return 是否成功
     */
    @Transactional
    public boolean updateForceMorale(Long forceId, BigDecimal morale) {
        return forceRepository.updateMorale(forceId, morale) > 0;
    }
    
    /**
     * 更新部队行动力
     * @param forceId 部队ID
     * @param actionPoints 行动力
     * @return 是否成功
     */
    @Transactional
    public boolean updateForceActionPoints(Long forceId, Integer actionPoints) {
        return forceRepository.updateActionPoints(forceId, actionPoints) > 0;
    }
    
    /**
     * 更新部队剩余战斗次数
     * @param forceId 部队ID
     * @param remainingCombatTimes 剩余战斗次数
     * @return 是否成功
     */
    @Transactional
    public boolean updateForceRemainingCombatTimes(Long forceId, Integer remainingCombatTimes) {
        return forceRepository.updateRemainingCombatTimes(forceId, remainingCombatTimes) > 0;
    }
    
    /**
     * 删除部队
     * @param forceId 部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteForce(Long forceId) {
        // 先删除部队组成
        forceCompositionRepository.deleteByForceId(forceId);
        // 再删除部队
        return forceRepository.delete(forceId) > 0;
    }
    
    /**
     * 批量创建部队
     * @param forceList 部队列表
     * @return 是否成功
     */
    @Transactional
    public boolean batchCreateForces(List<Force> forceList) {
        return forceRepository.batchInsert(forceList) > 0;
    }
    
    /**
     * 获取部队组成
     * @param forceId 部队ID
     * @return 部队组成列表
     */
    public List<ForceComposition> getForceComposition(Long forceId) {
        return forceCompositionRepository.findByForceId(forceId);
    }
    
    /**
     * 添加部队组成
     * @param forceId 部队ID
     * @param unitTypeId 兵种ID
     * @param unitCount 兵种基数
     * @return 是否成功
     */
    @Transactional
    public boolean addForceComposition(Long forceId, String unitTypeId, Integer unitCount) {
        ForceComposition composition = new ForceComposition();
        composition.setForceId(forceId);
        composition.setUnitTypeId(unitTypeId);
        composition.setUnitCount(unitCount);
        composition.setCreatedAt(new java.util.Date());
        composition.setUpdatedAt(new java.util.Date());
        
        return forceCompositionRepository.insert(composition) > 0;
    }
    
    /**
     * 更新部队组成
     * @param id 主键ID
     * @param unitCount 兵种基数
     * @return 是否成功
     */
    @Transactional
    public boolean updateForceComposition(Long id, Integer unitCount) {
        return forceCompositionRepository.updateUnitCount(id, unitCount) > 0;
    }
    
    /**
     * 删除部队组成
     * @param id 主键ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteForceComposition(Long id) {
        return forceCompositionRepository.delete(id) > 0;
    }
    
    /**
     * 计算部队战斗力
     * @param forceId 部队ID
     * @return 战斗力值
     */
    public Map<String, Object> calculateForceCombatPower(Long forceId) {
        Force force = forceRepository.findById(forceId);
        if (force == null) {
            return null;
        }
        
        // 获取部队组成
        List<ForceComposition> compositions = forceCompositionRepository.findByForceId(forceId);
        
        // 计算基础战斗力
        double baseCombatPower = 0.0;
        for (ForceComposition composition : compositions) {
            UnitType unitType = unitTypeRepository.findById(composition.getUnitTypeId());
            if (unitType != null) {
                // 简化计算，实际项目中应有更复杂的计算逻辑
                Map<String, Object> combatAttributes = unitType.getCombatAttributes();
                double unitPower = getDoubleValue(combatAttributes, "basePower", 1.0);
                baseCombatPower += unitPower * composition.getUnitCount();
            }
        }
        
        // 考虑士气和疲劳因素
        double moraleFactor = force.getMorale().doubleValue() / 100.0;
        double fatigueFactor = 1.0 - force.getFatigueFactor().doubleValue();
        
        // 计算最终战斗力
        double finalCombatPower = baseCombatPower * moraleFactor * fatigueFactor;
        
        // 构建结果
        Map<String, Object> result = new HashMap<>();
        result.put("baseCombatPower", baseCombatPower);
        result.put("moraleFactor", moraleFactor);
        result.put("fatigueFactor", fatigueFactor);
        result.put("finalCombatPower", finalCombatPower);
        
        return result;
    }
    
    /**
     * 计算部队可视范围内的六角格
     * @param forceId 部队ID
     * @return 可视六角格ID列表
     */
    public List<String> calculateVisibleHexes(Long forceId) {
        Force force = forceRepository.findById(forceId);
        if (force == null) {
            return null;
        }
        
        String currentHexId = force.getHexId();
        int visibilityRadius = force.getVisibilityRadius();
        
        // 获取当前六角格周围指定半径内的所有六角格
        // 简化实现，实际项目中应有更复杂的算法
        // 这里假设已经有一个方法可以获取指定半径内的六角格
        return getHexesWithinRadius(currentHexId, visibilityRadius);
    }
    
    /**
     * 获取指定半径内的六角格
     * @param centerHexId 中心六角格ID
     * @param radius 半径
     * @return 六角格ID列表
     */
    private List<String> getHexesWithinRadius(String centerHexId, int radius) {
        // 简化实现，实际项目中应有更复杂的算法
        // 这里只是一个示例
        return null;
    }
    
    /**
     * 从Map中获取double值
     * @param map Map对象
     * @param key 键
     * @param defaultValue 默认值
     * @return double值
     */
    private double getDoubleValue(Map<String, Object> map, String key, double defaultValue) {
        if (map == null || !map.containsKey(key)) {
            return defaultValue;
        }
        
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        } else if (value instanceof String) {
            try {
                return Double.parseDouble((String) value);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        
        return defaultValue;
    }
}
