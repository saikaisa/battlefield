/** 命令类型 */
export const CommandType = {
  // 通用命令
  NEXT_FACTION: 'NEXT_FACTION', // 切换阵营
  MOVE: 'MOVE', // 移动部队
  ATTACK: 'ATTACK', // 攻击
  EDIT_UNIT: 'EDIT_UNIT', // 编辑兵种，包括了创建和修改
  DELETE_UNIT: 'DELETE_UNIT', // 删除兵种
  CREATE_FORCE: 'CREATE_FORCE', // 创建部队
  MERGE_FORCES: 'MERGE_FORCES', // 合并部队
  SPLIT_FORCE: 'SPLIT_FORCE', // 拆分部队
  CREATE_FORMATION: 'CREATE_FORMATION', // 创建编队
  ADD_FORCE_TO_FORMATION: 'ADD_FORCE_TO_FORMATION', // 添加部队到编队
  DELETE_FORMATION: 'DELETE_FORMATION', // 删除编队

  // 仅 UI 命令
  PANORAMA_MODE: 'PANORAMA_MODE', // 俯瞰模式
  ORBIT_MODE: 'ORBIT_MODE', // 环绕模式
  CHANGE_LAYER: 'CHANGE_LAYER', // 切换图层
  STATISTIC: 'STATISTIC', // 统计模式
  MOVE_PREPARE: 'MOVE_PREPARE', // 移动准备
  ATTACK_PREPARE: 'ATTACK_PREPARE', // 攻击准备

  // 仅 JSON 命令
  RESET_CAMERA: 'RESET_CAMERA', // 重置相机
  FOCUS_FORCE: 'FOCUS_FORCE', // 聚焦部队
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

/** 命令名称 */
export const CommandName = {
  // 通用命令
  [CommandType.NEXT_FACTION]: '切换阵营',
  [CommandType.MOVE]: '移动部队',
  [CommandType.ATTACK]: '发起进攻',
  [CommandType.EDIT_UNIT]: '编辑兵种',
  [CommandType.DELETE_UNIT]: '删除兵种',
  [CommandType.CREATE_FORCE]: '创建部队',
  [CommandType.MERGE_FORCES]: '合并部队',
  [CommandType.SPLIT_FORCE]: '拆分部队',
  [CommandType.CREATE_FORMATION]: '创建编队',
  [CommandType.ADD_FORCE_TO_FORMATION]: '添加部队到编队',
  [CommandType.DELETE_FORMATION]: '删除编队',

  // 仅 UI 命令
  [CommandType.PANORAMA_MODE]: '俯瞰模式',
  [CommandType.ORBIT_MODE]: '环绕模式',
  [CommandType.CHANGE_LAYER]: '切换图层',
  [CommandType.STATISTIC]: '统计模式',
  [CommandType.MOVE_PREPARE]: '移动准备',
  [CommandType.ATTACK_PREPARE]: '攻击准备',

  // 仅 JSON 命令
  [CommandType.RESET_CAMERA]: '重置相机',
  [CommandType.FOCUS_FORCE]: '聚焦部队'
};

/** 命令系统配置 */
export const CommandLimit = {
  QUEUE_LIMIT: 50, // 队列上限
  HISTORY_LIMIT: 50, // 历史上限
};

/** API配置 */ 
export const ApiConfig = {
  URL: "http://localhost:8080/api", // 默认api地址
  TIMEOUT: 5000, // 请求超时时间(毫秒)
};