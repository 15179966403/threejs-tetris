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

    // 道具使用目标选取状态
    this.targeting = {
      active: false,
      itemIdx: -1,
      mode: 'cols', // 'cols' | 'rows'
      startIdx: 4,
      dir: 'down',
    };

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
    };
  }

  startTargeting(itemIdx) {
    this.targeting.active = true;
    this.targeting.itemIdx = itemIdx;
    this.targeting.mode = 'cols';
    this.targeting.startIdx = 4;
    this.targeting.dir = 'down';
    this.dirty = true;
  }

  cancelTargeting() {
    this.targeting.active = false;
    this.targeting.itemIdx = -1;
    this.dirty = true;
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

    // 道具栏面板（与十字键垂直中心对称）
    const zoneX = this.side === 'left' ? m + cross + 10 : m;
    const zoneW = W - m * 2 - cross - 20;
    const itemW = Math.max(104, Math.min(124, Math.floor(zoneW * 0.52)));
    const itemH = Math.min(cross, cross - 10);
    const itemX = this.side === 'left' ? W - m - itemW : m;
    this.itemPanel = { x: itemX, y: cy - itemH / 2, w: itemW, h: itemH };

    // 道具 5 个槽位：上排 3 个，下排 2 个居中
    const slotS = Math.max(26, Math.min(30, Math.floor((itemW - 20) / 3)));
    const gapX = Math.floor((itemW - 16 - slotS * 3) / 2);
    const row1W = slotS * 3 + gapX * 2;
    const row2W = slotS * 2 + gapX;
    const r1X = itemX + (itemW - row1W) / 2;
    const r2X = itemX + (itemW - row2W) / 2;
    const r1Y = cy - itemH / 2 + 34;
    const r2Y = r1Y + slotS + 6;

    this.controls.slots = [
      { x: r1X, y: r1Y, w: slotS, h: slotS },
      { x: r1X + slotS + gapX, y: r1Y, w: slotS, h: slotS },
      { x: r1X + (slotS + gapX) * 2, y: r1Y, w: slotS, h: slotS },
      { x: r2X, y: r2Y, w: slotS, h: slotS },
      { x: r2X + slotS + gapX, y: r2Y, w: slotS, h: slotS },
    ];

    // 中部控制区：仅保留一枚独立的“暂停 / 开始”胶囊键，居中对称
    const pillW = Math.max(52, Math.min(68, zoneW - itemW - 12));
    const pillH = 32;
    const pillCx =
      this.side === 'left'
        ? zoneX + (zoneW - itemW) / 2
        : zoneX + itemW + (zoneW - itemW) / 2;
    this.controls.pause = { x: pillCx - pillW / 2, y: cy - pillH / 2, w: pillW, h: pillH };

    // 目标选取控制区（在 targeting 模式下接管控制台区域）
    const tgtBtnH = 34;
    const tgtW = W - m * 2;
    const tgtY = deckY + 8;
    const tabW = (tgtW - 10) / 2;
    this.controls.targetColTab = { x: m, y: tgtY, w: tabW, h: tgtBtnH };
    this.controls.targetRowTab = { x: m + tabW + 10, y: tgtY, w: tabW, h: tgtBtnH };

    const stepY = tgtY + tgtBtnH + 8;
    const arrowW = 46;
    this.controls.targetPrev = { x: m, y: stepY, w: arrowW, h: tgtBtnH };
    this.controls.targetNext = { x: W - m - arrowW, y: stepY, w: arrowW, h: tgtBtnH };
    this.controls.targetLabel = { x: m + arrowW + 8, y: stepY, w: tgtW - arrowW * 2 - 16, h: tgtBtnH };

    const actY = stepY + tgtBtnH + 8;
    const okW = Math.floor(tgtW * 0.62);
    const cancelW = tgtW - okW - 10;
    this.controls.targetConfirm = { x: m, y: actY, w: okW, h: tgtBtnH + 4 };
    this.controls.targetCancel = { x: m + okW + 10, y: actY, w: cancelW, h: tgtBtnH + 4 };

    // 棋盘全屏触摸交互区
    this.controls.boardArea = { x: m, y: this.top + 76, w: W - m * 2, h: deckY - (this.top + 76) - 10 };


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
   * 游戏中：up/down/left/right/pause/swapTop/slot_0..4/targeting controls；
   * 浮层状态：swapOverlay/swapTop 响应切换左右手，主区域响应主按钮。
   */
  hitControl(x, y) {
    const c = this.controls;
    const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

    // 道具目标选取模式下：优先响应选取控制
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
    const itemsCount = (game.items && game.items.length) || 0;
    const itemEnergy = game.itemEnergy || 0;
    const tgtActive = !!(this.targeting && this.targeting.active);
    const tgtIdx = this.targeting ? this.targeting.startIdx : -1;
    const tgtMode = this.targeting ? this.targeting.mode : '';

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
      tgtMode !== c.tgtMode
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
    if (this.targeting && this.targeting.active) {
      this._drawTargetingHighlight(c);
    }
    if (game.state === 'playing' || game.state === 'clearing') {
      this._drawDeck(game);
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

  _drawDeck(game) {
    const c = this.ctx;
    const { W, deckY, deckH } = this;

    if (this.targeting && this.targeting.active) {
      this._drawTargetingControls(c);
      return;
    }

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
    this._drawItemPanel(c, game);
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

  _drawItemPanel(c, game) {
    const p = this.itemPanel;
    this._panel(c, p.x, p.y, p.w, p.h);

    // 顶部：能量条
    const curEnergy = game ? (game.itemEnergy || 0) : 0;
    const reqEnergy = game ? (game.requiredEnergy || 3) : 3;
    const pct = Math.min(1, curEnergy / reqEnergy);

    c.font = `600 9px ${FONT}`;
    c.fillStyle = pct >= 1 ? '#facc15' : '#22d3ee';
    c.textAlign = 'left';
    c.fillText('⚡ 能量', p.x + 8, p.y + 15);
    c.textAlign = 'right';
    c.fillText(`${curEnergy}/${reqEnergy}`, p.x + p.w - 8, p.y + 15);

    // 能量槽进度条
    const barX = p.x + 8;
    const barY = p.y + 20;
    const barW = p.w - 16;
    const barH = 5;
    this._rr(c, barX, barY, barW, barH, 2.5);
    c.fillStyle = 'rgba(20, 28, 55, 0.8)';
    c.fill();
    if (pct > 0) {
      const fillW = Math.max(5, barW * pct);
      const bg = c.createLinearGradient(barX, 0, barX + fillW, 0);
      bg.addColorStop(0, '#3b82f6');
      bg.addColorStop(1, pct >= 1 ? '#facc15' : '#22d3ee');
      c.fillStyle = bg;
      this._rr(c, barX, barY, fillW, barH, 2.5);
      c.fill();
    }

    // 5 个道具槽位
    const items = (game && game.items) || [];
    const slots = this.controls.slots || [];
    for (let i = 0; i < 5; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const item = items[i];
      if (item) {
        // 已获得道具：实心发光微立体质感按钮
        const g = c.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
        g.addColorStop(0, '#1e2d5a');
        g.addColorStop(1, '#0f172a');
        c.fillStyle = g;
        this._rr(c, slot.x, slot.y, slot.w, slot.h, 7);
        c.fill();
        c.strokeStyle = '#22d3ee';
        c.lineWidth = 1.5;
        c.stroke();

        // 重力图标与文字
        c.fillStyle = '#22d3ee';
        c.font = `700 13px ${FONT}`;
        c.textAlign = 'center';
        c.fillText('⤓', slot.x + slot.w / 2, slot.y + slot.h / 2 + 1);
        c.font = `600 7px ${FONT}`;
        c.fillStyle = '#cbd5e1';
        c.fillText('重力', slot.x + slot.w / 2, slot.y + slot.h - 3);
      } else {
        // 空槽位：微弱虚线框与数字序号
        c.setLineDash([3, 2]);
        c.strokeStyle = 'rgba(100, 116, 139, 0.4)';
        c.lineWidth = 1;
        this._rr(c, slot.x, slot.y, slot.w, slot.h, 7);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = 'rgba(100, 116, 139, 0.45)';
        c.font = `500 10px ${FONT}`;
        c.textAlign = 'center';
        c.fillText(String(i + 1), slot.x + slot.w / 2, slot.y + slot.h / 2 + 3.5);
      }
    }
    c.textAlign = 'left';
  }

  /* ---------- 目标选取界面（Targeting Overlay） ---------- */

  _drawTargetingControls(c) {
    const { W, deckY, deckH } = this;
    const tgt = this.targeting;

    // 控制台半透明底板
    c.fillStyle = 'rgba(9, 12, 24, 0.88)';
    c.fillRect(0, deckY, W, deckH);
    c.strokeStyle = '#22d3ee';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, deckY + 0.5);
    c.lineTo(W, deckY + 0.5);
    c.stroke();

    // 1. 模式切换 Tab
    const colTab = this.controls.targetColTab;
    const rowTab = this.controls.targetRowTab;
    const isCols = tgt.mode === 'cols';

    // 列选择 Tab
    this._rr(c, colTab.x, colTab.y, colTab.w, colTab.h, 8);
    c.fillStyle = isCols ? 'rgba(34, 211, 238, 0.25)' : 'rgba(20, 28, 55, 0.6)';
    c.fill();
    c.strokeStyle = isCols ? '#22d3ee' : BORDER;
    c.lineWidth = isCols ? 1.5 : 1;
    c.stroke();
    c.fillStyle = isCols ? '#22d3ee' : MUTED;
    c.font = `600 12px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('↔ 选连续 2 列 (下落)', colTab.x + colTab.w / 2, colTab.y + colTab.h / 2 + 4);

    // 行选择 Tab
    this._rr(c, rowTab.x, rowTab.y, rowTab.w, rowTab.h, 8);
    c.fillStyle = !isCols ? 'rgba(34, 211, 238, 0.25)' : 'rgba(20, 28, 55, 0.6)';
    c.fill();
    c.strokeStyle = !isCols ? '#22d3ee' : BORDER;
    c.lineWidth = !isCols ? 1.5 : 1;
    c.stroke();
    c.fillStyle = !isCols ? '#22d3ee' : MUTED;
    c.fillText('↕ 选连续 2 行 (下落)', rowTab.x + rowTab.w / 2, rowTab.y + rowTab.h / 2 + 4);

    // 2. 步进选择指示器 [ ◀ ] [ 选中第 X-Y 列/行 ] [ ▶ ]
    const prev = this.controls.targetPrev;
    const next = this.controls.targetNext;
    const lbl = this.controls.targetLabel;

    this._rr(c, prev.x, prev.y, prev.w, prev.h, 6);
    c.fillStyle = 'rgba(30, 41, 75, 0.8)';
    c.fill();
    c.strokeStyle = BORDER;
    c.stroke();
    c.fillStyle = '#cbd5e1';
    c.font = `700 15px ${FONT}`;
    c.fillText('◀', prev.x + prev.w / 2, prev.y + prev.h / 2 + 5);

    this._rr(c, next.x, next.y, next.w, next.h, 6);
    c.fillStyle = 'rgba(30, 41, 75, 0.8)';
    c.fill();
    c.strokeStyle = BORDER;
    c.stroke();
    c.fillText('▶', next.x + next.w / 2, next.y + next.h / 2 + 5);

    const desc = isCols
      ? `已选第 ${tgt.startIdx + 1} - ${tgt.startIdx + 2} 列 (可点触棋盘)`
      : `已选第 ${tgt.startIdx + 1} - ${tgt.startIdx + 2} 行 (可点触棋盘)`;
    c.font = `600 12px ${FONT}`;
    c.fillStyle = '#38bdf8';
    c.fillText(desc, lbl.x + lbl.w / 2, lbl.y + lbl.h / 2 + 4);

    // 3. 确认与取消按钮
    const ok = this.controls.targetConfirm;
    const cancel = this.controls.targetCancel;

    // 确认释放
    const okGrad = c.createLinearGradient(ok.x, ok.y, ok.x + ok.w, ok.y);
    okGrad.addColorStop(0, '#0284c7');
    okGrad.addColorStop(1, '#06b6d4');
    this._rr(c, ok.x, ok.y, ok.w, ok.h, 8);
    c.fillStyle = okGrad;
    c.fill();
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = `700 13px ${FONT}`;
    c.fillText('⤓ 确认释放重力', ok.x + ok.w / 2, ok.y + ok.h / 2 + 4.5);

    // 取消
    this._rr(c, cancel.x, cancel.y, cancel.w, cancel.h, 8);
    c.fillStyle = 'rgba(30, 41, 59, 0.85)';
    c.fill();
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#94a3b8';
    c.font = `600 12px ${FONT}`;
    c.fillText('✖ 取消', cancel.x + cancel.w / 2, cancel.y + cancel.h / 2 + 4);
    c.textAlign = 'left';
  }

  _drawTargetingHighlight(c) {
    if (!this.targeting || !this.targeting.active) return;
    const { W, top, deckY } = this;
    const tgt = this.targeting;
    const isCols = tgt.mode === 'cols';

    // 棋盘绘制区域估算（与 3D 棋盘位置匹配）
    const bTop = top + 80;
    const bH = deckY - bTop - 12;
    const cellH = bH / 20;
    const bW = cellH * 10;
    const bLeft = (W - bW) / 2;
    const cellW = bW / 10;

    c.save();
    if (isCols) {
      const x = bLeft + tgt.startIdx * cellW;
      const w = cellW * 2;
      const y = bTop;
      const h = bH;

      // 选区纵向光带
      c.fillStyle = 'rgba(34, 211, 238, 0.22)';
      c.fillRect(x, y, w, h);
      c.strokeStyle = '#22d3ee';
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);

      // 下坠箭头光标
      c.fillStyle = '#22d3ee';
      c.font = `700 16px ${FONT}`;
      c.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        c.fillText('⤓', x + w / 2, y + 25 + i * (h / 5));
      }
    } else {
      const x = bLeft;
      const w = bW;
      const y = bTop + tgt.startIdx * cellH;
      const h = cellH * 2;

      // 选区横向光带
      c.fillStyle = 'rgba(34, 211, 238, 0.22)';
      c.fillRect(x, y, w, h);
      c.strokeStyle = '#22d3ee';
      c.lineWidth = 2;
      c.strokeRect(x, y, w, h);

      // 下坠箭头光标
      c.fillStyle = '#22d3ee';
      c.font = `700 16px ${FONT}`;
      c.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        c.fillText('⤓', x + 20 + i * (w / 5), y + h / 2 + 5);
      }
    }
    c.restore();
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
