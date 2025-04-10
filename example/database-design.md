# 数据库结构设计

## 1. 总体设计

本项目使用MySQL作为数据库管理系统，设计了一套完整的数据库结构来支持军事模拟系统的各项功能。数据库设计遵循以下原则：

1. **数据完整性**：使用主键、外键和约束确保数据的完整性
2. **性能优化**：合理设计索引，优化查询性能
3. **可扩展性**：预留扩展字段，支持未来功能扩展
4. **数据分类**：将静态数据和动态数据分开存储

数据库主要包含以下几个部分：

1. **地图数据**：存储六角格及地形信息
2. **兵种数据**：存储兵种基本属性和能力
3. **部队数据**：存储部队编制和状态
4. **战斗数据**：存储战斗群和战斗记录
5. **系统数据**：存储系统配置和日志

## 2. 表结构设计

### 2.1 地图数据

#### 2.1.1 六角格表（hex_grid）

存储地图上所有六角格的基本信息和状态。

```sql
CREATE TABLE `hex_grid` (
  `hex_id` VARCHAR(20) NOT NULL COMMENT '六角格唯一标识',
  `longitude` DECIMAL(10, 6) NOT NULL COMMENT '经度',
  `latitude` DECIMAL(10, 6) NOT NULL COMMENT '纬度',
  `height` DECIMAL(10, 2) NOT NULL COMMENT '高度(米)',
  `row` INT NOT NULL COMMENT '行号',
  `col` INT NOT NULL COMMENT '列号',
  `terrain_type` VARCHAR(20) NOT NULL COMMENT '主地形类型',
  `terrain_composition` JSON COMMENT '地形组合结构',
  `elevation` DECIMAL(10, 2) NOT NULL COMMENT '平均高度',
  `passability` JSON NOT NULL COMMENT '可通行性',
  `control_faction` VARCHAR(20) NOT NULL DEFAULT 'neutral' COMMENT '控制方',
  `visible_to` JSON NOT NULL COMMENT '可见性状态',
  `is_objective_point` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为关键点',
  `resource` JSON COMMENT '资源属性',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`hex_id`),
  INDEX `idx_position` (`row`, `col`),
  INDEX `idx_control` (`control_faction`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='六角格数据表';
```

### 2.2 兵种数据

#### 2.2.1 兵种表（unit_type）

存储所有兵种的基本属性和能力。

```sql
CREATE TABLE `unit_type` (
  `unit_type_id` VARCHAR(50) NOT NULL COMMENT '兵种ID',
  `unit_name` VARCHAR(50) NOT NULL COMMENT '兵种名称',
  `service` JSON NOT NULL COMMENT '兵种军种',
  `category` VARCHAR(50) NOT NULL COMMENT '兵种类别',
  `unit_availability` JSON NOT NULL COMMENT '可用阵营',
  `combat_attributes` JSON NOT NULL COMMENT '战斗属性',
  `survival_attributes` JSON NOT NULL COMMENT '生存属性',
  `command_attributes` JSON NOT NULL COMMENT '指挥属性',
  `rendering_attributes` JSON NOT NULL COMMENT '渲染属性',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`unit_type_id`),
  INDEX `idx_category` (`category`),
  INDEX `idx_name` (`unit_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='兵种数据表';
