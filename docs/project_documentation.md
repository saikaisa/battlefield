# 战场模拟系统项目文档

## 项目概述

本项目是一个基于Cesium和Vue3的军事战场模拟系统。前端使用Vue3的Composition API构建用户界面，Cesium进行地图和三维场景渲染，后端使用Java Spring Boot提供REST API服务。

## 项目结构

### 前端结构

```
battlefield
├── src/                        # 前端源代码
│   ├── assets/                 # 静态资源
│   ├── components/             # 组件
│   │   └── hud/                # 界面组件
│   ├── config/                 # 配置文件
│   ├── layers/                 # 图层组件
│   │   ├── interaction-layer/  # 交互层
│   │   ├── military-layer/     # 军事单位层
│   │   └── scene-layer/        # 场景层
│   ├── models/                 # 数据模型
│   ├── services/               # 服务
│   ├── store/                  # 状态管理
│   ├── style/                  # 样式文件
│   └── utils/                  # 工具函数
├── public/                     # 公共资源
│   └── assets/                 # 静态资源
```

### 后端结构

```
example/backend
├── resources/                  # 配置资源
├── src.main.java.com.military.simulation/
│   ├── config/                 # 配置类
│   ├── controller/             # 控制器
│   ├── model/                  # 数据模型
│   ├── repository/             # 数据访问层
│   ├── service/                # 服务层
│   └── util/                   # 工具类
```

## 详细文件结构和功能说明

### 1. 核心入口文件

#### 1.1 App.vue
主应用入口组件，负责初始化整个应用的各个管理器和组件结构。

```javascript
// 关键功能：
- 加载Cesium地图容器
- 初始化SceneManager（场景管理器）
- 初始化MilitaryManager（军事单位管理器）
- 提供PanelManager（面板管理器）给子组件
- 管理应用的生命周期
```

#### 1.2 main.js
Vue应用的入口文件，初始化全局配置和插件。

```javascript
// 关键功能：
- 引入必要的库和样式 (Vue, ElementPlus, Pinia, Cesium)
- 设置Cesium的Ion默认访问令牌
- 创建和挂载Vue应用
```

### 2. 配置层 (src/config)

#### 2.1 GameConfig.js
游戏核心配置文件，定义了游戏各方面的参数和设置。

```javascript
// 核心配置项：
- RuleConfig: 游戏规则配置，包括回合、阵营等
- CesiumConfig: Cesium 地图相关配置
- HexConfig: 六角格网格配置（半径、边界等）
- CameraConfig: 相机视角配置
- MilitaryConfig: 军事单位配置（模型、限制参数等）
- ApiConfig: API 接口配置
```

#### 2.2 HexVisualStyles.js
六角格视觉样式配置，定义了不同状态下的六角格显示样式。

```javascript
// 主要样式定义：
- 地形样式（平原、丘陵、山地等）
- 交互状态样式（选中、高亮、路径等）
- 控制区域样式（中立、蓝方、红方等）
```

### 3. 数据模型层 (src/models)

#### 3.1 MilitaryUnit.js
军事单位的核心数据模型，定义了兵种、部队、战斗群和编队的数据结构和方法。

```javascript
// 数据模型：
- Unit（兵种）: 战斗单位模板，包含基础属性和能力
  - ID、名称、军种、类别、阵营可用性
  - 攻击/防御力组成
  - 可视范围、行动点消耗、恢复率
  - 指挥能力和范围
  - 计算方法：getAttackPower、getDefensePower、getActionPointCost

- Force（部队）: 战场上的实际单位实体
  - ID、名称、阵营、军种、所在六角格
  - 兵种组成 [{ unitId, unitCount }]
  - 状态属性：兵力值、战斗机会次数、行动点数
  - 动态计算属性：士气、攻击火力、防御火力、疲劳系数等
  - 操作方法：
    - 消耗/恢复兵力
    - 消耗/刷新战斗机会
    - 消耗/重置行动力
    - 计算移动消耗

- Battlegroup（战斗群）: 临时作战集群
  - ID、阵营、指挥部队ID、参与部队ID列表
  - 联合火力计算
  - 指挥能力和范围继承

- Formation（编队）: 部队管理分组
  - ID、名称、阵营、部队ID列表
```

