# 战场模拟系统命令格式规范

## 1. 命令系统概述

战场模拟系统采用统一的命令机制来处理各种操作，包括场景控制、军事单位操作和系统管理等。命令系统支持三种命令来源：

- **UI模块直接调用**：用户界面触发的命令，立即执行
- **API拉取JSON**：从远程API获取命令集合，加入队列
- **JSON文件导入**：从本地JSON文件导入命令集合，加入队列

命令系统由两个核心组件构成：

- **CommandDispatcher**：命令分发器，负责接收、解析、分发命令，并提供外部接口
- **CommandProcessor**：命令处理器，执行具体命令逻辑

## 2. 命令格式定义

每条命令采用JSON格式，它有两种格式。

```javascript
// 基础格式：作为待发送的命令时的格式
{
  "type": "<COMMAND_TYPE>", // 命令类型，如'MOVE'、'ATTACK'等
  "params": {
    // 命令特定参数，根据type不同而变化
  },
  "interval": 0, // 自动模式开启时，该条命令执行完毕到下条命令开始执行的等待间隔（毫秒），值为负数时关闭自动模式
  "source": "UI" // 命令来源："UI"、"API"、"FILE"、"MANUAL"
}
```

```javascript
// 完整格式：被CommandDispatcher接收后在系统中的格式
{
  "id": "", // 唯一命令ID，dispatcher收到时分配
  "type": "<COMMAND_TYPE>", // 命令类型，如'MOVE'、'ATTACK'等
  "params": {
    // 命令特定参数，根据type不同而变化
  },
  "startTime": 0, // 命令开始执行时间（毫秒）
  "endTime": 0, // 命令结束执行时间（毫秒）
  "interval": 0, // 自动模式开启时，该条命令执行完毕到下条命令开始执行的等待间隔（毫秒），值为负数时关闭自动模式
  "source": "UI", // 命令来源："UI"、"API"、"FILE"、"MANUAL"
  "status": "PENDING" // 命令状态："PENDING"、"EXECUTING"、"FAILED"、"FINISHED"
}
```

## 3. 游戏模式

命令执行会暂时更改游戏模式，通过禁用不必要的操作等方式，确保命令处理和画面渲染正常执行。

不同的模式对 `selectedHexIds` 和 `selectedForceIds` 两个选中标记数组的处理逻辑不同。

**无论处于哪种模式下，以下面板的交互逻辑都是不变的**：

- **编队列表**：始终显示当前阵营的所有编队，始终高亮`selectedForceIds`中最后一个部队的项；如果最后一个部队并不存在当前的编队列表中，则不高亮。
- **六角格详细信息**：始终显示 `selectedHexIds` 中最后一个六角格的信息，若数组为空则不显示。
- **六角格部队列表**：
  - **列表**：始终显示 `selectedHexIds` 中最后一个六角格中的所有部队，若没有部队则为空。
  - **高亮项**：始终高亮`selectedForceIds`中最后一个部队的项；如果最后一个部队并不存在当前的六角格部队列表中，则不高亮。
- **部队详细信息**：始终显示`selectedForceIds`中最后一个部队的信息。

**无论处于哪种模式下，以下高亮显示逻辑都是不变的**：

- 始终使`selectedHexIds`中的六角格处于高亮状态。

> **之后的一些用词的解释**：
>
> - **禁用**：停止鼠标与面板的交互，点击不会有反应。
>
> - **隐藏**：直接使面板不可见，自然也不允许再交互。

### (1) 自由模式

无任何命令执行时激活。

- 所有面板和命令按钮为启用状态。
- 启动鼠标交互的单选模式：可以单选六角格使其加入`selectedHexIds`并高亮。

**选中标记数组的维护规则**：

- 六角格为单选，`selectedHexIds`中只能存在一个元素。
  - 通过鼠标点击选择。
- 部队为单选，`selectedForceIds`中只能存在一个元素。
- `selectedForceIds`中的部队始终在`selectedHexIds`内，不在其内的部队总是会被移除。
- 因此有以下选中部队的方式：
  - 点击编队列表中的部队项，先将`selectedHexIds`切换成部队所在六角格，再将`selectedForceIds`切换成该部队，列表项高亮。
  - 点击六角格部队列表中的部队项，`selectedForceIds`会切换为该部队，列表项高亮。

### (2) 视角操作模式

复位、环绕模式下激活。

