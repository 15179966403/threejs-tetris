import * as THREE from 'three';
import { SHAPES, COLORS, FX_COLORS } from '../constants.js';

/* ---------- 与 Web 版 CSS 一致的配色 ---------- */
const PANEL = 'rgba(13, 18, 38, 0.72)';
const BORDER = 'rgba(120, 140, 255, 0.25)';
const ACCENT = '#22d3ee';
const TEXT = '#e2e8f0';
const MUTED = '#7d8bb0';
const FONT = `"PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif`;

/** 8 方向 -> NEXT 预览箭头旋转角（canvas y 轴向下，顺时针为正） */
const CANVAS_ANGLE = {
  up: 0,
  ne: Math.PI / 4,
  right: Math.PI / 2,
  se: (3 * Math.PI) / 4,
  down: Math.PI,
  sw: (-3 * Math.PI) / 4,
  left: -Math.PI / 2,
  nw: -Math.PI / 4,
};

/**
 * 小游戏 UI 层（小霸王手柄布局）：
 *
 *   [十字键]      [开始/选择]   [道具预留槽]
 *   D-pad：←→移动(长按连发) · ↑旋转 · ↓加速(长按连发) · 连按两下↓=硬降
 *   左右手模式可切换（SELECT），布局即时镜像并持久化。
 *
 * - 绘制到离屏 2D canvas → CanvasTexture → 正交相机全屏面片叠加；
 * - 脏检查：状态没变不重绘、不触发纹理上传。
 *
 * 注意：小游戏包内不使用 class #private 语法（见 BoardView.js 顶部说明）。
 */
export class GameUI {
  /**
   * @param uiScale  UI 画布像素密度
   * @param side     'left' | 'right'，十字键在哪一侧（默认 left）
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
    this.side = side === 'right' ? 'right' : 'left';
    this.controls = {}; // 十字键四臂 / 暂停 / 切换按键 的命中区
    this.itemPanel = null; // 道具预留面板
    this.deckY = 0;
    this.deckH = 0;

    this._cache = {
      state: '',
      score: -1,
      lines: -1,
      level: -1,
      next: '',
      best: -1,
      combo: -1,
      pressed: null,
    };
  }

  setSide(side) {
    const s = side === 'right' ? 'right' : 'left';
    if (s === this.side) return;
    this.side = s;
    this._layout();
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
    const m = 12;
    // 底部安全区适配：iOS Home Indicator 通常约为 34px，保底至少 12px
    const bottomInset = Math.max(this.bottom || 0, 12);
    // 十字键外径尺寸（适中大小，不超出下界）
    const cross = Math.max(116, Math.min(138, Math.floor(W * 0.34)));
    const arm = Math.floor(cross / 3);
    const topPad = 12;
    const bottomPad = 10;
    const deckH = cross + topPad + bottomPad + bottomInset;
    const deckY = H - deckH;
    // 控件垂直中心：确保十字键下边缘与底部安全区保留 bottomPad 间距，彻底避开 Home Bar
    const cy = deckY + topPad + cross / 2;
    const cx = this.side === 'left' ? m + cross / 2 : W - m - cross / 2;

    this.deckY = deckY;
    this.deckH = deckH;
    this.controls = {
      dpad: { x: cx - cross / 2, y: cy - cross / 2, w: cross, h: cross },
      center: { x: cx - arm / 2, y: cy - arm / 2, w: arm, h: arm },
      up: { x: cx - arm / 2, y: cy - cross / 2, w: arm, h: arm },
      down: { x: cx - arm / 2, y: cy + cross / 2 - arm, w: arm, h: arm },
      left: { x: cx - cross / 2, y: cy - arm / 2, w: arm, h: arm },
      right: { x: cx + cross / 2 - arm, y: cy - arm / 2, w: arm, h: arm },
    };

    // 道具预留槽面板（与十字键垂直中心对称）
    const zoneX = this.side === 'left' ? m + cross + 10 : m;
    const zoneW = W - m * 2 - cross - 20;
    const itemW = Math.max(86, Math.min(114, Math.floor(zoneW * 0.48)));
    const itemH = Math.min(cross, cross - 10);
    const itemX = this.side === 'left' ? W - m - itemW : m;
    this.itemPanel = { x: itemX, y: cy - itemH / 2, w: itemW, h: itemH };

    // 中部控制区：仅保留一枚独立的“暂停 / 开始”胶囊键，居中对称
    const pillW = Math.max(56, Math.min(74, zoneW - itemW - 14));
    const pillH = 32;
    const pillCx =
      this.side === 'left'
        ? zoneX + (zoneW - itemW) / 2
        : zoneX + itemW + (zoneW - itemW) / 2;
    this.controls.pause = { x: pillCx - pillW / 2, y: cy - pillH / 2, w: pillW, h: pillH };

    // 顶部 HUD 区域的防误触“左右手”快捷切换按钮（位于记分板与 NEXT 之间，避开微信胶囊）
    const topBtnW = 68;
    const topBtnH = 26;
    const topBtnY = this.top + 14;
    const topBtnX = Math.round(194 + (W - 96 - 194 - topBtnW) / 2);
    this.controls.swapTop = { x: topBtnX, y: topBtnY, w: topBtnW, h: topBtnH };

    // 浮层（Overlay）内部的左右手切换按钮（占位，实际在 _drawOverlay 绘制时精确定位）
    const pw = Math.min(W - 48, 340);
    const px = (W - pw) / 2;
    const swW = 200;
    const swH = 34;
    this.controls.swapOverlay = {
      x: px + (pw - swW) / 2,
      y: (H - 260) / 2 + 130,
      w: swW,
      h: swH,
    };
  }

  /**
   * 命中测试。
   * 游戏中：up/down/left/right/pause/swapTop；
   * 浮层状态：swapOverlay/swapTop 响应切换左右手，主区域响应主按钮。
   */
  hitControl(x, y) {
    const playing = this._cache.state === 'playing' || this._cache.state === 'clearing';
    const c = this.controls;
    const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (playing) {
      if (inR(c.swapTop)) return 'swapTop';
      for (const k of ['up', 'down', 'left', 'right', 'pause']) {
        if (inR(c[k])) return k;
      }
      return null;
    }
    // 浮层非游戏状态
    if (inR(c.swapOverlay)) return 'swapOverlay';
    if (inR(c.swapTop)) return 'swapTop';
    if (inR(c.primary)) return 'primary';
    return null;
  }

