/**
 * 重力道具目标选取组件：包含棋盘高亮光带、下坠光标、模式 Tab、步进器与确认/取消按钮。
 */
import { BORDER, FONT, drawRoundRect } from './UITheme.js';

export class TargetingView {
  layout(W, deckY, top) {
    const m = 12;
    const tgtBtnH = 34;
    const tgtW = W - m * 2;
    const tgtY = deckY + 8;
    const tabW = (tgtW - 10) / 2;

    const controls = {
      targetColTab: { x: m, y: tgtY, w: tabW, h: tgtBtnH },
      targetRowTab: { x: m + tabW + 10, y: tgtY, w: tabW, h: tgtBtnH },
    };

    const stepY = tgtY + tgtBtnH + 8;
    const arrowW = 46;
    controls.targetPrev = { x: m, y: stepY, w: arrowW, h: tgtBtnH };
    controls.targetNext = { x: W - m - arrowW, y: stepY, w: arrowW, h: tgtBtnH };
    controls.targetLabel = { x: m + arrowW + 8, y: stepY, w: tgtW - arrowW * 2 - 16, h: tgtBtnH };

    const actY = stepY + tgtBtnH + 8;
    const okW = Math.floor(tgtW * 0.62);
    const cancelW = tgtW - okW - 10;
    controls.targetConfirm = { x: m, y: actY, w: okW, h: tgtBtnH + 4 };
    controls.targetCancel = { x: m + okW + 10, y: actY, w: cancelW, h: tgtBtnH + 4 };

    controls.boardArea = { x: m, y: top + 76, w: W - m * 2, h: deckY - (top + 76) - 10 };

    return controls;
  }

