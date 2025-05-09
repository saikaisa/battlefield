import { reactive } from 'vue';

/**
 * 总览面板控制台管理类
 * 提供向控制台添加消息和清空消息的功能
 */
class OverviewConsoleManager {
  constructor() {
    // 单例模式
    if (OverviewConsoleManager.instance) {
      return OverviewConsoleManager.instance;
    }
    
    OverviewConsoleManager.instance = this;
    
    // 消息行列表
    this.lines = reactive([]);
    
    // 最大行数
    this.maxLines = 100;
  }
  
  /**
   * 获取所有消息行
   * @returns {Array} 消息行数组
   */
  getLines() {
    return this.lines;
  }
  
  /**
   * 添加一行普通消息
   * @param {string} content 消息内容
   */
  log(content) {
    this._addLine(content, 'info');
    return this;
  }
  
  /**
   * 添加一行成功消息
   * @param {string} content 消息内容
   */
  success(content) {
    this._addLine(content, 'success');
    return this;
  }
  
  /**
   * 添加一行警告消息
   * @param {string} content 消息内容
   */
  warning(content) {
    this._addLine(content, 'warning');
    return this;
  }
  
  /**
   * 添加一行错误消息
   * @param {string} content 消息内容
   */
  error(content) {
    this._addLine(content, 'error');
    return this;
  }
  
  /**
   * 添加一行统计信息
   * @param {string} content 消息内容
   */
  stat(content) {
    this._addLine(content, 'stat');
    return this;
  }
  
  /**
   * 清空所有消息
   */
  clear() {
    this.lines.length = 0;
    return this;
  }
  
  /**
   * 添加一行消息的内部方法
   * @param {string} content 消息内容
   * @param {string} type 消息类型
   * @private
   */
  _addLine(content, type) {
    // 检查是否超过最大行数
    if (this.lines.length >= this.maxLines) {
      // 移除最早的一行
      this.lines.shift();
    }
    
    // 添加新行
    this.lines.push({
      content,
      type,
      timestamp: Date.now()
    });
  }
  
  /**
   * 格式化统计信息
   * @param {Object} stats 统计对象
   * @returns {string} 格式化后的统计信息
   */
  formatStats(stats) {
    let result = '';
    
    if (stats.round) {
      result += `第 ${stats.round} 回合统计:\n`;
    }
    
    if (stats.selected) {
      result += `已选中 ${stats.selected.hexCount || 0} 个六角格，${stats.selected.forceCount || 0} 支部队\n`;
    }
    
    if (stats.blue) {
      result += `蓝方: ${stats.blue.forceCount || 0} 支部队 (进攻/防御火力值: ${stats.blue.offense || 0}/${stats.blue.defense || 0})\n`;
    }
    
    if (stats.red) {
      result += `红方: ${stats.red.forceCount || 0} 支部队 (进攻/防御火力值: ${stats.red.offense || 0}/${stats.red.defense || 0})\n`;
    }
    
    return result;
  }
}

// 创建单例实例
const consoleManager = new OverviewConsoleManager();

// 导出简便的接口
export const OverviewConsole = {
  getLines: () => consoleManager.getLines(),
  log: (content) => consoleManager.log(content),
  success: (content) => consoleManager.success(content),
  warning: (content) => consoleManager.warning(content),
  error: (content) => consoleManager.error(content),
  stat: (content) => consoleManager.stat(content),
  clear: () => consoleManager.clear(),
  formatStats: (stats) => consoleManager.formatStats(stats)
};

// 为统计模式添加一些辅助函数
export const StatisticsHelper = {
  /**
   * 更新总览面板中的统计信息
   * @param {Object} store Pinia Store实例
   */
  updateStatistics(store) {
    if (!store) return;
    
    // 清空统计信息
    OverviewConsole.clear();
    
    // 统计当前选中信息
    const selectedHexes = store.selectedHexIds ? store.selectedHexIds.size : 0;
    
    // 统计蓝方数据
    const blueForces = store.getForces().filter(force => force.faction === 'blue');
    const blueForceCount = blueForces.length;
    const blueOffense = blueForces.reduce((sum, force) => sum + (force.offensivePower || 0), 0);
    const blueDefense = blueForces.reduce((sum, force) => sum + (force.defensivePower || 0), 0);
    
    // 统计红方数据
    const redForces = store.getForces().filter(force => force.faction === 'red');
    const redForceCount = redForces.length;
    const redOffense = redForces.reduce((sum, force) => sum + (force.offensivePower || 0), 0);
    const redDefense = redForces.reduce((sum, force) => sum + (force.defensivePower || 0), 0);
    
    // 生成统计信息
    const stats = {
      round: store.currentRound,
      selected: {
        hexCount: selectedHexes,
        forceCount: store.selectedForceIds ? store.selectedForceIds.size : 0
      },
      blue: {
        forceCount: blueForceCount,
        offense: blueOffense,
        defense: blueDefense
      },
      red: {
        forceCount: redForceCount,
        offense: redOffense,
        defense: redDefense
      }
    };
    
    // 添加统计标题
    OverviewConsole.log('===== 战场态势统计 =====');
    
    // 添加统计信息
    const statsContent = OverviewConsole.formatStats(stats);
    OverviewConsole.stat(statsContent);
  }
}; 