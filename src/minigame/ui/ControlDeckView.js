/**
 * 底部手柄控制台组件：十字方向键、双手动作按键组（旋转/硬降）、暂停胶囊键。
 */
import { BORDER, ACCENT, FONT, drawRoundRect } from './UITheme.js';

export class ControlDeckView {
  /** 计算控制台及内部所有按键的位置与尺寸 */
  layout(W, H, bottom, side) {
    const m = 12;
    const bottomInset = Math.max(bottom || 0, 12);
    const cross = Math.max(116, Math.min(138, Math.floor(W * 0.34)));
    const arm = Math.floor(cross / 3);
    const topPad = 12;
    const bottomPad = 10;
    const deckH = cross + topPad + bottomPad + bottomInset;
    const deckY = H - deckH;
    const cy = deckY + topPad + cross / 2;
    const cx = side === 'right' ? W - m - cross / 2 : m + cross / 2;

    const controls = {
      dpad: { x: cx - cross / 2, y: cy - cross / 2, w: cross, h: cross },
      center: { x: cx - arm / 2, y: cy - arm / 2, w: arm, h: arm },
      up: { x: cx - arm / 2, y: cy - cross / 2, w: arm, h: arm },
      down: { x: cx - arm / 2, y: cy + cross / 2 - arm, w: arm, h: arm },
      left: { x: cx - cross / 2, y: cy - arm / 2, w: arm, h: arm },
      right: { x: cx + cross / 2 - arm, y: cy - arm / 2, w: arm, h: arm },
      btnRotate: null,
      btnHardDrop: null,
      pause: null,
      slots: [],
    };

    let itemPanel = null;

    if (side === 'dual') {
      // ===== 双手持握模式：左手十字键，右手动作键（旋转/硬降），居中道具栏与暂停 =====
      const rotR = Math.max(26, Math.min(29, Math.floor(cross * 0.22)));
      const rotX = W - m - cross * 0.36;
      const rotY = cy - cross * 0.16;
      controls.btnRotate = {
        cx: rotX,
        cy: rotY,
        r: rotR,
        x: rotX - rotR - 4,
        y: rotY - rotR - 4,
        w: (rotR + 4) * 2,
        h: (rotR + 4) * 2,
      };

      const dropR = Math.max(22, Math.min(25, Math.floor(cross * 0.19)));
      const dropX = W - m - cross * 0.72;
      const dropY = cy + cross * 0.18;
      controls.btnHardDrop = {
        cx: dropX,
        cy: dropY,
        r: dropR,
        x: dropX - dropR - 4,
        y: dropY - dropR - 4,
        w: (dropR + 4) * 2,
        h: (dropR + 4) * 2,
      };

      const midW = Math.max(90, W - (m + cross) * 2 - 8);
      const itemW = Math.min(midW, 116);
      const itemX = Math.round((W - itemW) / 2);
      const pauseW = Math.min(58, itemW);
      const pauseH = 24;
      const pauseY = deckY + 4;
      controls.pause = { x: Math.round((W - pauseW) / 2), y: pauseY, w: pauseW, h: pauseH };

      const itemY = pauseY + pauseH + 4;
      const itemH = deckH - (pauseH + 4 + 4) - bottomInset - bottomPad;
      itemPanel = { x: itemX, y: itemY, w: itemW, h: itemH };

      const slotS = Math.max(24, Math.min(28, Math.floor((itemW - 16) / 3)));
      const gapX = Math.floor((itemW - 14 - slotS * 3) / 2);
      const row1W = slotS * 3 + gapX * 2;
      const row2W = slotS * 2 + gapX;
      const r1X = itemX + (itemW - row1W) / 2;
      const r2X = itemX + (itemW - row2W) / 2;
      const r1Y = itemY + 28;
      const r2Y = r1Y + slotS + 4;

      controls.slots = [
        { x: r1X, y: r1Y, w: slotS, h: slotS },
        { x: r1X + slotS + gapX, y: r1Y, w: slotS, h: slotS },
        { x: r1X + (slotS + gapX) * 2, y: r1Y, w: slotS, h: slotS },
        { x: r2X, y: r2Y, w: slotS, h: slotS },
        { x: r2X + slotS + gapX, y: r2Y, w: slotS, h: slotS },
      ];
    } else {
      // ===== 单手模式（左手或右手）：十字键在单侧，道具栏在对侧，暂停在中间 =====
      const zoneX = side === 'left' ? m + cross + 10 : m;
      const zoneW = W - m * 2 - cross - 20;
      const itemW = Math.max(104, Math.min(124, Math.floor(zoneW * 0.52)));
      const itemH = Math.min(cross, cross - 10);
      const itemX = side === 'left' ? W - m - itemW : m;
      itemPanel = { x: itemX, y: cy - itemH / 2, w: itemW, h: itemH };

      const slotS = Math.max(26, Math.min(30, Math.floor((itemW - 20) / 3)));
      const gapX = Math.floor((itemW - 16 - slotS * 3) / 2);
      const row1W = slotS * 3 + gapX * 2;
      const row2W = slotS * 2 + gapX;
      const r1X = itemX + (itemW - row1W) / 2;
      const r2X = itemX + (itemW - row2W) / 2;
      const r1Y = cy - itemH / 2 + 34;
      const r2Y = r1Y + slotS + 6;

      controls.slots = [
        { x: r1X, y: r1Y, w: slotS, h: slotS },
        { x: r1X + slotS + gapX, y: r1Y, w: slotS, h: slotS },
        { x: r1X + (slotS + gapX) * 2, y: r1Y, w: slotS, h: slotS },
        { x: r2X, y: r2Y, w: slotS, h: slotS },
        { x: r2X + slotS + gapX, y: r2Y, w: slotS, h: slotS },
      ];

      const pillW = Math.max(52, Math.min(68, zoneW - itemW - 12));
      const pillH = 32;
      const pillCx =
        side === 'left'
          ? zoneX + (zoneW - itemW) / 2
          : zoneX + itemW + (zoneW - itemW) / 2;
      controls.pause = { x: pillCx - pillW / 2, y: cy - pillH / 2, w: pillW, h: pillH };
    }

    return { deckY, deckH, controls, itemPanel };
  }

