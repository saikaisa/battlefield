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
  "timestamp": "", // 时间戳（毫秒），dispatcher收到时分配
  "interval": 0, // 自动模式开启时，该条命令执行完毕到下条命令开始执行的等待间隔（毫秒），值为负数时关闭自动模式
  "source": "UI" // 命令来源："UI"、"API"、"FILE"，dispatcher收到时分配
  "status": "sending" // 命令状态："pending"、"executing"、"failed"、"finished"，dispatcher收到时分配
}
```

* UI界面中，scenePanel和militaryPanel的一切命令都需要以JSON格式走CommandDispatcher的统一解析入口，与"API"/"FILE"命令相同；commandPanel可以直接操作CommandDispatcher，调整命令接收相关功能
* commandPanel中的元素：
  * 命令编辑框：是一个文本框。只有点击了相关按钮才会显示在界面上，用于添加命令和编辑命令队列中已有的命令，同步到消息队列中。
  * 命令队列：
    * 按一定次序显示和执行，这个顺序需要用一个结构维护，在命令面板中可以通过拖动改变命令队列中的顺序
    * 命令队列需要显示命令类型，操作对象，命令来源，优先级和执行间隔，注意这些信息需要转换成中文而不是原英文字符串！可以写一个转换的配置供commandPanel的命令队列调用显示。
    * 不同的命令状态应该有着不同的底色或者标志。
    * 每个条目都有三个按钮：执行、编辑、删除。点击执行按钮立即执行该命令；点击编辑按钮打开命令编辑框，文本框中为该条命令的"基础格式"内容(详见上方命令格式)，提交后将修改后的项替换原命令对应的项；点击删除按钮删除该命令。
  * 添加命令按钮：点击后打开命令编辑框，打开后文本框中显示"基础格式"的模板(详见上方命令格式)。
  * 自动模式按钮：下面会解释。
  * 从文件中拉取命令的按钮：拉取命令给CommandDispatcher加载并解析后自动同步在命令队列中。
  * 从API中拉取命令的按钮：点击后打开一个地址填写框，请求填写的地址。但也有默认值，默认使用GameConfig里的API配置。
  * 过滤器：三个复选框，表示"UI"、"API"、"FILE"是否显示，选中的source会显示在命令队列中，并且自动模式下只执行"API"、"FILE"中复选框选中的source，并且staus是"pending"的指令，两个都选中就都执行，"UI"即使选中了也不自动执行，因为UI是立即执行的，它出现在命令队列里面时永远是"failed"或者"finished"状态。
  * 指令提交后，status改为"executing"状态，此时三个面板全部都无法点击。
* store需要维护
  * 全局状态"autoMode"：commandPanel中有一个按钮可以开关此模式。
  * 指令执行状态"isExecuting"：有任何一条指令执行时（即有指令处于"executing"状态），这个状态为true。
* 面板禁用逻辑：
  * autoMode为true时，除了自动模式按钮，三个panel的所有按钮都不可点击
  * isExecuting为true时，若自动模式处于关闭状态，则包括它和三个panel的所有按钮都不可点击；若自动模式处于打开状态，则除了自动模式按钮，三个panel的所有按钮都不可点击
* 

## 3. 命令分发和执行流程

1. **命令接收**：CommandDispatcher接收来自不同来源的命令，为其按接收到的时间自动分配id、timestamp、source和status
2. **命令校验**：CommandDispatcher对接收到的命令根据命令类型进行基本的格式校验，如各条目的数据类型是否匹配，若未通过校验则丢弃命令，若通过则将命令状态设为"pending"
3. **命令解析**：将命令加入到命令队列；验证命令格式，提取类型和参数
4. **命令分发**：根据命令类型，分发给相应的CommandProcessor处理。若命令source为"UI"且未处于自动模式，则立马分发执行；若正处于自动模式，则"UI"命令失效。自动模式下，根据命令间隔，在每条来自"API"和"FILE"的命令执行完成后依次分发下一条"API"/"FILE"命令
5. **命令执行**：CommandProcessor执行命令，更新系统状态
6. **结果反馈**：CommandProcessor返回执行结果，CommandDispatcher更新命令状态，在屏幕上显示结果，以及在自动模式下继续执行下一条命令等

## 4. 主要命令类型

### 4.1 军事单位命令

- **MOVE**：移动单位到指定位置
- **ATTACK**：攻击指定目标
- **DEFEND**：设置防御状态
- **RETREAT**：撤退到指定位置

### 4.2 场景控制命令

- **ZOOM**：调整视角缩放
- **PAN**：平移视角
- **FOCUS**：聚焦到指定单位或位置

### 4.3 系统管理命令

- **SAVE**：保存当前战场状态
- **LOAD**：加载指定战场状态
- **PAUSE**：暂停模拟
- **RESUME**：恢复模拟

## 5. 接口使用示例

```javascript
// 直接调用方式
import { dispatchCommand } from '@/utils/commands/CommandDispatcher';