  setPressed(name) {
    if (this._cache.pressed !== name) {
      this._cache.pressed = name;
      this.dirty = true;
    }
  }

  /**
   * 每帧调用：状态有变才重绘并返回 true（调用方随后置 texture.needsUpdate）。
   */
  update(game, best) {
    const c = this._cache;
    if (
      game.state !== c.state ||
      game.score !== c.score ||
      game.lines !== c.lines ||
      game.level !== c.level ||
      game.nextType !== c.next ||
      best !== c.best ||
      game.combo !== c.combo
    ) {
      c.state = game.state;
      c.score = game.score;
      c.lines = game.lines;
      c.level = game.level;
      c.next = game.nextType;
      c.best = best;
      c.combo = game.combo;
      this.dirty = true;
    }
    if (!this.dirty) return false;
    this._draw(game, best);
    this.dirty = false;
    return true;
  }

  /* ================= 绘制 ================= */

  _rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  _panel(c, x, y, w, h) {
    this._rr(c, x, y, w, h, 12);
    c.fillStyle = PANEL;
    c.fill();
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    c.stroke();
  }

  _draw(game, best) {
    const c = this.ctx;
    const { W, H } = this;
    c.clearRect(0, 0, W, H);

    this._drawHud(game);
    // 连锁波次提示
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
    if (game.state === 'playing' || game.state === 'clearing') {
      this._drawDeck();
    } else {
      this._drawOverlay(game, best);
    }
  }

