package com.military.simulation.service;

import com.military.simulation.model.CommandLog;
import com.military.simulation.repository.CommandLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 指令解析服务实现类
 */
@Service
public class CommandService {
    
    @Autowired
    private CommandLogRepository commandLogRepository;
    
    @Autowired
    private ForceService forceService;
    
    @Autowired
    private BattleGroupService battleGroupService;
    
    @Autowired
    private FormationService formationService;
    
    @Autowired
    private BattleService battleService;
    
    @Autowired
    private MovementService movementService;
    
    /**
     * 解析并执行指令
     * @param commandType 指令类型
     * @param parameters 指令参数
     * @param source 指令来源
     * @return 执行结果
     */
    @Transactional
    public Map<String, Object> parseAndExecuteCommand(String commandType, Map<String, Object> parameters, String source) {
        // 记录指令日志
        CommandLog commandLog = new CommandLog();
        commandLog.setCommandType(commandType);
        commandLog.setParameters(parameters);
        commandLog.setSource(source);
        commandLog.setStatus("processing");
        commandLog.setCreatedAt(new Date());
        
        commandLogRepository.insert(commandLog);
        
        // 解析并执行指令
        Map<String, Object> result;
        
        try {
            switch (commandType) {
                case "move":
                    result = executeMovementCommand(parameters);
                    break;
                case "attack":
                    result = executeAttackCommand(parameters);
                    break;
                case "create_formation":
                    result = executeCreateFormationCommand(parameters);
                    break;
                case "create_battlegroup":
                    result = executeCreateBattleGroupCommand(parameters);
                    break;
                case "add_formation_member":
                    result = executeAddFormationMemberCommand(parameters);
                    break;
                case "add_battlegroup_member":
                    result = executeAddBattleGroupMemberCommand(parameters);
                    break;
                case "remove_formation_member":
                    result = executeRemoveFormationMemberCommand(parameters);
                    break;
                case "remove_battlegroup_member":
                    result = executeRemoveBattleGroupMemberCommand(parameters);
                    break;
                case "predict_battle":
                    result = executePredictBattleCommand(parameters);
                    break;
                case "predict_battlegroup_battle":
                    result = executePredictBattleGroupBattleCommand(parameters);
                    break;
                default:
                    result = createErrorResult("未知指令类型: " + commandType);
            }
        } catch (Exception e) {
            result = createErrorResult("指令执行异常: " + e.getMessage());
        }
        
        // 更新指令日志
        if ((boolean) result.get("success")) {
            commandLog.setStatus("completed");
            commandLog.setResult(result);
            commandLog.setErrorMessage(null);
        } else {
            commandLog.setStatus("failed");
            commandLog.setResult(null);
            commandLog.setErrorMessage((String) result.get("error"));
        }
        
        commandLog.setCompletedAt(new Date());
        commandLogRepository.updateStatus(
                commandLog.getCommandId(),
                commandLog.getStatus(),
                commandLog.getResult() != null ? commandLog.getResult().toString() : null,
                commandLog.getErrorMessage()
        );
        
        return result;
    }
    
    /**
     * 获取指令记录
     * @param commandId 指令ID
     * @return 指令记录
     */
    public CommandLog getCommandLog(Long commandId) {
        return commandLogRepository.findById(commandId);
    }
    
    /**
     * 获取所有指令记录
     * @return 指令记录列表
     */
    public List<CommandLog> getAllCommandLogs() {
        return commandLogRepository.findAll();
    }
    
    /**
     * 分页获取指令记录
     * @param page 页码
     * @param size 每页大小
     * @return 指令记录列表
     */
    public List<CommandLog> getCommandLogsByPage(int page, int size) {
        int offset = (page - 1) * size;
        return commandLogRepository.findByPage(offset, size);
    }
    
    /**
     * 根据指令类型获取指令记录
     * @param commandType 指令类型
     * @return 指令记录列表
     */
    public List<CommandLog> getCommandLogsByType(String commandType) {
        return commandLogRepository.findByCommandType(commandType);
    }
    
    /**
     * 根据指令来源获取指令记录
     * @param source 指令来源
     * @return 指令记录列表
     */
    public List<CommandLog> getCommandLogsBySource(String source) {
        return commandLogRepository.findBySource(source);
    }
    
    /**
     * 根据执行状态获取指令记录
     * @param status 执行状态
     * @return 指令记录列表
     */
    public List<CommandLog> getCommandLogsByStatus(String status) {
        return commandLogRepository.findByStatus(status);
    }
    