- 禁用所有面板的点击操作和所有命令按钮的点击操作（环绕模式下，只有环绕模式按钮可用，以便切换回来）。
- 禁用鼠标交互：禁止鼠标操作地图视角，禁止鼠标对六角格进行选中。
- 命令结束（视角移动完成）后回到自由模式。

**选中标记数组的维护规则**：

- `selectedHexIds`和`selectedForceIds`与进入模式前的内容保持一致，不进行操作。

### (3) 准备模式

从UI中的面板点击相应命令对应的按钮后，进入各命令对应的准备模式。

#### a. 移动命令准备模式

点击移动命令按钮，当前选中六角格为起点，开始选择六角格路径。

- 隐藏编队列表、命令控制面板，禁用六角格部队列表，禁用除移动命令按钮之外的所有按钮。
- 启用鼠标交互的多选模式：可以多选六角格作为路径，但是每一次点击六角格，都需要通过移动命令处理模块的合理性校验才可以选中/取消。
- 移动命令按钮旁边出现一个取消按钮，点击取消按钮后可以退出移动命令准备模式，还原到原来的状态；再次点击移动命令按钮提交命令。
- 提交后进入移动模式，移动命令按钮旁边的取消按钮消失。

**选中标记数组的维护规则**：

- `selectedHexIds`为多选，具体限制由命令内部控制。
- `selectedForceIds`不允许添加新部队，只存放待移动的那支部队。

#### b. 进攻命令准备模式

点击进攻命令按钮，当前选中六角格为指挥部队所在六角格，开始选择支援部队和目标六角格。

- 隐藏编队列表、命令控制面板，禁用除进攻命令按钮之外的所有按钮。注意此处不禁用六角格部队列表。
- 启用鼠标交互的多选模式：可以多选六角格作为支援部队六角格，但是每一次点击六角格，都需要通过进攻命令处理模块的合理性校验才可以选中/取消。
- 进攻命令按钮旁边出现一个取消按钮，点击取消按钮后可以退出进攻命令准备模式，还原到原来的状态；再次点击进攻命令按钮提交命令。
- 提交后进入进攻模式，进攻命令按钮旁边的取消按钮消失。

**选中标记数组的维护规则**：

- `selectedHexIds`为多选，具体限制由命令内部控制。
- `selectedForceIds`无用，通过与六角格部队列表的交互进行改变，单选，与自由模式相同。

### (4) 移动模式

提交移动命令后激活。

- 禁用所有面板的点击操作和所有命令按钮的点击操作。（如果位于自动模式，则不禁用自动模式的按钮）
- 禁用鼠标交互：禁止鼠标对六角格进行选中，但仍然可以移动视角。
- 命令结束（播放完移动动画，或报错等）后，回到自由模式。

**选中标记数组的维护规则**：

- `selectedHexIds`由处理移动的动画控制器控制。
- `selectedForceIds`由处理移动的动画控制器控制（一般保持为正在移动的部队id）。

### (5) 进攻模式

提交攻击命令后激活。

- 禁用所有面板的点击操作和所有命令按钮的点击操作。（如果位于自动模式，则不禁用自动模式的按钮）
- 禁用鼠标交互：禁止鼠标对六角格进行选中，但仍然可以移动视角。
- 命令结束（显示战斗报告点击关闭）后，回到自由模式。

**选中标记数组的维护规则**：

- `selectedHexIds`由处理移动的动画控制器控制。
- `selectedForceIds`无用，具体限制由命令内部控制（一般都清空）。

### (6) 统计模式

点击统计命令后激活。

- 统计命令按钮变成取消按钮。
- 隐藏编队列表、命令控制面板，禁用除取消按钮之外的所有按钮。六角格部队列表不禁用。（如果位于自动模式，则不禁用自动模式的按钮）
- 启用鼠标交互的多选模式。
- 点击取消按钮，回到自由模式。

**选中标记数组的维护规则**：

- `selectedHexIds`为多选。
- `selectedForceIds`的规则与自由模式相同，也保持“`selectedForceIds`中的部队始终在`selectedHexIds`内，不在其内的部队总是会被移除”的关系。

### (7) 部队管理模式

点击部队管理按钮，弹出部队管理面板，显示当前选中六角格内的所有部队，可在该六角格内进行创建、合并、拆分部队操作。

- 禁止点击部队管理面板之外的区域，只能通过面板内的取消按钮退出。