#### 3.2 HexCell.js
六角格地图单元数据模型，定义了地图网格的数据结构和可视化属性。

```javascript
// 数据结构：
- 基础标识：hexId
- 空间位置：position {points, row, col}
- 地形属性：terrainAttributes {terrainType, terrainComposition, elevation, passability}
- 战场状态：battlefieldState {controlFaction}
- 可视状态：visibility {visualStyles, visibleTo}
- 附加信息：additionalInfo {isObjectivePoint, resource}

// 关键方法：
- getCenter(): 获取中心点
- getVertices(): 获取顶点
- updateElevation(): 计算加权平均高度
- 样式管理：addVisualStyle, removeVisualStyleByType, getTopVisualStyle
```

#### 3.3 CameraView.js
相机视角数据模型，定义了不同视角的保存和恢复机制。

```javascript
// 数据结构：
- viewId: 视角ID
- viewName: 视角名称
- position: 位置 {longitude, latitude, height}
- orientation: 方向 {heading, pitch, roll}
- range: 距离
```

### 4. 状态管理层 (src/store)

#### 4.1 index.js
使用Pinia实现的状态管理，维护全局游戏状态和数据。

```javascript
// 状态定义：
- 图层状态：layerIndex
- 游戏回合状态：currentRound, currentFaction, factionFinished
- 主数据容器：
  - hexCellMap: Map<hexId, HexCell>
  - unitMap: Map<unitId, Unit>
  - forceMap: Map<forceId, Force>
  - battlegroupMap: Map<battlegroupId, Battlegroup>
  - formationMap: Map<formationId, Formation>
- 选中状态：selectedHexIds, selectedForceIds

// 方法定义：
- 图层控制：setLayerIndex
- 回合控制：switchToNextFaction, getRoundInfo
- 六角格操作：addHexCell, setHexCells, getHexCells, getHexCellById, removeHexCellById
- 兵种操作：addUnit, getUnitById, getUnits, getUnitsByFaction
- 部队操作：addForce, getForceById, getForces, getForcesByFaction
- 战斗群操作：addBattlegroup, getBattlegroupById, getBattlegroups, getBattlegroupsByFaction
- 编队操作：addFormation, getFormationById, getFormations, getFormationsByFaction, 
  addForceToFormation, removeForceFromCurrentFormation, getFormationByForceId
- 选中状态操作：addSelectedHexId, removeSelectedHexId, clearSelectedHexIds, getSelectedHexIds,
  addSelectedForceId, removeSelectedForceId, clearSelectedForceIds, getSelectedForceIds
```

### 5. 服务层 (src/services)

#### 5.1 api.js
定义与后端服务交互的API接口。

```javascript
// API接口定义：
- move(forceId, path): 移动命令
- attack(commandForceId, targetHex, supportForceIds): 进攻命令
- createForce(hexId, faction, composition, formationId): 创建部队命令
- mergeForces(hexId, forceIds): 合并部队命令
- splitForce(forceId, splitDetails): 拆分部队命令
```

#### 5.2 mock.js
模拟后端服务的本地实现，用于前端开发和测试。

```javascript
// 模拟服务实现：
- handleMove(command): 处理移动命令
- handleAttack(command): 处理进攻命令
- handleCreateForce(command): 处理创建部队命令
- handleMergeForces(command): 处理合并部队命令
- handleSplitForce(command): 处理拆分部队命令
```

### 6. 图层组件 (src/layers)

#### 6.1 场景层 (scene-layer)

##### 6.1.1 SceneManager.js
场景管理器，负责初始化和管理Cesium地图和场景。

```javascript
// 核心功能：
- 实现单例模式，全局访问
- 初始化Cesium Viewer和地形数据
- 管理六角格生成和渲染
- 管理相机控制系统
- 处理屏幕交互

// 关键方法：
- getInstance(containerId): 获取单例实例
- init(): 异步初始化地图和六角网格
- setPanelManager(pm): 挂载面板管理器
- _bindPanelManager(): 绑定面板回调
- _loadTerrain(viewer, terrainInput): 加载地形数据
```

##### 6.1.2 components/CameraViewController.js
相机视角控制器，管理地图相机的移动和视角转换。

