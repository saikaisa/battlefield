package com.military.simulation.service;

import com.military.simulation.model.Formation;
import com.military.simulation.model.FormationMember;
import com.military.simulation.model.Force;
import com.military.simulation.repository.FormationMemberRepository;
import com.military.simulation.repository.FormationRepository;
import com.military.simulation.repository.ForceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * 编队服务实现类
 */
@Service
public class FormationService {
    
    @Autowired
    private FormationRepository formationRepository;
    
    @Autowired
    private FormationMemberRepository formationMemberRepository;
    
    @Autowired
    private ForceRepository forceRepository;
    
    /**
     * 根据ID查询编队
     * @param formationId 编队ID
     * @return 编队对象
     */
    public Formation getFormationById(String formationId) {
        return formationRepository.findById(formationId);
    }
    
    /**
     * 查询所有编队
     * @return 编队列表
     */
    public List<Formation> getAllFormations() {
        return formationRepository.findAll();
    }
    
    /**
     * 根据阵营查询编队
     * @param faction 阵营
     * @return 编队列表
     */
    public List<Formation> getFormationsByFaction(String faction) {
        return formationRepository.findByFaction(faction);
    }
    
    /**
     * 根据名称查询编队
     * @param formationName 编队名称
     * @return 编队列表
     */
    public List<Formation> getFormationsByName(String formationName) {
        return formationRepository.findByName(formationName);
    }
    
    /**
     * 创建编队
     * @param formationName 编队名称
     * @param faction 阵营
     * @param forceIds 部队ID列表
     * @return 编队ID
     */
    @Transactional
    public String createFormation(String formationName, String faction, List<Long> forceIds) {
        // 检查部队是否存在且属于同一阵营
        if (!checkForcesExistAndSameFaction(forceIds, faction)) {
            return null;
        }
        
        // 创建编队
        String formationId = "F" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        Formation formation = new Formation();
        formation.setFormationId(formationId);
        formation.setFormationName(formationName);
        formation.setFaction(faction);
        formation.setCreatedAt(new Date());
        formation.setUpdatedAt(new Date());
        
        // 保存编队
        formationRepository.insert(formation);
        
        // 添加编队成员
        for (Long forceId : forceIds) {
            FormationMember member = new FormationMember();
            member.setFormationId(formationId);
            member.setForceId(forceId);
            member.setCreatedAt(new Date());
            
            formationMemberRepository.insert(member);
        }
        
        return formationId;
    }
    
    /**
     * 更新编队
     * @param formation 编队对象
     * @return 是否成功
     */
    @Transactional
    public boolean updateFormation(Formation formation) {
        return formationRepository.update(formation) > 0;
    }
    
    /**
     * 删除编队
     * @param formationId 编队ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteFormation(String formationId) {
        // 先删除编队成员
        formationMemberRepository.deleteByFormationId(formationId);
        // 再删除编队
        return formationRepository.delete(formationId) > 0;
    }
    
    /**
     * 获取编队成员
     * @param formationId 编队ID
     * @return 部队列表
     */
    public List<Force> getFormationMembers(String formationId) {
        List<FormationMember> members = formationMemberRepository.findByFormationId(formationId);
        List<Force> forces = new ArrayList<>();
        
        for (FormationMember member : members) {
            Force force = forceRepository.findById(member.getForceId());
            if (force != null) {
                forces.add(force);
            }
        }
        
        return forces;
    }
    
    /**
     * 添加编队成员
     * @param formationId 编队ID
     * @param forceId 部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean addFormationMember(String formationId, Long forceId) {
        // 检查编队是否存在
        Formation formation = formationRepository.findById(formationId);
        if (formation == null) {
            return false;
        }
        
        // 检查部队是否存在且属于同一阵营
        Force force = forceRepository.findById(forceId);
        if (force == null || !force.getFaction().equals(formation.getFaction())) {
            return false;
        }
        
        // 检查是否已经是编队成员
        FormationMember existingMember = formationMemberRepository.findByFormationIdAndForceId(formationId, forceId);
        if (existingMember != null) {
            return true; // 已经是成员，视为成功
        }
        
        // 添加编队成员
        FormationMember member = new FormationMember();
        member.setFormationId(formationId);
        member.setForceId(forceId);
        member.setCreatedAt(new Date());
        
        return formationMemberRepository.insert(member) > 0;
    }
    
    /**
     * 移除编队成员
     * @param formationId 编队ID
     * @param forceId 部队ID
     * @return 是否成功
     */
    @Transactional
    public boolean removeFormationMember(String formationId, Long forceId) {
        FormationMember member = formationMemberRepository.findByFormationIdAndForceId(formationId, forceId);
        if (member == null) {
            return false;
        }
        
        return formationMemberRepository.delete(member.getId()) > 0;
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
}