**选中标记数组的维护规则**：

- 若未进行任何操作就退出面板，则`selectedHexIds`和`selectedForceIds`不发生任何变化。
- 若创建/合并部队，则命令结束后，将`selectedHexIds`和`selectedForceIds`设为该部队所在六角格及该部队，便于在下方信息栏中立即看到新部队的信息。
- 若拆分部队，则命令结束后，将`selectedForceIds`设为空，`selectedHexIds`设为这些部队所在六角格。

### (8) 兵种管理模式

点击兵种管理模式按钮，弹出兵种管理面板，进行兵种创建、编辑、删除操作。

- 禁止点击兵种管理面板之外的区域，只能通过面板内的取消按钮退出。

**选中标记数组的维护规则**：

- `selectedHexIds`和`selectedForceIds`不发生任何变化。

### (9) 自动模式

这个模式比较特殊，因为它并不通过UI命令按钮的入口执行命令，所以它不需要在执行移动和进攻命令时进入准备模式，但对于其他模式，其经过的命令处理器仍然为同一个，只不过有一些附加条件：

- 禁用鼠标交互：禁止鼠标对六角格进行选中，但仍然可以移动视角。
- 禁用所有面板，除了自动模式按钮。

**选中标记数组的维护规则**：

- 由自动模式正在执行的指令的模式决定。





## 4. 命令分发和执行流程

这里只说明来自API、文件和手动添加的命令的执行流程。

1. **命令接收**：CommandDispatcher接收来自不同来源的命令（基础格式），将基础格式转化为完整格式并储存。
2. **命令校验**：CommandDispatcher对接收到的命令根据命令类型进行基本的格式校验，如各条目的数据类型是否匹配，若未通过校验则丢弃命令，若通过则将命令状态设为"PENDING"；将命令加入到命令队列。然后分两种情况：
   - **来自API、文件和手动添加的命令**：等待手动或自动模式调用。
   - **来自UI命令**：立即执行。

3. **命令分发**：
   1. 验证命令格式，提取类型和参数；
   2. 根据命令类型，分发给相应的CommandProcessor处理。自动模式下，根据命令间隔，在每条来自选中源的命令执行完成后依次分发同源中的下一条命令。

4. **命令执行**：CommandProcessor执行命令，并根据不同命令，切换成相应模式（禁用/隐藏面板、按钮或鼠标交互）。
5. **结果反馈**：CommandProcessor返回执行结果，CommandDispatcher更新命令状态，在屏幕上显示结果，以及在自动模式下继续执行下一条命令等

## 5. 主要命令类型

### 4.1 军事单位命令

#### 移动部队（MOVE）

1. 自由模式下，选中

```javascript
// command描述：部队 forceId 沿着规划路径 [path] 移动
{
  "type": "MOVE",
  "params": {
    "forceId": string,
    "path": Array<string>
  },
  "interval": 0,
  "source": string
}
// result描述：最后沿着的实际路径 [fixedPath]
{
  "status": string,
  "message": string,
  "data": {
    "fixedPath": Array<string>
  }
}
```

#### 攻击指定目标（ATTACK）

```javascript
// command描述：部队 [commandForceId, supportForceIds] 向处于六角格 targetHex 的部队发起进攻
{
  "type": "ATTACK",
  "params": {
    "commandForceId": string,
    "supportForceIds": Array<string>,
    "targetHex": string
  },
  "interval": 0,
  "source": string
}
// result成功描述：双方战斗群 {attacker, defender} 战斗完成，显示部队变化信息 forceChanges
{
  "status": string,
  "message": string,
  "data": {
    "attacker": {
      "battlegroupId": string,
      "faction": string,
      "commandForceId": string,
      "attackFirepower": number
      "forceChanges": {    // 部队变化
        "surviving": [
          {
            "forceId": string,
            "forceName": string,
            "oldTroopStrength": number,
            "newTroopStrength": number
          },
          //...
        ],
        "eliminated": [
          {
            "forceId": string,
            "forceName": string,
            "oldTroopStrength": number,
            "newTroopStrength": number  // 保留负数，便于计算扣除的兵力值
          },
          //...
        ]
      }
    },
    "defender": {
      "battlegroupId": string,
      "faction": string,
      "defenseFirepower": number,
      "forceChanges": {
        // ...与attacker结构相同
      }
    }
  }
}
```

