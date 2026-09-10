/**
 * 微信小游戏用户隐私保护授权管理器 (PrivacyManager)
 *
 * 遵循微信 2023 年 9 月起强制执行的《小程序用户隐私保护指引》规范：
 * 1. 监听 wx.onNeedPrivacyAuthorization 事件；
 * 2. 拦截受限敏感接口调用，提供统一的同意 (agree) 与拒绝 (disagree) 响应；
 * 3. 在非微信环境（如 Web 浏览器、Node 仿真）安全静默降级。
 */
/* global wx */

export class PrivacyManager {
  constructor() {
    this._initialized = false;
    this._privacyResolve = null;
    this._listeners = new Set();
    this.needAuth = false;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    if (typeof wx !== 'undefined' && typeof wx.onNeedPrivacyAuthorization === 'function') {
      try {
        wx.onNeedPrivacyAuthorization((resolve) => {
          this._privacyResolve = resolve;
          this.needAuth = true;
          this._notify(true);
        });
      } catch (e) {
        console.warn('[PrivacyManager] 监听隐私授权失败', e);
      }
    }
  }

  /**
   * 用户点击同意《用户隐私保护指引》
   */
  agree() {
    if (this._privacyResolve) {
      this._privacyResolve({ buttonId: 'agree-btn', event: 'agree' });
      this._privacyResolve = null;
    }
    this.needAuth = false;
    this._notify(false);
  }

  /**
   * 用户拒绝授权
   */
  disagree() {
    if (this._privacyResolve) {
      this._privacyResolve({ event: 'disagree' });
      this._privacyResolve = null;
    }
    this.needAuth = false;
    this._notify(false);
  }

  /**
   * 订阅授权提示弹窗显隐通知
   */
  onNeedAuth(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * 主动触发微信隐私授权校验
   */
  async requirePrivacyAuthorize() {
    if (typeof wx !== 'undefined' && typeof wx.requirePrivacyAuthorize === 'function') {
      return new Promise((resolve) => {
        wx.requirePrivacyAuthorize({
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      });
    }
    return true;
  }

  /**
   * 模拟或手动派发隐私授权事件（用于跨平台或测试）
   */
  handleNeedAuth(resolveFn) {
    this._privacyResolve = resolveFn;
    this.needAuth = true;
    this._notify(true);
  }

  _notify(need) {
    for (const fn of this._listeners) {
      try {
        fn(need);
      } catch (e) {
        console.error('[PrivacyManager] listener error', e);
      }
    }
  }
}

export const privacyManager = new PrivacyManager();
