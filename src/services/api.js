// src\services\api.js
// eslint-disable-next-line no-unused-vars
import { ApiConfig } from "@/config/GameConfig";
import { MockService } from "./mock";

/**
 * API 接口定义
 * 负责与后端的数据交互，返回标准格式的响应
 * {
 *   status: "success" | "error",
 *   data: any,
 *   message: string
 * }
 */
export const API = {
  /**
   * 移动命令
   * @param {string} forceId 部队ID
   * @param {string[]} path 路径（六角格ID数组）
   */
  move: async (forceId, path) => {
    try {
      const command = {
        command_type: "MOVE",
        force_id: forceId,
        path: path,
        timestamp: new Date().toISOString(),
        parameters: {
          estimated_action_points_cost: 35
        }
      };

      // TODO: 替换为实际的后端 API 调用
      return await MockService.handleMove(command);
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        data: null
      };
    }
  },

  /**
   * 进攻命令
   * @param {string} commandForceId 指挥部队ID
   * @param {string} targetHex 目标六角格ID
   * @param {string[]} supportForceIds 支援部队ID数组
   */
  attack: async (commandForceId, targetHex, supportForceIds) => {
    try {
      const command = {
        command_type: "ATTACK",
        command_force_id: commandForceId,
        target_hex: targetHex,
        support_force_ids: supportForceIds,
        timestamp: new Date().toISOString(),
        parameters: {
          expected_firepower: {
            attack: { land: 300, sea: 20, air: 10 },
            defense: { land: 200, sea: 15, air: 5 }
          }
        }
      };

      // TODO: 替换为实际的后端 API 调用
      return await MockService.handleAttack(command);
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        data: null
      };
    }
  },

  /**
   * 创建部队命令
   * @param {string} hexId 六角格ID
   * @param {string} faction 阵营
   * @param {Array} composition 部队组成
   */
  createForce: async (hexId, faction, composition) => {
    try {
      const command = {
        command_type: "CREATE_FORCE",
        hex_id: hexId,
        faction: faction,
        composition: composition,
        timestamp: new Date().toISOString()
      };

      // TODO: 替换为实际的后端 API 调用
      return await MockService.handleCreateForce(command);
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        data: null
      };
    }
  },

  /**
   * 合并部队命令
   * @param {string} hexId 六角格ID
   * @param {string[]} forceIds 待合并的部队ID数组
   */
  mergeForces: async (hexId, forceIds) => {
    try {
      const command = {
        command_type: "MERGE_FORCES",
        hex_id: hexId,
        force_ids: forceIds,
        timestamp: new Date().toISOString()
      };

      // TODO: 替换为实际的后端 API 调用
      return await MockService.handleMergeForces(command);
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        data: null
      };
    }
  },

  /**
   * 拆分部队命令
   * @param {string} forceId 待拆分的部队ID
   * @param {Array} splitDetails 拆分详情
   */
  splitForce: async (forceId, splitDetails) => {
    try {
      const command = {
        command_type: "SPLIT_FORCE",
        force_id: forceId,
        split_details: splitDetails,
        timestamp: new Date().toISOString()
      };

      // TODO: 替换为实际的后端 API 调用
      return await MockService.handleSplitForce(command);
    } catch (error) {
      return {
        status: "error",
        message: error.message,
        data: null
      };
    }
  }
};