  _drawHud(game) {
    const c = this.ctx;
    const { W, top } = this;

    // ---- 记分板 ----
    const px = 12;
    const py = top + 12;
    this._panel(c, px, py, 182, 66);
    const cols = [
      ['S C O R E', String(game.score), px + 16],
      ['L I N E S', String(game.lines), px + 78],
      ['L E V E L', String(game.level), px + 136],
    ];
    for (const [label, value, x] of cols) {
      c.textAlign = 'left';
      c.fillStyle = MUTED;
      c.font = `9px ${FONT}`;
      c.fillText(label, x, py + 24);
      c.fillStyle = ACCENT;
      c.font = `700 20px ${FONT}`;
      c.fillText(value, x, py + 50);
    }

    // ---- NEXT 预览 ----
    const nx = W - 96;
    const nw = 84;
    this._panel(c, nx, py, nw, 74);
    c.fillStyle = MUTED;
    c.font = `9px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('N E X T', nx + nw / 2, py + 18);
    const cell = 13;
    const gap = 3;
    const gx = nx + (nw - (cell * 4 + gap * 3)) / 2;
    const gy = py + 26;
    const shape = SHAPES[game.nextType];
    let minR = 4, maxR = -1, minC = 4, maxC = -1;
    shape.forEach((row, r) =>
      row.forEach((v, cc) => {
        if (!v) return;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, cc); maxC = Math.max(maxC, cc);
      })
    );
    const offX = ((4 - (maxC - minC + 1)) / 2) | 0;
    const offY = ((4 - (maxR - minR + 1)) / 2) | 0;
    c.fillStyle = '#' + COLORS[game.nextType].toString(16).padStart(6, '0');
    shape.forEach((row, r) =>
      row.forEach((v, cc) => {
        if (!v) return;
        const x = gx + (cc - minC + offX) * (cell + gap);
        const y = gy + (r - minR + offY) * (cell + gap);
        this._rr(c, x, y, cell, cell, 3);
        c.fill();
      })
    );
    // 特殊格：效果色描边 + 激光方向箭头
    const sp = game.nextSpecial;
    if (sp) {
      const sx = gx + (sp.c - minC + offX) * (cell + gap);
      const sy = gy + (sp.r - minR + offY) * (cell + gap);
      const fxHex = '#' + FX_COLORS[sp.fx].toString(16).padStart(6, '0');
      this._rr(c, sx - 1.5, sy - 1.5, cell + 3, cell + 3, 4);
      c.strokeStyle = fxHex;
      c.lineWidth = 1.5;
      c.stroke();
      const mx = sx + cell / 2;
      const my = sy + cell / 2;
      c.fillStyle = fxHex;
      c.save();
      c.translate(mx, my);
      c.rotate(CANVAS_ANGLE[sp.fx] || 0);
      c.beginPath();
      c.moveTo(0, -4.5);
      c.lineTo(4, 1);
      c.lineTo(1.6, 1);
      c.lineTo(1.6, 4.5);
      c.lineTo(-1.6, 4.5);
      c.lineTo(-1.6, 1);
      c.lineTo(-4, 1);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.textAlign = 'left';
    // ---- 顶部防误触左右手快捷切换按键 ----
    const tb = this.controls.swapTop;
    if (tb) {
      const isRight = this.side === 'right';
      c.fillStyle = 'rgba(13, 18, 38, 0.72)';
      c.strokeStyle = 'rgba(120, 140, 255, 0.35)';
      c.lineWidth = 1;
      this._rr(c, tb.x, tb.y, tb.w, tb.h, 8);
      c.fill();
      c.stroke();

      c.font = `500 11px ${FONT}`;
      c.fillStyle = '#aab6dd';
      c.textAlign = 'center';
      c.fillText(isRight ? '🖐 右手' : '🖐 左手', tb.x + tb.w / 2, tb.y + tb.h / 2 + 3.5);
      c.textAlign = 'left';
    }
  }

  /* ---------- 手柄控制台 ---------- */

  _drawDeck() {
    const c = this.ctx;
    const { W, deckY, deckH } = this;

    // 控制台底板
    c.fillStyle = 'rgba(9, 12, 24, 0.55)';
    c.fillRect(0, deckY, W, deckH);
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, deckY + 0.5);
    c.lineTo(W, deckY + 0.5);
    c.stroke();

    this._drawDpad(c);
    this._drawItemPanel(c);
    this._drawPauseButton(c);
  }

  _drawDpad(c) {
    const d = this.controls;
    const cx = d.dpad.x + d.dpad.w / 2;
    const cy = d.dpad.y + d.dpad.h / 2;
    const arm = d.up.w;

    // 十字底座（横竖两条圆角矩形叠成十字），塑料渐变
    const g = c.createLinearGradient(0, d.dpad.y, 0, d.dpad.y + d.dpad.h);
    g.addColorStop(0, '#263156');
    g.addColorStop(1, '#141a36');
    c.fillStyle = g;
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    this._rr(c, d.dpad.x, cy - arm / 2, d.dpad.w, arm, 10);
    c.fill();
    c.stroke();
    this._rr(c, cx - arm / 2, d.dpad.y, arm, d.dpad.h, 10);
    c.fill();
    c.stroke();

    // 中心枢纽
    c.fillStyle = 'rgba(7, 10, 20, 0.5)';
    this._rr(c, d.center.x + 4, d.center.y + 4, d.center.w - 8, d.center.h - 8, 6);
    c.fill();

    // 四臂：按下高亮 + 方向箭头
    for (const k of ['up', 'down', 'left', 'right']) {
      const r = d[k];
      const pressed = this._cache.pressed === k;
      if (pressed) {
        c.fillStyle = 'rgba(34, 211, 238, 0.22)';
        c.strokeStyle = ACCENT;
        this._rr(c, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 9);
        c.fill();
        c.stroke();
      }
      const mx = r.x + r.w / 2;
      const my = r.y + r.h / 2;
      const s = 7;
      c.fillStyle = pressed ? ACCENT : '#aab6dd';
      c.beginPath();
      if (k === 'up') { c.moveTo(mx, my - s); c.lineTo(mx + s, my + s * 0.7); c.lineTo(mx - s, my + s * 0.7); }
      else if (k === 'down') { c.moveTo(mx, my + s); c.lineTo(mx + s, my - s * 0.7); c.lineTo(mx - s, my - s * 0.7); }
      else if (k === 'left') { c.moveTo(mx - s, my); c.lineTo(mx + s * 0.7, my + s); c.lineTo(mx + s * 0.7, my - s); }
      else { c.moveTo(mx + s, my); c.lineTo(mx - s * 0.7, my + s); c.lineTo(mx - s * 0.7, my - s); }
      c.closePath();
      c.fill();
    }
  }

  _drawItemPanel(c) {
    const p = this.itemPanel;
    this._panel(c, p.x, p.y, p.w, p.h);
    c.textAlign = 'center';
    c.fillStyle = MUTED;
    c.font = `9px ${FONT}`;
    c.fillText('道 具', p.x + p.w / 2, p.y + 16);

    // A/B 预留槽位（虚线圆，后续道具按钮放这里）
    const r = Math.min(15, Math.floor(p.w * 0.15));
    c.setLineDash([4, 3]);
    c.strokeStyle = 'rgba(125, 139, 176, 0.55)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(p.x + p.w * 0.32, p.y + p.h * 0.62, r, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(p.x + p.w * 0.68, p.y + p.h * 0.42, r, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(125, 139, 176, 0.55)';
    c.font = `10px ${FONT}`;
    c.fillText('A', p.x + p.w * 0.32, p.y + p.h * 0.62 + 3.5);
    c.fillText('B', p.x + p.w * 0.68, p.y + p.h * 0.42 + 3.5);
    c.textAlign = 'left';
  }

  _drawPauseButton(c) {
    const r = this.controls.pause;
    if (!r) return;
    const pressed = this._cache.pressed === 'pause';
    c.fillStyle = pressed ? 'rgba(34, 211, 238, 0.25)' : 'rgba(13, 18, 38, 0.85)';
    c.strokeStyle = pressed ? ACCENT : 'rgba(125, 139, 176, 0.65)';
    c.lineWidth = 1;
    this._rr(c, r.x, r.y, r.w, r.h, r.h / 2);
    c.fill();
    c.stroke();

    c.fillStyle = pressed ? ACCENT : '#c5d1ec';
    c.font = `600 11px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('暂 停', r.x + r.w / 2, r.y + r.h / 2 + 4);
    c.textAlign = 'left';
  }

