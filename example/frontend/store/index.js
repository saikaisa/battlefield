import { reactive } from 'vue';
import { createStore } from 'vuex';

/**
 * 创建Vuex状态管理存储
 * @param {Object} apiService - API服务实例
 * @returns {Store} Vuex存储实例
 */
export function createAppStore(apiService) {
  return createStore({
    state() {
      return {
        // 系统状态
        system: {
          currentFaction: 'blue',
          currentTurn: 1,
          gameStatus: 'running',
          objectives: []
        },
        
        // 地图状态
        map: {
          hexGridLoaded: false,
          selectedHexId: null,
          hoveredHexId: null,
          visibleHexes: {
            blue: [],
            red: []
          }
        },
        
        // 部队状态
        forces: {
          items: {},
          selectedForceId: null,
          selectedForces: []
        },
        
        // 战斗群状态
        battlegroups: {
          items: {}
        },
        
        // 编队状态
        formations: {
          items: {}
        },
        
        // 交互状态
        interaction: {
          mode: 'normal',
          pathHexes: []
        },
        
        // 面板状态
        panels: {
          hexInfoVisible: false,
          forceInfoVisible: false,
          battleInfoVisible: false,
          systemInfoVisible: true,
          commandPanelVisible: true
        },
        
        // 加载状态
        loading: {
          isLoading: false,
          loadingMessage: ''
        },
        
        // 通知状态
        notification: {
          messages: []
        }
      };
    },
    
    mutations: {
      // 系统状态变更
      SET_CURRENT_FACTION(state, faction) {
        state.system.currentFaction = faction;
      },
      
      SET_CURRENT_TURN(state, turn) {
        state.system.currentTurn = turn;
      },
      
      SET_GAME_STATUS(state, status) {
        state.system.gameStatus = status;
      },
      
      SET_OBJECTIVES(state, objectives) {
        state.system.objectives = objectives;
      },
      
      // 地图状态变更
      SET_HEX_GRID_LOADED(state, loaded) {
        state.map.hexGridLoaded = loaded;
      },
      
      SET_SELECTED_HEX(state, hexId) {
        state.map.selectedHexId = hexId;
      },
      
      SET_HOVERED_HEX(state, hexId) {
        state.map.hoveredHexId = hexId;
      },
      
      SET_VISIBLE_HEXES(state, { faction, hexes }) {
        state.map.visibleHexes[faction] = hexes;
      },
      
      // 部队状态变更
      SET_FORCES(state, forces) {
        state.forces.items = forces;
      },
      
      ADD_FORCE(state, force) {
        state.forces.items[force.force_id] = force;
      },
      
      UPDATE_FORCE(state, force) {
        state.forces.items[force.force_id] = {
          ...state.forces.items[force.force_id],
          ...force
        };
      },
      
      REMOVE_FORCE(state, forceId) {
        delete state.forces.items[forceId];
      },
      
      SET_SELECTED_FORCE(state, forceId) {
        state.forces.selectedForceId = forceId;
      },
      
      SET_SELECTED_FORCES(state, forceIds) {
        state.forces.selectedForces = forceIds;
      },
      
      // 战斗群状态变更
      SET_BATTLEGROUPS(state, battlegroups) {
        state.battlegroups.items = battlegroups;
      },
      
      ADD_BATTLEGROUP(state, battlegroup) {
        state.battlegroups.items[battlegroup.battlegroup_id] = battlegroup;
      },
      
      UPDATE_BATTLEGROUP(state, battlegroup) {
        state.battlegroups.items[battlegroup.battlegroup_id] = {
          ...state.battlegroups.items[battlegroup.battlegroup_id],
          ...battlegroup
        };
      },
      
      REMOVE_BATTLEGROUP(state, battlegroupId) {
        delete state.battlegroups.items[battlegroupId];
      },
      
      // 编队状态变更
      SET_FORMATIONS(state, formations) {
        state.formations.items = formations;
      },
      
      ADD_FORMATION(state, formation) {
        state.formations.items[formation.formation_id] = formation;
      },
      
      UPDATE_FORMATION(state, formation) {
        state.formations.items[formation.formation_id] = {
          ...state.formations.items[formation.formation_id],
          ...formation
        };
      },
      
      REMOVE_FORMATION(state, formationId) {
        delete state.formations.items[formationId];
      },
      
      // 交互状态变更
      SET_INTERACTION_MODE(state, mode) {
        state.interaction.mode = mode;
      },
      
      SET_PATH_HEXES(state, hexes) {
        state.interaction.pathHexes = hexes;
      },
      
      // 面板状态变更
      SET_PANEL_VISIBILITY(state, { panel, visible }) {
        state.panels[`${panel}Visible`] = visible;
      },
      
      // 加载状态变更
      SET_LOADING(state, { isLoading, message = '' }) {
        state.loading.isLoading = isLoading;
        state.loading.loadingMessage = message;
      },
      
      // 通知状态变更
      ADD_NOTIFICATION(state, message) {
        state.notification.messages.push({
          id: Date.now(),
          text: message,
          read: false,
          time: new Date().toLocaleTimeString()
        });
      },
      
      MARK_NOTIFICATION_READ(state, id) {
        const message = state.notification.messages.find(msg => msg.id === id);
        if (message) {
          message.read = true;
        }
      },
      
      CLEAR_NOTIFICATIONS(state) {
        state.notification.messages = [];
      }
    },
    
    actions: {
      // 初始化游戏
      async initializeGame({ commit, dispatch }) {
        commit('SET_LOADING', { isLoading: true, message: '初始化游戏...' });
        
        try {
          // 加载六角格数据
          await dispatch('loadHexGrid');
          
          // 加载部队数据
          await dispatch('loadForces');
          
          // 加载战斗群数据
          await dispatch('loadBattlegroups');
          
          // 加载编队数据
          await dispatch('loadFormations');
          
          // 加载目标点数据
          await dispatch('loadObjectives');
          
          commit('ADD_NOTIFICATION', '游戏初始化完成');
        } catch (error) {
          console.error('初始化游戏失败:', error);
          commit('ADD_NOTIFICATION', `初始化游戏失败: ${error.message}`);
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 加载六角格数据
      async loadHexGrid({ commit }) {
        try {
          const hexGrid = await apiService.getHexGrid();
          
          // 更新六角格加载状态
          commit('SET_HEX_GRID_LOADED', true);
          
          return hexGrid;
        } catch (error) {
          console.error('加载六角格数据失败:', error);
          commit('ADD_NOTIFICATION', `加载六角格数据失败: ${error.message}`);
          throw error;
        }
      },
      
      // 加载部队数据
      async loadForces({ commit }) {
        try {
          const forces = await apiService.getForces();
          
          // 更新部队数据
          commit('SET_FORCES', forces);
          
          return forces;
        } catch (error) {
          console.error('加载部队数据失败:', error);
          commit('ADD_NOTIFICATION', `加载部队数据失败: ${error.message}`);
          throw error;
        }
      },
      
      // 加载战斗群数据
      async loadBattlegroups({ commit }) {
        try {
          const battlegroups = await apiService.getBattlegroups();
          
          // 更新战斗群数据
          commit('SET_BATTLEGROUPS', battlegroups);
          
          return battlegroups;
        } catch (error) {
          console.error('加载战斗群数据失败:', error);
          commit('ADD_NOTIFICATION', `加载战斗群数据失败: ${error.message}`);
          throw error;
        }
      },
      
      // 加载编队数据
      async loadFormations({ commit }) {
        try {
          const formations = await apiService.getFormations();
          
          // 更新编队数据
          commit('SET_FORMATIONS', formations);
          
          return formations;
        } catch (error) {
          console.error('加载编队数据失败:', error);
          commit('ADD_NOTIFICATION', `加载编队数据失败: ${error.message}`);
          throw error;
        }
      },
      
      // 加载目标点数据
      async loadObjectives({ commit }) {
        try {
          const objectives = await apiService.getObjectives();
          
          // 更新目标点数据
          commit('SET_OBJECTIVES', objectives);
          
          return objectives;
        } catch (error) {
          console.error('加载目标点数据失败:', error);
          commit('ADD_NOTIFICATION', `加载目标点数据失败: ${error.message}`);
          throw error;
        }
      },
      
      // 执行移动指令
      async executeMove({ commit }, { forceId, path }) {
        commit('SET_LOADING', { isLoading: true, message: '执行移动指令...' });
        
        try {
          const result = await apiService.executeCommand('move', { forceId, path });
          
          if (result.success) {
            // 更新部队位置
            commit('UPDATE_FORCE', {
              force_id: forceId,
              hex_id: path[path.length - 1]
            });
            
            commit('ADD_NOTIFICATION', `部队 ${forceId} 移动成功`);
          } else {
            commit('ADD_NOTIFICATION', `部队 ${forceId} 移动失败: ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error('执行移动指令失败:', error);
          commit('ADD_NOTIFICATION', `执行移动指令失败: ${error.message}`);
          throw error;
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 执行攻击指令
      async executeAttack({ commit }, { attackerForceId, targetHexId }) {
        commit('SET_LOADING', { isLoading: true, message: '执行攻击指令...' });
        
        try {
          const result = await apiService.executeCommand('attack', { attackerForceId, targetHexId });
          
          if (result.success) {
            // 更新部队状态
            if (result.battleResult) {
              // 更新攻击方
              if (result.battleResult.attacker_loss) {
                const attackerForce = await apiService.getForce(attackerForceId);
                commit('UPDATE_FORCE', attackerForce);
              }
              
              // 更新防御方
              if (result.battleResult.defender_forces) {
                result.battleResult.defender_forces.forEach(async (defenderId) => {
                  const defenderForce = await apiService.getForce(defenderId);
                  if (defenderForce) {
                    commit('UPDATE_FORCE', defenderForce);
                  }
                });
              }
            }
            
            commit('ADD_NOTIFICATION', `部队 ${attackerForceId} 攻击成功`);
          } else {
            commit('ADD_NOTIFICATION', `部队 ${attackerForceId} 攻击失败: ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error('执行攻击指令失败:', error);
          commit('ADD_NOTIFICATION', `执行攻击指令失败: ${error.message}`);
          throw error;
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 执行组建战斗群指令
      async executeFormBattlegroup({ commit }, { forceIds, commandForceId }) {
        commit('SET_LOADING', { isLoading: true, message: '组建战斗群...' });
        
        try {
          const result = await apiService.executeCommand('form_battlegroup', { forceIds, commandForceId });
          
          if (result.success) {
            // 加载新的战斗群数据
            const battlegroup = await apiService.getBattlegroup(result.battlegroupId);
            commit('ADD_BATTLEGROUP', battlegroup);
            
            commit('ADD_NOTIFICATION', `战斗群 ${result.battlegroupId} 组建成功`);
          } else {
            commit('ADD_NOTIFICATION', `组建战斗群失败: ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error('执行组建战斗群指令失败:', error);
          commit('ADD_NOTIFICATION', `执行组建战斗群指令失败: ${error.message}`);
          throw error;
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 执行编组指令
      async executeFormFormation({ commit }, { forceIds, formationName }) {
        commit('SET_LOADING', { isLoading: true, message: '执行编组...' });
        
        try {
          const result = await apiService.executeCommand('form_formation', { forceIds, formationName });
          
          if (result.success) {
            // 加载新的编队数据
            const formation = await apiService.getFormation(result.formationId);
            commit('ADD_FORMATION', formation);
            
            commit('ADD_NOTIFICATION', `编队 ${formationName} 创建成功`);
          } else {
            commit('ADD_NOTIFICATION', `编组失败: ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error('执行编组指令失败:', error);
          commit('ADD_NOTIFICATION', `执行编组指令失败: ${error.message}`);
          throw error;
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 执行结束回合指令
      async executeEndTurn({ commit }) {
        commit('SET_LOADING', { isLoading: true, message: '结束回合...' });
        
        try {
          const result = await apiService.executeCommand('end_turn', {});
          
          if (result.success) {
            // 更新回合和阵营
            commit('SET_CURRENT_TURN', result.currentTurn);
            commit('SET_CURRENT_FACTION', result.currentFaction);
            
            // 重新加载部队数据
            await dispatch('loadForces');
            
            commit('ADD_NOTIFICATION', `回合 ${result.currentTurn - 1} 结束，当前阵营: ${result.currentFaction}`);
          } else {
            commit('ADD_NOTIFICATION', `结束回合失败: ${result.error}`);
          }
          
          return result;
        } catch (error) {
          console.error('执行结束回合指令失败:', error);
          commit('ADD_NOTIFICATION', `执行结束回合指令失败: ${error.message}`);
          throw error;
        } finally {
          commit('SET_LOADING', { isLoading: false });
        }
      },
      
      // 切换阵营视角
      switchFactionView({ commit, state }, faction) {
        // 仅在调试模式下允许切换阵营视角
        if (state.system.gameStatus === 'debug') {
          commit('SET_CURRENT_FACTION', faction);
          commit('ADD_NOTIFICATION', `切换到 ${faction} 阵营视角`);
        }
      }
    },
    
    getters: {
      // 获取当前阵营
      currentFaction: state => state.system.currentFaction,
      
      // 获取当前回合
      currentTurn: state => state.system.currentTurn,
      
      // 获取游戏状态
      gameStatus: state => state.system.gameStatus,
      
      // 获取目标点列表
      objectives: state => state.system.objectives,
      
      // 获取所有部队
      allForces: state => state.forces.items,
      
      // 获取当前阵营的部队
      currentFactionForces: (state, getters) => {
        const faction = getters.currentFaction;
        return Object.values(state.forces.items).filter(force => force.faction === faction);
      },
      
      // 获取选中的部队
      selectedForce: state => {
        if (!state.forces.selectedForceId) return null;
        return state.forces.items[state.forces.selectedForceId];
      },
      
      // 获取选中的多个部队
      selectedForces: state => {
        return state.forces.selectedForces.map(id => state.forces.items[id]).filter(Boolean);
      },
      
      // 获取所有战斗群
      allBattlegroups: state => state.battlegroups.items,
      
      // 获取当前阵营的战斗群
      currentFactionBattlegroups: (state, getters) => {
        const faction = getters.currentFaction;
        return Object.values(state.battlegroups.items).filter(bg => bg.faction === faction);
      },
      
      // 获取所有编队
      allFormations: state => state.formations.items,
      
      // 获取当前阵营的编队
      currentFactionFormations: (state, getters) => {
        const faction = getters.currentFaction;
        return Object.values(state.formations.items).filter(formation => formation.faction === faction);
      },
      
      // 获取交互模式
      interactionMode: state => state.interaction.mode,
      
      // 获取路径六角格
      pathHexes: state => state.interaction.pathHexes,
      
      // 获取面板可见性
      isPanelVisible: state => panel => state.panels[`${panel}Visible`],
      
      // 获取加载状态
      isLoading: state => state.loading.isLoading,
      
      // 获取加载消息
      loadingMessage: state => state.loading.loadingMessage,
      
      // 获取通知消息
      notifications: state => state.notification.messages,
      
      // 获取未读通知数量
      unreadNotificationsCount: state => {
        return state.notification.messages.filter(msg => !msg.read).length;
      }
    }
  });
}
