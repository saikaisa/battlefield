# 后端架构设计

## 1. 总体架构

本项目后端采用 Spring Boot + MyBatis 技术栈，按照系统模块设计文档中的分层结构进行实现。后端架构分为五个主要模块：

1. **指令解析模块**：统一接收前端和第三方API发送的JSON格式指令与查询请求
2. **兵种与部队管理模块**：统一管理所有兵种与部队的信息
3. **战斗裁决与判定模块**：根据当前作战数据与各部队的属性，实时计算交战双方的联合火力比
4. **移动控制模块**：处理部队移动请求，接收前端手动选择的六角格路径
5. **数据存储与管理模块**：负责整个系统静态数据与动态数据的存储和管理

## 2. 目录结构

```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── military/
│   │   │           ├── simulation/
│   │   │           │   ├── MilitarySimulationApplication.java  # 应用入口
│   │   │           │   ├── config/                # 配置类
│   │   │           │   ├── controller/            # 控制器
│   │   │           │   │   ├── CommandController.java        # 指令控制器
│   │   │           │   │   ├── UnitController.java           # 兵种控制器
│   │   │           │   │   ├── ForceController.java          # 部队控制器
│   │   │           │   │   ├── BattleController.java         # 战斗控制器
│   │   │           │   │   ├── MovementController.java       # 移动控制器
│   │   │           │   │   └── HexGridController.java        # 六角格控制器
│   │   │           │   ├── service/               # 服务层
│   │   │           │   │   ├── command/                      # 指令解析模块
│   │   │           │   │   ├── unit/                         # 兵种与部队管理模块
│   │   │           │   │   ├── battle/                       # 战斗裁决与判定模块
│   │   │           │   │   ├── movement/                     # 移动控制模块
│   │   │           │   │   └── data/                         # 数据存储与管理模块
│   │   │           │   ├── model/                 # 数据模型
│   │   │           │   │   ├── entity/                       # 实体类
│   │   │           │   │   ├── dto/                          # 数据传输对象
│   │   │           │   │   └── vo/                           # 视图对象
│   │   │           │   ├── mapper/                # MyBatis映射接口
│   │   │           │   ├── common/                # 公共组件
│   │   │           │   │   ├── exception/                    # 异常处理
│   │   │           │   │   ├── util/                         # 工具类
│   │   │           │   │   └── constant/                     # 常量定义
│   │   │           │   └── aspect/                # 切面类
│   │   ├── resources/
│   │   │   ├── application.yml                    # 应用配置
│   │   │   ├── application-dev.yml                # 开发环境配置
│   │   │   ├── application-prod.yml               # 生产环境配置
│   │   │   ├── mapper/                            # MyBatis映射XML文件
│   │   │   └── static/                            # 静态资源
│   └── test/                                      # 测试代码
├── pom.xml                                        # Maven配置
└── README.md                                      # 项目说明
```

## 3. 模块详细设计

### 3.1 指令解析模块

**职责**：统一接收前端和第三方API发送的JSON格式指令与查询请求，进行基本的结构、字段校验，然后根据指令类型路由到各业务模块。

#### 3.1.1 指令解析器

**核心类**：
- `service/command/CommandParsingService.java` - 指令解析服务
- `service/command/CommandValidator.java` - 指令验证器

**关键功能**：
- 接收JSON格式指令
- 解析指令类型和参数
- 验证指令格式和字段
- 路由指令到相应模块

#### 3.1.2 规则校验器

**核心类**：
- `service/command/RuleValidationService.java` - 规则验证服务
- `service/command/validator/MoveCommandValidator.java` - 移动指令验证器
- `service/command/validator/AttackCommandValidator.java` - 攻击指令验证器
- `service/command/validator/ForceCommandValidator.java` - 部队指令验证器

**关键功能**：
- 验证移动路径连续性
- 验证进攻条件
- 验证部队状态
- 返回验证结果和错误信息

#### 3.1.3 模块分发器

**核心类**：
- `service/command/CommandDispatcherService.java` - 指令分发服务

**关键功能**：
- 根据指令类型分发指令
- 调用相应模块处理指令
- 收集处理结果
- 返回统一格式响应

#### 3.1.4 日志记录与反馈模块

**核心类**：
- `service/command/CommandLogService.java` - 指令日志服务
- `common/util/ResponseBuilder.java` - 响应构建器