  /* ---------- 浮层 ---------- */

  _drawOverlay(game, best) {
    const c = this.ctx;
    const { W, H } = this;

    // 半透明遮罩
    c.fillStyle = 'rgba(5, 8, 18, 0.65)';
    c.fillRect(0, 0, W, H);

    const pw = Math.min(W - 48, 330);
    const state = game.state;
    const ph = state === 'gameover' ? 280 : state === 'ready' ? 288 : 240;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - 20;
    this._panel(c, px, py, pw, ph);

    c.textAlign = 'center';
    // 标题（带辉光）
    c.shadowColor = 'rgba(34, 211, 238, 0.55)';
    c.shadowBlur = 24;
    c.fillStyle = ACCENT;
    c.font = `700 32px ${FONT}`;
    const title = state === 'ready' ? '3D TETRIS' : state === 'paused' ? 'PAUSED' : 'GAME OVER';
    c.fillText(title, W / 2, py + 56);
    c.shadowBlur = 0;

    c.font = `12px ${FONT}`;
    c.fillStyle = '#9fb0d8';
    let swY = py + 160;
    if (state === 'ready') {
      c.fillText('十字键 ←→ 移动 · ↑ 旋转', W / 2, py + 88);
      c.fillText('↓ 加速 · 连按两下↓ 直接落地', W / 2, py + 110);
      c.fillText('发光格 8 向效果：直线清除 · 斜向取反', W / 2, py + 132);
      swY = py + 158;
    } else if (state === 'paused') {
      c.fillText('游戏已暂停', W / 2, py + 92);
      swY = py + 120;
    } else {
      c.font = `700 22px ${FONT}`;
      c.fillStyle = ACCENT;
      c.fillText(`本局得分  ${game.score}`, W / 2, py + 94);
      c.font = `12px ${FONT}`;
      c.fillStyle = '#9fb0d8';
      c.fillText(`消除 ${game.lines} 行 · 等级 ${game.level}`, W / 2, py + 122);
      c.fillText(`最高分 ${Math.max(best, game.score)}`, W / 2, py + 144);
      swY = py + 164;
    }

    // 左右手布局设置按键（在浮层中，防误触）
    const swW = 200;
    const swH = 34;
    const swX = px + (pw - swW) / 2;
    this.controls.swapOverlay = { x: swX, y: swY, w: swW, h: swH };

    const isRight = this.side === 'right';
    c.fillStyle = 'rgba(20, 28, 58, 0.85)';
    c.strokeStyle = 'rgba(120, 140, 255, 0.45)';
    c.lineWidth = 1;
    this._rr(c, swX, swY, swW, swH, swH / 2);
    c.fill();
    c.stroke();

    c.font = `500 12px ${FONT}`;
    c.fillStyle = '#c5d1ec';
    c.textAlign = 'center';
    c.fillText(
      isRight ? '🖐 操作模式：右手 (点击切换)' : '🖐 操作模式：左手 (点击切换)',
      swX + swW / 2,
      swY + swH / 2 + 4
    );

    // 主操作按钮
    const bw = 184;
    const bh = 44;
    const bx = (W - bw) / 2;
    const by = py + ph - bh - 20;
    this.controls.primary = { x: bx, y: by, w: bw, h: bh };

    const grad = c.createLinearGradient(bx, by, bx + bw, by + bh);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#4f8dff');
    this._rr(c, bx, by, bw, bh, 10);
    c.fillStyle = grad;
    c.fill();
    c.fillStyle = '#04101a';
    c.font = `600 16px ${FONT}`;
    c.fillText(
      state === 'ready' ? '开始游戏' : state === 'paused' ? '继续游戏' : '再来一局',
      W / 2,
      by + 28
    );
  }
}
