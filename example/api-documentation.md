# 前端与后端通信接口文档

本文档详细说明了前端与后端之间的通信接口，包括API路径、请求方法、参数和返回值。

## 基础信息

- 基础URL: `http://localhost:8080/api`
- 所有请求和响应均使用JSON格式
- 认证方式: 暂无认证要求

## 六角格接口

### 获取所有六角格

- 路径: `/hexgrid`
- 方法: `GET`
- 参数: 无
- 返回: 六角格列表

### 根据ID获取六角格

- 路径: `/hexgrid/{hexId}`
- 方法: `GET`
- 参数: 
  - `hexId`: 六角格ID
- 返回: 六角格对象

### 根据行列范围获取六角格

- 路径: `/hexgrid/range`
- 方法: `GET`
- 参数: 
  - `minRow`: 最小行
  - `maxRow`: 最大行
  - `minCol`: 最小列
  - `maxCol`: 最大列
- 返回: 六角格列表

### 根据控制方获取六角格

- 路径: `/hexgrid/faction/{faction}`
- 方法: `GET`
- 参数: 
  - `faction`: 控制方
- 返回: 六角格列表

### 更新六角格控制方

- 路径: `/hexgrid/{hexId}/control`
- 方法: `PUT`
- 参数: 
  - `hexId`: 六角格ID
  - `faction`: 控制方
- 返回: 更新结果

## 兵种接口

### 获取所有兵种

- 路径: `/unittype`
- 方法: `GET`
- 参数: 无
- 返回: 兵种列表

### 根据ID获取兵种

- 路径: `/unittype/{unitTypeId}`
- 方法: `GET`
- 参数: 
  - `unitTypeId`: 兵种ID
- 返回: 兵种对象

### 根据类别获取兵种

- 路径: `/unittype/category/{category}`
- 方法: `GET`
- 参数: 
  - `category`: 兵种类别
- 返回: 兵种列表

### 根据阵营获取可用兵种

- 路径: `/unittype/faction/{faction}`
- 方法: `GET`
- 参数: 
  - `faction`: 阵营
- 返回: 兵种列表

## 部队接口

### 获取所有部队

- 路径: `/force`
- 方法: `GET`
- 参数: 无
- 返回: 部队列表

### 根据ID获取部队

- 路径: `/force/{forceId}`
- 方法: `GET`
- 参数: 
  - `forceId`: 部队ID
- 返回: 部队对象

### 根据阵营获取部队

- 路径: `/force/faction/{faction}`
- 方法: `GET`
- 参数: 
  - `faction`: 阵营
- 返回: 部队列表

### 根据六角格ID获取部队

- 路径: `/force/hex/{hexId}`
- 方法: `GET`
- 参数: 
  - `hexId`: 六角格ID
- 返回: 部队列表

### 创建部队

- 路径: `/force`
- 方法: `POST`
- 参数: 部队对象
- 返回: 创建结果

### 更新部队位置

- 路径: `/force/{forceId}/position`
- 方法: `PUT`
- 参数: 
  - `forceId`: 部队ID
  - `hexId`: 六角格ID
- 返回: 更新结果

### 获取部队组成

- 路径: `/force/{forceId}/composition`
- 方法: `GET`
- 参数: 
  - `forceId`: 部队ID
- 返回: 部队组成列表

### 计算部队战斗力

- 路径: `/force/{forceId}/combatpower`
- 方法: `GET`
- 参数: 
  - `forceId`: 部队ID
- 返回: 战斗力值

## 编队接口

### 获取所有编队

- 路径: `/formation`
- 方法: `GET`
- 参数: 无
- 返回: 编队列表

### 根据ID获取编队

- 路径: `/formation/{formationId}`
- 方法: `GET`
- 参数: 
  - `formationId`: 编队ID
- 返回: 编队对象

### 创建编队

- 路径: `/formation`
- 方法: `POST`
- 参数: 
  - `formationName`: 编队名称
  - `faction`: 阵营
  - `forceIds`: 部队ID列表
- 返回: 创建结果

### 获取编队成员

- 路径: `/formation/{formationId}/members`
- 方法: `GET`
- 参数: 
  - `formationId`: 编队ID
- 返回: 部队列表

### 添加编队成员

- 路径: `/formation/{formationId}/members`
- 方法: `POST`
- 参数: 
  - `formationId`: 编队ID
  - `forceId`: 部队ID
- 返回: 添加结果

## 战斗群接口

### 获取所有战斗群

