package com.military.simulation.repository;

import com.military.simulation.model.FormationMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 编队成员数据访问接口
 */
@Mapper
public interface FormationMemberRepository {
    
    /**
     * 根据ID查询编队成员
     * @param id 主键ID
     * @return 编队成员对象
     */
    FormationMember findById(@Param("id") Long id);
    
    /**
     * 根据编队ID查询编队成员
     * @param formationId 编队ID
     * @return 编队成员列表
     */
    List<FormationMember> findByFormationId(@Param("formationId") String formationId);
    
    /**
     * 根据部队ID查询编队成员
     * @param forceId 部队ID
     * @return 编队成员列表
     */
    List<FormationMember> findByForceId(@Param("forceId") Long forceId);
    
    /**
     * 根据编队ID和部队ID查询编队成员
     * @param formationId 编队ID
     * @param forceId 部队ID
     * @return 编队成员对象
     */
    FormationMember findByFormationIdAndForceId(
            @Param("formationId") String formationId, 
            @Param("forceId") Long forceId);
    
    /**
     * 插入编队成员
     * @param formationMember 编队成员对象
     * @return 影响行数
     */
    int insert(FormationMember formationMember);
    
    /**
     * 删除编队成员
     * @param id 主键ID
     * @return 影响行数
     */
    int delete(@Param("id") Long id);
    
    /**
     * 根据编队ID删除编队成员
     * @param formationId 编队ID
     * @return 影响行数
     */
    int deleteByFormationId(@Param("formationId") String formationId);
    
    /**
     * 根据部队ID删除编队成员
     * @param forceId 部队ID
     * @return 影响行数
     */
    int deleteByForceId(@Param("forceId") Long forceId);
    
    /**
     * 批量插入编队成员
     * @param formationMemberList 编队成员列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<FormationMember> formationMemberList);
}
