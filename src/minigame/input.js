/**
 * 触屏输入层 —— 支持双手持握多点触控与经典小霸王十字键方案。
 *
 *   左手/单手 十字键：
 *     ← →  移动（按下立即执行，长按 DAS 连发：180ms 延迟后每 45ms 一次）
 *     ↑    旋转
 *     ↓    加速下落（同长按连发）；快速连按两下 ↓ = 硬降（双击窗口 280ms）
 *   右手 动作键（双手持握模式）：
 *     ↻ 旋转键   顺时针旋转方块
 *     ⤓ 硬降键   瞬间直落并锁定
 *   中置/顶部 控件：
 *     暂停       暂停游戏（居中胶囊键）
 *     顶部/弹窗   切换双手/左手/右手布局（三模循环，远离操作区防误触）
 *     道具槽位   点击直接使用/选取目标
 *
 *   多点触控（Multi-Touch）：
 *     左手按住方向平移/连发时，右手可同时并发点按旋转或硬降，互不干扰阻断。
 *
 * 注意：小游戏包内不使用 class #private 语法（见 BoardView.js 顶部说明）。
 */
/* global wx */

const DAS_DELAY = 0.18; // 长按首次重复前的延迟（秒）
const DAS_RATE = 0.045; // 连发间隔（秒）
const DOUBLE_TAP_MS = 280; // 连按两下 ↓ 触发硬降的窗口

export class Input {
  /**
   * @param ui  GameUI 实例（命中测试 / 按压态）
   * @param actions { getState, move, rotate, softDrop, hardDrop, pause, swap, primary, clickSlot, useGravity }
   */
  constructor(ui, actions) {
    this.ui = ui;
    this.a = actions;
    this.dpadTouch = null; // { id, control } 十字键当前手指
    this.actionTouch = null; // { id, control } 动作键当前手指
    this.held = null; // { act, t, rep } 长按连发
    this.overlayTouch = false;
    this._downPressedAt = 0; // 本次 ↓ 按下时刻
    this._downReleasedQuickly = 0; // 上次「快速点按 ↓」抬起的时刻（双击窗口）

    wx.onTouchStart((e) => this._onStart(e));
    wx.onTouchMove((e) => this._onMove(e));
    wx.onTouchEnd((e) => this._onEnd(e));
    wx.onTouchCancel(() => this._releaseAll());
  }

  /** 主循环每帧调用：驱动长按连发 */
  update(dt) {
    const h = this.held;
    if (!h) return;
    h.t += dt;
    if (h.t >= DAS_DELAY) {
      h.rep += dt;
      while (h.rep >= DAS_RATE) {
        h.rep -= DAS_RATE;
        h.act();
      }
    }
  }

  _releaseAll() {
    this.held = null;
    this.dpadTouch = null;
    this.actionTouch = null;
    this.overlayTouch = false;
    this.ui.setPressed(null);
  }

  /** 按下十字键四臂之一：立即执行，方向键附带长按连发 */
  _pressDpad(control, id) {
    this.ui.setPressed(control, true);
    this.dpadTouch = { id, control };

    if (control === 'up') {
      this.a.rotate(1);
      return;
    }

    const act =
      control === 'left'
        ? () => this.a.move(-1)
        : control === 'right'
          ? () => this.a.move(1)
          : () => this.a.softDrop();

    if (control === 'down') {
      this._downPressedAt = Date.now();
      const now = Date.now();
      if (this._downReleasedQuickly && now - this._downReleasedQuickly < DOUBLE_TAP_MS) {
        this._downReleasedQuickly = 0;
        this.a.hardDrop();
      } else {
        act();
      }
    } else {
      act();
    }
    this.held = { act, t: 0, rep: 0 };
  }

  /** 按下右手独立动作键（双手持握模式）：旋转 / 硬降 */
  _pressAction(control, id) {
    this.ui.setPressed(control, true);
    this.actionTouch = { id, control };

    if (control === 'btnRotate') {
      this.a.rotate(1);
    } else if (control === 'btnHardDrop') {
      this.a.hardDrop();
    }
  }