- 路径: `/battlegroup`
- 方法: `GET`
- 参数: 无
- 返回: 战斗群列表

### 根据ID获取战斗群

- 路径: `/battlegroup/{battlegroupId}`
- 方法: `GET`
- 参数: 
  - `battlegroupId`: 战斗群ID
- 返回: 战斗群对象

### 创建战斗群

- 路径: `/battlegroup`
- 方法: `POST`
- 参数: 
  - `faction`: 阵营
  - `commandForceId`: 指挥部队ID
  - `forceIds`: 部队ID列表
- 返回: 创建结果

### 获取战斗群成员

- 路径: `/battlegroup/{battlegroupId}/members`
- 方法: `GET`
- 参数: 
  - `battlegroupId`: 战斗群ID
- 返回: 部队列表

## 战斗接口

### 执行战斗

- 路径: `/battle/execute`
- 方法: `POST`
- 参数: 
  - `attackerForceId`: 攻击方部队ID
  - `targetHexId`: 目标六角格ID
- 返回: 战斗结果

### 执行战斗群战斗

- 路径: `/battle/execute/group`
- 方法: `POST`
- 参数: 
  - `attackerBattlegroupId`: 攻击方战斗群ID
  - `targetHexId`: 目标六角格ID
- 返回: 战斗结果

### 预测战斗结果

- 路径: `/battle/predict`
- 方法: `GET`
- 参数: 
  - `attackerForceId`: 攻击方部队ID
  - `targetHexId`: 目标六角格ID
- 返回: 预测结果

## 移动接口

### 执行移动

- 路径: `/movement/execute`
- 方法: `POST`
- 参数: 
  - `forceId`: 部队ID
  - `path`: 移动路径
- 返回: 移动结果

### 计算移动路径

- 路径: `/movement/calculate`
- 方法: `GET`
- 参数: 
  - `forceId`: 部队ID
  - `targetHexId`: 目标六角格ID
- 返回: 移动路径

## 指令接口

### 解析并执行指令

- 路径: `/command/execute`
- 方法: `POST`
- 参数: 
  - `commandType`: 指令类型
  - `parameters`: 指令参数
  - `source`: 指令来源
- 返回: 执行结果

### 获取指令记录

- 路径: `/command/{commandId}`
- 方法: `GET`
- 参数: 
  - `commandId`: 指令ID
- 返回: 指令记录

### 获取所有指令记录

- 路径: `/command/logs`
- 方法: `GET`
- 参数: 无
- 返回: 指令记录列表

## 错误处理

所有API都遵循以下错误处理规则：

- 200: 请求成功
- 400: 请求参数错误
- 404: 资源不存在
- 500: 服务器内部错误

错误响应格式：
```json
{
  "error": "错误信息",
  "status": 400,
  "path": "/api/force/1",
  "timestamp": "2025-04-10T10:20:00.000+0000"
}
```

## 数据格式示例

### 六角格对象
```json
{
  "hexId": "r0c0",
  "row": 0,
  "col": 0,
  "terrainType": "平原",
  "elevation": 100.0,
  "controlFaction": "蓝方",
  "isObjectivePoint": false,
  "passability": {
    "infantry": 1.0,
    "armor": 0.8,
    "artillery": 0.6
  },
  "visibility": {
    "red": true,
    "blue": true
  }
}
```

### 兵种对象
```json
{
  "unitTypeId": "infantry_1",
  "unitName": "步兵",
  "category": "infantry",
  "service": "army",
  "faction": "蓝方",
  "combatAttributes": {
    "attackPower": 10.0,
    "defensePower": 8.0,
    "range": 1
  },
  "movementAttributes": {
    "movementPoints": 3,
    "terrainModifiers": {
      "平原": 1.0,
      "山地": 2.0,
      "水域": 3.0
    }
  }
}
```

### 部队对象
```json
{
  "forceId": 1,
  "forceName": "第一步兵连",
  "faction": "蓝方",
  "service": "army",
  "hexId": "r0c0",
  "troopStrength": 100.0,
  "morale": 90.0,
  "fatigueFactor": 0.0,
  "actionPoints": 3,
  "remainingCombatTimes": 1,
  "visibilityRadius": 3,
  "commandCapability": 0.8,
  "attackFirepower": {
    "infantry": 10.0,
    "armor": 5.0,
    "artillery": 2.0
  },
  "defenseFirepower": {
    "infantry": 8.0,
    "armor": 4.0,
    "artillery": 6.0
  }
}
```