  drawControls(ctx, W, deckY, deckH, targeting, controls) {
    const c = ctx;
    const tgt = targeting;

    // 控制台半透明微质感底板
    const deckGrad = c.createLinearGradient(0, deckY, 0, deckY + deckH);
    deckGrad.addColorStop(0, 'rgba(14, 20, 44, 0.92)');
    deckGrad.addColorStop(1, 'rgba(5, 7, 18, 0.98)');
    c.fillStyle = deckGrad;
    c.fillRect(0, deckY, W, deckH);

    // 顶部霓虹地平线
    c.strokeStyle = '#00f2fe';
    c.lineWidth = 1.5;
    c.shadowColor = '#00f2fe';
    c.shadowBlur = 6;
    c.beginPath();
    c.moveTo(0, deckY + 0.75);
    c.lineTo(W, deckY + 0.75);
    c.stroke();
    c.shadowBlur = 0;

    // 1. 模式切换 Tab
    const colTab = controls.targetColTab;
    const rowTab = controls.targetRowTab;
    const isCols = tgt.mode === 'cols';

    // 列选择 Tab
    drawRoundRect(c, colTab.x, colTab.y, colTab.w, colTab.h, 7);
    if (isCols) {
      const g = c.createLinearGradient(colTab.x, colTab.y, colTab.x + colTab.w, colTab.y + colTab.h);
      g.addColorStop(0, 'rgba(2, 132, 199, 0.55)');
      g.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#00f2fe';
      c.lineWidth = 1.5;
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 6;
      c.stroke();
      c.shadowBlur = 0;
    } else {
      c.fillStyle = 'rgba(15, 23, 48, 0.65)';
      c.fill();
      c.strokeStyle = 'rgba(120, 160, 255, 0.25)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.fillStyle = isCols ? '#ffffff' : '#94a3b8';
    c.font = `700 12px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('↔ 选连续 3 列 (下落)', colTab.x + colTab.w / 2, colTab.y + colTab.h / 2 + 4);

    // 行选择 Tab
    drawRoundRect(c, rowTab.x, rowTab.y, rowTab.w, rowTab.h, 7);
    if (!isCols) {
      const g = c.createLinearGradient(rowTab.x, rowTab.y, rowTab.x + rowTab.w, rowTab.y + rowTab.h);
      g.addColorStop(0, 'rgba(2, 132, 199, 0.55)');
      g.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#00f2fe';
      c.lineWidth = 1.5;
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 6;
      c.stroke();
      c.shadowBlur = 0;
    } else {
      c.fillStyle = 'rgba(15, 23, 48, 0.65)';
      c.fill();
      c.strokeStyle = 'rgba(120, 160, 255, 0.25)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.fillStyle = !isCols ? '#ffffff' : '#94a3b8';
    c.font = `700 12px ${FONT}`;
    c.fillText('↕ 选连续 2 行 (下落)', rowTab.x + rowTab.w / 2, rowTab.y + rowTab.h / 2 + 4);

    // 2. 步进选择指示器 [ ◀ ] [ 选中第 X-Y 列/行 ] [ ▶ ]
    const prev = controls.targetPrev;
    const next = controls.targetNext;
    const lbl = controls.targetLabel;

    drawRoundRect(c, prev.x, prev.y, prev.w, prev.h, 7);
    c.fillStyle = 'rgba(25, 35, 70, 0.85)';
    c.fill();
    c.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#e2e8f0';
    c.font = `700 15px ${FONT}`;
    c.fillText('◀', prev.x + prev.w / 2, prev.y + prev.h / 2 + 5);

    drawRoundRect(c, next.x, next.y, next.w, next.h, 7);
    c.fillStyle = 'rgba(25, 35, 70, 0.85)';
    c.fill();
    c.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    c.lineWidth = 1;
    c.stroke();
    c.fillText('▶', next.x + next.w / 2, next.y + next.h / 2 + 5);

    const desc = isCols
      ? `已选第 ${tgt.startIdx + 1} - ${tgt.startIdx + 3} 列 (可点触棋盘)`
      : `已选第 ${tgt.startIdx + 1} - ${tgt.startIdx + 2} 行 (可点触棋盘)`;
    c.font = `700 12px ${FONT}`;
    c.fillStyle = '#38bdf8';
    c.fillText(desc, lbl.x + lbl.w / 2, lbl.y + lbl.h / 2 + 4);

    // 3. 确认与取消按钮
    const ok = controls.targetConfirm;
    const cancel = controls.targetCancel;

    // 确认释放（深邃皇家蓝底盘 + 霓虹发光边框 + 纯白文字）
    const okGrad = c.createLinearGradient(ok.x, ok.y, ok.x + ok.w, ok.y + ok.h);
    okGrad.addColorStop(0, '#0284c7');
    okGrad.addColorStop(1, '#1d4ed8');
    drawRoundRect(c, ok.x, ok.y, ok.w, ok.h, 9);
    c.fillStyle = okGrad;
    c.shadowColor = 'rgba(0, 242, 254, 0.45)';
    c.shadowBlur = 10;
    c.fill();
    c.shadowBlur = 0;

    c.strokeStyle = '#00f2fe';
    c.lineWidth = 1.5;
    c.shadowColor = '#00f2fe';
    c.shadowBlur = 6;
    c.stroke();
    c.shadowBlur = 0;

    c.beginPath();
    c.moveTo(ok.x + 8, ok.y + 1.2);
    c.lineTo(ok.x + ok.w - 8, ok.y + 1.2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    c.lineWidth = 1;
    c.stroke();

    c.fillStyle = '#ffffff';
    c.font = `700 13px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0, 0, 0, 0.85)';
    c.shadowBlur = 4;
    c.fillText('⤓ 确认释放重力', ok.x + ok.w / 2, ok.y + ok.h / 2);
    c.shadowBlur = 0;

    // 取消按钮
    drawRoundRect(c, cancel.x, cancel.y, cancel.w, cancel.h, 9);
    c.fillStyle = 'rgba(25, 35, 65, 0.85)';
    c.fill();
    c.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = `700 12px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('✖ 取消', cancel.x + cancel.w / 2, cancel.y + cancel.h / 2);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
  }

  drawHighlight(ctx, W, top, deckY, targeting) {
    if (!targeting || !targeting.active) return;
    const c = ctx;
    const tgt = targeting;
    const isCols = tgt.mode === 'cols';

    const bTop = top + 80;
    const bH = deckY - bTop - 12;
    const cellH = bH / 20;
    const bW = cellH * 10;
    const bLeft = (W - bW) / 2;
    const cellW = bW / 10;

    c.save();
    if (isCols) {
      const x = bLeft + tgt.startIdx * cellW;
      const w = cellW * 3;
      const y = bTop;
      const h = bH;

      // 全息纵向能量柱（中心向边缘渐弱光效）
      const beamGrad = c.createLinearGradient(x, 0, x + w, 0);
      beamGrad.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
      beamGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.28)');
      beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0.08)');
      c.fillStyle = beamGrad;
      c.fillRect(x, y, w, h);

      // 发光霓虹轮廓
      c.strokeStyle = '#00f2fe';
      c.lineWidth = 2;
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 10;
      c.strokeRect(x, y, w, h);
      c.shadowBlur = 0;

      // 动态下坠箭头光标
      c.fillStyle = '#ffffff';
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 8;
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

      // 全息横向能量柱
      const beamGrad = c.createLinearGradient(0, y, 0, y + h);
      beamGrad.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
      beamGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.28)');
      beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0.08)');
      c.fillStyle = beamGrad;
      c.fillRect(x, y, w, h);

      c.strokeStyle = '#00f2fe';
      c.lineWidth = 2;
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 10;
      c.strokeRect(x, y, w, h);
      c.shadowBlur = 0;

      // 动态下坠箭头光标
      c.fillStyle = '#ffffff';
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 8;
      c.font = `700 16px ${FONT}`;
      c.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        c.fillText('⤓', x + 20 + i * (w / 5), y + h / 2 + 6);
      }
    }
    c.restore();
  }
}