```javascript
// 主要功能：
- 初始化相机默认视角
- 提供视角切换和保存功能
- 实现轨道旋转(Orbit)模式
- 支持飞行到特定位置

// 关键方法：
- initialize(): 初始化控制器
- resetToDefaultView(): 重置到默认视角
- focusOnLocation(longitude, latitude): 聚焦到指定位置
- setOrbitMode(enabled): 切换轨道模式
```

##### 6.1.3 components/HexGridGenerator.js
六角格网格生成器，负责生成地图六角格网络。

```javascript
// 主要功能：
- 根据配置生成六角格网格
- 基于地形采样计算高度和地形类型
- 生成六角格唯一标识

// 关键方法：
- generateGrid(): 生成六角格网格
- _createHexCell(row, col, points): 创建单个六角格
- _sampleTerrainHeight(positions): 地形高度采样
```

##### 6.1.4 components/HexGridRenderer.js
六角格网格渲染器，负责将六角格数据可视化到地图上。

```javascript
// 主要功能：
- 渲染基础六角格网格
- 渲染交互状态（选中、高亮等）
- 更新六角格样式和颜色

// 关键方法：
- renderBaseGrid(): 渲染基础网格
- renderInteractGrid(): 渲染交互状态
- _createHexEntity(hexCell, visualStyle): 创建六角格实体
```

#### 6.2 军事层 (military-layer)

##### 6.2.1 MilitaryManager.js
军事单位管理器，负责军事单位的生命周期和命令分发。

```javascript
// 核心功能：
- 初始化和管理军事单位系统
- 处理部队的创建、移动、攻击等命令
- 管理部队与六角格的映射关系
- 处理部队变更的UI同步

// 关键方法：
- init(onProgress): 异步初始化
- setPanelManager(pm): 挂载面板管理器
- _initHexForceMapper(): 初始化映射器
- _initFormationSystem(): 初始化编队系统
- _bindPanelCommands(): 绑定面板命令回调

// 命令处理方法：
- onMoveCommand({forceId, path}): 处理移动命令
- onAttackCommand({commandForceId, targetHex, supportForceIds}): 处理攻击命令
- onCreateForceCommand({hexId, faction, composition, formationId}): 处理创建部队命令
- onMergeForcesCommand({hexId, forceIds}): 处理合并部队命令
- onSplitForceCommand({forceId, splitDetails}): 处理拆分部队命令
```

##### 6.2.2 components/MilitaryModelLoader.js
军事模型加载器，负责预加载军事单位的3D模型资源。

```javascript
// 主要功能：
- 预加载军事单位模型
- 管理模型LOD级别和动画
- 提供模型资源的访问接口

// 关键方法：
- preloadModelTemplates(onProgress): 预加载模型模板
- getModelTemplate(unitType): 获取模型模板
```

##### 6.2.3 components/MilitaryModelRenderer.js
军事模型渲染器，负责将部队数据渲染为3D模型实体。

```javascript
// 主要功能：
- 渲染部队3D模型
- 根据部队数量调整布局（环形、网格、聚合）
- 处理部队变更的模型同步
- 更新部队视觉状态（选中、移动等）

// 关键方法：
- renderAllForces(): 渲染所有部队
- renderForce(forceId): 渲染单个部队
- updateForcePosition(forceId): 更新部队位置
- handleForcesChange(newForceIds, oldForceIds): 处理部队变化
- _calcMatrix(force, opts): 计算模型变换矩阵
```

##### 6.2.4 components/MilitaryMovementController.js
军事移动控制器，负责处理部队的移动动画和路径显示。

```javascript
// 主要功能：
- 控制部队沿路径移动
- 生成并显示移动路径
- 计算移动时间和行动力消耗

// 关键方法：
- moveForce(forceId, path): 移动部队
- showPath(path): 显示路径
- hidePath(): 隐藏路径
```

#### 6.3 交互层 (interaction-layer)

##### 6.3.1 ScreenInteractor.js
屏幕交互器，处理地图上的鼠标和触摸事件。

```javascript
// 主要功能：
- 处理六角格点击和拖拽选择
- 处理部队选择和取消选择
- 支持单选和多选模式

// 关键方法：
- registerEventHandlers(): 注册事件处理器
- handleHexSelection(hexId): 处理六角格选择
- handleForceSelection(forceId): 处理部队选择
```