    /**
     * 执行移动指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeMovementCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("forceId") || !parameters.containsKey("path")) {
            return createErrorResult("移动指令缺少必要参数");
        }
        
        Long forceId = Long.valueOf(parameters.get("forceId").toString());
        @SuppressWarnings("unchecked")
        List<String> path = (List<String>) parameters.get("path");
        
        // 执行移动
        return movementService.executeMovement(forceId, path);
    }
    
    /**
     * 执行攻击指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeAttackCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("attackerForceId") && !parameters.containsKey("attackerBattlegroupId")) {
            return createErrorResult("攻击指令缺少必要参数");
        }
        
        if (!parameters.containsKey("targetHexId")) {
            return createErrorResult("攻击指令缺少目标六角格ID");
        }
        
        String targetHexId = parameters.get("targetHexId").toString();
        
        // 执行攻击
        if (parameters.containsKey("attackerForceId")) {
            Long attackerForceId = Long.valueOf(parameters.get("attackerForceId").toString());
            return battleService.executeBattle(attackerForceId, targetHexId);
        } else {
            String attackerBattlegroupId = parameters.get("attackerBattlegroupId").toString();
            return battleService.executeBattleGroupBattle(attackerBattlegroupId, targetHexId);
        }
    }
    
    /**
     * 执行创建编队指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeCreateFormationCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("formationName") || !parameters.containsKey("faction") || !parameters.containsKey("forceIds")) {
            return createErrorResult("创建编队指令缺少必要参数");
        }
        
        String formationName = parameters.get("formationName").toString();
        String faction = parameters.get("faction").toString();
        @SuppressWarnings("unchecked")
        List<Long> forceIds = (List<Long>) parameters.get("forceIds");
        
        // 执行创建编队
        String formationId = formationService.createFormation(formationName, faction, forceIds);
        
        if (formationId == null) {
            return createErrorResult("创建编队失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("formationId", formationId);
        
        return result;
    }
    
    /**
     * 执行创建战斗群指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeCreateBattleGroupCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("faction") || !parameters.containsKey("commandForceId") || !parameters.containsKey("forceIds")) {
            return createErrorResult("创建战斗群指令缺少必要参数");
        }
        
        String faction = parameters.get("faction").toString();
        Long commandForceId = Long.valueOf(parameters.get("commandForceId").toString());
        @SuppressWarnings("unchecked")
        List<Long> forceIds = (List<Long>) parameters.get("forceIds");
        
        // 执行创建战斗群
        String battlegroupId = battleGroupService.createBattleGroup(faction, commandForceId, forceIds);
        
        if (battlegroupId == null) {
            return createErrorResult("创建战斗群失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("battlegroupId", battlegroupId);
        
        return result;
    }
    
    /**
     * 执行添加编队成员指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeAddFormationMemberCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("formationId") || !parameters.containsKey("forceId")) {
            return createErrorResult("添加编队成员指令缺少必要参数");
        }
        
        String formationId = parameters.get("formationId").toString();
        Long forceId = Long.valueOf(parameters.get("forceId").toString());
        
        // 执行添加编队成员
        boolean success = formationService.addFormationMember(formationId, forceId);
        
        if (!success) {
            return createErrorResult("添加编队成员失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        
        return result;
    }
    
    /**
     * 执行添加战斗群成员指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeAddBattleGroupMemberCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("battlegroupId") || !parameters.containsKey("forceId")) {
            return createErrorResult("添加战斗群成员指令缺少必要参数");
        }
        
        String battlegroupId = parameters.get("battlegroupId").toString();
        Long forceId = Long.valueOf(parameters.get("forceId").toString());
        
        // 执行添加战斗群成员
        boolean success = battleGroupService.addBattleGroupMember(battlegroupId, forceId);
        
        if (!success) {
            return createErrorResult("添加战斗群成员失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        
        return result;
    }
    
    /**
     * 执行移除编队成员指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeRemoveFormationMemberCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("formationId") || !parameters.containsKey("forceId")) {
            return createErrorResult("移除编队成员指令缺少必要参数");
        }
        
        String formationId = parameters.get("formationId").toString();
        Long forceId = Long.valueOf(parameters.get("forceId").toString());
        
        // 执行移除编队成员
        boolean success = formationService.removeFormationMember(formationId, forceId);
        
        if (!success) {
            return createErrorResult("移除编队成员失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        
        return result;
    }
    
    /**
     * 执行移除战斗群成员指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executeRemoveBattleGroupMemberCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("battlegroupId") || !parameters.containsKey("forceId")) {
            return createErrorResult("移除战斗群成员指令缺少必要参数");
        }
        
        String battlegroupId = parameters.get("battlegroupId").toString();
        Long forceId = Long.valueOf(parameters.get("forceId").toString());
        
        // 执行移除战斗群成员
        boolean success = battleGroupService.removeBattleGroupMember(battlegroupId, forceId);
        
        if (!success) {
            return createErrorResult("移除战斗群成员失败");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        
        return result;
    }
    
    /**
     * 执行预测战斗结果指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executePredictBattleCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("attackerForceId") || !parameters.containsKey("targetHexId")) {
            return createErrorResult("预测战斗结果指令缺少必要参数");
        }
        
        Long attackerForceId = Long.valueOf(parameters.get("attackerForceId").toString());
        String targetHexId = parameters.get("targetHexId").toString();
        
        // 执行预测战斗结果
        return battleService.predictBattleResult(attackerForceId, targetHexId);
    }
    
    /**
     * 执行预测战斗群战斗结果指令
     * @param parameters 指令参数
     * @return 执行结果
     */
    private Map<String, Object> executePredictBattleGroupBattleCommand(Map<String, Object> parameters) {
        // 检查参数
        if (!parameters.containsKey("attackerBattlegroupId") || !parameters.containsKey("targetHexId")) {
            return createErrorResult("预测战斗群战斗结果指令缺少必要参数");
        }
        
        String attackerBattlegroupId = parameters.get("attackerBattlegroupId").toString();
        String targetHexId = parameters.get("targetHexId").toString();
        
        // 执行预测战斗群战斗结果
        return battleService.predictBattleGroupResult(attackerBattlegroupId, targetHexId);
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
