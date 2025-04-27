// src\layers\interaction-layer\MessageBox.js
import { reactive } from "vue";

/**
 * 消息盒子管理器
 * 用于在界面上显示各类消息提示
 */
export class MessageBoxManager {
  static instance = null;

  constructor() {
    // 单例模式
    if (MessageBoxManager.instance) {
      return MessageBoxManager.instance;
    }
    MessageBoxManager.instance = this;

    // 消息队列
    this.messages = reactive([]);
    
    // 配置项
    this.config = {
      duration: {
        default: 3000,
        error: 5000,
        warning: 4000,
        success: 3000,
        info: 3000
      }
    };

    // 创建DOM容器
    this._createContainer();
  }

  /**
   * 创建消息容器
   * @private
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'message-box-container';
    document.body.appendChild(this.container);
    
    const containerStyle = document.createElement('style');
    containerStyle.textContent = `
      .message-box-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        pointer-events: none;
      }
      .message-box {
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        min-width: 280px;
        max-width: 400px;
        pointer-events: auto;
        animation: message-fade-in 0.3s;
        transition: opacity 0.3s, transform 0.3s;
        word-break: break-word;
      }
      .message-box.error {
        background-color: #FFE8E6;
        border-left: 4px solid #F56C6C;
        color: #CF1322;
      }
      .message-box.warning {
        background-color: #FFF7E6;
        border-left: 4px solid #FA8C16;
        color: #D46B08;
      }
      .message-box.success {
        background-color: #E6FFFB;
        border-left: 4px solid #52C41A;
        color: #389E0D;
      }
      .message-box.info {
        background-color: #E6F7FF;
        border-left: 4px solid #1890FF;
        color: #096DD9;
      }
      .message-content {
        flex: 1;
        padding-right: 16px;
      }
      .message-close {
        cursor: pointer;
        color: rgba(0, 0, 0, 0.45);
      }
      @keyframes message-fade-in {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(containerStyle);
  }

  /**
   * 添加消息到队列
   * @param {string} content 消息内容
   * @param {string} type 消息类型: error, warning, success, info
   * @param {number} duration 显示时间(毫秒)
   */
  _addMessage(content, type = 'info', duration) {
    // 生成唯一ID
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    // 确定显示时长
    const actualDuration = duration || this.config.duration[type] || this.config.duration.default;
    
    // 创建消息对象
    const message = {
      id,
      content,
      type,
      timestamp: Date.now()
    };
    
    // 添加到队列
    this.messages.push(message);
    
    // 创建消息DOM
    this._renderMessage(message);
    
    // 设置自动移除
    setTimeout(() => {
      this.removeMessage(id);
    }, actualDuration);
    
    return id;
  }

  /**
   * 渲染消息DOM
   * @param {Object} message 消息对象
   * @private
   */
  _renderMessage(message) {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message-box ${message.type}`;
    messageEl.dataset.id = message.id;
    
    // 创建内容部分
    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';
    contentEl.textContent = message.content;
    messageEl.appendChild(contentEl);
    
    // 创建关闭按钮
    const closeEl = document.createElement('span');
    closeEl.className = 'message-close';
    closeEl.textContent = '×';
    closeEl.addEventListener('click', () => {
      this.removeMessage(message.id);
    });
    messageEl.appendChild(closeEl);
    
    // 添加到容器
    this.container.appendChild(messageEl);
  }

  /**
   * 从队列和DOM中移除消息
   * @param {number} id 消息ID
   */
  removeMessage(id) {
    // 从队列移除
    const index = this.messages.findIndex(msg => msg.id === id);
    if (index > -1) {
      this.messages.splice(index, 1);
    }
    
    // 从DOM移除
    const messageEl = this.container.querySelector(`.message-box[data-id="${id}"]`);
    if (messageEl) {
      messageEl.style.opacity = '0';
      messageEl.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        if (messageEl.parentNode === this.container) {
          this.container.removeChild(messageEl);
        }
      }, 300); // 等待动画完成
    }
  }

  /**
   * 移除所有消息
   */
  removeAll() {
    // 清空队列
    this.messages.length = 0;
    
    // 清空DOM
    const messages = this.container.querySelectorAll('.message-box');
    messages.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-20px)';
    });
    
    setTimeout(() => {
      this.container.innerHTML = '';
    }, 300);
  }
  
  // 公共方法: 显示错误消息
  error(content, duration) {
    return this._addMessage(content, 'error', duration);
  }
  
  // 公共方法: 显示警告消息
  warning(content, duration) {
    return this._addMessage(content, 'warning', duration);
  }
  
  // 公共方法: 显示成功消息
  success(content, duration) {
    return this._addMessage(content, 'success', duration);
  }
  
  // 公共方法: 显示信息消息
  info(content, duration) {
    return this._addMessage(content, 'info', duration);
  }
}

// 创建并导出全局单例
const messageBox = new MessageBoxManager();

// 导出简单API
export const showError = (content, duration) => messageBox.error(content, duration);
export const showWarning = (content, duration) => messageBox.warning(content, duration);
export const showSuccess = (content, duration) => messageBox.success(content, duration);
export const showInfo = (content, duration) => messageBox.info(content, duration);

// 提供Vue插件安装方法
export const MessageBoxPlugin = {
  install(app) {
    // 提供全局实例
    app.config.globalProperties.$message = {
      error: showError,
      warning: showWarning,
      success: showSuccess,
      info: showInfo
    };
  }
};