##### 6.3.2 ScenePanelManager.js
场景面板管理器，作为场景控制面板和场景管理器之间的桥梁。

```javascript
// 主要功能：
- 管理场景控制面板的状态
- 将面板操作转换为场景管理器指令
- 更新场景状态显示

// 关键回调：
- onOrbitModeChange(enabled): 轨道模式切换
- onResetCamera(): 重置相机
- onFocusForce(): 聚焦到选中部队
- onLayerChange(): 切换图层
- onSelectionModeChange(isMultiSelect): 切换选择模式
```

##### 6.3.3 MilitaryPanelManager.js
军事面板管理器，作为军事控制面板和军事管理器之间的桥梁。

```javascript
// 主要功能：
- 管理军事控制面板的状态
- 将面板操作转换为军事管理器指令
- 处理编队的拖放操作
- 格式化部队数据用于显示

// 属性：
- formationList: 格式化的编队列表
- selectedForceInfo: 选中部队的详细信息

// 主要回调：
- onMoveCommand({forceId, path}): 移动命令回调
- onAttackCommand({commandForceId, targetHex, supportForceIds}): 攻击命令回调
- onCreateForceCommand({hexId, faction, composition, formationId}): 创建部队命令回调
- onMergeForcesCommand({hexId, forceIds}): 合并部队命令回调
- onSplitForceCommand({forceId, splitDetails}): 拆分部队命令回调
```

### 7. 组件层 (src/components)

#### 7.1 HUD组件 (hud)

##### 7.1.1 ScenePanel.vue
场景控制面板，提供地图视角和图层控制。

```javascript
// 主要功能：
- 切换地图图层显示
- 控制相机视角和模式
- 提供地图交互选项
- 显示当前游戏回合状态

// 关键组件：
- 图层选择器
- 相机控制按钮
- 选择模式开关
- 回合信息显示
```

##### 7.1.2 MilitaryPanel.vue
军事控制面板，提供军事单位管理和命令下达。

```javascript
// 主要功能：
- 显示和管理编队列表
- 显示选中六角格信息
- 显示选中部队详细信息
- 提供命令下达界面（移动、攻击、创建、合并、拆分）
- 显示战斗群信息

// 关键组件：
- 编队管理器（支持拖放操作）
- 六角格信息显示
- 部队详细信息显示
- 命令输入区域
- 战斗结果显示
```

### 8. 工具函数 (src/utils)

#### 8.1 HexForceMapper.js
六角格与部队的映射关系管理工具。

```javascript
// 主要功能：
- 维护六角格和部队之间的双向映射
- 处理部队移动时的映射更新
- 提供查询接口

// 关键方法：
- initMapping(hexCells, forces): 初始化映射关系
- getForcesByHexId(hexId): 获取六角格上的部队
- getHexByForceId(forceId): 获取部队所在六角格
- moveForceToHex(forceId, newHexId): 移动部队到新六角格
- addForceById(forceId, hexId): 添加部队到六角格
- removeForceById(forceId): 移除部队
```

## 前后端接口文档

### API接口清单

前端通过以下API与后端进行通信：

#### 1. 移动命令

- **请求方法**: POST
- **请求路径**: `/api/command/move`
- **功能描述**: 向指定部队发送移动命令，使其按照指定路径移动

```javascript
// 请求参数
{
  "command_type": "MOVE",
  "force_id": "string",    // 部队ID
  "path": ["string"],     // 路径（六角格ID数组）
  "timestamp": "string",  // ISO日期时间
  "parameters": {
    "estimated_action_points_cost": 35
  }
}

// 响应数据
{
  "status": "success", // 或 "error"
  "data": {
    "final_path": ["string"],  // 最终实际路径
    "action_points_cost": 35,  // 实际行动点消耗
    "force_id": "string"       // 部队ID
  },
  "message": "移动成功"
}
```

#### 2. 进攻命令

- **请求方法**: POST
- **请求路径**: `/api/command/attack`
- **功能描述**: 使指挥部队向目标六角格发动攻击，可指定支援部队

