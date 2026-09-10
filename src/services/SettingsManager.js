/**
 * 全局设置与用户偏好持久化管理器。
 *
 * 统一管理游戏配置（双手/左手/右手操作模式、震动反馈、音效、音乐等），
 * 适配微信小游戏与 Web 环境本地存储，并提供事件订阅机制。
 */
/* global wx */

const STORAGE_KEY = 'tetris3d_settings';
const LEGACY_SIDE_KEY = 'tetris3d_dpad_side';

const DEFAULT_SETTINGS = {
  controlMode: 'dual', // 'dual' | 'left' | 'right'
  vibrateEnabled: true,
  sfxEnabled: true,
  bgmEnabled: true,
  ghostEnabled: true,
  dasDelay: 0.18, // DAS 首次重复延迟（秒）
};

export class SettingsManager {
  constructor() {
    this._listeners = new Set();
    this._settings = { ...DEFAULT_SETTINGS };
    this._load();
  }

  _load() {
    try {
      // 1. 尝试读取统一设置字典
      if (typeof wx !== 'undefined' && wx.getStorageSync) {
        const data = wx.getStorageSync(STORAGE_KEY);
        if (data && typeof data === 'object') {
          this._settings = { ...this._settings, ...data };
        } else {
          // 2. 兼容旧版单独存储的 tetris3d_dpad_side
          const legacySide = wx.getStorageSync(LEGACY_SIDE_KEY);
          if (legacySide === 'left' || legacySide === 'right' || legacySide === 'dual') {
            this._settings.controlMode = legacySide;
          }
        }
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this._settings = { ...this._settings, ...JSON.parse(raw) };
        }
      }
    } catch (e) {
      console.warn('[SettingsManager] 读取设置失败，使用默认值', e);
    }
  }

  _save() {
    try {
      if (typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync(STORAGE_KEY, this._settings);
        // 同步兼容写入旧版 key
        wx.setStorageSync(LEGACY_SIDE_KEY, this._settings.controlMode);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
      }
    } catch (e) {
      console.warn('[SettingsManager] 保存设置失败', e);
    }
    this._notify();
  }

  _notify() {
    for (const fn of this._listeners) {
      try {
        fn(this._settings);
      } catch (err) {
        console.error('[SettingsManager] listener error', err);
      }
    }
  }

  /** 获取单项配置 */
  get(key) {
    return this._settings[key] ?? DEFAULT_SETTINGS[key];
  }

  /** 更新配置 */
  set(key, value) {
    if (this._settings[key] === value) return;
    this._settings[key] = value;
    this._save();
  }

  /** 批量更新配置 */
  update(partial) {
    let changed = false;
    for (const k of Object.keys(partial)) {
      if (this._settings[k] !== partial[k]) {
        this._settings[k] = partial[k];
        changed = true;
      }
    }
    if (changed) this._save();
  }

  /** 翻转布尔配置（如震动、音效开关） */
  toggle(key) {
    this.set(key, !this.get(key));
    return this.get(key);
  }

  /** 循环切换手柄操作模式：dual -> left -> right -> dual */
  cycleControlMode() {
    const cur = this.get('controlMode');
    const next = cur === 'dual' ? 'left' : cur === 'left' ? 'right' : 'dual';
    this.set('controlMode', next);
    return next;
  }

  /** 订阅设置变更事件 */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** 获取全部设置快照 */
  getAll() {
    return { ...this._settings };
  }
}

export const settingsManager = new SettingsManager();
