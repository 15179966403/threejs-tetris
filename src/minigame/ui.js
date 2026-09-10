import * as THREE from 'three';
import { ACCENT, FONT } from './ui/UITheme.js';
import { HUDView } from './ui/HUDView.js';
import { ControlDeckView } from './ui/ControlDeckView.js';
import { PropBarView } from './ui/PropBarView.js';
import { TargetingView } from './ui/TargetingView.js';
import { ModalView } from './ui/ModalView.js';
import { settingsManager } from '../services/SettingsManager.js';

/* global wx */

/**
 * 小游戏 UI 层协调器（小霸王手柄/双手双持布局）：
 *
 * 采用微组件装配式架构：
 * - HUDView: 顶部记分、消除行数、等级与 NEXT 预览及模式切换
 * - ControlDeckView: 底部手柄控制台（十字键、右手动作键、暂停键）
 * - PropBarView: 能量槽与 5 个道具槽位
 * - TargetingView: 重力道具瞄准、高亮光带与确认交互
 * - ModalView: 就绪、暂停、结算与游戏设置全局弹窗
 *
 * 绘制到离屏 2D canvas → CanvasTexture → 正交相机全屏面片叠加；
 * 脏检查驱动：状态无变化不重绘、不触发 GPU 纹理上传。
 */
export class GameUI {
  /**
   * @param uiScale  UI 画布像素密度
   * @param side     'dual' | 'left' | 'right'，手柄操作布局（默认 dual）
   */
  constructor(uiScale, side) {
    this.canvas = wx.createCanvas(); // 第 2 次调用 => 离屏 canvas
    this.ctx = this.canvas.getContext('2d');
    this.scale = Math.min(uiScale, 2);
    this.texture = new THREE.CanvasTexture(this.canvas);
    // 小游戏多为 WebGL1，NPOT 纹理必须关闭 mipmap，否则 three 会静默放大到 POT
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.dirty = true;
    this.W = 0;
    this.H = 0;
    this.top = 0; // 刘海安全区高度
    this.bottom = 0; // 底部安全区高度（Home Bar）
    this.side = side === 'right' ? 'right' : side === 'left' ? 'left' : 'dual';
    this.controls = {}; // 命中测试区域字典
    this.itemPanel = null; // 道具面板区域
    this.deckY = 0;
    this.deckH = 0;
    this._pressedSet = new Set();

    // 道具使用目标选取状态
    this.targeting = {
      active: false,
      itemIdx: -1,
      mode: 'cols', // 'cols' | 'rows'
      startIdx: 3,
      dir: 'down',
    };

    // 视图子组件
    this.hudView = new HUDView();
    this.deckView = new ControlDeckView();
    this.propBarView = new PropBarView();
    this.targetingView = new TargetingView();
    this.modalView = new ModalView();

    this._cache = {
      state: '',
      score: -1,
      lines: -1,
      level: -1,
      next: '',
      best: -1,
      combo: -1,
      pressed: null,
      itemEnergy: -1,
      itemCount: -1,
      tgtActive: false,
      tgtIdx: -1,
      tgtMode: '',
      settingsOpen: false,
      vibrateEnabled: null,
      sfxEnabled: null,
      controlMode: '',
    };
  }

  startTargeting(itemIdx) {
    this.targeting.active = true;
    this.targeting.itemIdx = itemIdx;
    this.targeting.mode = 'cols';
    this.targeting.startIdx = 3;
    this.targeting.dir = 'down';
    this.dirty = true;
  }

  cancelTargeting() {
    this.targeting.active = false;
    this.targeting.itemIdx = -1;
    this.dirty = true;
  }

  setSide(side) {
    const s = side === 'right' ? 'right' : side === 'left' ? 'left' : 'dual';
    if (s === this.side) return;
    this.side = s;
    this._layout();
    this.dirty = true;
  }

  openSettings() {
    this.modalView.isSettingsOpen = true;
    this.dirty = true;
  }

  closeSettings() {
    this.modalView.isSettingsOpen = false;
    this.dirty = true;
  }

  toggleSettings() {
    this.modalView.isSettingsOpen = !this.modalView.isSettingsOpen;
    this.dirty = true;
  }

