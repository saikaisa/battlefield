CREATE DATABASE military_simulation;

USE military_simulation;

-- 六角格表
CREATE TABLE hex_grid (
    hex_id VARCHAR(50) PRIMARY KEY,
    row INT NOT NULL,
    col INT NOT NULL,
    terrain_type VARCHAR(50) NOT NULL,
    elevation DECIMAL(10, 2),
    control_faction VARCHAR(50),
    is_objective_point BOOLEAN DEFAULT FALSE,
    passability JSON,
    visibility JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 兵种表
CREATE TABLE unit_type (
    unit_type_id VARCHAR(50) PRIMARY KEY,
    unit_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    service VARCHAR(50) NOT NULL,
    faction VARCHAR(50) NOT NULL,
    combat_attributes JSON,
    movement_attributes JSON,
    model_info JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 部队表
CREATE TABLE force (
    force_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    force_name VARCHAR(100) NOT NULL,
    faction VARCHAR(50) NOT NULL,
    service VARCHAR(50) NOT NULL,
    hex_id VARCHAR(50),
    troop_strength DECIMAL(10, 2) NOT NULL,
    morale DECIMAL(5, 2) NOT NULL,
    fatigue_factor DECIMAL(5, 2) DEFAULT 0,
    action_points INT DEFAULT 0,
    remaining_combat_times INT DEFAULT 0,
    visibility_radius INT DEFAULT 3,
    command_capability DECIMAL(5, 2) DEFAULT 0,
    attack_firepower JSON,
    defense_firepower JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hex_id) REFERENCES hex_grid(hex_id)
);

-- 部队组成表
CREATE TABLE force_composition (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    force_id BIGINT NOT NULL,
    unit_type_id VARCHAR(50) NOT NULL,
    unit_count INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (force_id) REFERENCES force(force_id),
    FOREIGN KEY (unit_type_id) REFERENCES unit_type(unit_type_id)
);

-- 编队表
CREATE TABLE formation (
    formation_id VARCHAR(50) PRIMARY KEY,
    formation_name VARCHAR(100) NOT NULL,
    faction VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 编队成员表
CREATE TABLE formation_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    formation_id VARCHAR(50) NOT NULL,
    force_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formation_id) REFERENCES formation(formation_id),
    FOREIGN KEY (force_id) REFERENCES force(force_id)
);

-- 战斗群表
CREATE TABLE battle_group (
    battlegroup_id VARCHAR(50) PRIMARY KEY,
    faction VARCHAR(50) NOT NULL,
    command_force_id BIGINT NOT NULL,
    joint_attack_firepower JSON,
    joint_defense_firepower JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (command_force_id) REFERENCES force(force_id)
);

-- 战斗群成员表
CREATE TABLE battle_group_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    battlegroup_id VARCHAR(50) NOT NULL,
    force_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (battlegroup_id) REFERENCES battle_group(battlegroup_id),
    FOREIGN KEY (force_id) REFERENCES force(force_id)
);

-- 战斗记录表
CREATE TABLE battle_log (
    battle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attacker_battlegroup_id VARCHAR(50),
    defender_battlegroup_id VARCHAR(50),
    target_hex_id VARCHAR(50) NOT NULL,
    battle_result VARCHAR(50) NOT NULL,
    attacker_loss DECIMAL(10, 2),
    defender_loss DECIMAL(10, 2),
    battle_details JSON,
    battle_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attacker_battlegroup_id) REFERENCES battle_group(battlegroup_id),
    FOREIGN KEY (defender_battlegroup_id) REFERENCES battle_group(battlegroup_id),
    FOREIGN KEY (target_hex_id) REFERENCES hex_grid(hex_id)
);

-- 移动记录表
CREATE TABLE movement_log (
    movement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    force_id BIGINT NOT NULL,
    path JSON NOT NULL,
    action_points_cost INT NOT NULL,
    original_path JSON,
    truncated BOOLEAN DEFAULT FALSE,
    truncate_reason VARCHAR(255),
    movement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (force_id) REFERENCES force(force_id)
);

-- 指令日志表
CREATE TABLE command_log (
    command_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    command_type VARCHAR(50) NOT NULL,
    parameters JSON NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    result JSON,
    error_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 系统配置表
CREATE TABLE system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_hex_grid_row_col ON hex_grid(row, col);
CREATE INDEX idx_hex_grid_terrain ON hex_grid(terrain_type);
CREATE INDEX idx_hex_grid_control ON hex_grid(control_faction);
CREATE INDEX idx_hex_grid_objective ON hex_grid(is_objective_point);

CREATE INDEX idx_unit_type_category ON unit_type(category);
CREATE INDEX idx_unit_type_service ON unit_type(service);
CREATE INDEX idx_unit_type_faction ON unit_type(faction);
CREATE INDEX idx_unit_type_name ON unit_type(unit_name);

CREATE INDEX idx_force_faction ON force(faction);
CREATE INDEX idx_force_service ON force(service);
CREATE INDEX idx_force_hex_id ON force(hex_id);
CREATE INDEX idx_force_name ON force(force_name);

CREATE INDEX idx_formation_faction ON formation(faction);
CREATE INDEX idx_formation_name ON formation(formation_name);

CREATE INDEX idx_battle_group_faction ON battle_group(faction);
CREATE INDEX idx_battle_group_command ON battle_group(command_force_id);

CREATE INDEX idx_battle_log_target ON battle_log(target_hex_id);
CREATE INDEX idx_battle_log_time ON battle_log(battle_time);

CREATE INDEX idx_movement_log_force ON movement_log(force_id);
CREATE INDEX idx_movement_log_time ON movement_log(movement_time);

CREATE INDEX idx_command_log_type ON command_log(command_type);
CREATE INDEX idx_command_log_source ON command_log(source);
CREATE INDEX idx_command_log_status ON command_log(status);
CREATE INDEX idx_command_log_time ON command_log(created_at);