// 发送移动命令
dispatchCommand({
  type: 'MOVE',
  target: { unitId: 'unit-123' },
  params: { 
    destination: { latitude: 34.5, longitude: 109.2 },
    speed: 30
  }
});

// 加载命令文件
import { loadCommandsFromFile } from '@/utils/commands/CommandDispatcher';

// 选择文件后调用
function handleFileUpload(file) {
  loadCommandsFromFile(file)
    .then(result => console.log(`成功加载${result.count}条命令`))
    .catch(error => console.error('加载命令失败:', error));
}
```

## 6. 命令执行结果格式

所有命令执行完成后返回统一的结果格式：

```json
{
  "success": true/false,
  "message": "执行结果描述",
  "data": {
    // 可选，命令执行产生的数据
  }
}
```

## 7. 命令示例

### 7.1 切换轨道模式

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ORBIT_MODE",
  "params": {
    "enabled": true
  },
  "source": "ui",
  "status": "pending",
  "timestamp": 1673456789000
}
```

### 7.2 移动部队

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "MOVE",
  "params": {
    "forceId": "force_1",
    "path": ["H_1_1", "H_1_2", "H_1_3"]
  },
  "source": "file",
  "status": "pending",
  "timestamp": 1673456790000
}
```

### 7.3 攻击命令

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "type": "ATTACK",
  "params": {
    "commandForceId": "force_1",
    "targetHex": "H_2_3",
    "supportForceIds": ["force_2", "force_3"]
  },
  "source": "api",
  "status": "pending",
  "timestamp": 1673456791000
}
```

## 8. 批量命令格式

API和文件导入支持批量命令，格式为命令对象数组：

```json
[
  {
    "type": "MOVE",
    "params": { "forceId": "force_1", "path": ["H_1_1", "H_1_2"] }
  },
  {
    "type": "ATTACK",
    "params": { "commandForceId": "force_1", "targetHex": "H_2_3", "supportForceIds": [] }
  }
]
```

## 9. 命令系统API

### 9.1 CommandService API

| 方法                                | 说明             | 参数                                   |
| ----------------------------------- | ---------------- | -------------------------------------- |
| commandService.executeCommand       | 直接执行命令     | type: 命令类型`<br>`params: 命令参数 |
| commandService.executeQueuedCommand | 执行队列中的命令 | commandId: 命令ID                      |
| commandService.clearCommandQueue    | 清空命令队列     | 无                                     |
| loadCommandsFromFile                | 从文件加载命令   | file: File对象                         |
| fetchCommandsFromAPI                | 从API拉取命令    | url: API地址                           |

### 9.2 事件监听

命令系统支持以下事件：

| 事件名            | 说明         | 回调参数            |
| ----------------- | ------------ | ------------------- |
| onCommandExecuted | 命令执行成功 | { command, result } |
| onCommandError    | 命令执行失败 | { command, error }  |
| onCommandQueued   | 命令加入队列 | { command }         |

## 10. 如何扩展新命令

1. 在 `CommandType`中添加新的命令类型常量
2. 在 `CommandProcessor`中实现对应的处理方法
3. 在 `CommandDispatcher._processCommand`中添加对新命令的处理分支

## 11. 最佳实践

1. 组件中优先使用 `commandService`而非直接调用 `CommandDispatcher`
2. 命令参数应该尽量简单，避免复杂对象
3. 命令执行应捕获所有可能的异常并给出友好提示
4. 命令处理过程中应避免修改命令对象本身

---

此文档定义了战场模拟系统的命令格式、类型和处理流程，为开发和扩展提供标准参考。
