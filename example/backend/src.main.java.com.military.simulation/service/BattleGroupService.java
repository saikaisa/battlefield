package com.military.simulation.service;

import com.military.simulation.model.BattleGroup;
import com.military.simulation.model.BattleGroupMember;
import com.military.simulation.model.Force;
import com.military.simulation.repository.BattleGroupMemberRepository;
import com.military.simulation.repository.BattleGroupRepository;
import com.military.simulation.repository.ForceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 战斗群服务实现类
 */
@Service
public class BattleGroupService {
    
    @Autowired
    private BattleGroupRepository battleGroupRepository;
    
    @Autowired
    private BattleGroupMemberRepository battleGroupMemberRepository;
    
    @Autowired
    private ForceRepository forceRepository;
    
    @Autowired
    private ForceService forceService;
    
    /**
     * 根据ID查询战斗群
     * @param battlegroupId 战斗群ID
     * @return 战斗群对象
     */
    public BattleGroup getBattleGroupById(String battlegroupId) {
        return battleGroupRepository.findById(battlegroupId);
    }
    
    /**
     * 查询所有战斗群
     * @return 战斗群列表
     */
    public List<BattleGroup> getAllBattleGroups() {
        return battleGroupRepository.findAll();
    }
    
    /**
     * 根据阵营查询战斗群
     * @param faction 阵营
     * @return 战斗群列表
     */
    public List<BattleGroup> getBattleGroupsByFaction(String faction) {
        return battleGroupRepository.findByFaction(faction);
    }
    
    /**
     * 根据指挥部队ID查询战斗群
     * @param commandForceId 指挥部队ID
     * @return 战斗群列表
     */
    public List<BattleGroup> getBattleGroupsByCommandForceId(Long commandForceId) {
        return battleGroupRepository.findByCommandForceId(commandForceId);
    }
    
    /**
     * 创建战斗群
     * @param faction 阵营
     * @param commandForceId 指挥部队ID
     * @param forceIds 部队ID列表
     * @return 战斗群ID
     */
    @Transactional
    public String createBattleGroup(String faction, Long commandForceId, List<Long> forceIds) {
        // 检查部队是否存在且属于同一阵营
        if (!checkForcesExistAndSameFaction(forceIds, faction)) {
            return null;
        }
        
        // 检查指挥部队是否在部队列表中
        if (!forceIds.contains(commandForceId)) {
            return null;
        }
        
        // 计算联合火力值
        Map<String, Object> jointAttackFirepower = calculateJointAttackFirepower(forceIds);
        Map<String, Object> jointDefenseFirepower = calculateJointDefenseFirepower(forceIds);
        
        // 创建战斗群
        String battlegroupId = "BG" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        BattleGroup battleGroup = new BattleGroup();
        battleGroup.setBattlegroupId(battlegroupId);
        battleGroup.setFaction(faction);
        battleGroup.setCommandForceId(commandForceId);
        battleGroup.setJointAttackFirepower(jointAttackFirepower);
        battleGroup.setJointDefenseFirepower(jointDefenseFirepower);
        battleGroup.setCreatedAt(new Date());
        
        // 保存战斗群
        battleGroupRepository.insert(battleGroup);
        
        // 添加战斗群成员
        for (Long forceId : forceIds) {
            BattleGroupMember member = new BattleGroupMember();
            member.setBattlegroupId(battlegroupId);
            member.setForceId(forceId);
            member.setCreatedAt(new Date());
            
            battleGroupMemberRepository.insert(member);
        }
        
        return battlegroupId;
    }
    
    /**
     * 更新战斗群
     * @param battleGroup 战斗群对象
     * @return 是否成功
     */
    @Transactional
    public boolean updateBattleGroup(BattleGroup battleGroup) {
        return battleGroupRepository.update(battleGroup) > 0;
    }
    