  _onStart(e) {
    const touches = e.changedTouches || (e.touches ? [e.touches[0]] : []);
    const st = this.a.getState();

    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if (!t) continue;
      const x = t.clientX;
      const y = t.clientY;
      const id = t.identifier;

      // 浮层状态（ready / paused / gameover / settings）：
      if (st !== 'playing' && st !== 'clearing') {
        const hit = this.ui.hitControl(x, y);
        if (hit === 'settingsClose') {
          if (this.a.closeSettings) this.a.closeSettings();
          else this.ui.closeSettings();
          return;
        }
        if (hit === 'settingVibe') {
          if (this.a.toggleVibrate) this.a.toggleVibrate();
          return;
        }
        if (hit && hit.startsWith('settingMode_')) {
          const mode = hit.replace('settingMode_', '');
          if (this.a.setControlMode) this.a.setControlMode(mode);
          return;
        }
        if (hit === 'swapOverlay' || hit === 'swapTop') {
          this.a.swap();
          return;
        }
        this.overlayTouch = true;
        return;
      }

      // 道具目标选取模式下的触控分发
      if (this.ui.targeting && this.ui.targeting.active) {
        const tgt = this.ui.targeting;
        const hit = this.ui.hitControl(x, y);
        if (hit === 'targetColTab') {
          tgt.mode = 'cols';
          tgt.startIdx = Math.min(7, tgt.startIdx);
          this.ui.dirty = true;
          return;
        }
        if (hit === 'targetRowTab') {
          tgt.mode = 'rows';
          tgt.startIdx = Math.min(18, tgt.startIdx);
          this.ui.dirty = true;
          return;
        }
        if (hit === 'targetPrev') {
          tgt.startIdx = Math.max(0, tgt.startIdx - 1);
          this.ui.dirty = true;
          return;
        }
        if (hit === 'targetNext') {
          const max = tgt.mode === 'cols' ? 7 : 18;
          tgt.startIdx = Math.min(max, tgt.startIdx + 1);
          this.ui.dirty = true;
          return;
        }
        if (hit === 'targetConfirm') {
          this.a.useGravity(tgt.mode, tgt.startIdx, tgt.dir);
          this.ui.cancelTargeting();
          return;
        }
        if (hit === 'targetCancel') {
          this.ui.cancelTargeting();
          return;
        }
        if (hit === 'boardArea') {
          this._updateTargetByCoords(x, y);
          return;
        }
        return;
      }

      const hit = this.ui.hitControl(x, y);
      if (!hit) continue;

      // 游戏中：顶部切换模式
      if (hit === 'swapTop') {
        this.a.swap();
        continue;
      }

      // 游戏中：点击暂停
      if (hit === 'pause') {
        this.a.pause();
        continue;
      }

      // 点击道具槽位
      if (hit.startsWith('slot_')) {
        const slotIdx = parseInt(hit.split('_')[1], 10);
        this.a.clickSlot(slotIdx);
        continue;
      }

      // 双手模式右手动作键
      if (hit === 'btnRotate' || hit === 'btnHardDrop') {
        this._pressAction(hit, id);
        continue;
      }

      // 十字键方向控制
      if (hit === 'up' || hit === 'down' || hit === 'left' || hit === 'right') {
        this._pressDpad(hit, id);
        continue;
      }
    }
  }

  _onMove(e) {
    if (this.ui.targeting && this.ui.targeting.active) {
      const t = e.touches[0];
      if (t) this._updateTargetByCoords(t.clientX, t.clientY);
      return;
    }

    // 手指在十字键上滑动切臂（支持连续滑动）
    const g = this.dpadTouch;
    if (!g) return;
    const t = Array.from(e.touches || []).find((tt) => tt.identifier === g.id);
    if (!t) return;
    const hit = this.ui.hitControl(t.clientX, t.clientY);
    if (
      hit &&
      hit !== g.control &&
      (hit === 'up' || hit === 'down' || hit === 'left' || hit === 'right')
    ) {
      this.ui.setPressed(g.control, false);
      this._pressDpad(hit, g.id);
    }
  }

  _updateTargetByCoords(x, y) {
    const tgt = this.ui.targeting;
    if (!tgt || !tgt.active) return;
    const { W, top, deckY } = this.ui;
    const bTop = top + 80;
    const bH = deckY - bTop - 12;
    const cellH = bH / 20;
    const bW = cellH * 10;
    const bLeft = (W - bW) / 2;
    const cellW = bW / 10;

    if (tgt.mode === 'cols') {
      const c = Math.floor((x - bLeft) / cellW);
      tgt.startIdx = Math.max(0, Math.min(7, c));
    } else {
      const r = Math.floor((y - bTop) / cellH);
      tgt.startIdx = Math.max(0, Math.min(18, r));
    }
    this.ui.dirty = true;
  }

  _onEnd(e) {
    if (this.overlayTouch) {
      this.overlayTouch = false;
      this.a.primary();
      return;
    }
    const changed = e.changedTouches || (e.touches ? [e.touches[0]] : []);
    for (let i = 0; i < changed.length; i++) {
      const t = changed[i];
      if (!t) continue;

      if (this.dpadTouch && t.identifier === this.dpadTouch.id) {
        if (this.dpadTouch.control === 'down') {
          const dur = Date.now() - (this._downPressedAt || 0);
          this._downPressedAt = 0;
          this._downReleasedQuickly = dur <= 220 ? Date.now() : 0;
        }
        this.ui.setPressed(this.dpadTouch.control, false);
        this.dpadTouch = null;
        this.held = null;
      }

      if (this.actionTouch && t.identifier === this.actionTouch.id) {
        this.ui.setPressed(this.actionTouch.control, false);
        this.actionTouch = null;
      }
    }
  }
}