```javascript
// 请求参数
{
  "command_type": "ATTACK",
  "command_force_id": "string",     // 指挥部队ID
  "target_hex": "string",           // 目标六角格ID
  "support_force_ids": ["string"],  // 支援部队ID数组
  "timestamp": "string",
  "parameters": {
    "expected_firepower": {
      "attack": { "land": 300, "sea": 20, "air": 10 },
      "defense": { "land": 200, "sea": 15, "air": 5 }
    }
  }
}

// 响应数据
{
  "status": "success",
  "data": {
    "result": "win",  // 或 "lose"
    "losses": {
      "attacker": 30,  // 攻击方损失
      "defender": 50   // 防御方损失
    },
    "command_force_id": "string",
    "target_hex": "string",
    "support_force_ids": ["string"]
  },
  "message": "进攻成功"
}
```

#### 3. 创建部队命令

- **请求方法**: POST
- **请求路径**: `/api/command/create-force`
- **功能描述**: 在指定六角格创建新部队

```javascript
// 请求参数
{
  "command_type": "CREATE_FORCE",
  "hex_id": "string",           // 六角格ID
  "faction": "string",          // 阵营
  "composition": [],            // 部队组成
  "formation_id": "string",     // 编队ID（可选）
  "timestamp": "string"
}

// 响应数据
{
  "status": "success",
  "data": {
    "force": {
      "force_id": "string",
      "force_name": "新建部队",
      "faction": "string",
      "hex_id": "string",
      "composition": [],
      "combat_attributes": {
        "troop_strength": 100,
        "morale": 100,
        "attack_firepower": { "land": 120, "sea": 10, "air": 0 },
        "defense_firepower": { "land": 85, "sea": 8, "air": 0 }
      }
    },
    "hex_id": "string"
  },
  "message": "部队创建成功"
}
```

#### 4. 合并部队命令

- **请求方法**: POST
- **请求路径**: `/api/command/merge-forces`
- **功能描述**: 合并同一六角格内的多个部队

```javascript
// 请求参数
{
  "command_type": "MERGE_FORCES",
  "hex_id": "string",          // 六角格ID
  "force_ids": ["string"],     // 待合并的部队ID数组
  "timestamp": "string"
}

// 响应数据
{
  "status": "success",
  "data": {
    "new_force": {
      // 新部队数据
    },
    "merged_force_ids": ["string"]
  },
  "message": "部队合并成功"
}
```

#### 5. 拆分部队命令

- **请求方法**: POST
- **请求路径**: `/api/command/split-force`
- **功能描述**: 将一个部队拆分为多个部队

```javascript
// 请求参数
{
  "command_type": "SPLIT_FORCE",
  "force_id": "string",              // 待拆分的部队ID
  "split_details": [                 // 拆分详情
    {
      "new_force_name": "string",
      "composition": []
    }
  ],
  "timestamp": "string"
}

// 响应数据
{
  "status": "success",
  "data": {
    "original_force_id": "string",
    "new_forces": [
      // 新部队数据数组
    ]
  },
  "message": "部队拆分成功"
}
```

## 后端数据库设计

根据前端模型，后端数据库应包含以下主要表：

### 1. unit (兵种表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| unit_id | VARCHAR(64) | 主键，兵种ID |
| unit_name | VARCHAR(255) | 兵种名称 |
| service | VARCHAR(64) | 军种 (LAND/SEA/AIR) |
| category | VARCHAR(64) | 兵种类别 |
| faction_availability | JSON | 可用阵营 |
| attack_power_composition | JSON | 攻击力组成 |
| defense_power_composition | JSON | 防御力组成 |
| visibility_radius | INTEGER | 可视范围 |
| action_point_cost_composition | JSON | 行动点消耗组成 |
| recovery_rate | FLOAT | 恢复速率 |
| command_capability | FLOAT | 指挥能力 |
| command_range | INTEGER | 指挥范围 |
| rendering_key | VARCHAR(255) | 渲染标识 |

### 2. force (部队表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| force_id | VARCHAR(64) | 主键，部队ID |
| force_name | VARCHAR(255) | 部队名称 |
| faction | VARCHAR(64) | 阵营 |
| service | VARCHAR(64) | 军种 |
| hex_id | VARCHAR(64) | 外键，所在六角格ID |
| composition | JSON | 兵种组成 |
| troop_strength | FLOAT | 兵力 (0-100) |
| combat_chance | FLOAT | 战斗机会 |
| action_points | FLOAT | 行动点数 |

