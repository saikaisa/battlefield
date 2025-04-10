# 前端架构设计

## 1. 总体架构

本项目前端采用 Vue3 + Element Plus + Cesium 技术栈，按照系统模块设计文档中的分层结构进行实现。前端架构分为三个主要层次：

1. **基础地理渲染层**：负责地图加载、地形渲染、六角网格绘制和战争迷雾渲染
2. **作战单位渲染与动画层**：负责模型预处理与优化、军事单位放置、动画与状态更新
3. **交互与信息展示层**：负责HUD与控制面板、地图标记与交互、用户交互逻辑

## 2. 目录结构

```
frontend/
├── public/                    # 静态资源
│   ├── models/                # 3D模型文件
│   ├── animations/            # 动画文件
│   ├── terrain/               # DEM地形数据
│   └── images/                # 图片资源
├── src/
│   ├── assets/                # 项目资源文件
│   ├── components/            # 通用组件
│   │   ├── common/            # 公共UI组件
│   │   ├── map/               # 地图相关组件
│   │   ├── units/             # 单位相关组件
│   │   └── hud/               # HUD界面组件
│   ├── views/                 # 页面视图
│   │   ├── MainView.vue       # 主视图
│   │   ├── BattleView.vue     # 战斗视图
│   │   └── SettingsView.vue   # 设置视图
│   ├── layers/                # 分层模块
│   │   ├── geo-render/        # 基础地理渲染层
│   │   ├── unit-render/       # 作战单位渲染与动画层
│   │   └── interaction/       # 交互与信息展示层
│   ├── services/              # 服务层
│   │   ├── api.js             # API接口
│   │   ├── cesium-service.js  # Cesium服务
│   │   └── event-bus.js       # 事件总线
│   ├── utils/                 # 工具函数
│   ├── store/                 # 状态管理(可选)
│   ├── router/                # 路由配置
│   ├── App.vue                # 根组件
│   └── main.js                # 入口文件
├── .env                       # 环境变量
├── package.json               # 项目依赖
└── vite.config.js             # Vite配置
```

## 3. 模块详细设计

### 3.1 基础地理渲染层

#### 3.1.1 地图加载与地形渲染模块

**职责**：加载Cesium地图、配置DEM地形数据、设置基本视图参数

**核心文件**：
- `layers/geo-render/MapInitializer.js` - 地图初始化
- `layers/geo-render/TerrainLoader.js` - 地形数据加载
- `layers/geo-render/ViewerConfig.js` - 视图配置

**关键功能**：
- 初始化Cesium Viewer
- 加载DEM地形数据
- 配置地图投影和坐标系
- 设置初始视角和分辨率

#### 3.1.2 环境与光影效果模块

**职责**：配置光照、阴影、天气/时间效果

**核心文件**：
- `layers/geo-render/LightingManager.js` - 光照管理
- `layers/geo-render/WeatherEffects.js` - 天气效果

**关键功能**：
- 设置光照参数
- 配置阴影效果
- 实现天气变化效果
- 实现昼夜交替效果

#### 3.1.3 六角网格绘制模块

**职责**：在地图上生成规则的六角格，标注各个格子信息

**核心文件**：
- `layers/geo-render/HexGridGenerator.js` - 六角网格生成器
- `layers/geo-render/HexGridRenderer.js` - 六角网格渲染器

**关键功能**：
- 计算六角格坐标
- 生成六角格网格
- 渲染六角格
- 标注六角格信息

#### 3.1.4 战争迷雾渲染模块

**职责**：实现战争迷雾效果，根据部队视野计算可见区域

**核心文件**：
- `layers/geo-render/FogOfWarManager.js` - 战争迷雾管理器
- `layers/geo-render/VisibilityCalculator.js` - 可见性计算器

**关键功能**：
- 计算部队视野范围
- 更新六角格可见性状态
- 渲染战争迷雾效果
- 动态更新迷雾状态

### 3.2 作战单位渲染与动画层

#### 3.2.1 模型预处理与优化模块

**职责**：处理3D模型，实现LOD、多级纹理等优化

**核心文件**：
- `layers/unit-render/ModelOptimizer.js` - 模型优化器
- `layers/unit-render/LODManager.js` - LOD管理器

**关键功能**：
- 实现模型LOD
- 配置多级纹理
- 实现八叉树分块加载
- 优化模型渲染性能

