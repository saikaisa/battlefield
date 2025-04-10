package com.military.simulation.service;

import com.military.simulation.model.UnitType;
import com.military.simulation.repository.UnitTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 兵种服务实现类
 */
@Service
public class UnitTypeService {
    
    @Autowired
    private UnitTypeRepository unitTypeRepository;
    
    /**
     * 根据ID查询兵种
     * @param unitTypeId 兵种ID
     * @return 兵种对象
     */
    public UnitType getUnitTypeById(String unitTypeId) {
        return unitTypeRepository.findById(unitTypeId);
    }
    
    /**
     * 查询所有兵种
     * @return 兵种列表
     */
    public List<UnitType> getAllUnitTypes() {
        return unitTypeRepository.findAll();
    }
    
    /**
     * 根据类别查询兵种
     * @param category 兵种类别
     * @return 兵种列表
     */
    public List<UnitType> getUnitTypesByCategory(String category) {
        return unitTypeRepository.findByCategory(category);
    }
    
    /**
     * 根据军种查询兵种
     * @param service 军种
     * @return 兵种列表
     */
    public List<UnitType> getUnitTypesByService(String service) {
        return unitTypeRepository.findByService(service);
    }
    
    /**
     * 根据阵营查询可用兵种
     * @param faction 阵营
     * @return 兵种列表
     */
    public List<UnitType> getUnitTypesByFaction(String faction) {
        return unitTypeRepository.findByFaction(faction);
    }
    
    /**
     * 根据名称查询兵种
     * @param unitName 兵种名称
     * @return 兵种列表
     */
    public List<UnitType> getUnitTypesByName(String unitName) {
        return unitTypeRepository.findByName(unitName);
    }
    
    /**
     * 创建兵种
     * @param unitType 兵种对象
     * @return 是否成功
     */
    @Transactional
    public boolean createUnitType(UnitType unitType) {
        return unitTypeRepository.insert(unitType) > 0;
    }
    
    /**
     * 更新兵种
     * @param unitType 兵种对象
     * @return 是否成功
     */
    @Transactional
    public boolean updateUnitType(UnitType unitType) {
        return unitTypeRepository.update(unitType) > 0;
    }
    
    /**
     * 删除兵种
     * @param unitTypeId 兵种ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteUnitType(String unitTypeId) {
        return unitTypeRepository.delete(unitTypeId) > 0;
    }
    
    /**
     * 批量创建兵种
     * @param unitTypeList 兵种列表
     * @return 是否成功
     */
    @Transactional
    public boolean batchCreateUnitTypes(List<UnitType> unitTypeList) {
        return unitTypeRepository.batchInsert(unitTypeList) > 0;
    }
    
    /**
     * 计算兵种对抗关系
     * @param attackerTypeId 攻击方兵种ID
     * @param defenderTypeId 防御方兵种ID
     * @return 优势系数（大于1表示攻击方有优势，小于1表示防御方有优势）
     */
    public double calculateCounterRelationship(String attackerTypeId, String defenderTypeId) {
        UnitType attackerType = unitTypeRepository.findById(attackerTypeId);
        UnitType defenderType = unitTypeRepository.findById(defenderTypeId);
        
        if (attackerType == null || defenderType == null) {
            return 1.0; // 默认无优势
        }
        
        // 简化的兵种克制关系计算
        // 实际项目中应该有更复杂的计算逻辑
        String attackerCategory = attackerType.getCategory();
        String defenderCategory = defenderType.getCategory();
        
        // 简单的兵种克制关系示例
        if ("infantry".equals(attackerCategory) && "armor".equals(defenderCategory)) {
            return 0.7; // 步兵对装甲不利
        } else if ("infantry".equals(attackerCategory) && "artillery".equals(defenderCategory)) {
            return 1.2; // 步兵对炮兵有优势
        } else if ("armor".equals(attackerCategory) && "infantry".equals(defenderCategory)) {
            return 1.5; // 装甲对步兵有优势
        } else if ("armor".equals(attackerCategory) && "artillery".equals(defenderCategory)) {
            return 1.3; // 装甲对炮兵有优势
        } else if ("artillery".equals(attackerCategory) && "infantry".equals(defenderCategory)) {
            return 1.4; // 炮兵对步兵有优势
        } else if ("artillery".equals(attackerCategory) && "armor".equals(defenderCategory)) {
            return 1.2; // 炮兵对装甲有优势
        } else if ("air".equals(attackerCategory) && !"air".equals(defenderCategory)) {
            return 1.3; // 空军对地面单位有优势
        } else if (!"air".equals(attackerCategory) && "air".equals(defenderCategory)) {
            return 0.7; // 地面单位对空军不利
        }
        
        return 1.0; // 默认无优势
    }
}