**关键功能**：
- 记录指令请求和处理结果
- 构建统一格式响应
- 处理异常情况
- 提供日志查询接口

### 3.2 兵种与部队管理模块

**职责**：统一管理所有兵种与部队的信息，负责兵种的创建、修改、删除及查询，同时处理部队的编制、合并和拆分操作。

#### 3.2.1 兵种管理

**核心类**：
- `service/unit/UnitTypeService.java` - 兵种服务
- `model/entity/UnitType.java` - 兵种实体类
- `mapper/UnitTypeMapper.java` - 兵种数据访问接口

**关键功能**：
- 创建兵种
- 修改兵种属性
- 删除兵种
- 查询兵种信息

#### 3.2.2 部队管理

**核心类**：
- `service/unit/ForceService.java` - 部队服务
- `model/entity/Force.java` - 部队实体类
- `mapper/ForceMapper.java` - 部队数据访问接口

**关键功能**：
- 创建部队
- 修改部队属性
- 删除部队
- 查询部队信息
- 部队合并操作
- 部队拆分操作

#### 3.2.3 编队管理

**核心类**：
- `service/unit/FormationService.java` - 编队服务
- `model/entity/Formation.java` - 编队实体类
- `mapper/FormationMapper.java` - 编队数据访问接口

**关键功能**：
- 创建编队
- 修改编队
- 删除编队
- 查询编队信息
- 管理编队内部队

### 3.3 战斗裁决与判定模块

**职责**：根据当前作战数据与各部队的属性，实时计算交战双方的联合火力比，判断胜负，并更新部队战损和状态。

#### 3.3.1 战斗群生成

**核心类**：
- `service/battle/BattleGroupService.java` - 战斗群服务
- `model/entity/BattleGroup.java` - 战斗群实体类

**关键功能**：
- 生成进攻方战斗群
- 生成防御方战斗群
- 计算战斗群属性
- 验证战斗群合法性

#### 3.3.2 战斗结果计算

**核心类**：
- `service/battle/CombatCalculationService.java` - 战斗计算服务
- `service/battle/FirepowerCalculator.java` - 火力计算器

**关键功能**：
- 计算联合攻击火力
- 计算联合防御火力
- 引入随机因素
- 判断战斗胜负

#### 3.3.3 结果判定与状态更新

**核心类**：
- `service/battle/BattleResultService.java` - 战斗结果服务
- `service/battle/ForceStatusUpdater.java` - 部队状态更新器

**关键功能**：
- 计算兵力损失
- 更新士气值
- 更新部队状态
- 记录战斗日志

### 3.4 移动控制模块

**职责**：处理部队移动请求，接收前端手动选择的六角格路径，对路径连续性和合法性进行校验，包括特殊情况下的路径截断处理。

#### 3.4.1 路径校验

**核心类**：
- `service/movement/PathValidationService.java` - 路径验证服务
- `service/movement/HexConnectivityChecker.java` - 六角格连接性检查器

**关键功能**：
- 检查路径连续性
- 验证六角格可通行性
- 处理迷雾中敌军情况
- 计算行动力消耗

#### 3.4.2 移动执行

**核心类**：
- `service/movement/MovementExecutionService.java` - 移动执行服务
- `service/movement/ActionPointCalculator.java` - 行动力计算器

**关键功能**：
- 执行部队移动
- 更新部队位置
- 消耗行动力
- 处理特殊情况

#### 3.4.3 状态更新与日志记录

**核心类**：
- `service/movement/MovementLogService.java` - 移动日志服务

**关键功能**：
- 记录移动路径
- 记录行动力消耗
- 记录特殊情况
- 提供日志查询接口

### 3.5 数据存储与管理模块

**职责**：负责整个系统静态数据与动态数据的存储和管理，提供统一的数据访问接口。

#### 3.5.1 数据库访问层

**核心类**：
- `mapper/HexGridMapper.java` - 六角格数据访问接口
- `mapper/UnitTypeMapper.java` - 兵种数据访问接口
- `mapper/ForceMapper.java` - 部队数据访问接口
- `mapper/BattleLogMapper.java` - 战斗日志数据访问接口
- `mapper/MovementLogMapper.java` - 移动日志数据访问接口

**关键功能**：
- 提供CRUD操作接口
- 支持复杂查询条件
- 实现批量操作
- 优化查询性能

#### 3.5.2 缓存管理

**核心类**：
- `service/data/CacheService.java` - 缓存服务
- `config/CacheConfig.java` - 缓存配置