#### 3.2.2 军事单位放置模块

**职责**：将部队模型放置到正确的六角格位置

**核心文件**：
- `layers/unit-render/UnitPlacer.js` - 单位放置器
- `layers/unit-render/UnitVisibilityManager.js` - 单位可见性管理器

**关键功能**：
- 解析部队位置数据
- 将模型放置到六角格
- 管理单位可见性
- 处理单位选中状态

#### 3.2.3 动画与状态更新模块

**职责**：处理部队移动、进攻、受损等动态效果

**核心文件**：
- `layers/unit-render/AnimationController.js` - 动画控制器
- `layers/unit-render/UnitStateManager.js` - 单位状态管理器

**关键功能**：
- 实现部队移动动画
- 实现交战动画
- 实现状态变化动画
- 处理动画过渡效果

### 3.3 交互与信息展示层

#### 3.3.1 HUD与控制面板模块

**职责**：构建用户界面，包括各种控制面板和信息展示

**核心文件**：
- `layers/interaction/HUDManager.vue` - HUD管理器
- `components/hud/ControlPanel.vue` - 控制面板
- `components/hud/UnitInfoPanel.vue` - 单位信息面板
- `components/hud/CommandPanel.vue` - 命令面板

**关键功能**：
- 实现视角控制区
- 实现编队列表
- 实现六角格信息栏
- 实现详细信息栏
- 实现命令下达区
- 实现战斗群列表
- 实现统计列表
- 实现部队管理面板
- 实现兵种管理面板
- 实现规则编辑面板
- 实现战斗日志面板

#### 3.3.2 地图标记与交互模块

**职责**：在地图上绘制选中高亮状态、移动轨迹等

**核心文件**：
- `layers/interaction/MapInteractionManager.js` - 地图交互管理器
- `layers/interaction/SelectionManager.js` - 选择管理器
- `layers/interaction/PathRenderer.js` - 路径渲染器

**关键功能**：
- 实现六角格选中高亮
- 实现移动路径显示
- 实现区域框选
- 实现提示标记

#### 3.3.3 用户交互逻辑模块

**职责**：处理鼠标、触控等事件，调整视角，下达命令

**核心文件**：
- `layers/interaction/InputHandler.js` - 输入处理器
- `layers/interaction/CommandBuilder.js` - 命令构建器
- `layers/interaction/ViewManipulator.js` - 视图操作器

**关键功能**：
- 处理鼠标事件
- 处理触控事件
- 实现视角调整
- 构建命令JSON
- 发送命令到后端

## 4. 状态管理设计

根据项目需求，我们可以使用Vue3的Composition API结合简单的状态管理方案，而不必引入完整的Vuex或Pinia。

**核心文件**：
- `store/index.js` - 状态管理入口
- `store/modules/` - 状态模块目录

**主要状态模块**：
- `hexGrid.js` - 六角格状态
- `units.js` - 单位状态
- `selection.js` - 选择状态
- `commands.js` - 命令状态
- `battle.js` - 战斗状态

## 5. 通信机制

### 5.1 前后端通信

使用Axios进行HTTP请求，与后端RESTful API进行通信。

**核心文件**：
- `services/api.js` - API服务

**主要API**：
- 六角格数据API
- 单位数据API
- 命令执行API
- 战斗结果API

### 5.2 组件间通信

使用Vue3的provide/inject API和简单的事件总线进行组件间通信。

**核心文件**：
- `services/event-bus.js` - 事件总线

**主要事件**：
- 六角格选中事件
- 单位选中事件
- 命令执行事件
- 战斗结果事件

## 6. 性能优化策略

1. **模型优化**：
   - 使用LOD技术减少远处模型的复杂度
   - 使用实例化渲染相同模型
   - 使用纹理压缩减少内存占用

2. **渲染优化**：
   - 只渲染视野内的单位
   - 使用Cesium的地形分块加载
   - 使用WebWorker进行复杂计算

3. **数据优化**：
   - 缓存六角格数据
   - 增量更新单位状态
   - 按需加载模型资源

## 7. 扩展性考虑

1. **模块化设计**：
   - 各层之间通过明确的接口通信
   - 使用依赖注入降低模块耦合

2. **插件机制**：
   - 为关键功能提供插件接口
   - 支持自定义渲染器和交互处理器

3. **配置驱动**：
   - 使用配置文件定义关键参数
   - 支持运行时修改配置