**下达命令前：**

- 正常状态下，单击某六角格，在六角格信息板的部队列表中选中单个部队，此时攻击按钮可点击。
- 点击攻击按钮后，该选中部队成为指挥部队，进入六角格多选模式。此时以指挥部队为中心，指挥范围为半径，高亮指挥半径中的所有六角格。
- 此时可以在高亮六角格的六角格信息板的部队列表中，对友军部队进行勾选（可多选），作为联合作战部队。

**条件：**

- 

**操作：**

- 创建新部队
- 将新部队加入到命令里规定的编队中
- 为新的部队创建部队实例对象并渲染
- 返回 result

#### 创建部队（CREATE_FORCE）

```javascript
// command描述：阵营 faction 在六角格 hexId 上创建部队 forceName(forceId)
{
  "type": "CREATE_FORCE",
  "params": {
    "forceData": {
      "forceId": null,                 // 部队ID，不能自行填写
      "forceName": string,             // 部队名称
      "faction": string,               // 部队所属阵营
      "hexId": string,                 // 创建部队的六角格ID
      "composition": [                 // 兵种构成与各自数量
        {
          "unitId": string,            // 兵种ID
          "unitCount": number          // 该兵种数量
        },
        // 更多兵种...
      ],
      "troopStrength": number,         // 可选，兵力值，一般为默认
      "combatChance": number,          // 可选，战斗机会，一般为默认
      "actionPoints": number           // 可选，行动力，一般为默认
    }
    "formationId": string              // 可选，指定编队ID，不选则默认
  },
  "interval": 0,
  "source": string
}
// result成功描述：阵营 faction 在六角格 hexId 上创建部队 forceName(forceId)
{
  "status": string,
  "message": string,
  "data": {
    "forceId": string,                 // 新创建的部队ID
    "forceName": string,               // 部队名称
    "hexId": string,                   // 所在六角格ID
    "faction": string                  // 部队阵营
  }
}
```

**条件：**

- 待创建部队所在六角格的隶属方 `control_faction` 不能为敌方，并且 `visible_to` 必须对该阵营可见
- 待创建部队的兵种组成中，各兵种必须是该阵营可用的，并且是同一军种

**操作：**

- 创建新部队
- 将新部队加入到命令里规定的编队中
- 为新的部队创建部队实例对象并渲染
- 返回 result

#### 合并部队（MERGE_FORCES）

```javascript
// command描述：将部队 [forceIds] 合并为一个新部队 newForceName
{
  "type": "MERGE_FORCES",
  "params": {
    "forceIds": Array<string>          // 待合并的各部队ID数组
    "newForceName": string             // 合并后的部队名称
  },
  "interval": 0,
  "source": string
}
// result描述：阵营 faction 合并后的部队 forceName(forceId) 位于六角格 hexId 上
{
  "status": string,
  "message": string,
  "data": {
    "forceId": string,                 // 新创建的部队ID
    "forceName": string,               // 部队名称
    "hexId": string,                   // 所在六角格ID
    "faction": string                  // 部队阵营
  }
}
```

**条件：**

- 待合并部队需要在同一六角格、同一阵营，为同一军种（service）
- 待合并部队的兵力值、战斗机会、行动力需要已满

**操作：**

- 将部队合并到新的部队对象中
- 删除合并前所有部队对象及部队实例对象取消渲染
- 为新的部队对象创建部队实例对象并渲染
- 返回 result

#### 拆分部队（SPLIT_FORCE）

```javascript
// command描述：将一个部队拆分为多个部队
{
  "type": "SPLIT_FORCE",
  "params": {
    "forceId": string,                 // 待拆分的部队ID
    "splitDetails": [                  // 拆分详细信息
      {
        "composition": [               // 第一个新部队的兵种构成
          {
            "unitId": string,
            "unitCount": number
          },
          // 更多兵种...
        ],
        "forceName": string            // 可选，新部队名称
      },
      // 更多新部队...
    ]
  },
  "interval": 0,
  "source": string
}
// result描述：拆分后生成的新部队信息
{
  "status": string,
  "message": string,
  "data": {
    "originalForceId": string,         // 原部队ID
    "newForces": [                     // 新生成的部队列表
      {
        "forceId": string,
        "forceName": string,
        "hexId": string,
        "composition": [
          {
            "unitId": string,
            "unitCount": number
          }
          // 更多兵种...
        ]
      },
      // 更多新部队...
    ]
  }
}
```

