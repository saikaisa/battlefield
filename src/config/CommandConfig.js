/** 命令类型 */
export const CommandType = {
  // 场景控制命令
  ORBIT_MODE: 'ORBIT_MODE',
  RESET_CAMERA: 'RESET_CAMERA',
  FOCUS_FORCE: 'FOCUS_FORCE',
  CHANGE_LAYER: 'CHANGE_LAYER',
  SELECTION_MODE: 'SELECTION_MODE',
  NEXT_FACTION: 'NEXT_FACTION',
  
  // 军事单位命令 (待实现)
  MOVE: 'MOVE',
  ATTACK: 'ATTACK',
  CREATE_FORCE: 'CREATE_FORCE',
  MERGE_FORCES: 'MERGE_FORCES',
  SPLIT_FORCE: 'SPLIT_FORCE',
};

/** 命令来源 */
export const CommandSource = {
  UI: 'UI',      // 来自界面操作
  FILE: 'FILE',  // 来自文件加载
  API: 'API',     // 来自API
  MANUAL: 'MANUAL'
};

/** 命令状态 */
export const CommandStatus = {
  PENDING: 'pending',      // 等待执行
  EXECUTING: 'executing',  // 正在执行
  FINISHED: 'finished',    // 执行完成
  FAILED: 'failed'         // 执行失败
};

/** 命令类型-中文映射 */
export const CommandTypeMap = {
  [CommandType.ORBIT_MODE]: '轨道模式',
  [CommandType.RESET_CAMERA]: '重置相机',
  [CommandType.FOCUS_FORCE]: '聚焦部队',
  [CommandType.CHANGE_LAYER]: '切换图层',
  [CommandType.SELECTION_MODE]: '选择模式',
  [CommandType.NEXT_FACTION]: '下一回合',
  [CommandType.MOVE]: '移动部队',
  [CommandType.ATTACK]: '攻击',
  [CommandType.CREATE_FORCE]: '创建部队',
  [CommandType.MERGE_FORCES]: '合并部队',
  [CommandType.SPLIT_FORCE]: '拆分部队'
};

/** 命令系统配置 */
export const CommandLimit = {
  // 队列上限
  QUEUE_LIMIT: 50,
  // 历史上限
  HISTORY_LIMIT: 20,
};

/** API配置 */ 
export const ApiConfig = {
  URL: "http://localhost:8080/api", // 后续根据实际部署环境更改
  TIMEOUT: 5000, // 请求超时时间(毫秒)
};