  drawDeckBase(ctx, W, deckY, deckH) {
    ctx.fillStyle = 'rgba(9, 12, 24, 0.55)';
    ctx.fillRect(0, deckY, W, deckH);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, deckY + 0.5);
    ctx.lineTo(W, deckY + 0.5);
    ctx.stroke();
  }

  drawDpad(ctx, controls, isPressedFn) {
    const c = ctx;
    const d = controls;
    const cx = d.dpad.x + d.dpad.w / 2;
    const cy = d.dpad.y + d.dpad.h / 2;
    const arm = d.up.w;

    // 十字底座塑料渐变
    const g = c.createLinearGradient(0, d.dpad.y, 0, d.dpad.y + d.dpad.h);
    g.addColorStop(0, '#263156');
    g.addColorStop(1, '#141a36');
    c.fillStyle = g;
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    drawRoundRect(c, d.dpad.x, cy - arm / 2, d.dpad.w, arm, 10);
    c.fill();
    c.stroke();
    drawRoundRect(c, cx - arm / 2, d.dpad.y, arm, d.dpad.h, 10);
    c.fill();
    c.stroke();

    // 中心枢纽
    c.fillStyle = 'rgba(7, 10, 20, 0.5)';
    drawRoundRect(c, d.center.x + 4, d.center.y + 4, d.center.w - 8, d.center.h - 8, 6);
    c.fill();

    // 四臂：按下高亮 + 方向箭头
    for (const k of ['up', 'down', 'left', 'right']) {
      const r = d[k];
      const pressed = isPressedFn(k);
      if (pressed) {
        c.fillStyle = 'rgba(34, 211, 238, 0.22)';
        c.strokeStyle = ACCENT;
        drawRoundRect(c, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 9);
        c.fill();
        c.stroke();
      }
      const mx = r.x + r.w / 2;
      const my = r.y + r.h / 2;
      const s = 7;
      c.fillStyle = pressed ? ACCENT : '#aab6dd';
      c.beginPath();
      if (k === 'up') {
        c.moveTo(mx, my - s);
        c.lineTo(mx + s, my + s * 0.7);
        c.lineTo(mx - s, my + s * 0.7);
      } else if (k === 'down') {
        c.moveTo(mx, my + s);
        c.lineTo(mx + s, my - s * 0.7);
        c.lineTo(mx - s, my - s * 0.7);
      } else if (k === 'left') {
        c.moveTo(mx - s, my);
        c.lineTo(mx + s * 0.7, my + s);
        c.lineTo(mx + s * 0.7, my - s);
      } else {
        c.moveTo(mx + s, my);
        c.lineTo(mx - s * 0.7, my + s);
        c.lineTo(mx - s * 0.7, my - s);
      }
      c.closePath();
      c.fill();
    }
  }

  drawActionButtons(ctx, controls, isPressedFn) {
    const { btnRotate, btnHardDrop } = controls;
    if (!btnRotate || !btnHardDrop) return;

    // 1. 旋转按键 (btnRotate, ↻)
    const rotPressed = isPressedFn('btnRotate');
    this._drawActionButton(ctx, btnRotate, rotPressed, {
      border: rotPressed ? '#38bdf8' : 'rgba(34, 211, 238, 0.45)',
      grad1: rotPressed ? '#0284c7' : '#1e294f',
      grad2: rotPressed ? '#0ea5e9' : '#0f172a',
      iconColor: rotPressed ? '#ffffff' : '#38bdf8',
      textColor: rotPressed ? '#ffffff' : '#94a3b8',
      icon: '↻',
      text: '旋转',
    });

    // 2. 硬降按键 (btnHardDrop, ⤓)
    const dropPressed = isPressedFn('btnHardDrop');
    this._drawActionButton(ctx, btnHardDrop, dropPressed, {
      border: dropPressed ? '#facc15' : 'rgba(250, 204, 21, 0.45)',
      grad1: dropPressed ? '#d97706' : '#28214a',
      grad2: dropPressed ? '#f59e0b' : '#16112c',
      iconColor: dropPressed ? '#ffffff' : '#fbbf24',
      textColor: dropPressed ? '#ffffff' : '#94a3b8',
      icon: '⤓',
      text: '硬降',
    });
  }

  _drawActionButton(c, btn, pressed, opt) {
    const { cx, cy, r } = btn;
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);

    const grad = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, opt.grad1);
    grad.addColorStop(1, opt.grad2);
    c.fillStyle = grad;
    c.fill();

    c.strokeStyle = opt.border;
    c.lineWidth = pressed ? 2.5 : 1.5;
    if (pressed) {
      c.shadowColor = opt.border;
      c.shadowBlur = 10;
    }
    c.stroke();
    c.shadowBlur = 0;

    c.textAlign = 'center';
    c.fillStyle = opt.iconColor;
    c.font = `700 ${Math.round(r * 0.72)}px ${FONT}`;
    c.fillText(opt.icon, cx, cy + Math.round(r * 0.04));

    c.fillStyle = opt.textColor;
    c.font = `600 ${Math.max(9, Math.round(r * 0.36))}px ${FONT}`;
    c.fillText(opt.text, cx, cy + Math.round(r * 0.62));
    c.restore();
  }

  drawPauseButton(ctx, controls, isPressedFn) {
    const r = controls.pause;
    if (!r) return;
    const pressed = isPressedFn('pause');
    ctx.fillStyle = pressed ? 'rgba(34, 211, 238, 0.25)' : 'rgba(13, 18, 38, 0.85)';
    ctx.strokeStyle = pressed ? ACCENT : 'rgba(125, 139, 176, 0.65)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pressed ? ACCENT : '#c5d1ec';
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('暂 停', r.x + r.w / 2, r.y + r.h / 2 + 4);
    ctx.textAlign = 'left';
  }
}