#### 创建兵种（CREATE_UNIT）

```javascript
// command描述：创建一个新的兵种类型
{
  "type": "CREATE_UNIT",
  "params": {
    "unitId": string,                  // 兵种ID
    "unitName": string,                // 兵种名称
    "service": Array<string>,          // 服务类型：["land", "sea", "air"]
    "category": string,                // 兵种类别，如"infantry", "armor"等
    "factionAvailability": Array<string>, // 可用阵营
    "attackPowerComposition": {        // 攻击力组成
      "baseAttackPower": number,
      "domainFactor": {
        "land": number,
        "sea": number,
        "air": number
      },
      "terrainFactor": {
        // 地形影响因素，如:
        "plain": number,
        "mountain": number,
        // 更多地形...
      }
    },
    "defensePowerComposition": {       // 防御力组成
      "baseDefensePower": number,
      "domainFactor": {
        "land": number,
        "sea": number,
        "air": number
      },
      "terrainFactor": {
        // 地形影响因素
      }
    },
    "visibilityRadius": number,        // 可视范围
    "actionPointCostComposition": {    // 行动力消耗
      "baseActionPointCost": number,
      "terrainFactor": {
        // 地形影响因素
      }
    },
    "recoveryRate": number,            // 恢复速率
    "commandCapability": number,       // 指挥能力
    "commandRange": number,            // 指挥范围
    "renderingKey": string             // 渲染关键字
  },
  "interval": 0,
  "source": string
}
// result描述：创建的兵种信息
{
  "status": string,
  "message": string,
  "data": {
    "unitId": string,                  // 新创建的兵种ID
    "unitName": string                 // 兵种名称
  }
}
```

#### 修改兵种（MODIFY_UNIT）

```javascript
// command描述：修改现有兵种的属性
{
  "type": "MODIFY_UNIT",
  "params": {
    "unitId": string,                  // 要修改的兵种ID
    "changes": {                       // 要修改的属性及其新值
      // 只包含需要修改的属性，不需要包含所有属性
      "unitName": string,              // 可选，修改名称
      "attackPowerComposition": {      // 可选，修改攻击力
        "baseAttackPower": number
        // 其他可修改的攻击力属性...
      },
      "defensePowerComposition": {     // 可选，修改防御力
        "baseDefensePower": number
        // 其他可修改的防御力属性...
      }
      // 其他可修改的属性...
    }
  },
  "interval": 0,
  "source": string
}
// result描述：修改后的兵种信息
{
  "status": string,
  "message": string,
  "data": {
    "unitId": string,                  // 修改的兵种ID
    "changes": Object                  // 成功修改的属性及其新值
  }
}
```

#### 删除兵种（DELETE_UNIT）

```javascript
// command描述：删除指定的兵种
{
  "type": "DELETE_UNIT",
  "params": {
    "unitId": string                   // 要删除的兵种ID
  },
  "interval": 0,
  "source": string
}
// result描述：删除操作结果
{
  "status": string,
  "message": string,
  "data": {
    "unitId": string,                  // 被删除的兵种ID
    "unitName": string                 // 被删除的兵种名称
  }
}
```

### 4.2 场景控制命令

#### 切换轨道模式（ORBIT_MODE）

```javascript
// command描述：启用或禁用相机轨道模式
{
  "type": "ORBIT_MODE",
  "params": {
    "enabled": boolean                 // true启用，false禁用
  },
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": {
    "enabled": boolean                 // 当前轨道模式状态
  }
}
```

#### 重置相机（RESET_CAMERA）

```javascript
// command描述：将相机重置到初始位置
{
  "type": "RESET_CAMERA",
  "params": {},                        // 无需参数
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": null
}
```

#### 聚焦部队（FOCUS_FORCE）

```javascript
// command描述：将相机聚焦到选中的部队
{
  "type": "FOCUS_FORCE",
  "params": {},                        // 无需参数，使用当前选中的部队
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": {
    "forceId": string,                 // 聚焦的部队ID
    "hexId": string                    // 部队所在的六角格ID
  }
}
```

#### 切换图层（CHANGE_LAYER）

```javascript
// command描述：切换场景显示图层
{
  "type": "CHANGE_LAYER",
  "params": {
    "layerIndex": number               // 图层索引
  },
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": {
    "layerIndex": number               // 当前激活的图层索引
  }
}
```

