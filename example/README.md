# 军事模拟系统项目说明文档

## 项目概述

本项目是一个基于六角格的军事模拟系统，用于模拟军事单位在地理环境中的部署、移动和战斗。系统采用前后端分离架构，前端使用Vue3 + Element Plus + Cesium实现地图渲染和用户交互，后端使用Spring Boot + MyBatis实现业务逻辑和数据处理，数据库使用MySQL存储系统数据。

## 系统架构

### 前端架构

前端采用三层架构：
1. **基础地理渲染层**：负责地图初始化、六角网格生成和战争迷雾管理
2. **作战单位渲染与动画层**：负责模型优化、单位放置和动画控制
3. **交互与信息展示层**：负责地图交互、信息面板和指令面板管理

### 后端架构

后端采用五个主要模块：
1. **指令解析模块**：负责解析和执行用户指令
2. **兵种与部队管理模块**：负责管理兵种和部队数据
3. **战斗裁决与判定模块**：负责战斗结果计算和战斗记录
4. **移动控制模块**：负责部队移动路径计算和移动执行
5. **数据存储与管理模块**：负责数据持久化和查询

### 数据库结构

数据库包含以下主要表：
- 六角格表（hex_grid）
- 兵种表（unit_type）
- 部队表（force）
- 部队组成表（force_composition）
- 编队表（formation）
- 编队成员表（formation_member）
- 战斗群表（battle_group）
- 战斗群成员表（battle_group_member）
- 战斗记录表（battle_log）
- 移动记录表（movement_log）
- 指令日志表（command_log）
- 系统配置表（system_config）

## 系统功能

1. **六角格地图管理**：生成和管理六角格地图，包括地形、高度和可通行性
2. **兵种管理**：管理不同类型的兵种，包括属性和能力
3. **部队管理**：创建和管理部队，包括部队组成和属性
4. **编队管理**：创建和管理编队，组织多个部队
5. **战斗群管理**：创建和管理战斗群，组织多个部队进行联合作战
6. **战斗模拟**：模拟部队之间的战斗，计算战斗结果
7. **移动控制**：计算和执行部队移动
8. **指令系统**：解析和执行用户指令

## 技术栈

### 前端
- Vue 3
- Element Plus
- Cesium
- Axios
- Vue Router

### 后端
- Spring Boot
- MyBatis
- MySQL

## 部署指南

### 数据库部署
1. 安装MySQL数据库
2. 创建数据库：`CREATE DATABASE military_simulation;`
3. 执行数据库脚本：`mysql -u root -p military_simulation < schema.sql`

### 后端部署
1. 安装JDK 11或更高版本
2. 修改`application.properties`中的数据库连接信息
3. 使用Maven构建项目：`mvn clean package`
4. 运行生成的JAR文件：`java -jar military-simulation-backend.jar`

### 前端部署
1. 安装Node.js
2. 安装依赖：`npm install`
3. 修改`.env`文件中的API地址
4. 构建项目：`npm run build`
5. 将生成的`dist`目录部署到Web服务器

## 使用指南

1. 打开浏览器访问前端地址
2. 使用系统提供的功能进行军事模拟
3. 通过指令面板发送指令
4. 查看模拟结果和战斗记录

## 开发指南

### 前端开发
1. 克隆项目代码
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run serve`
4. 在`src`目录下进行开发

### 后端开发
1. 克隆项目代码
2. 使用IDE（如IntelliJ IDEA）导入项目
3. 配置数据库连接
4. 运行`MilitarySimulationApplication`类启动应用

## 项目结构

```
military-simulation-system/
├── frontend/                  # 前端代码
│   ├── src/
│   │   ├── assets/            # 静态资源
│   │   ├── components/        # 组件
│   │   ├── layers/            # 渲染层
│   │   │   ├── geo-render/    # 地理渲染层
│   │   │   ├── unit-render/   # 单位渲染层
│   │   │   └── interaction/   # 交互层
│   │   ├── services/          # 服务
│   │   ├── store/             # 状态管理
│   │   ├── utils/             # 工具函数
│   │   ├── router/            # 路由
│   │   └── views/             # 页面
│   ├── public/                # 公共资源
│   └── package.json           # 项目配置
├── backend/                   # 后端代码
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/military/simulation/
│   │   │   │   ├── controller/  # 控制器
│   │   │   │   ├── service/     # 服务层
│   │   │   │   ├── repository/  # 仓库接口
│   │   │   │   ├── model/       # 数据模型
│   │   │   │   ├── config/      # 配置类
│   │   │   │   └── util/        # 工具类
│   │   │   └── resources/       # 资源文件
│   │   └── test/                # 测试代码
│   └── pom.xml                  # Maven配置
├── database/                    # 数据库脚本
│   └── schema.sql               # 数据库结构
└── docs/                        # 文档
    ├── frontend-architecture.md # 前端架构文档
    ├── backend-architecture.md  # 后端架构文档
    └── database-design.md       # 数据库设计文档
```

## 注意事项

1. 本系统使用DEM数据进行空间分析和高度分析，确保Cesium能够正确加载DEM数据
2. 系统的战争迷雾渲染和战斗裁决算法是简化实现，可以根据需要进行扩展和优化
3. 前后端通信使用RESTful API，确保API地址配置正确
4. 数据库连接信息需要根据实际环境进行修改

## 扩展与优化

1. 增加更复杂的战斗算法和战术模拟
2. 优化3D模型渲染性能
3. 增加多用户支持和权限管理
4. 增加历史记录和回放功能
5. 优化移动路径算法
6. 增加更多地形类型和天气影响