    /**
     * 删除战斗群
     * @param battlegroupId 战斗群ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteBattleGroup(String battlegroupId) {
        // 先删除战斗群成员
        battleGroupMemberRepository.deleteByBattlegroupId(battlegroupId);
        // 再删除战斗群
        return battleGroupRepository.delete(battlegroupId) > 0;
    }
    
    /**
     * 获取战斗群成员
     * @param battlegroupId 战斗群ID
     * @return 部队列表
     */
    public List<Force> getBattleGroupMembers(String battlegroupId) {
        List<BattleGroupMember> members = battleGroupMemberRepository.findByBattlegroupId(battlegroupId);
        List<Force> forces = new ArrayList<>();
        
        for (BattleGroupMember member : members) {
            Force force = forceRepository.findById(member.getForceId());
            if (force != null) {
                forces.add(force);
            }
        }
        
        return forces;
    }
    
    /**
     * 添加战斗群成员
     * @param battlegroupId 战斗群ID
     * @param forceId 部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean addBattleGroupMember(String battlegroupId, Long forceId) {
        // 检查战斗群是否存在
        BattleGroup battleGroup = battleGroupRepository.findById(battlegroupId);
        if (battleGroup == null) {
            return false;
        }
        
        // 检查部队是否存在且属于同一阵营
        Force force = forceRepository.findById(forceId);
        if (force == null || !force.getFaction().equals(battleGroup.getFaction())) {
            return false;
        }
        
        // 检查是否已经是战斗群成员
        BattleGroupMember existingMember = battleGroupMemberRepository.findByBattlegroupIdAndForceId(battlegroupId, forceId);
        if (existingMember != null) {
            return true; // 已经是成员，视为成功
        }
        
        // 添加战斗群成员
        BattleGroupMember member = new BattleGroupMember();
        member.setBattlegroupId(battlegroupId);
        member.setForceId(forceId);
        member.setCreatedAt(new Date());
        
        boolean result = battleGroupMemberRepository.insert(member) > 0;
        
        // 更新联合火力值
        if (result) {
            updateBattleGroupFirepower(battlegroupId);
        }
        
        return result;
    }
    
    /**
     * 移除战斗群成员
     * @param battlegroupId 战斗群ID
     * @param forceId 部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean removeBattleGroupMember(String battlegroupId, Long forceId) {
        BattleGroupMember member = battleGroupMemberRepository.findByBattlegroupIdAndForceId(battlegroupId, forceId);
        if (member == null) {
            return false;
        }
        
        // 检查是否是指挥部队
        BattleGroup battleGroup = battleGroupRepository.findById(battlegroupId);
        if (battleGroup != null && battleGroup.getCommandForceId().equals(forceId)) {
            return false; // 不能移除指挥部队
        }
        
        boolean result = battleGroupMemberRepository.delete(member.getId()) > 0;
        
        // 更新联合火力值
        if (result) {
            updateBattleGroupFirepower(battlegroupId);
        }
        
        return result;
    }
    
    /**
     * 更新战斗群指挥部队
     * @param battlegroupId 战斗群ID
     * @param commandForceId 指挥部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean updateBattleGroupCommandForce(String battlegroupId, Long commandForceId) {
        // 检查战斗群是否存在
        BattleGroup battleGroup = battleGroupRepository.findById(battlegroupId);
        if (battleGroup == null) {
            return false;
        }
        
        // 检查部队是否是战斗群成员
        BattleGroupMember member = battleGroupMemberRepository.findByBattlegroupIdAndForceId(battlegroupId, commandForceId);
        if (member == null) {
            return false;
        }
        
        // 更新指挥部队
        battleGroup.setCommandForceId(commandForceId);
        
        return battleGroupRepository.update(battleGroup) > 0;
    }
    
    /**
     * 更新战斗群火力值
     * @param battlegroupId 战斗群ID
     * @return 是否成功
     */
    @Transactional
    public boolean updateBattleGroupFirepower(String battlegroupId) {
        // 获取战斗群成员
        List<BattleGroupMember> members = battleGroupMemberRepository.findByBattlegroupId(battlegroupId);
        List<Long> forceIds = new ArrayList<>();
        
        for (BattleGroupMember member : members) {
            forceIds.add(member.getForceId());
        }
        
        // 计算联合火力值
        Map<String, Object> jointAttackFirepower = calculateJointAttackFirepower(forceIds);
        Map<String, Object> jointDefenseFirepower = calculateJointDefenseFirepower(forceIds);
        
        // 更新战斗群
        BattleGroup battleGroup = battleGroupRepository.findById(battlegroupId);
        if (battleGroup == null) {
            return false;
        }
        
        battleGroup.setJointAttackFirepower(jointAttackFirepower);
        battleGroup.setJointDefenseFirepower(jointDefenseFirepower);
        
        return battleGroupRepository.update(battleGroup) > 0;
    }
    