#### 设置选择模式（SELECTION_MODE）

```javascript
// command描述：设置选择模式为单选或多选
{
  "type": "SELECTION_MODE",
  "params": {
    "isMultiSelect": boolean           // true多选，false单选
  },
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": {
    "isMultiSelect": boolean           // 当前选择模式
  }
}
```

#### 切换到下一个阵营（NEXT_FACTION）

```javascript
// command描述：结束当前回合，切换到下一个阵营
{
  "type": "NEXT_FACTION",
  "params": {},                        // 无需参数
  "interval": 0,
  "source": string
}
// result描述：操作结果
{
  "status": string,
  "message": string,
  "data": {
    "faction": string,                 // 当前激活的阵营
    "round": number                    // 当前回合数
  }
}
```

## 6. 批量命令格式

API和文件导入支持批量命令，格式为命令对象数组：

```javascript
[
  {
    "type": "MOVE",
    "params": { "forceId": "F_1", "path": ["H_1_1", "H_1_2"] },
    "interval": 1000
  },
  {
    "type": "ATTACK",
    "params": { "commandForceId": "F_1", "targetHex": "H_2_3", "supportForceIds": [] },
    "interval": 1000
  }
]
```

## 7. 命令系统API

### 7.1 CommandService API

| 方法                                   | 说明             | 参数                                    |
| -------------------------------------- | ---------------- | --------------------------------------- |
| commandService.executeCommandFromUI    | 直接执行命令     | type: 命令类型<br>params: 命令参数     |
| commandService.executeQueuedCommand    | 执行队列中的命令 | commandId: 命令ID                       |
| commandService.loadCommandsFromFile    | 从文件加载命令   | file: File对象                          |
| commandService.loadCommandsFromAPI     | 从API拉取命令    | url: API地址                            |
| commandService.startAutoMode           | 开启自动模式     | 无                                      |
| commandService.stopAutoMode            | 停止自动模式     | 无                                      |
| commandService.toggleAutoMode          | 切换自动模式     | enable: 是否启用                        |

## 8. 面板

### 1 编队列表 （左上，固定宽 ≈ 320 px，垂直滚动）

- 顶栏：
  - 标题：`编队列表`
  - 左侧："+"图标（使用我自带的图片）
  - 右侧：删除图标（使用我自带的图片）
- 列表区（`overflow-y: auto`）
  - *一级条目* ＝编队
    - 左侧三角：展开 / 折叠 `<transition-group>`
    - 文本：<编队名>
    - 条目点击：展开
  - *二级条目* ＝部队
    - 左侧竖色条（军种色：陆=绿，海=蓝，空=红 ）
    - 文字：`部队名称 所在六角格`（例 `空军战斗机队 (H_25_12)`）
    - 单击 → 选中，点击规则与部队列表一致（同步 `selectedForceIds`）
    - 双击 → 相机直接飞至该部队所在六角格
- 当滚动过长：自带滚动条，仅列表区滚动，顶栏固定

### 2 命令管理面板 （编队列表正下方）

- 样式：浅棕卡片，宽度可调整，最窄和最宽都有限制范围，最宽不能碰到底部信息栏

- **顶栏**：标题

- **顶栏下方一行区域**

  1. Switch：`自动模式`（左侧文字）
  2. “清空列表”超链接按钮（右对齐）

- **四按钮（占一行）**：

  1. `执行` (蓝)
  2. `编辑` (黄)
  3. `删除` (红)
  4. `新增` (绿，下拉箭头)
     - 三个选项：`手动添加` `从API获取` `从文件导入`

- **Tab 行： 2 个**

  - `命令队列` (默认)
  - `命令历史`

- **主体区域 (Tab-content)**

  - *命令队列页* （第一张图）

    1. “来源选择”三个单选按钮组：`API` `文件` `手动`
    2. 表头：`类型` `描述` `间隔(ms)` `（空，留空间放拖拽把手）`
    3. 行示例：
       - `MOVE` `部队 {forceId} 移动至 …` `500` `（把手图标）`
       - `CREATE_FORCE` `创建部队 {forceName}` `停止`(等于 -1) `（把手图标）`

  - *命令历史页* （第二张图）

    > 切到这个tab时，上方的`执行` `编辑` `删除`按钮变灰不可用。

    1. “来源选择”四个多选按钮组：`UI` `API` `文件` `手动`
    2. 表头：`类型` `结果信息` `执行时间` `来源`
    3. 行示例：
       - `ATTACK` `部队 {id} 攻击 …` `13827 ms` `UI`
       - `CHANGE_MODE` `命令格式错误` `未完成` `文件`

