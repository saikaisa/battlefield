package com.military.simulation.repository;

import com.military.simulation.model.SystemConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 系统配置数据访问接口
 */
@Mapper
public interface SystemConfigRepository {
    
    /**
     * 根据配置键查询系统配置
     * @param configKey 配置键
     * @return 系统配置对象
     */
    SystemConfig findByKey(@Param("configKey") String configKey);
    
    /**
     * 查询所有系统配置
     * @return 系统配置列表
     */
    List<SystemConfig> findAll();
    
    /**
     * 插入系统配置
     * @param systemConfig 系统配置对象
     * @return 影响行数
     */
    int insert(SystemConfig systemConfig);
    
    /**
     * 更新系统配置
     * @param systemConfig 系统配置对象
     * @return 影响行数
     */
    int update(SystemConfig systemConfig);
    
    /**
     * 更新配置值
     * @param configKey 配置键
     * @param configValue 配置值
     * @return 影响行数
     */
    int updateValue(@Param("configKey") String configKey, @Param("configValue") String configValue);
    
    /**
     * 删除系统配置
     * @param configKey 配置键
     * @return 影响行数
     */
    int delete(@Param("configKey") String configKey);
    
    /**
     * 批量插入系统配置
     * @param systemConfigList 系统配置列表
     * @return 影响行数
     */
    int batchInsert(@Param("list") List<SystemConfig> systemConfigList);
}