  resize(W, H, top, bottom) {
    this.W = W;
    this.H = H;
    this.top = top || 0;
    this.bottom = bottom || 0;
    this.canvas.width = Math.round(W * this.scale);
    this.canvas.height = Math.round(H * this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this._layout();
    this.dirty = true;
  }

  _layout() {
    const { W, H } = this;
    const deckLayout = this.deckView.layout(W, H, this.bottom, this.side);
    this.deckY = deckLayout.deckY;
    this.deckH = deckLayout.deckH;
    this.itemPanel = deckLayout.itemPanel;

    const tgtControls = this.targetingView.layout(W, this.deckY, this.top);
    const hudControls = this.hudView.layout(W, this.top);

    // 弹窗主按钮与切换按钮占位
    const pw = Math.min(W - 48, 330);
    const px = (W - pw) / 2;
    const swW = 200;
    const swH = 34;
    const bw = 184;
    const bh = 44;

    this.controls = {
      ...deckLayout.controls,
      ...tgtControls,
      ...hudControls,
      swapOverlay: {
        x: px + (pw - swW) / 2,
        y: (H - 260) / 2 + 130,
        w: swW,
        h: swH,
      },
      primary: {
        x: (W - bw) / 2,
        y: (H - 260) / 2 + 260 - bh - 20,
        w: bw,
        h: bh,
      },
    };
  }

  /**
   * 命中测试。
   * 设置弹窗开启：响应设置关闭、模式切换、震动切换；
   * 道具选取模式：响应步进、模式 Tab、确认/取消、棋盘区域触控；
   * 游戏中：up/down/left/right/btnRotate/btnHardDrop/pause/swapTop/slot_0..4；
   * 浮层就绪/暂停/结算状态：swapOverlay/swapTop 响应切换布局，主区域响应主按钮。
   */
  hitControl(x, y) {
    const c = this.controls;
    const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

    // 1. 设置弹窗打开时
    if (this.modalView.isSettingsOpen) {
      if (inR(c.settingsClose)) return 'settingsClose';
      if (inR(c.settingVibe)) return 'settingVibe';
      if (inR(c.settingSfx)) return 'settingSfx';
      if (c.settingModes) {
        for (let i = 0; i < c.settingModes.length; i++) {
          const m = c.settingModes[i];
          if (inR(m)) return 'settingMode_' + m.key;
        }
      }
      return null;
    }

    // 2. 道具目标选取模式下：优先响应选取控制
    if (this.targeting && this.targeting.active) {
      if (inR(c.targetColTab)) return 'targetColTab';
      if (inR(c.targetRowTab)) return 'targetRowTab';
      if (inR(c.targetPrev)) return 'targetPrev';
      if (inR(c.targetNext)) return 'targetNext';
      if (inR(c.targetConfirm)) return 'targetConfirm';
      if (inR(c.targetCancel)) return 'targetCancel';
      if (inR(c.boardArea)) return 'boardArea';
      return null;
    }

    const playing = this._cache.state === 'playing' || this._cache.state === 'clearing';
    if (playing) {
      if (inR(c.swapTop)) return 'swapTop';
      if (inR(c.pause)) return 'pause';
      if (this.side === 'dual') {
        if (inR(c.btnRotate)) return 'btnRotate';
        if (inR(c.btnHardDrop)) return 'btnHardDrop';
      }
      for (const k of ['up', 'down', 'left', 'right']) {
        if (inR(c[k])) return k;
      }
      if (c.slots) {
        for (let i = 0; i < c.slots.length; i++) {
          if (inR(c.slots[i])) return 'slot_' + i;
        }
      }
      return null;
    }

    // 3. 浮层非游戏状态
    if (inR(c.btnSettings)) return 'btnSettings';
    if (inR(c.btnHome)) return 'btnHome';
    if (inR(c.btnShare)) return 'btnShare';
    if (c.modeTabs) {
      for (let i = 0; i < c.modeTabs.length; i++) {
        if (inR(c.modeTabs[i])) return 'mode_' + c.modeTabs[i].mode;
      }
    }
    if (inR(c.swapOverlay)) return 'swapOverlay';
    if (inR(c.swapTop)) return 'swapTop';
    if (inR(c.primary)) return 'primary';
    return null;
  }

  setPressed(name, isPressed = true) {
    if (name === null) {
      if (this._pressedSet && this._pressedSet.size > 0) {
        this._pressedSet.clear();
        this._cache.pressed = null;
        this.dirty = true;
      }
      return;
    }
    if (!this._pressedSet) this._pressedSet = new Set();
    if (isPressed) {
      if (!this._pressedSet.has(name)) {
        this._pressedSet.add(name);
        this._cache.pressed = name;
        this.dirty = true;
      }
    } else {
      if (this._pressedSet.has(name)) {
        this._pressedSet.delete(name);
        this._cache.pressed = this._pressedSet.values().next().value || null;
        this.dirty = true;
      }
    }
  }

  isPressed(name) {
    if (this._pressedSet && this._pressedSet.size > 0) {
      return this._pressedSet.has(name);
    }
    return this._cache.pressed === name;
  }

  /**
   * 每帧调用：状态有变才重绘并返回 true（调用方随后置 texture.needsUpdate）。
   */
  update(game, best, settings) {
    const c = this._cache;
    const itemsCount = (game.items && game.items.length) || 0;
    const itemEnergy = game.itemEnergy || 0;
    const tgtActive = !!(this.targeting && this.targeting.active);
    const tgtIdx = this.targeting ? this.targeting.startIdx : -1;
    const tgtMode = this.targeting ? this.targeting.mode : '';
    const settingsOpen = this.modalView.isSettingsOpen;
    const curSettings = settings || (settingsManager ? settingsManager.getAll() : null);
    const vibeOn = curSettings ? curSettings.vibrateEnabled !== false : true;
    const sfxOn = curSettings ? curSettings.sfxEnabled !== false : true;
    const ctrlMode = curSettings ? curSettings.controlMode : this.side;

    if (
      game.state !== c.state ||
      game.score !== c.score ||
      game.lines !== c.lines ||
      game.level !== c.level ||
      game.nextType !== c.next ||
      best !== c.best ||
      game.combo !== c.combo ||
      itemEnergy !== c.itemEnergy ||
      itemsCount !== c.itemCount ||
      tgtActive !== c.tgtActive ||
      tgtIdx !== c.tgtIdx ||
      tgtMode !== c.tgtMode ||
      settingsOpen !== c.settingsOpen ||
      vibeOn !== c.vibrateEnabled ||
      sfxOn !== c.sfxEnabled ||
      ctrlMode !== c.controlMode
    ) {
      c.state = game.state;
      c.score = game.score;
      c.lines = game.lines;
      c.level = game.level;
      c.next = game.nextType;
      c.best = best;
      c.combo = game.combo;
      c.itemEnergy = itemEnergy;
      c.itemCount = itemsCount;
      c.tgtActive = tgtActive;
      c.tgtIdx = tgtIdx;
      c.tgtMode = tgtMode;
      c.settingsOpen = settingsOpen;
      c.vibrateEnabled = vibeOn;
      c.sfxEnabled = sfxOn;
      c.controlMode = ctrlMode;
      this.dirty = true;
    }
    if (!this.dirty) return false;
    this._draw(game, best, curSettings);
    this.dirty = false;
    return true;
  }

  /* ================= 绘制装配 ================= */

  _draw(game, best, settings) {
    const c = this.ctx;
    const { W, H } = this;
    c.clearRect(0, 0, W, H);

    // 1. 顶部 HUD
    this.hudView.draw(c, W, this.top, game, this.side);

    // 2. 连锁连击浮空特效
    if (game.state === 'clearing' && game.combo >= 1) {
      c.save();
      c.shadowColor = 'rgba(34, 211, 238, 0.7)';
      c.shadowBlur = 20;
      c.fillStyle = ACCENT;
      c.font = `700 30px ${FONT}`;
      c.textAlign = 'center';
      c.fillText(`COMBO ×${game.combo + 1}`, W / 2, H * 0.36);
      c.restore();
      c.textAlign = 'left';
    }

    // 3. 道具瞄准高亮光带
    if (this.targeting && this.targeting.active) {
      this.targetingView.drawHighlight(c, W, this.top, this.deckY, this.targeting);
    }

    // 4. 控制台 / 弹窗
    if (game.state === 'playing' || game.state === 'clearing') {
      if (this.targeting && this.targeting.active) {
        this.targetingView.drawControls(c, W, this.deckY, this.deckH, this.targeting, this.controls);
      } else {
        this.deckView.drawDeckBase(c, W, this.deckY, this.deckH);
        this.deckView.drawDpad(c, this.controls, (name) => this.isPressed(name));
        if (this.side === 'dual') {
          this.deckView.drawActionButtons(c, this.controls, (name) => this.isPressed(name));
        }
        this.propBarView.draw(c, this.itemPanel, this.controls.slots, game);
        this.deckView.drawPauseButton(c, this.controls, (name) => this.isPressed(name));
      }
    } else {
      const activeSettings = settings || (settingsManager ? settingsManager.getAll() : null);
      this.modalView.draw(c, W, H, game, best, this.side, activeSettings, this.controls);
    }
  }
}
