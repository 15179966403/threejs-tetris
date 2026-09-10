/**
 * 底部手柄控制台组件：十字方向键、双手动作按键组（旋转/硬降）、暂停胶囊键。
 */
import { BORDER, ACCENT, FONT, drawRoundRect, drawPanel } from './UITheme.js';

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
    const c = ctx;
    // 1. 深色微质感控制台底板（多段渐变）
    const deckGrad = c.createLinearGradient(0, deckY, 0, deckY + deckH);
    deckGrad.addColorStop(0, 'rgba(14, 20, 44, 0.88)');
    deckGrad.addColorStop(0.12, 'rgba(9, 13, 30, 0.94)');
    deckGrad.addColorStop(1, 'rgba(5, 7, 18, 0.98)');
    c.fillStyle = deckGrad;
    c.fillRect(0, deckY, W, deckH);

    // 2. 顶部微发光霓虹地平线
    const lineGrad = c.createLinearGradient(0, deckY, W, deckY);
    lineGrad.addColorStop(0, 'rgba(34, 211, 238, 0.05)');
    lineGrad.addColorStop(0.2, 'rgba(34, 211, 238, 0.35)');
    lineGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.85)');
    lineGrad.addColorStop(0.8, 'rgba(34, 211, 238, 0.35)');
    lineGrad.addColorStop(1, 'rgba(34, 211, 238, 0.05)');

    c.strokeStyle = lineGrad;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, deckY + 0.75);
    c.lineTo(W, deckY + 0.75);
    c.stroke();
  }

  drawDpad(ctx, controls, isPressedFn) {
    const c = ctx;
    const d = controls;
    const cx = d.dpad.x + d.dpad.w / 2;
    const cy = d.dpad.y + d.dpad.h / 2;
    const arm = d.up.w;

    // 1. 十字键底层金属触感圆盘底座 (D-Pad Halo Disc)
    const haloR = d.dpad.w * 0.52;
    c.beginPath();
    c.arc(cx, cy, haloR, 0, Math.PI * 2);
    const haloGrad = c.createRadialGradient(cx, cy, haloR * 0.3, cx, cy, haloR);
    haloGrad.addColorStop(0, 'rgba(25, 34, 72, 0.45)');
    haloGrad.addColorStop(0.85, 'rgba(15, 20, 45, 0.65)');
    haloGrad.addColorStop(1, 'rgba(8, 12, 26, 0.85)');
    c.fillStyle = haloGrad;
    c.fill();
    c.strokeStyle = 'rgba(120, 160, 255, 0.18)';
    c.lineWidth = 1;
    c.stroke();

    // 2. 十字臂本体（一体化斜角双向圆角柱）
    const g = c.createLinearGradient(0, d.dpad.y, 0, d.dpad.y + d.dpad.h);
    g.addColorStop(0, '#242f56');
    g.addColorStop(0.5, '#17203e');
    g.addColorStop(1, '#0e142b');
    c.fillStyle = g;
    c.strokeStyle = 'rgba(120, 160, 255, 0.3)';
    c.lineWidth = 1;

    // 横臂
    drawRoundRect(c, d.dpad.x, cy - arm / 2, d.dpad.w, arm, 10);
    c.fill();
    c.stroke();
    // 纵臂
    drawRoundRect(c, cx - arm / 2, d.dpad.y, arm, d.dpad.h, 10);
    c.fill();
    c.stroke();

    // 3. 中心凹陷轴心盘 (Center Pivot)
    const cenW = d.center.w - 6;
    const cenH = d.center.h - 6;
    const cenX = d.center.x + 3;
    const cenY = d.center.y + 3;
    const cenGrad = c.createRadialGradient(cx, cy, 2, cx, cy, cenW / 2);
    cenGrad.addColorStop(0, '#090d1c');
    cenGrad.addColorStop(1, '#1b2446');
    c.fillStyle = cenGrad;
    drawRoundRect(c, cenX, cenY, cenW, cenH, cenW / 2);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    c.lineWidth = 1;
    c.stroke();

    // 中心微型十字标
    c.fillStyle = 'rgba(34, 211, 238, 0.4)';
    c.beginPath();
    c.arc(cx, cy, 2, 0, Math.PI * 2);
    c.fill();

    // 4. 四向臂按键与触控反馈
    const dirs = [
      { key: 'up', mx: cx, my: d.up.y + d.up.h / 2 },
      { key: 'down', mx: cx, my: d.down.y + d.down.h / 2 },
      { key: 'left', mx: d.left.x + d.left.w / 2, my: cy },
      { key: 'right', mx: d.right.x + d.right.w / 2, my: cy },
    ];

    for (const item of dirs) {
      const k = item.key;
      const r = d[k];
      const pressed = isPressedFn(k);
      const mx = item.mx;
      const my = item.my;

      if (pressed) {
        // 按下瞬间：强烈的电光青蓝色径向光晕爆发
        const flash = c.createRadialGradient(mx, my, 2, mx, my, arm * 0.9);
        flash.addColorStop(0, 'rgba(0, 242, 254, 0.65)');
        flash.addColorStop(0.5, 'rgba(34, 211, 238, 0.35)');
        flash.addColorStop(1, 'rgba(34, 211, 238, 0)');
        c.fillStyle = flash;
        c.beginPath();
        c.arc(mx, my, arm * 0.85, 0, Math.PI * 2);
        c.fill();

        // 臂的高亮外框
        c.fillStyle = 'rgba(34, 211, 238, 0.22)';
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        drawRoundRect(c, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 9);
        c.fill();
        c.stroke();
      }

      // 方向箭头（立体几何设计）
      const s = 7;
      c.save();
      c.fillStyle = pressed ? '#ffffff' : '#94a3b8';
      if (pressed) {
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 10;
      }
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
      c.restore();
    }
  }

  drawActionButtons(ctx, controls, isPressedFn) {
    const { btnRotate, btnHardDrop } = controls;
    if (!btnRotate || !btnHardDrop) return;

    // 1. 旋转按键 (btnRotate, ↻)
    const rotPressed = isPressedFn('btnRotate');
    this._drawActionButton(ctx, btnRotate, rotPressed, {
      border: rotPressed ? '#00f2fe' : 'rgba(34, 211, 238, 0.5)',
      grad1: rotPressed ? '#0284c7' : '#22305a',
      grad2: rotPressed ? '#0369a1' : '#111933',
      iconColor: rotPressed ? '#ffffff' : '#38bdf8',
      textColor: rotPressed ? '#e0f2fe' : '#94a3b8',
      glowColor: '#00f2fe',
      icon: '↻',
      text: '旋转',
    });

    // 2. 硬降按键 (btnHardDrop, ⤓)
    const dropPressed = isPressedFn('btnHardDrop');
    this._drawActionButton(ctx, btnHardDrop, dropPressed, {
      border: dropPressed ? '#fbbf24' : 'rgba(250, 204, 21, 0.5)',
      grad1: dropPressed ? '#d97706' : '#382c5a',
      grad2: dropPressed ? '#b45309' : '#1a1433',
      iconColor: dropPressed ? '#ffffff' : '#fbbf24',
      textColor: dropPressed ? '#fef3c7' : '#94a3b8',
      glowColor: '#f59e0b',
      icon: '⤓',
      text: '硬降',
    });
  }

  _drawActionButton(c, btn, pressed, opt) {
    const { cx, cy, r } = btn;
    c.save();

    // 1. 外晕爆发（按下时大面积高亮）
    if (pressed) {
      const aura = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
      aura.addColorStop(0, opt.glowColor ? `${opt.glowColor}aa` : 'rgba(34, 211, 238, 0.6)');
      aura.addColorStop(1, 'transparent');
      c.fillStyle = aura;
      c.beginPath();
      c.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      c.fill();
    }

    // 2. 按键底盘
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, opt.grad1);
    grad.addColorStop(1, opt.grad2);
    c.fillStyle = grad;
    c.fill();

    // 3. 边框高亮
    c.strokeStyle = opt.border;
    c.lineWidth = pressed ? 2.5 : 1.8;
    if (pressed) {
      c.shadowColor = opt.glowColor || opt.border;
      c.shadowBlur = 12;
    }
    c.stroke();
    c.shadowBlur = 0;

    // 4. 内部高光弧度线
    c.beginPath();
    c.arc(cx, cy, r - 2, Math.PI * 1.15, Math.PI * 1.85);
    c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    c.lineWidth = 1;
    c.stroke();

    // 5. 中心图标
    c.textAlign = 'center';
    c.fillStyle = opt.iconColor;
    c.font = `700 ${Math.round(r * 0.72)}px ${FONT}`;
    if (pressed) {
      c.shadowColor = opt.iconColor;
      c.shadowBlur = 8;
    }
    c.fillText(opt.icon, cx, cy + Math.round(r * 0.04));
    c.shadowBlur = 0;

    // 6. 底部微型功能标签
    c.fillStyle = opt.textColor;
    c.font = `700 ${Math.max(9, Math.round(r * 0.36))}px ${FONT}`;
    c.fillText(opt.text, cx, cy + Math.round(r * 0.62));

    c.restore();
  }

  drawPauseButton(ctx, controls, isPressedFn) {
    const r = controls.pause;
    if (!r) return;
    const pressed = isPressedFn('pause');

    // 科技感半透明胶囊键
    drawPanel(ctx, r.x, r.y, r.w, r.h, r.h / 2, {
      bgTop: pressed ? 'rgba(34, 211, 238, 0.35)' : 'rgba(20, 28, 62, 0.85)',
      bgBot: pressed ? 'rgba(14, 165, 233, 0.45)' : 'rgba(10, 15, 34, 0.92)',
      border: pressed ? '#00f2fe' : 'rgba(120, 160, 255, 0.35)',
    });

    ctx.fillStyle = pressed ? '#ffffff' : '#dbeafe';
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⏸ 暂停', r.x + r.w / 2, r.y + r.h / 2 + 3.5);
    ctx.textAlign = 'left';
  }
}
