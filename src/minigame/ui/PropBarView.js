/**
 * 道具栏与能量槽绘制组件（Cyber Reactor 能量发生器视觉设计）。
 */
import {
  FONT,
  ACCENT,
  ACCENT_CYAN,
  ACCENT_GOLD,
  MUTED,
  drawRoundRect,
  drawPanel,
  drawTechCorners,
} from './UITheme.js';

export class PropBarView {
  draw(ctx, itemPanel, slots, game) {
    if (!itemPanel) return;
    const c = ctx;
    const p = itemPanel;

    drawPanel(c, p.x, p.y, p.w, p.h, 12, {
      bgTop: 'rgba(16, 24, 52, 0.85)',
      bgBot: 'rgba(8, 12, 28, 0.92)',
      border: 'rgba(120, 160, 255, 0.28)',
    });
    drawTechCorners(c, p.x, p.y, p.w, p.h, 5, 'rgba(34, 211, 238, 0.35)');

    if (game && game.mode === 'classic') {
      // 经典纯净模式：展示专属电竞质感徽章，不展示能量槽与道具
      const badgeW = p.w - 16;
      const badgeH = p.h - 16;
      const badgeX = p.x + 8;
      const badgeY = p.y + 8;

      const badgeGrad = c.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
      badgeGrad.addColorStop(0, 'rgba(30, 41, 75, 0.65)');
      badgeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      drawRoundRect(c, badgeX, badgeY, badgeW, badgeH, 8);
      c.fillStyle = badgeGrad;
      c.fill();
      c.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      c.lineWidth = 1;
      c.stroke();

      c.textAlign = 'center';
      c.font = `700 12px ${FONT}`;
      c.fillStyle = '#38bdf8';
      c.shadowColor = '#0284c7';
      c.shadowBlur = 6;
      c.fillText('🧱 CLASSIC', p.x + p.w / 2, p.y + p.h / 2 - 4);
      c.shadowBlur = 0;

      c.font = `600 9px ${FONT}`;
      c.fillStyle = '#94a3b8';
      c.fillText('纯 粹 竞 技', p.x + p.w / 2, p.y + p.h / 2 + 12);
      c.textAlign = 'left';
      return;
    }

    // 顶部：能量计量槽
    const curEnergy = game ? (game.itemEnergy || 0) : 0;
    const reqEnergy = game ? (game.requiredEnergy || 3) : 3;
    const pct = Math.min(1, curEnergy / reqEnergy);
    const isReady = pct >= 1;

    c.font = `700 9px ${FONT}`;
    c.fillStyle = isReady ? ACCENT_GOLD : ACCENT_CYAN;
    c.textAlign = 'left';
    c.fillText(isReady ? '⚡ 能量就绪' : '⚡ 蓄能槽', p.x + 8, p.y + 15);

    c.textAlign = 'right';
    c.font = `700 9px ${FONT}`;
    c.fillStyle = isReady ? '#fef08a' : '#94a3b8';
    c.fillText(`${curEnergy}/${reqEnergy}`, p.x + p.w - 8, p.y + 15);

    // 能量槽进度条（发光圆角能量柱）
    const barX = p.x + 8;
    const barY = p.y + 20;
    const barW = p.w - 16;
    const barH = 5;

    drawRoundRect(c, barX, barY, barW, barH, 2.5);
    c.fillStyle = 'rgba(15, 23, 42, 0.9)';
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    c.lineWidth = 0.8;
    c.stroke();

    if (pct > 0) {
      const fillW = Math.max(5, barW * pct);
      const bg = c.createLinearGradient(barX, 0, barX + fillW, 0);
      if (isReady) {
        bg.addColorStop(0, '#f59e0b');
        bg.addColorStop(1, '#facc15');
      } else {
        bg.addColorStop(0, '#0284c7');
        bg.addColorStop(1, '#00f2fe');
      }

      drawRoundRect(c, barX, barY, fillW, barH, 2.5);
      c.fillStyle = bg;
      if (isReady) {
        c.shadowColor = '#facc15';
        c.shadowBlur = 6;
      }
      c.fill();
      c.shadowBlur = 0;
    }

    // 5 个道具槽位（科技卡槽外观）
    const items = (game && game.items) || [];
    const slotList = slots || [];
    for (let i = 0; i < 5; i++) {
      const slot = slotList[i];
      if (!slot) continue;
      const item = items[i];
      if (item) {
        // 已获得道具：发光高科技能量矩阵按钮
        const g = c.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
        g.addColorStop(0, '#1e3366');
        g.addColorStop(1, '#0b1633');
        drawRoundRect(c, slot.x, slot.y, slot.w, slot.h, 7);
        c.fillStyle = g;
        c.fill();

        // 边框发光
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 6;
        c.stroke();
        c.shadowBlur = 0;

        // 重力图标与文字
        c.fillStyle = '#ffffff';
        c.font = `700 14px ${FONT}`;
        c.textAlign = 'center';
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 5;
        c.fillText('⤓', slot.x + slot.w / 2, slot.y + slot.h / 2 + 1);
        c.shadowBlur = 0;

        c.font = `700 8px ${FONT}`;
        c.fillStyle = '#7dd3fc';
        c.fillText('重力', slot.x + slot.w / 2, slot.y + slot.h - 3);
      } else {
        // 空槽位：微暗槽位底座与极简科技感编号
        drawRoundRect(c, slot.x, slot.y, slot.w, slot.h, 7);
        c.fillStyle = 'rgba(15, 23, 42, 0.55)';
        c.fill();

        c.setLineDash([3, 2]);
        c.strokeStyle = 'rgba(100, 116, 139, 0.35)';
        c.lineWidth = 1;
        c.stroke();
        c.setLineDash([]);

        c.fillStyle = 'rgba(100, 116, 139, 0.5)';
        c.font = `600 9px ${FONT}`;
        c.textAlign = 'center';
        c.fillText(`0${i + 1}`, slot.x + slot.w / 2, slot.y + slot.h / 2 + 3.5);
      }
    }
    c.textAlign = 'left';
  }
}