- 面板外，左下角有一个小圆按钮，点击可以收起（隐藏）这个面板。

------

### 3 底部详细信息栏

1. **六角格 & 部队复合面板** （底部中央，全宽，高度 ≈ 240 px），从左至右分别为：

   1. **六角格详细信息** （最左，宽 ≈ 260 px，固定）
      - ID、位置（经纬度）、地形类型(含高程)、可通行军种、控制方(含部队数) 各一行
   2. **六角格部队列表** （中间，可滚动）
      - 表头：`编号（去除F_前缀）  名称  兵力  行动力`
      - 行点击：同步 `selectedForceIds`；行高亮切换
   3. **部队详细信息** （右侧，水平再切两栏）
      - **属性子栏** （左半）
        - 8 条：战斗机会数、进/防火力、回复速率、士气、疲劳、指挥力、指挥范围、可视范围
      - **兵种组成子栏** （右半，可滚动）
        - `兵种名 | 数量` 列表
      - 两子栏 title：用 Tabs 或标题分隔 `属性` / `兵种组成`

2. **战斗命令栏**（靠在复合面板最右侧，垂直方向排列，四枚圆形纯图标按钮，从上到下）

   - `移动`
   - `进攻`
   - `部队管理`
   - `兵种管理`

   > 注：按钮激活态用填色或描边高亮；禁用态灰掉 (`pointer-events:none; opacity:.4`)

------

### 4 总览区

1. **总览面板** （右下角，宽 ≈ 260 px，高 ≈ 220 px）

   - **顶部**：`第 N 回合   <当前阵营(蓝/红)>    XX游戏模式`
   - **信息框** （textarea 风格，`readonly`, `overflow-y: auto`）：将MessageBox的内容都显示到这里
     - 报错 / 执行反馈 / 统计结果等

2. **工具命令栏** （总览面板左侧，4 枚，垂直方向排列，从上到下）

   - `复位`  
   - `环绕视角` 
   - `统计模式` 
   - `切换图层` 

   > 注：按钮激活态用填色或描边高亮；禁用态灰掉 (`pointer-events:none; opacity:.4`)

------

### 5 两类弹窗（模态，遮罩背景，在图中未显示）

1. **部队管理弹窗** (`<Dialog width≈600px>`，三页 Tab)
   - *Tab 1 创建*
     - 左：下拉选当前阵营可用兵种，添加到右侧`已选兵种表`
     - 右：表格列 `兵种名 | 数量(±)`
     - 下：部队名称输入框 + “创建”按钮 + “取消”
   - *Tab 2 合并*
     - 上：多选当前六角格部队列表 → 右侧实时预览“合并后属性”
     - 下：新部队名称输入 + “确认合并” / “取消”
   - *Tab 3 拆分*
     - 左：原部队兵种表（数量可减）
     - 右：新部队预览区（可新增部队面板）
     - 尾：每个新部队命名 + “确认拆分” / “取消”
2. **兵种管理弹窗** (`<Dialog width≈720px>`)
   - **主界面**
     - 左侧列表：当前阵营全部兵种，行内 `编辑 ✎` `删除 🗑`
     - 右侧属性只读面板：详细字段（攻击係数、防御係数、基础消耗…）
     - 底部：`新增兵种` 按钮
   - **编辑/新增界面（共用表单组件）**
     - 字段：兵种名、服务军种、可用阵营、基础攻击、防御、行动力消耗、可用地形係数表…
     - “保存 / 取消” 两按钮
     - 若来自“新增”则置空默认；“编辑”则填默认值

------

### 6 其他参考

- **鼠标模式切换** 用 `ScreenInteractor.setMode('single' | 'multi' | 'disabled')`
- **模式护栏**：进入非自由模式时，及时调用相关状态切换
- **高亮维护**：渲染层实时监视 `selectedHexIds`，若数组变则刷新交互层。
- **命令按钮状态**：根据当前 `GameMode` 状态自动 `:disabled`。
- **滚动容器**：所有列表都 `max-height` + `overflow-y: auto`，标题/底栏固定。
