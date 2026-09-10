/**
 * 道具栏与能量槽绘制组件。
 */
import { FONT, drawRoundRect, drawPanel } from './UITheme.js';

export class PropBarView {
  draw(ctx, itemPanel, slots, game) {
    if (!itemPanel) return;
    const c = ctx;
    const p = itemPanel;

    drawPanel(c, p.x, p.y, p.w, p.h, 12);

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
    drawRoundRect(c, barX, barY, barW, barH, 2.5);
    c.fillStyle = 'rgba(20, 28, 55, 0.8)';
    c.fill();
    if (pct > 0) {
      const fillW = Math.max(5, barW * pct);
      const bg = c.createLinearGradient(barX, 0, barX + fillW, 0);
      bg.addColorStop(0, '#3b82f6');
      bg.addColorStop(1, pct >= 1 ? '#facc15' : '#22d3ee');
      c.fillStyle = bg;
      drawRoundRect(c, barX, barY, fillW, barH, 2.5);
      c.fill();
    }

    // 5 个道具槽位
    const items = (game && game.items) || [];
    const slotList = slots || [];
    for (let i = 0; i < 5; i++) {
      const slot = slotList[i];
      if (!slot) continue;
      const item = items[i];
      if (item) {
        // 已获得道具：实心发光微立体质感按钮
        const g = c.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
        g.addColorStop(0, '#1e2d5a');
        g.addColorStop(1, '#0f172a');
        c.fillStyle = g;
        drawRoundRect(c, slot.x, slot.y, slot.w, slot.h, 7);
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
        drawRoundRect(c, slot.x, slot.y, slot.w, slot.h, 7);
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
}