    /**
     * 计算联合攻击火力值
     * @param forceIds 部队ID列表
     * @return 联合攻击火力值
     */
    private Map<String, Object> calculateJointAttackFirepower(List<Long> forceIds) {
        Map<String, Object> jointAttackFirepower = new HashMap<>();
        
        // 初始化各类型火力值
        jointAttackFirepower.put("infantry", 0.0);
        jointAttackFirepower.put("armor", 0.0);
        jointAttackFirepower.put("artillery", 0.0);
        jointAttackFirepower.put("air", 0.0);
        jointAttackFirepower.put("total", 0.0);
        
        // 累加各部队火力值
        for (Long forceId : forceIds) {
            Force force = forceRepository.findById(forceId);
            if (force != null && force.getAttackFirepower() != null) {
                Map<String, Object> attackFirepower = force.getAttackFirepower();
                
                // 累加各类型火力值
                for (String key : jointAttackFirepower.keySet()) {
                    if (key.equals("total")) continue;
                    
                    double currentValue = (double) jointAttackFirepower.get(key);
                    double forceValue = getDoubleValue(attackFirepower, key, 0.0);
                    
                    jointAttackFirepower.put(key, currentValue + forceValue);
                }
            }
        }
        
        // 计算总火力值
        double total = 0.0;
        for (String key : jointAttackFirepower.keySet()) {
            if (key.equals("total")) continue;
            total += (double) jointAttackFirepower.get(key);
        }
        
        jointAttackFirepower.put("total", total);
        
        return jointAttackFirepower;
    }
    
    /**
     * 计算联合防御火力值
     * @param forceIds 部队ID列表
     * @return 联合防御火力值
     */
    private Map<String, Object> calculateJointDefenseFirepower(List<Long> forceIds) {
        Map<String, Object> jointDefenseFirepower = new HashMap<>();
        
        // 初始化各类型火力值
        jointDefenseFirepower.put("infantry", 0.0);
        jointDefenseFirepower.put("armor", 0.0);
        jointDefenseFirepower.put("artillery", 0.0);
        jointDefenseFirepower.put("air", 0.0);
        jointDefenseFirepower.put("total", 0.0);
        
        // 累加各部队火力值
        for (Long forceId : forceIds) {
            Force force = forceRepository.findById(forceId);
            if (force != null && force.getDefenseFirepower() != null) {
                Map<String, Object> defenseFirepower = force.getDefenseFirepower();
                
                // 累加各类型火力值
                for (String key : jointDefenseFirepower.keySet()) {
                    if (key.equals("total")) continue;
                    
                    double currentValue = (double) jointDefenseFirepower.get(key);
                    double forceValue = getDoubleValue(defenseFirepower, key, 0.0);
                    
                    jointDefenseFirepower.put(key, currentValue + forceValue);
                }
            }
        }
        
        // 计算总火力值
        double total = 0.0;
        for (String key : jointDefenseFirepower.keySet()) {
            if (key.equals("total")) continue;
            total += (double) jointDefenseFirepower.get(key);
        }
        
        jointDefenseFirepower.put("total", total);
        
        return jointDefenseFirepower;
    }
    
    /**
     * 检查部队是否存在且属于同一阵营
     * @param forceIds 部队ID列表
     * @param faction 阵营
     * @return 是否通过检查
     */
    private boolean checkForcesExistAndSameFaction(List<Long> forceIds, String faction) {
        for (Long forceId : forceIds) {
            Force force = forceRepository.findById(forceId);
            if (force == null || !force.getFaction().equals(faction)) {
                return false;
            }
        }
        
        return true;
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
