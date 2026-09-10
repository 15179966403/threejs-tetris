/**
 * 统一音频服务 —— 基于 WebAudio / wx.createWebAudioContext 的零素材合成音效引擎。
 *
 * 特性：
 * 1. 0 KB 素材依赖：纯代码驱动振荡器 (OscillatorNode) 与增益包络 (GainNode) 实时合成；
 * 2. 0 延迟：无网络下载、无音频文件解码开销，移动端瞬发；
 * 3. 双端兼容：微信小游戏 WebAudioContext 与浏览器标准 Web Audio API 自动适配；
 * 4. 配置感知：联动 SettingsManager，静音时不分配声道、不消耗任何 CPU。
 */
/* global wx */
import { settingsManager } from './SettingsManager.js';

export class AudioService {
  constructor() {
    this._ctx = null;
    this._resumed = false;
    this._initContext();
  }

  _initContext() {
    try {
      if (typeof wx !== 'undefined' && typeof wx.createWebAudioContext === 'function') {
        this._ctx = wx.createWebAudioContext();
      } else if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this._ctx = new AudioCtx();
        }
      }
    } catch (e) {
      console.warn('[AudioService] 初始化音频上下文失败，静音降级', e);
    }
  }

  /**
   * 在移动端/浏览器首次点触时解锁唤醒音频上下文
   */
  resume() {
    if (this._resumed || !this._ctx) return;
    try {
      if (this._ctx.state === 'suspended' && typeof this._ctx.resume === 'function') {
        this._ctx.resume();
      }
      this._resumed = true;
    } catch (e) {
      // 忽略
    }
  }

  /**
   * 是否允许播放音效
   */
  isEnabled() {
    return settingsManager ? settingsManager.get('sfxEnabled') !== false : true;
  }

  /**
   * 底层基础合成器：指定频率、波形、音量包络播放单音
   */
  _tone({
    freq = 440,
    endFreq = null,
    type = 'sine',
    duration = 0.08,
    gain = 0.15,
    attack = 0.005,
  }) {
    if (!this.isEnabled() || !this._ctx) return;
    this.resume();

    try {
      const ctx = this._ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
      }

      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + duration);
    } catch (e) {
      // 捕获播放偶发异常
    }
  }

  /** 方块移动轻微提示音 */
  playMove() {
    this._tone({ freq: 420, duration: 0.035, gain: 0.08, type: 'triangle' });
  }

  /** 方块旋转清脆上升音 */
  playRotate() {
    this._tone({ freq: 520, endFreq: 820, duration: 0.055, gain: 0.12, type: 'sine' });
  }

  /** 软降轻微点顿音 */
  playSoftDrop() {
    this._tone({ freq: 280, endFreq: 200, duration: 0.03, gain: 0.07, type: 'triangle' });
  }

  /** 硬降沉稳撞击重音 */
  playHardDrop() {
    this._tone({ freq: 190, endFreq: 45, duration: 0.14, gain: 0.28, type: 'triangle' });
  }

  /** 满行消除与连击和弦音 */
  playClear(lines = 1, combo = 0) {
    if (!this.isEnabled() || !this._ctx) return;
    // C5(523.25), E5(659.25), G5(783.99), B5(987.77), C6(1046.5)
    const pitches = [523.25, 659.25, 783.99, 987.77, 1046.5];
    const baseIdx = Math.min(lines - 1, pitches.length - 1);
    const startFreq = pitches[Math.max(0, baseIdx)];

    this._tone({ freq: startFreq, endFreq: startFreq * 1.5, duration: 0.12, gain: 0.22, type: 'sine' });

    if (combo >= 1 || lines >= 2) {
      setTimeout(() => {
        const topFreq = pitches[Math.min(baseIdx + 1, pitches.length - 1)] * (1 + combo * 0.1);
        this._tone({ freq: topFreq, duration: 0.18, gain: 0.25, type: 'sine' });
      }, 70);
    }
  }

  /** 激光发射科幻扫频音 */
  playLaser() {
    this._tone({ freq: 1100, endFreq: 260, duration: 0.15, gain: 0.26, type: 'sawtooth' });
  }

  /** 重力道具低频脉冲轰鸣波 */
  playGravity() {
    this._tone({ freq: 95, endFreq: 40, duration: 0.26, gain: 0.35, type: 'sine' });
    setTimeout(() => {
      this._tone({ freq: 120, endFreq: 50, duration: 0.2, gain: 0.25, type: 'triangle' });
    }, 80);
  }

  /** 超量方块销毁炸裂清脆音 */
  playDecay() {
    this._tone({ freq: 720, endFreq: 360, duration: 0.08, gain: 0.18, type: 'sine' });
  }

  /** 游戏结束下行悲鸣音 */
  playGameOver() {
    if (!this.isEnabled() || !this._ctx) return;
    const notes = [440, 392, 349, 261];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this._tone({ freq, endFreq: freq * 0.85, duration: 0.18, gain: 0.22, type: 'triangle' });
      }, i * 140);
    });
  }

  /** 菜单按钮点击回馈音 */
  playUiClick() {
    this._tone({ freq: 880, duration: 0.025, gain: 0.12, type: 'sine' });
  }
}

export const audioService = new AudioService();
