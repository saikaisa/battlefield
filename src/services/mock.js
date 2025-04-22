/**
 * 模拟后端数据生成
 * 所有方法返回符合后端 API 格式的 JSON 数据
 */
export const MockService = {
  /**
   * 模拟移动命令的响应
   */
  handleMove: async (command) => {
    await new Promise(r => setTimeout(r, 300));
    console.log('[Mock] move command:', command);

    // 模拟路径校验和截断（遇到可见敌军时）
    let finalPath = [...command.path];
    // TODO: 实现路径校验逻辑

    return {
      status: "success",
      data: {
        final_path: finalPath,
        action_points_cost: 35,
        force_id: command.force_id
      },
      message: "移动成功"
    };
  },

  /**
   * 模拟进攻命令的响应
   */
  handleAttack: async (command) => {
    await new Promise(r => setTimeout(r, 500));
    console.log('[Mock] attack command:', command);

    // 模拟战斗结果计算
    const win = Math.random() > 0.5;
    const losses = {
      attacker: Math.floor(Math.random() * 30),
      defender: Math.floor(Math.random() * 50)
    };

    return {
      status: "success",
      data: {
        result: win ? "win" : "lose",
        losses: losses,
        command_force_id: command.command_force_id,
        target_hex: command.target_hex,
        support_force_ids: command.support_force_ids
      },
      message: win ? "进攻成功" : "进攻失败"
    };
  },

  /**
   * 模拟创建部队命令的响应
   */
  handleCreateForce: async (command) => {
    await new Promise(r => setTimeout(r, 400));
    console.log('[Mock] createForce command:', command);

    // 模拟生成新部队数据
    const newForce = {
      force_id: `F_${Date.now()}`,
      force_name: "新建部队",
      faction: command.faction,
      hex_id: command.hex_id,
      composition: command.composition,
      combat_attributes: {
        troop_strength: 100,
        morale: 100,
        attack_firepower: { land: 120, sea: 10, air: 0 },
        defense_firepower: { land: 85, sea: 8, air: 0 }
      }
    };

    return {
      status: "success",
      data: {
        force: newForce,
        hex_id: command.hex_id
      },
      message: "部队创建成功"
    };
  },

  /**
   * 模拟合并部队命令的响应
   */
  handleMergeForces: async (command) => {
    await new Promise(r => setTimeout(r, 400));
    console.log('[Mock] mergeForces command:', command);

    // 模拟合并后的部队数据
    const newForce = {
      force_id: `F_${Date.now()}`,
      force_name: "合并部队",
      faction: "blue", // 这里应该从原部队数据中获取
      hex_id: command.hex_id,
      composition: [], // 这里应该合并原部队的 composition
      combat_attributes: {
        troop_strength: 100,
        morale: 100,
        attack_firepower: { land: 200, sea: 20, air: 0 },
        defense_firepower: { land: 150, sea: 15, air: 0 }
      }
    };

    return {
      status: "success",
      data: {
        new_force: newForce,
        merged_force_ids: command.force_ids
      },
      message: "部队合并成功"
    };
  },

  /**
   * 模拟拆分部队命令的响应
   */
  handleSplitForce: async (command) => {
    await new Promise(r => setTimeout(r, 400));
    console.log('[Mock] splitForce command:', command);

    // 模拟拆分后的部队数据
    const newForces = command.split_details.map((detail, index) => ({
      force_id: `F_${Date.now()}_${index}`,
      force_name: detail.new_force_name,
      faction: "blue", // 这里应该从原部队数据中获取
      hex_id: command.hex_id,
      composition: detail.composition,
      combat_attributes: {
        troop_strength: 100,
        morale: 100,
        attack_firepower: { land: 60, sea: 5, air: 0 },
        defense_firepower: { land: 40, sea: 4, air: 0 }
      }
    }));

    return {
      status: "success",
      data: {
        original_force_id: command.force_id,
        new_forces: newForces
      },
      message: "部队拆分成功"
    };
  }
};
