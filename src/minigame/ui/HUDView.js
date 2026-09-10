/**
 * 顶部 HUD 界面组件：记分板、NEXT 预览窗口及顶部模式切换胶囊。
 */
import { SHAPES, COLORS, FX_COLORS } from '../../constants.js';
import { PANEL, BORDER, ACCENT, TEXT, MUTED, FONT, CANVAS_ANGLE, drawRoundRect, drawPanel } from './UITheme.js';

export class HUDView {
  constructor() {
    this.controls = {
      swapTop: null,
    };
  }

  layout(W, top) {
    const topBtnW = 68;
    const topBtnH = 26;
    const topBtnY = top + 14;
    const topBtnX = Math.round(194 + (W - 96 - 194 - topBtnW) / 2);
    this.controls.swapTop = { x: topBtnX, y: topBtnY, w: topBtnW, h: topBtnH };
    return this.controls;
  }

  draw(ctx, W, top, game, side) {
    const c = ctx;

    // ---- 记分板 ----
    const px = 12;
    const py = top + 12;
    drawPanel(c, px, py, 182, 66, 12);
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

    // ---- NEXT 预览窗口 ----
    const nx = W - 96;
    const nw = 84;
    drawPanel(c, nx, py, nw, 74, 12);
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
        drawRoundRect(c, x, y, cell, cell, 3);
        c.fill();
      })
    );

    // 特殊格：效果色描边 + 激光方向箭头
    const sp = game.nextSpecial;
    if (sp) {
      const sx = gx + (sp.c - minC + offX) * (cell + gap);
      const sy = gy + (sp.r - minR + offY) * (cell + gap);
      const fxHex = '#' + FX_COLORS[sp.fx].toString(16).padStart(6, '0');
      drawRoundRect(c, sx - 1.5, sy - 1.5, cell + 3, cell + 3, 4);
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

    // ---- 顶部模式切换胶囊按键 ----
    const tb = this.controls.swapTop;
    if (tb) {
      c.fillStyle = 'rgba(13, 18, 38, 0.72)';
      c.strokeStyle = 'rgba(120, 140, 255, 0.35)';
      c.lineWidth = 1;
      drawRoundRect(c, tb.x, tb.y, tb.w, tb.h, 8);
      c.fill();
      c.stroke();

      c.font = `500 11px ${FONT}`;
      c.fillStyle = '#aab6dd';
      c.textAlign = 'center';
      const label = side === 'dual' ? '👐 双手' : side === 'right' ? '👉 右手' : '👈 左手';
      c.fillText(label, tb.x + tb.w / 2, tb.y + tb.h / 2 + 3.5);
      c.textAlign = 'left';
    }
  }
}
