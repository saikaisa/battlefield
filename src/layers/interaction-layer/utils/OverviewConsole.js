import { reactive } from 'vue';
import { openGameStore } from '@/store';
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
    
    // 消息行列表，每条消息包含：id, content, type, timestamp
    this.lines = reactive([]);
    
    // 最大行数
    this.maxLines = 100;
    
    // 用于生成自动ID的计数器
    this.autoIdCounter = 0;
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
   * @param {string} [lineId] 可选的行ID，用于后续更新
   * @returns {string} 分配给该行的ID
   */
  log(content, lineId = null) {
    return this._addLine(content, 'info', lineId);
  }
  
  /**
   * 添加一行成功消息
   * @param {string} content 消息内容
   * @param {string} [lineId] 可选的行ID，用于后续更新
   * @returns {string} 分配给该行的ID
   */
  success(content, lineId = null) {
    return this._addLine(content, 'success', lineId);
  }
  
  /**
   * 添加一行警告消息
   * @param {string} content 消息内容
   * @param {string} [lineId] 可选的行ID，用于后续更新
   * @returns {string} 分配给该行的ID
   */
  warning(content, lineId = null) {
    return this._addLine(content, 'warning', lineId);
  }
  
  /**
   * 添加一行错误消息
   * @param {string} content 消息内容
   * @param {string} [lineId] 可选的行ID，用于后续更新
   * @returns {string} 分配给该行的ID
   */
  error(content, lineId = null) {
    return this._addLine(content, 'error', lineId);
  }
  
  /**
   * 添加一行统计信息
   * @param {string} content 消息内容
   * @param {string} [lineId] 可选的行ID，用于后续更新
   * @returns {string} 分配给该行的ID
   */
  stat(content, lineId = null) {
    return this._addLine(content, 'stat', lineId);
  }
  
  /**
   * 更新特定行的内容
   * @param {string} lineId 行ID
   * @param {string} content 新内容
   * @param {string} [type] 可选的行类型，如果需要修改
   * @returns {boolean} 是否成功更新
   */
  updateLine(lineId, content, type = null) {
    // 查找拥有指定id的行
    const index = this.lines.findIndex(line => line.id === lineId);
    if (index === -1) {
      // 如果没有找到对应ID的行，则创建一个新行
      return this._addLine(content, type || 'info', lineId);
    }
    
    // 创建更新后的行对象
    const updatedLine = {
      ...this.lines[index],
      content,
      timestamp: Date.now()
    };
    
    // 如果指定了类型，则更新类型
    if (type) {
      updatedLine.type = type;
    }
    
    // 更新行
    this.lines[index] = updatedLine;
    return true;
  }
  
  /**
   * 清空所有消息
   */
  clear() {
    this.lines.length = 0;
    return this;
  }
  
  /**
   * 获取当前控制台内容的深拷贝
   * @returns {Array} 控制台内容的深拷贝
   */
  getContent() {
    return JSON.parse(JSON.stringify(this.lines));
  }
  
  /**
   * 设置控制台内容
   * @param {Array} content 要设置的控制台内容
   */
  setContent(content) {
    // 清空当前内容
    this.lines.splice(0, this.lines.length);
    
    // 如果content是数组且不为空，则添加内容
    if (Array.isArray(content) && content.length > 0) {
      this.lines.push(...content);
      // 更新自动ID计数器，确保不会与已有ID冲突
      this._updateAutoIdCounter();
    }
  }
  
  /**
   * 添加一行消息的内部方法
   * @param {string} content 消息内容
   * @param {string} type 消息类型
   * @param {string} [lineId] 行ID，用于后续更新
   * @returns {string} 行ID
   * @private
   */
  _addLine(content, type, lineId = null) {
    // 检查是否超过最大行数
    if (this.lines.length >= this.maxLines) {
      // 移除最早的一行
      this.lines.shift();
    }
    
    // 如果未指定行ID，则生成一个默认ID
    const id = lineId || `default_${++this.autoIdCounter}`;
    
    // 添加新行，直接包含id属性
    this.lines.push({
      id,
      content,
      type,
      timestamp: Date.now()
    });
    
    return id;
  }
  
  /**
   * 更新自动ID计数器，确保不会与已有ID冲突
   * @private
   */
  _updateAutoIdCounter() {
    this.lines.forEach(line => {
      if (line.id && line.id.startsWith('default_')) {
        const idNum = parseInt(line.id.split('_')[1], 10);
        if (!isNaN(idNum) && idNum > this.autoIdCounter) {
          this.autoIdCounter = idNum;
        }
      }
    });
  }
}

// 创建单例实例
const consoleManager = new OverviewConsoleManager();

// 导出接口
export const OverviewConsole = {
  getLines: () => consoleManager.getLines(),
  log: (content, lineId) => consoleManager.log(content, lineId),
  success: (content, lineId) => consoleManager.success(content, lineId),
  warning: (content, lineId) => consoleManager.warning(content, lineId),
  error: (content, lineId) => consoleManager.error(content, lineId),
  stat: (content, lineId) => consoleManager.stat(content, lineId),
  updateLine: (lineId, content, type) => consoleManager.updateLine(lineId, content, type),
  clear: () => consoleManager.clear(),
  getContent: () => consoleManager.getContent(),
  setContent: (content) => consoleManager.setContent(content)
};