**关键功能**：
- 缓存静态数据
- 缓存热点数据
- 管理缓存生命周期
- 提供缓存刷新机制

#### 3.5.3 数据同步

**核心类**：
- `service/data/DataSyncService.java` - 数据同步服务

**关键功能**：
- 同步前后端数据
- 处理并发更新
- 保证数据一致性
- 提供事务支持

## 4. API设计

### 4.1 RESTful API

#### 4.1.1 指令API

- `POST /api/command` - 接收并处理指令
- `GET /api/command/log` - 查询指令日志

#### 4.1.2 兵种API

- `GET /api/unitTypes` - 获取所有兵种
- `GET /api/unitTypes/{id}` - 获取单个兵种
- `POST /api/unitTypes` - 创建兵种
- `PUT /api/unitTypes/{id}` - 更新兵种
- `DELETE /api/unitTypes/{id}` - 删除兵种

#### 4.1.3 部队API

- `GET /api/forces` - 获取所有部队
- `GET /api/forces/{id}` - 获取单个部队
- `POST /api/forces` - 创建部队
- `PUT /api/forces/{id}` - 更新部队
- `DELETE /api/forces/{id}` - 删除部队
- `POST /api/forces/merge` - 合并部队
- `POST /api/forces/split` - 拆分部队

#### 4.1.4 战斗API

- `POST /api/battle` - 发起战斗
- `GET /api/battle/log` - 查询战斗日志

#### 4.1.5 移动API

- `POST /api/movement` - 执行移动
- `GET /api/movement/log` - 查询移动日志

#### 4.1.6 六角格API

- `GET /api/hexGrid` - 获取所有六角格
- `GET /api/hexGrid/{id}` - 获取单个六角格
- `PUT /api/hexGrid/{id}` - 更新六角格状态

### 4.2 第三方API

为支持第三方代码对引擎进行灵活调用，提供以下API：

- `POST /api/thirdparty/command` - 接收第三方指令
- `GET /api/thirdparty/status` - 获取系统状态
- `GET /api/thirdparty/forces` - 获取部队信息
- `GET /api/thirdparty/hexGrid` - 获取六角格信息

## 5. 安全设计

### 5.1 认证与授权

**核心类**：
- `config/SecurityConfig.java` - 安全配置
- `service/auth/AuthService.java` - 认证服务

**关键功能**：
- 基于Token的认证
- 角色权限控制
- API访问限制
- 第三方API认证

### 5.2 数据安全

**核心类**：
- `aspect/DataSecurityAspect.java` - 数据安全切面
- `common/util/EncryptionUtil.java` - 加密工具

**关键功能**：
- 敏感数据加密
- 数据访问控制
- 操作日志记录
- 数据完整性校验

## 6. 性能优化策略

1. **数据库优化**：
   - 使用索引提高查询效率
   - 使用连接池管理数据库连接
   - 分页查询大数据集
   - 批量操作减少数据库交互

2. **缓存优化**：
   - 缓存静态数据
   - 缓存热点数据
   - 使用多级缓存策略
   - 定时刷新缓存

3. **并发处理**：
   - 使用线程池处理并发请求
   - 使用乐观锁处理并发更新
   - 使用事务保证数据一致性
   - 异步处理非关键操作

## 7. 扩展性考虑

1. **模块化设计**：
   - 各模块通过接口通信
   - 使用依赖注入降低耦合
   - 遵循单一职责原则
   - 提供扩展点

2. **配置驱动**：
   - 使用配置文件定义关键参数
   - 支持运行时修改配置
   - 使用配置中心管理配置
   - 环境隔离配置

3. **插件机制**：
   - 提供SPI扩展点
   - 支持自定义规则
   - 支持自定义算法
   - 支持自定义数据源

## 8. 异常处理

**核心类**：
- `common/exception/GlobalExceptionHandler.java` - 全局异常处理器
- `common/exception/BusinessException.java` - 业务异常
- `common/exception/SystemException.java` - 系统异常

**关键功能**：
- 统一异常处理
- 友好错误信息
- 异常日志记录
- 异常分类处理

## 9. 日志管理

**核心类**：
- `aspect/LogAspect.java` - 日志切面
- `common/util/LogUtil.java` - 日志工具

**关键功能**：
- 操作日志记录
- 系统日志记录
- 日志分级管理
- 日志查询接口
