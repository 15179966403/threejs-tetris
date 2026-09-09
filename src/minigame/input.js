/**
 * 触屏输入层 —— 小霸王十字键方案。
 *
 *   ← →  移动（按下立即执行，长按 DAS 连发：180ms 延迟后每 45ms 一次）
 *   ↑    旋转
 *   ↓    加速下落（同长按连发）；快速连按两下 ↓ = 硬降（双击窗口 280ms）
 *   暂停  暂停游戏（居中药丸键）
 *   顶部/弹窗  切换左右手布局（远离操作区防误触）
 *   手指在十字键上滑动可直接切到相邻臂（实体手柄手感）
 *   浮层状态：点主按钮/任意处 = 主操作（开始/继续/再来一局）；切换按钮可随时切换布局
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
   * @param actions { getState, move, rotate, softDrop, hardDrop, pause, swap, primary }
   */
  constructor(ui, actions) {
    this.ui = ui;
    this.a = actions;
    this.dpadTouch = null; // { id, control } 十字键当前手指
    this.held = null; // { act, t, rep } 长按连发
    this.overlayTouch = false;
    this._downPressedAt = 0; // 本次 ↓ 按下时刻
    this._downReleasedQuickly = 0; // 上次「快速点按 ↓」抬起的时刻（双击窗口）

    wx.onTouchStart((e) => this._onStart(e));
    wx.onTouchMove((e) => this._onMove(e));
    wx.onTouchEnd((e) => this._onEnd(e));
    wx.onTouchCancel(() => this._release());
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

  _release() {
    this.held = null;
    this.ui.setPressed(null);
  }

  /** 按下某个控件：立即执行对应动作，方向键附带长按连发 */
  _press(control, id) {
    this.ui.setPressed(control);
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
      // 连按两下 ↓（两次快速点按）= 硬降；长按后或滑过后不算「连按」
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

  _onStart(e) {
    const t = e.touches[0];
    if (!t) return;
    const x = t.clientX;
    const y = t.clientY;
    const st = this.a.getState();

    // 浮层状态（ready / paused / gameover）：抬起时触发主操作；左右手切换按钮响应切换
    if (st !== 'playing' && st !== 'clearing') {
      const hit = this.ui.hitControl(x, y);
      if (hit === 'swapOverlay' || hit === 'swapTop') {
        this.a.swap();
        return;
      }
      this.overlayTouch = true;
      return;
    }

    const hit = this.ui.hitControl(x, y);

    // 游戏中：顶部切换左右手
    if (hit === 'swapTop') {
      this.a.swap();
      return;
    }

    // 游戏中：点击暂停
    if (hit === 'pause') {
      this.a.pause();
      return;
    }

    // 已有手指按住十字键：第二根手指只响应暂停或顶部切换
    if (this.dpadTouch) {
      if (hit === 'pause') this.a.pause();
      else if (hit === 'swapTop') this.a.swap();
      return;
    }

    if (hit) this._press(hit, t.identifier);
  }

  _onMove(e) {
    const g = this.dpadTouch;
    if (!g) return;
    const t = e.touches.find((tt) => tt.identifier === g.id) || e.touches[0];
    if (!t) return;
    const hit = this.ui.hitControl(t.clientX, t.clientY);
    // 手指滑到相邻臂：松开旧臂、按下新臂（实体十字键手感）
    if (
      hit &&
      hit !== g.control &&
      (hit === 'up' || hit === 'down' || hit === 'left' || hit === 'right')
    ) {
      this._release();
      this._press(hit, g.id);
    }
  }

  _onEnd(e) {
    if (this.overlayTouch) {
      this.overlayTouch = false;
      this.a.primary();
      return;
    }
    if (!this.dpadTouch) return;
    const t =
      (e.changedTouches || []).find((tt) => tt.identifier === this.dpadTouch.id) ||
      e.changedTouches[0];
    if (!t) return;
    // ↓ 快速点按（<220ms）才计入双击窗口；长按/滑动不算
    if (this.dpadTouch.control === 'down') {
      const dur = Date.now() - (this._downPressedAt || 0);
      this._downPressedAt = 0;
      this._downReleasedQuickly = dur <= 220 ? Date.now() : 0;
    }
    this._release();
    this.dpadTouch = null;
  }
}