### 3. hex_cell (六角格表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| hex_id | VARCHAR(64) | 主键，六角格ID |
| position | JSON | 位置 (包含row、col和points) |
| terrain_attributes | JSON | 地形属性 |
| battlefield_state | JSON | 战场状态 |
| visibility | JSON | 可视状态 |
| additional_info | JSON | 附加信息 |

### 4. formation (编队表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| formation_id | VARCHAR(64) | 主键，编队ID |
| formation_name | VARCHAR(255) | 编队名称 |
| faction | VARCHAR(64) | 阵营 |

### 5. formation_forces (编队-部队关联表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT | 主键，自增ID |
| formation_id | VARCHAR(64) | 外键，关联formation表 |
| force_id | VARCHAR(64) | 外键，关联force表 |

### 6. battlegroup (战斗群表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| battlegroup_id | VARCHAR(64) | 主键，战斗群ID |
| faction | VARCHAR(64) | 阵营 |
| command_force_id | VARCHAR(64) | 外键，指挥部队ID |

### 7. battlegroup_forces (战斗群-部队关联表)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT | 主键，自增ID |
| battlegroup_id | VARCHAR(64) | 外键，关联battlegroup表 |
| force_id | VARCHAR(64) | 外键，关联force表 |

## 后端框架设计

### 技术栈

- **框架**: Spring Boot 2.7.x
- **数据库**: MySQL 8.0 / PostgreSQL 13.x
- **ORM**: Spring Data JPA
- **API文档**: Springdoc OpenAPI (Swagger)
- **安全**: Spring Security (JWT认证)

### 模块划分

1. **Controller层**: 处理HTTP请求，接收前端命令
2. **Service层**: 包含业务逻辑
3. **Repository层**: 数据库访问
4. **Model层**: 数据模型
5. **Config层**: 配置类
6. **Util层**: 工具类

### 后端API实现

后端实现与前端的mock服务对应的实际API，包括：

- `CommandController`: 处理所有命令
  - `/api/command/move`: 处理移动命令
  - `/api/command/attack`: 处理攻击命令
  - `/api/command/create-force`: 处理创建部队命令
  - `/api/command/merge-forces`: 处理合并部队命令
  - `/api/command/split-force`: 处理拆分部队命令

- `ForceController`: 查询部队相关信息
  - `/api/forces`: 获取部队列表
  - `/api/forces/{id}`: 获取特定部队详情

- `HexCellController`: 查询地形相关信息
  - `/api/hexcells`: 获取六角格列表
  - `/api/hexcells/{id}`: 获取特定六角格详情

- `BattleSimulationService`: 战斗模拟业务逻辑
  - 计算攻击结果
  - 更新部队状态

## 系统架构

前后端分离架构：
- 前端: Vue.js + Cesium (3D渲染)
- 后端: Spring Boot RESTful API
- 数据库: MySQL/PostgreSQL

### 数据流向

1. 用户在前端UI操作
2. 前端组件调用相应的PanelManager方法
3. PanelManager调用对应Manager的回调
4. Manager发起API接口请求
5. 后端Controller接收请求
6. 后端Service处理业务逻辑
7. 更新数据库
8. 返回结果给前端
9. 前端更新Store
10. UI组件根据Store状态自动更新

## 项目开发指南

### 当前状态

本项目的 military-layer 模块正在开发中。在前端部分，已完成的功能包括：

- 基本的Cesium地图和地形渲染
- 六角格网格生成和渲染
- 部队数据模型定义和基础操作
- 部队移动和攻击的界面交互
- 回合系统的前端管理

后端部分目前使用mock服务模拟，真实后端实现待开发。

### 开发重点

1. 完成MilitaryManager及其子组件的功能实现
2. 实现军事单位的3D模型加载与渲染
3. 完善部队移动和战斗的动画效果
4. 对接真实后端API
5. 优化UI交互体验

### 注意事项

1. 遵循"数据驱动渲染"原则，所有UI更新都应源于Store状态变化
2. 确保Manager类遵循单例模式，避免重复实例化
3. 3D模型资源应进行适当的预加载和LOD管理，优化性能
4. 军事单位操作应考虑异步处理，使用Promise管理操作流程
5. 保持模块间的松耦合，使用依赖注入和事件机制管理组件通信 