```

### 2.3 部队数据

#### 2.3.1 部队表（force）

存储所有部队的基本信息和当前状态。

```sql
CREATE TABLE `force` (
  `force_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '部队ID',
  `force_name` VARCHAR(100) NOT NULL COMMENT '部队名称',
  `faction` VARCHAR(20) NOT NULL COMMENT '隶属阵营',
  `service` VARCHAR(20) NOT NULL COMMENT '军种类型',
  `hex_id` VARCHAR(20) NOT NULL COMMENT '当前位置',
  `troop_strength` DECIMAL(5, 2) NOT NULL DEFAULT 100 COMMENT '兵力值',
  `morale` DECIMAL(5, 2) NOT NULL DEFAULT 100 COMMENT '士气值',
  `attack_firepower` JSON NOT NULL COMMENT '进攻火力值',
  `defense_firepower` JSON NOT NULL COMMENT '防御火力值',
  `remaining_combat_times` INT NOT NULL DEFAULT 0 COMMENT '剩余战斗次数',
  `fatigue_factor` DECIMAL(3, 2) NOT NULL DEFAULT 1.00 COMMENT '疲劳系数',
  `visibility_radius` INT NOT NULL COMMENT '可视范围',
  `action_points` INT NOT NULL DEFAULT 100 COMMENT '行动力',
  `recovery_rate` DECIMAL(5, 2) NOT NULL COMMENT '兵力值恢复速率',
  `command_capability` DECIMAL(3, 2) NOT NULL COMMENT '指挥能力',
  `command_range` INT NOT NULL COMMENT '指挥范围',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`force_id`),
  INDEX `idx_faction` (`faction`),
  INDEX `idx_location` (`hex_id`),
  INDEX `idx_name` (`force_name`),
  CONSTRAINT `fk_force_hex` FOREIGN KEY (`hex_id`) REFERENCES `hex_grid` (`hex_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部队数据表';
```

#### 2.3.2 部队组成表（force_composition）

存储部队的兵种组成信息。

```sql
CREATE TABLE `force_composition` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `force_id` BIGINT NOT NULL COMMENT '部队ID',
  `unit_type_id` VARCHAR(50) NOT NULL COMMENT '兵种ID',
  `unit_count` INT NOT NULL COMMENT '兵种基数',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_force_unit` (`force_id`, `unit_type_id`),
  CONSTRAINT `fk_composition_force` FOREIGN KEY (`force_id`) REFERENCES `force` (`force_id`),
  CONSTRAINT `fk_composition_unit` FOREIGN KEY (`unit_type_id`) REFERENCES `unit_type` (`unit_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部队组成表';
```

#### 2.3.3 编队表（formation）

存储编队信息，用于管理部队分组。

```sql
CREATE TABLE `formation` (
  `formation_id` VARCHAR(20) NOT NULL COMMENT '编队ID',
  `formation_name` VARCHAR(100) NOT NULL COMMENT '编队名称',
  `faction` VARCHAR(20) NOT NULL COMMENT '隶属阵营',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`formation_id`),
  INDEX `idx_faction` (`faction`),
  INDEX `idx_name` (`formation_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='编队数据表';
```

#### 2.3.4 编队成员表（formation_member）

存储编队中的部队成员信息。

```sql
CREATE TABLE `formation_member` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `formation_id` VARCHAR(20) NOT NULL COMMENT '编队ID',
  `force_id` BIGINT NOT NULL COMMENT '部队ID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_formation_force` (`formation_id`, `force_id`),
  CONSTRAINT `fk_member_formation` FOREIGN KEY (`formation_id`) REFERENCES `formation` (`formation_id`),
  CONSTRAINT `fk_member_force` FOREIGN KEY (`force_id`) REFERENCES `force` (`force_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='编队成员表';
```

### 2.4 战斗数据

#### 2.4.1 战斗群表（battle_group）

存储战斗时临时组成的战斗群信息。

```sql
CREATE TABLE `battle_group` (
  `battlegroup_id` VARCHAR(20) NOT NULL COMMENT '战斗群ID',
  `faction` VARCHAR(20) NOT NULL COMMENT '隶属阵营',
  `command_force_id` BIGINT NOT NULL COMMENT '指挥主体部队ID',
  `joint_attack_firepower` JSON NOT NULL COMMENT '联合攻击火力值',
  `joint_defense_firepower` JSON NOT NULL COMMENT '联合防御火力值',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`battlegroup_id`),
  INDEX `idx_faction` (`faction`),
  INDEX `idx_command` (`command_force_id`),
  CONSTRAINT `fk_battlegroup_force` FOREIGN KEY (`command_force_id`) REFERENCES `force` (`force_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战斗群数据表';
```

#### 2.4.2 战斗群成员表（battle_group_member）

存储战斗群中的部队成员信息。

```sql
CREATE TABLE `battle_group_member` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `battlegroup_id` VARCHAR(20) NOT NULL COMMENT '战斗群ID',
  `force_id` BIGINT NOT NULL COMMENT '部队ID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_battlegroup_force` (`battlegroup_id`, `force_id`),
  CONSTRAINT `fk_bgmember_battlegroup` FOREIGN KEY (`battlegroup_id`) REFERENCES `battle_group` (`battlegroup_id`),
  CONSTRAINT `fk_bgmember_force` FOREIGN KEY (`force_id`) REFERENCES `force` (`force_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战斗群成员表';
```

#### 2.4.3 战斗记录表（battle_log）

存储战斗过程和结果的详细记录。

```sql
CREATE TABLE `battle_log` (
  `battle_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '战斗ID',
  `attacker_battlegroup_id` VARCHAR(20) NOT NULL COMMENT '攻击方战斗群ID',
  `defender_battlegroup_id` VARCHAR(20) NOT NULL COMMENT '防御方战斗群ID',
  `target_hex_id` VARCHAR(20) NOT NULL COMMENT '目标六角格ID',
  `battle_result` VARCHAR(20) NOT NULL COMMENT '战斗结果',
  `attacker_loss` DECIMAL(5, 2) NOT NULL COMMENT '攻击方损失',
  `defender_loss` DECIMAL(5, 2) NOT NULL COMMENT '防御方损失',
  `battle_details` JSON NOT NULL COMMENT '战斗详情',
  `battle_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '战斗时间',
  PRIMARY KEY (`battle_id`),
  INDEX `idx_attacker` (`attacker_battlegroup_id`),
  INDEX `idx_defender` (`defender_battlegroup_id`),
  INDEX `idx_target` (`target_hex_id`),
  INDEX `idx_time` (`battle_time`),
  CONSTRAINT `fk_battle_attacker` FOREIGN KEY (`attacker_battlegroup_id`) REFERENCES `battle_group` (`battlegroup_id`),
  CONSTRAINT `fk_battle_defender` FOREIGN KEY (`defender_battlegroup_id`) REFERENCES `battle_group` (`battlegroup_id`),
  CONSTRAINT `fk_battle_hex` FOREIGN KEY (`target_hex_id`) REFERENCES `hex_grid` (`hex_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战斗记录表';
```

### 2.5 移动数据

#### 2.5.1 移动记录表（movement_log）

存储部队移动的详细记录。

```sql
CREATE TABLE `movement_log` (
  `movement_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '移动ID',
  `force_id` BIGINT NOT NULL COMMENT '部队ID',
  `path` JSON NOT NULL COMMENT '移动路径',
  `action_points_cost` INT NOT NULL COMMENT '行动力消耗',
  `original_path` JSON COMMENT '原始路径',
  `truncated` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否被截断',
  `truncate_reason` VARCHAR(100) COMMENT '截断原因',
  `movement_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '移动时间',
  PRIMARY KEY (`movement_id`),
  INDEX `idx_force` (`force_id`),
  INDEX `idx_time` (`movement_time`),
  CONSTRAINT `fk_movement_force` FOREIGN KEY (`force_id`) REFERENCES `force` (`force_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='移动记录表';
```

### 2.6 系统数据

#### 2.6.1 指令日志表（command_log）

存储所有指令的执行记录。

```sql
CREATE TABLE `command_log` (
  `command_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '指令ID',
  `command_type` VARCHAR(50) NOT NULL COMMENT '指令类型',
  `command_content` JSON NOT NULL COMMENT '指令内容',
  `source` VARCHAR(50) NOT NULL COMMENT '指令来源',
  `status` VARCHAR(20) NOT NULL COMMENT '执行状态',
  `result` JSON COMMENT '执行结果',
  `error_message` TEXT COMMENT '错误信息',
  `command_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '指令时间',
  PRIMARY KEY (`command_id`),
  INDEX `idx_type` (`command_type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_time` (`command_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指令日志表';
```

#### 2.6.2 系统配置表（system_config）

存储系统配置信息。

```sql
CREATE TABLE `system_config` (
  `config_key` VARCHAR(50) NOT NULL COMMENT '配置键',
  `config_value` TEXT NOT NULL COMMENT '配置值',
  `config_desc` VARCHAR(200) COMMENT '配置描述',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
```

## 3. 数据关系图

```
+-------------+       +-------------+       +-------------+
|   hex_grid  |<------| force       |------>| formation   |
+-------------+       +-------------+       +-------------+
                           |                      |
                           |                      |
                           v                      v
                     +-------------+       +-------------+
                     | force_      |       | formation_  |
                     | composition |       | member      |
                     +-------------+       +-------------+
                           |
                           |
                           v
                     +-------------+
                     | unit_type   |
                     +-------------+
                           ^
                           |
                           |
+-------------+       +-------------+       +-------------+
| battle_log  |<------| battle_     |------>| battle_     |
+-------------+       | group       |       | group_member|
                     +-------------+       +-------------+
                                                  |
                                                  |
                                                  v
                                           +-------------+
                                           | force       |
                                           +-------------+
```

## 4. 索引设计

为了提高查询性能，我们为各表设计了以下索引：

### 4.1 六角格表（hex_grid）
- 主键索引：`hex_id`
- 位置索引：`row`, `col`
- 控制方索引：`control_faction`

### 4.2 兵种表（unit_type）
- 主键索引：`unit_type_id`
- 类别索引：`category`
- 名称索引：`unit_name`

### 4.3 部队表（force）
- 主键索引：`force_id`
- 阵营索引：`faction`
- 位置索引：`hex_id`
- 名称索引：`force_name`

### 4.4 编队表（formation）
- 主键索引：`formation_id`
- 阵营索引：`faction`
- 名称索引：`formation_name`

### 4.5 战斗群表（battle_group）
- 主键索引：`battlegroup_id`
- 阵营索引：`faction`
- 指挥部队索引：`command_force_id`

### 4.6 战斗记录表（battle_log）
- 主键索引：`battle_id`
- 攻击方索引：`attacker_battlegroup_id`
- 防御方索引：`defender_battlegroup_id`
- 目标位置索引：`target_hex_id`
- 时间索引：`battle_time`

### 4.7 移动记录表（movement_log）
- 主键索引：`movement_id`
- 部队索引：`force_id`
- 时间索引：`movement_time`

### 4.8 指令日志表（command_log）
- 主键索引：`command_id`
- 类型索引：`command_type`
- 状态索引：`status`
- 时间索引：`command_time`

## 5. 数据初始化

为了系统能够正常运行，需要初始化以下基础数据：

### 5.1 六角格数据

初始化地图上的所有六角格，包括位置、地形类型等信息。

```sql
INSERT INTO `hex_grid` (`hex_id`, `longitude`, `latitude`, `height`, `row`, `col`, `terrain_type`, `terrain_composition`, `elevation`, `passability`, `control_faction`, `visible_to`, `is_objective_point`)
VALUES 
('H0001', 116.407394, 39.904211, 50, 0, 0, 'plain', '{"plain": 1.0}', 50, '{"land": true, "naval": false, "air": true}', 'neutral', '{"blue": false, "red": false}', 0),
('H0002', 116.408394, 39.904211, 55, 0, 1, 'plain', '{"plain": 0.8, "forest": 0.2}', 55, '{"land": true, "naval": false, "air": true}', 'neutral', '{"blue": false, "red": false}', 0),
-- 更多六角格数据...
```

### 5.2 兵种数据

初始化基本兵种，包括步兵、炮兵、坦克等。

```sql
INSERT INTO `unit_type` (`unit_type_id`, `unit_name`, `service`, `category`, `unit_availability`, `combat_attributes`, `survival_attributes`, `command_attributes`, `rendering_attributes`)
VALUES 
('infantry_base', '普通步兵', '["land"]', '步兵', '["blue", "red"]', 
 '{"attack_power": {"base_attack_power": 100, "domain_factor": {"land": 1.0, "sea": 0.5, "air": 0.0}, "terrain_factor": {"plain": 1.0, "mountain": 0.8, "urban": 1.1, "water": 0.0, "forest": 0.9, "desert": 1.0}}, "defense_power": {"base_defense_power": 80, "domain_factor": {"land": 1.0, "sea": 0.6, "air": 0.0}, "terrain_factor": {"plain": 1.0, "mountain": 0.9, "urban": 1.0, "water": 0.0, "forest": 1.0, "desert": 0.95}}}', 
 '{"visibility_radius": 6, "action_point_post": {"base_action_point_cost": 10, "terrain_factor": {"plain": 1.0, "mountain": 1.5, "urban": 1.2, "water": 10000, "forest": 1.3, "desert": 1.1}}, "recovery_rate": 0}', 
 '{"command_capability": 1.0, "command_range": 2}', 
 '{"model_path": "models/infantry.glb", "lod_levels": [{"level": 0, "distance": 0, "model_path": "models/infantry_high.glb"}, {"level": 1, "distance": 1000, "model_path": "models/infantry_mid.glb"}, {"level": 2, "distance": 3000, "model_path": "models/infantry_low.glb"}], "animation_list": [{"animation_name": "walk", "file_path": "animations/infantry_walk.glb"}, {"animation_name": "attack", "file_path": "animations/infantry_attack.glb"}, {"animation_name": "hit", "file_path": "animations/infantry_hit.glb"}, {"animation_name": "die", "file_path": "animations/infantry_die.glb"}]}'),
-- 更多兵种数据...
```

### 5.3 系统配置数据

初始化系统配置，包括战斗规则、回合设置等。

```sql
INSERT INTO `system_config` (`config_key`, `config_value`, `config_desc`)
VALUES 
('battle_rules', '{"random_factor_range": [0.9, 1.1], "min_morale": 50, "max_morale": 100}', '战斗规则配置'),
('turn_settings', '{"max_combat_times": 2, "action_points_recovery": 100}', '回合设置'),
-- 更多配置数据...
```

## 6. 数据库优化策略

### 6.1 查询优化

1. **使用适当的索引**：
   - 为常用查询条件创建索引
   - 避免过度索引，影响写入性能
   - 定期分析索引使用情况

2. **分页查询**：
   - 大数据集使用分页查询
   - 使用索引列进行排序
   - 避免使用OFFSET，使用条件过滤

3. **避免全表扫描**：
   - 使用索引覆盖查询
   - 避免SELECT *，只查询需要的列
   - 使用EXPLAIN分析查询计划

### 6.2 写入优化

1. **批量操作**：
   - 使用批量插入代替单条插入
   - 使用批量更新代替循环更新
   - 使用事务包装批量操作

2. **减少索引**：
   - 大批量写入前禁用索引
   - 写入完成后重建索引
   - 只创建必要的索引

3. **表分区**：
   - 按时间分区日志表
   - 定期归档历史数据
   - 使用分区裁剪提高查询性能

### 6.3 连接优化

1. **连接池配置**：
   - 合理设置连接池大小
   - 设置连接超时时间
   - 定期检测空闲连接

2. **事务管理**：
   - 控制事务大小
   - 避免长事务
   - 使用适当的隔离级别

## 7. 数据安全策略

### 7.1 备份策略

1. **定时备份**：
   - 每日全量备份
   - 每小时增量备份
   - 备份文件异地存储

2. **备份验证**：
   - 定期验证备份有效性
   - 模拟恢复测试
   - 记录备份日志

### 7.2 数据加密

1. **敏感数据加密**：
   - 使用AES加密敏感数据
   - 密钥安全管理
   - 传输数据加密

2. **访问控制**：
   - 最小权限原则
   - 定期审计数据访问
   - 角色权限分离

## 8. 扩展性考虑

1. **字段预留**：
   - 使用JSON类型存储扩展属性
   - 预留扩展字段
   - 版本控制字段

2. **表设计**：
   - 避免过度范式化
   - 适当冗余提高查询性能
   - 使用视图简化复杂查询

3. **分库分表**：
   - 预留分库分表空间
   - 使用中间件支持水平扩展
   - 设计分片键