// 为统计模式添加一些辅助函数
export const StatisticsHelper = {
  /**
   * 更新总览面板中的统计信息
   */
  updateStatistics() {
    const store = openGameStore();
    const selectedHexIds = Array.from(store.selectedHexIds || []);

    // 更新选中计数
    OverviewConsole.updateLine('stat_selected', 
      `已选中 ${selectedHexIds.length} 个六角格，选中统计如下：`);
    
    // 同时计算蓝方和红方数据
    const factions = ['blue', 'red'];
    const stats = {
      blue: { hexes: [], forces: [], forceCount: 0 },
      red: { hexes: [], forces: [], forceCount: 0 }
    };
    
    // 统计六角格和其中的部队
    factions.forEach(faction => {
      // 筛选出属于该阵营的六角格
      stats[faction].hexes = selectedHexIds.filter(hexId => {
        const hexCell = store.getHexCellById(hexId);
        return hexCell && hexCell.battlefieldState.controlFaction === faction;
      });
      
      // 遍历所有属于该阵营的选中的六角格
      for (const hexId of stats[faction].hexes) {
        const hexCell = store.getHexCellById(hexId);
        if (hexCell && hexCell.forcesIds) {
          // 遍历六角格中的所有部队
          for (const forceId of hexCell.forcesIds) {
            const force = store.getForceById(forceId);
            if (force && force.faction === faction) {
              stats[faction].forces.push(force);
              stats[faction].forceCount++;
            }
          }
        }
      }
    });
    
    // 计算火力值并更新UI
    factions.forEach(faction => {
      const attackPower = { land: 0, sea: 0, air: 0 };
      const defensePower = { land: 0, sea: 0, air: 0 };
      
      // 累加各部队火力值
      stats[faction].forces.forEach(force => {
        try {
          const attack = force.attackFirepower;
          if (attack) {
            attackPower.land += attack.land || 0;
            attackPower.sea += attack.sea || 0;
            attackPower.air += attack.air || 0;
          }
          
          const defense = force.defenseFirepower;
          if (defense) {
            defensePower.land += defense.land || 0;
            defensePower.sea += defense.sea || 0;
            defensePower.air += defense.air || 0;
          }
        } catch (e) {
          console.error(`获取${faction}部队 ${force.forceId} 火力值失败:`, e);
        }
      });
      
      // 更新基本信息
      OverviewConsole.updateLine(
        `stat_${faction}_info`, 
        `${faction === 'blue' ? '蓝' : '红'}方: 控制 ${stats[faction].hexes.length} 个六角格，包含 ${stats[faction].forceCount} 支部队`
      );
      
          // 更新火力表格 - 简化版无框线
    const table = [
      `${faction === 'blue' ? '蓝' : '红'}方火力   进攻火力     防御火力`,
      `-----------------------------------`,
      `  对陆     ${this._padNumber(attackPower.land)}     ${this._padNumber(defensePower.land)}`,
      `  对海     ${this._padNumber(attackPower.sea)}     ${this._padNumber(defensePower.sea)}`,
      `  对空     ${this._padNumber(attackPower.air)}     ${this._padNumber(defensePower.air)}`
    ].join('\n');
      
      // 更新表格
      OverviewConsole.updateLine(`stat_${faction}_table`, table);
    });
  },
  
  /**
   * 格式化数字，使用m表示百万级数字，b表示十亿级数字
   * @private
   */
  _formatNumber(num) {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(3) + 'b';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(3) + 'm';
    } else {
      // 百万以下数字精确显示
      return String(num);
    }
  },
  
  /**
   * 将数字格式化为固定长度的字符串，用于表格对齐
   * @private
   */
  _padNumber(num) {
    const formattedNum = this._formatNumber(num);
    const padLength = 7; // 设置宽度为7位
    return formattedNum.length >= padLength ? formattedNum : ' '.repeat(padLength - formattedNum.length) + formattedNum;
  },
  
  /**
   * 初始化统计模式控制台
   */
  initStatisticsConsole() {
    OverviewConsole.clear();
    OverviewConsole.stat('===== 进入统计模式 =====');
    OverviewConsole.stat('已选中 0 个六角格', 'stat_selected');
    
    OverviewConsole.log('蓝方: 控制 0 个六角格，包含 0 支部队', 'stat_blue_info');
    const emptyBlueTable = [
      `蓝方火力   进攻火力     防御火力`,
      `-----------------------------------`,
      `  对陆         0         0`,
      `  对海         0         0`,
      `  对空         0         0`
    ].join('\n');
    OverviewConsole.log(emptyBlueTable, 'stat_blue_table');
    
    OverviewConsole.error('红方: 控制 0 个六角格，包含 0 支部队', 'stat_red_info');
    const emptyRedTable = [
      `红方火力   进攻火力     防御火力`,
      `-----------------------------------`,
      `  对陆         0         0`,
      `  对海         0         0`,
      `  对空         0         0`
    ].join('\n');
    OverviewConsole.error(emptyRedTable, 'stat_red_table');
  }
}; 