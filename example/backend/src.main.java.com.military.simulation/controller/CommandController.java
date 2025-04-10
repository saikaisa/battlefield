package com.military.simulation.controller;

import com.military.simulation.model.CommandLog;
import com.military.simulation.service.CommandService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 指令控制器
 */
@RestController
@RequestMapping("/api/command")
public class CommandController {
    
    @Autowired
    private CommandService commandService;
    
    /**
     * 解析并执行指令
     * @param commandType 指令类型
     * @param parameters 指令参数
     * @param source 指令来源
     * @return 执行结果
     */
    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> parseAndExecuteCommand(
            @RequestParam String commandType,
            @RequestBody Map<String, Object> parameters,
            @RequestParam(defaultValue = "user") String source) {
        Map<String, Object> result = commandService.parseAndExecuteCommand(commandType, parameters, source);
        return ResponseEntity.ok(result);
    }
    
    /**
     * 获取指令记录
     * @param commandId 指令ID
     * @return 指令记录
     */
    @GetMapping("/{commandId}")
    public ResponseEntity<CommandLog> getCommandLog(@PathVariable Long commandId) {
        CommandLog commandLog = commandService.getCommandLog(commandId);
        if (commandLog == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(commandLog);
    }
    
    /**
     * 获取所有指令记录
     * @return 指令记录列表
     */
    @GetMapping("/logs")
    public ResponseEntity<List<CommandLog>> getAllCommandLogs() {
        List<CommandLog> commandLogs = commandService.getAllCommandLogs();
        return ResponseEntity.ok(commandLogs);
    }
    
    /**
     * 分页获取指令记录
     * @param page 页码
     * @param size 每页大小
     * @return 指令记录列表
     */
    @GetMapping("/logs/page")
    public ResponseEntity<List<CommandLog>> getCommandLogsByPage(
            @RequestParam int page,
            @RequestParam int size) {
        List<CommandLog> commandLogs = commandService.getCommandLogsByPage(page, size);
        return ResponseEntity.ok(commandLogs);
    }
    
    /**
     * 根据指令类型获取指令记录
     * @param commandType 指令类型
     * @return 指令记录列表
     */
    @GetMapping("/logs/type/{commandType}")
    public ResponseEntity<List<CommandLog>> getCommandLogsByType(@PathVariable String commandType) {
        List<CommandLog> commandLogs = commandService.getCommandLogsByType(commandType);
        return ResponseEntity.ok(commandLogs);
    }
    
    /**
     * 根据指令来源获取指令记录
     * @param source 指令来源
     * @return 指令记录列表
     */
    @GetMapping("/logs/source/{source}")
    public ResponseEntity<List<CommandLog>> getCommandLogsBySource(@PathVariable String source) {
        List<CommandLog> commandLogs = commandService.getCommandLogsBySource(source);
        return ResponseEntity.ok(commandLogs);
    }
    
    /**
     * 根据执行状态获取指令记录
     * @param status 执行状态
     * @return 指令记录列表
     */
    @GetMapping("/logs/status/{status}")
    public ResponseEntity<List<CommandLog>> getCommandLogsByStatus(@PathVariable String status) {
        List<CommandLog> commandLogs = commandService.getCommandLogsByStatus(status);
        return ResponseEntity.ok(commandLogs);
    }
}
