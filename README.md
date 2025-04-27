# 战场指挥系统

战场指挥系统是一个基于Vue3和Cesium的军事沙盘模拟系统。

## 主要功能

- 六角格地图生成与渲染
- 军事单位建模与渲染
- 战场指挥与控制

## 使用说明

### 命令系统

项目新增了命令系统，用于处理从不同来源接收的指令。命令系统由两部分组成：

1. **CommandService**：提供命令处理的核心功能，包括接收、排队和执行命令
2. **CommandPanel**：UI界面组件，用于上传命令文件或从API拉取命令

#### 命令服务的使用方法

```javascript
// 导入命令服务
import { submitCommand, loadCommandsFromFile, fetchCommandsFromAPI } from '@/services/CommandService';

// 提交单个命令
submitCommand({
  type: 'MOVE',
  params: {
    force_id: 'F_123',
    path: ['hex_1', 'hex_2', 'hex_3']
  }
}).then(result => {
  console.log('命令执行结果:', result);
}).catch(error => {
  console.error('命令执行失败:', error);
});

// 从文件加载命令（在文件输入事件中）
function handleFileChange(event) {
  const file = event.target.files[0];
  if (file) {
    loadCommandsFromFile(file).then(results => {
      console.log('文件命令执行结果:', results);
    });
  }
}

// 从API拉取命令
fetchCommandsFromAPI('https://api.example.com/commands').then(results => {
  console.log('API命令执行结果:', results);
});
```

#### 命令面板的使用方法

将CommandPanel组件添加到您的页面中：

```vue
<template>
  <div>
    <h1>战场指挥中心</h1>
    <CommandPanel />
  </div>
</template>

<script setup>
import CommandPanel from '@/components/CommandPanel.vue';
</script>
```

#### 支持的命令类型

命令系统目前支持以下命令类型：

1. **MOVE**：移动部队

   ```json
   {
     "type": "MOVE",
     "params": {
       "force_id": "F_123",
       "path": ["hex_1", "hex_2", "hex_3"]
     }
   }
   ```
2. **ATTACK**：攻击目标

   ```json
   {
     "type": "ATTACK",
     "params": {
       "command_force_id": "F_123",
       "target_hex": "hex_45",
       "support_force_ids": ["F_456", "F_789"]
     }
   }
   ```
3. **CREATE_FORCE**：创建部队

   ```json
   {
     "type": "CREATE_FORCE",
     "params": {
       "force_name": "第1步兵连",
       "faction": "blue",
       "hex_id": "hex_10",
       "composition": [
         { "unitId": "U_1", "unitCount": 10 },
         { "unitId": "U_2", "unitCount": 5 }
       ]
     }
   }
   ```
4. **MERGE_FORCES**：合并部队

   ```json
   {
     "type": "MERGE_FORCES",
     "params": {
       "force_ids": ["F_111", "F_222"],
       "force_name": "合并部队A",
       "hex_id": "hex_15"
     }
   }
   ```
5. **SPLIT_FORCE**：拆分部队

   ```json
   {
     "type": "SPLIT_FORCE",
     "params": {
       "force_id": "F_123",
       "hex_id": "hex_22",
       "split_details": [
         {
           "new_force_name": "分队A",
           "composition": [{ "unitId": "U_1", "unitCount": 5 }]
         },
         {
           "new_force_name": "分队B",
           "composition": [{ "unitId": "U_2", "unitCount": 5 }]
         }
       ]
     }
   }
   ```
6. **QUERY**：查询信息

   ```json
   {
     "type": "QUERY",
     "params": {
       "query_type": "FORCES",
       "params": {
         "faction": "blue"
       }
     }
   }
   ```

### 命令文件格式

命令文件应为JSON格式，包含一个命令对象数组：

```json
[
  {
    "type": "MOVE",
    "params": {
      "force_id": "F_123",
      "path": ["hex_1", "hex_2", "hex_3"]
    }
  },
  {
    "type": "ATTACK",
    "params": {
      "command_force_id": "F_123",
      "target_hex": "hex_45",
      "support_force_ids": ["F_456", "F_789"]
    }
  }
]
```

## Project setup

```
npm install
```

### Compiles and hot-reloads for development

```
npm run serve
```

### Compiles and minifies for production

```
npm run build
```

### Lints and fixes files

```
npm run lint
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
