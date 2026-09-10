/**
 * 顶部 HUD 界面组件：记分板、NEXT 预览窗口及顶部模式切换胶囊。
 */
import { SHAPES, COLORS, FX_COLORS } from '../../constants.js';
import {
  BORDER,
  ACCENT,
  ACCENT_CYAN,
  ACCENT_PURPLE,
  ACCENT_GOLD,
  TEXT,
  MUTED,
  FONT,
  CANVAS_ANGLE,
  drawRoundRect,
  drawPanel,
  drawTechCorners,
} from './UITheme.js';

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

    // ---- 记分板（左上角科技微型仪表盘） ----
    const px = 12;
    const py = top + 12;
    const pw = 182;
    const ph = 66;
    drawPanel(c, px, py, pw, ph, 12, {
      bgTop: 'rgba(16, 24, 52, 0.85)',
      bgBot: 'rgba(8, 12, 28, 0.92)',
      border: 'rgba(120, 160, 255, 0.28)',
    });
    drawTechCorners(c, px, py, pw, ph, 6, 'rgba(34, 211, 238, 0.45)');

    // 内部垂直微弱分隔线
    c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px + 68, py + 16);
    c.lineTo(px + 68, py + ph - 14);
    c.moveTo(px + 126, py + 16);
    c.lineTo(px + 126, py + ph - 14);
    c.stroke();

    const cols = [
      { label: 'SCORE', value: String(game.score), x: px + 14, color: ACCENT_CYAN, dotColor: '#00f2fe' },
      { label: 'LINES', value: String(game.lines), x: px + 76, color: ACCENT_PURPLE, dotColor: '#c084fc' },
      { label: 'LEVEL', value: String(game.level), x: px + 134, color: ACCENT_GOLD, dotColor: '#fbbf24' },
    ];

    for (const col of cols) {
      c.textAlign = 'left';
      // 小彩色指示圆点
      c.beginPath();
      c.arc(col.x + 3, py + 21, 2.5, 0, Math.PI * 2);
      c.fillStyle = col.dotColor;
      c.shadowColor = col.dotColor;
      c.shadowBlur = 4;
      c.fill();
      c.shadowBlur = 0;

      // 标签
      c.fillStyle = MUTED;
      c.font = `600 9px ${FONT}`;
      c.fillText(col.label, col.x + 9, py + 24);

      // 数值展示
      c.fillStyle = col.color;
      c.font = `700 20px ${FONT}`;
      if (col.value !== '0') {
        c.shadowColor = col.color;
        c.shadowBlur = 8;
      }
      c.fillText(col.value, col.x + 2, py + 50);
      c.shadowBlur = 0;
    }

    // ---- NEXT 预览窗口（右上角晶格仓） ----
    const nx = W - 96;
    const nw = 84;
    const nh = 74;
    drawPanel(c, nx, py, nw, nh, 12, {
      bgTop: 'rgba(16, 24, 52, 0.85)',
      bgBot: 'rgba(8, 12, 28, 0.92)',
      border: 'rgba(120, 160, 255, 0.28)',
    });
    drawTechCorners(c, nx, py, nw, nh, 5, 'rgba(34, 211, 238, 0.45)');

    // NEXT 标题胶囊标头
    c.fillStyle = 'rgba(34, 211, 238, 0.12)';
    drawRoundRect(c, nx + nw / 2 - 24, py + 8, 48, 14, 7);
    c.fill();
    c.fillStyle = ACCENT;
    c.font = `700 9px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('N E X T', nx + nw / 2, py + 18);

    // 4x4 预览区晶格背景微点
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

    const pieceHex = '#' + COLORS[game.nextType].toString(16).padStart(6, '0');

    // 绘制方块（带微立体倒角与高光反光，宛如发光晶体）
    shape.forEach((row, r) =>
      row.forEach((v, cc) => {
        if (!v) return;
        const x = gx + (cc - minC + offX) * (cell + gap);
        const y = gy + (r - minR + offY) * (cell + gap);

        // 主体发光底盘
        drawRoundRect(c, x, y, cell, cell, 3.5);
        c.fillStyle = pieceHex;
        c.shadowColor = pieceHex;
        c.shadowBlur = 6;
        c.fill();
        c.shadowBlur = 0;

        // 顶面半透明高光层
        const highGrad = c.createLinearGradient(x, y, x, y + cell / 2);
        highGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        highGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        drawRoundRect(c, x + 0.5, y + 0.5, cell - 1, cell * 0.5, 2.5);
        c.fillStyle = highGrad;
        c.fill();
      })
    );

    // 特殊格：高亮环形光晕 + 激光方向箭头
    const sp = game.nextSpecial;
    if (sp) {
      const sx = gx + (sp.c - minC + offX) * (cell + gap);
      const sy = gy + (sp.r - minR + offY) * (cell + gap);
      const fxHex = '#' + FX_COLORS[sp.fx].toString(16).padStart(6, '0');

      // 围绕特殊格的外环光圈
      drawRoundRect(c, sx - 2, sy - 2, cell + 4, cell + 4, 5);
      c.strokeStyle = fxHex;
      c.lineWidth = 1.5;
      c.shadowColor = fxHex;
      c.shadowBlur = 8;
      c.stroke();
      c.shadowBlur = 0;

      const mx = sx + cell / 2;
      const my = sy + cell / 2;
      c.fillStyle = '#ffffff';
      c.save();
      c.translate(mx, my);
      c.rotate(CANVAS_ANGLE[sp.fx] || 0);
      c.beginPath();
      c.moveTo(0, -4.5);
      c.lineTo(3.8, 1);
      c.lineTo(1.5, 1);
      c.lineTo(1.5, 4.5);
      c.lineTo(-1.5, 4.5);
      c.lineTo(-1.5, 1);
      c.lineTo(-3.8, 1);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.textAlign = 'left';

    // ---- 顶部模式切换胶囊按键 ----
    const tb = this.controls.swapTop;
    if (tb) {
      // 科技感半透明胶囊
      drawPanel(c, tb.x, tb.y, tb.w, tb.h, tb.h / 2, {
        bgTop: 'rgba(20, 28, 62, 0.85)',
        bgBot: 'rgba(10, 15, 34, 0.92)',
        border: 'rgba(120, 160, 255, 0.35)',
      });

      // 状态发光绿/青色小圆点
      const dotX = tb.x + 12;
      const dotY = tb.y + tb.h / 2;
      c.beginPath();
      c.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      c.fillStyle = side === 'dual' ? '#00f2fe' : '#34d399';
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 5;
      c.fill();
      c.shadowBlur = 0;

      c.font = `600 11px ${FONT}`;
      c.fillStyle = '#dbeafe';
      c.textAlign = 'center';
      const label = side === 'dual' ? '双手' : side === 'right' ? '右手' : '左手';
      c.fillText(label, tb.x + tb.w / 2 + 5, tb.y + tb.h / 2 + 3.5);
      c.textAlign = 'left';
    }
  }
}

