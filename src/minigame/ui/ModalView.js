/**
 * 弹窗系统组件：就绪/首页 (ready)、暂停 (paused)、结算 (gameover) 以及全局设置 (settings) 弹窗。
 */
import { BORDER, ACCENT, FONT, drawRoundRect, drawPanel } from './UITheme.js';

export class ModalView {
  constructor() {
    this.isSettingsOpen = false;
  }

  draw(ctx, W, H, game, best, side, settings, controlsOut) {
    const c = ctx;

    // 半透明遮罩底色
    c.fillStyle = 'rgba(5, 8, 18, 0.65)';
    c.fillRect(0, 0, W, H);

    if (this.isSettingsOpen) {
      this._drawSettingsModal(c, W, H, side, settings, controlsOut);
      return;
    }

    const state = game.state;
    const pw = Math.min(W - 48, 330);
    const ph = state === 'gameover' ? 280 : state === 'ready' ? 288 : 240;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - 20;
    drawPanel(c, px, py, pw, ph, 12);

    c.textAlign = 'center';
    // 标题（带辉光）
    c.shadowColor = 'rgba(34, 211, 238, 0.55)';
    c.shadowBlur = 24;
    c.fillStyle = ACCENT;
    c.font = `700 32px ${FONT}`;
    const title = state === 'ready' ? '3D TETRIS' : state === 'paused' ? 'PAUSED' : 'GAME OVER';
    c.fillText(title, W / 2, py + 56);
    c.shadowBlur = 0;

    // 右上角辅助胶囊按键（首页显示设置，暂停/结算显示返回首页）
    if (state === 'ready') {
      const setW = 84;
      const setH = 24;
      const setX = px + pw - setW - 14;
      const setY = py + 14;
      controlsOut.btnSettings = { x: setX, y: setY, w: setW, h: setH };

      drawRoundRect(c, setX, setY, setW, setH, setH / 2);
      c.fillStyle = 'rgba(20, 28, 55, 0.7)';
      c.fill();
      c.strokeStyle = 'rgba(120, 140, 255, 0.4)';
      c.lineWidth = 1;
      c.stroke();

      c.font = `600 11px ${FONT}`;
      c.fillStyle = '#cbd5e1';
      c.textAlign = 'center';
      c.fillText('⚙️ 设置', setX + setW / 2, setY + setH / 2 + 3.5);
    } else {
      const homeW = 84;
      const homeH = 24;
      const homeX = px + pw - homeW - 14;
      const homeY = py + 14;
      controlsOut.btnHome = { x: homeX, y: homeY, w: homeW, h: homeH };

      drawRoundRect(c, homeX, homeY, homeW, homeH, homeH / 2);
      c.fillStyle = 'rgba(20, 28, 55, 0.7)';
      c.fill();
      c.strokeStyle = 'rgba(120, 140, 255, 0.4)';
      c.lineWidth = 1;
      c.stroke();

      c.font = `600 11px ${FONT}`;
      c.fillStyle = '#94a3b8';
      c.textAlign = 'center';
      c.fillText('🏠 首页', homeX + homeW / 2, homeY + homeH / 2 + 3.5);
    }

    c.font = `12px ${FONT}`;
    c.fillStyle = '#9fb0d8';
    let swY = py + 160;

    if (state === 'ready') {
      if (best > 0) {
        c.font = `600 12px ${FONT}`;
        c.fillStyle = '#facc15';
        c.fillText(`🏆 历史最高分  ${best}`, W / 2, py + 86);
        c.font = `11px ${FONT}`;
        c.fillStyle = '#9fb0d8';
        c.fillText('十字键 ←→ 移动 · ↑ 旋转 · ↓ 加速', W / 2, py + 108);
        c.fillText('连按两下↓ 直接落地 · 发光格 8 向特效', W / 2, py + 128);
      } else {
        c.fillText('十字键 ←→ 移动 · ↑ 旋转', W / 2, py + 88);
        c.fillText('↓ 加速 · 连按两下↓ 直接落地', W / 2, py + 110);
        c.fillText('发光格 8 向效果：直线清除 · 斜向取反', W / 2, py + 132);
      }
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
      c.fillStyle = '#facc15';
      c.fillText(`最高分 ${Math.max(best, game.score)}`, W / 2, py + 144);
      swY = py + 164;
    }

    // 模式切换快捷按键（与原版位置完全一致，保证自动化测试与手感兼容）
    const swW = 200;
    const swH = 34;
    const swX = px + (pw - swW) / 2;
    controlsOut.swapOverlay = { x: swX, y: swY, w: swW, h: swH };

    c.fillStyle = 'rgba(20, 28, 58, 0.85)';
    c.strokeStyle = 'rgba(120, 140, 255, 0.45)';
    c.lineWidth = 1;
    drawRoundRect(c, swX, swY, swW, swH, swH / 2);
    c.fill();
    c.stroke();

    c.font = `500 12px ${FONT}`;
    c.fillStyle = '#c5d1ec';
    c.textAlign = 'center';
    const modeText =
      side === 'dual'
        ? '👐 操作模式：双手 (点击切换)'
        : side === 'right'
          ? '👉 操作模式：右手 (点击切换)'
          : '👈 操作模式：左手 (点击切换)';
    c.fillText(modeText, swX + swW / 2, swY + swH / 2 + 4);

    // 主操作按钮（与原版位置完全一致）
    const bw = 184;
    const bh = 44;
    const bx = (W - bw) / 2;
    const by = py + ph - bh - 20;
    controlsOut.primary = { x: bx, y: by, w: bw, h: bh };

    const grad = c.createLinearGradient(bx, by, bx + bw, by + bh);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#4f8dff');
    drawRoundRect(c, bx, by, bw, bh, 10);
    c.fillStyle = grad;
    c.fill();
    c.fillStyle = '#04101a';
    c.font = `700 16px ${FONT}`;
    c.fillText(
      state === 'ready' ? '开始游戏' : state === 'paused' ? '继续游戏' : '再来一局',
      W / 2,
      by + 28
    );
  }

  _drawSettingsModal(c, W, H, side, settings, controlsOut) {
    const pw = Math.min(W - 48, 330);
    const ph = 300;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - 20;
    drawPanel(c, px, py, pw, ph, 12);

    c.textAlign = 'center';
    c.shadowColor = 'rgba(34, 211, 238, 0.55)';
    c.shadowBlur = 18;
    c.fillStyle = ACCENT;
    c.font = `700 24px ${FONT}`;
    c.fillText('游戏设置', W / 2, py + 38);
    c.shadowBlur = 0;

    // 1. 操作模式分段选择器
    c.font = `600 12px ${FONT}`;
    c.fillStyle = '#94a3b8';
    c.textAlign = 'left';
    c.fillText('操作布局模式', px + 24, py + 68);

    const segW = Math.floor((pw - 48 - 16) / 3);
    const segH = 32;
    const segY = py + 78;

    const modes = [
      { key: 'dual', label: '👐 双手', x: px + 24 },
      { key: 'left', label: '👈 左手', x: px + 24 + segW + 8 },
      { key: 'right', label: '👉 右手', x: px + 24 + (segW + 8) * 2 },
    ];

    controlsOut.settingModes = [];
    for (const m of modes) {
      const active = side === m.key;
      controlsOut.settingModes.push({ key: m.key, x: m.x, y: segY, w: segW, h: segH });

      drawRoundRect(c, m.x, segY, segW, segH, 6);
      c.fillStyle = active ? 'rgba(34, 211, 238, 0.25)' : 'rgba(20, 28, 55, 0.6)';
      c.fill();
      c.strokeStyle = active ? ACCENT : BORDER;
      c.lineWidth = active ? 1.5 : 1;
      c.stroke();

      c.font = `600 11px ${FONT}`;
      c.fillStyle = active ? ACCENT : '#94a3b8';
      c.textAlign = 'center';
      c.fillText(m.label, m.x + segW / 2, segY + segH / 2 + 4);
    }

    // 2. 触感震动反馈开关
    const vibeY = py + 126;
    c.textAlign = 'left';
    c.font = `600 12px ${FONT}`;
    c.fillStyle = '#94a3b8';
    c.fillText('触感震动反馈', px + 24, vibeY + 16);

    const toggleBtnW = 84;
    const toggleBtnH = 28;
    const toggleBtnX = px + pw - 24 - toggleBtnW;
    controlsOut.settingVibe = { x: toggleBtnX, y: vibeY, w: toggleBtnW, h: toggleBtnH };

    const vibeOn = settings ? settings.vibrateEnabled !== false : true;
    drawRoundRect(c, toggleBtnX, vibeY, toggleBtnW, toggleBtnH, toggleBtnH / 2);
    c.fillStyle = vibeOn ? 'rgba(34, 211, 238, 0.2)' : 'rgba(20, 28, 55, 0.6)';
    c.fill();
    c.strokeStyle = vibeOn ? ACCENT : BORDER;
    c.lineWidth = 1;
    c.stroke();

    c.font = `600 11px ${FONT}`;
    c.fillStyle = vibeOn ? ACCENT : '#64748b';
    c.textAlign = 'center';
    c.fillText(vibeOn ? '📳 已开启' : '关闭', toggleBtnX + toggleBtnW / 2, vibeY + toggleBtnH / 2 + 3.5);

    // 3. 音效声音反馈开关
    const sfxY = py + 168;
    c.textAlign = 'left';
    c.font = `600 12px ${FONT}`;
    c.fillStyle = '#94a3b8';
    c.fillText('音效声音反馈', px + 24, sfxY + 16);

    controlsOut.settingSfx = { x: toggleBtnX, y: sfxY, w: toggleBtnW, h: toggleBtnH };

    const sfxOn = settings ? settings.sfxEnabled !== false : true;
    drawRoundRect(c, toggleBtnX, sfxY, toggleBtnW, toggleBtnH, toggleBtnH / 2);
    c.fillStyle = sfxOn ? 'rgba(34, 211, 238, 0.2)' : 'rgba(20, 28, 55, 0.6)';
    c.fill();
    c.strokeStyle = sfxOn ? ACCENT : BORDER;
    c.lineWidth = 1;
    c.stroke();

    c.font = `600 11px ${FONT}`;
    c.fillStyle = sfxOn ? ACCENT : '#64748b';
    c.textAlign = 'center';
    c.fillText(sfxOn ? '🔊 已开启' : '🔇 静音', toggleBtnX + toggleBtnW / 2, sfxY + toggleBtnH / 2 + 3.5);

    // 4. 关闭/确定按钮
    const okW = 160;
    const okH = 38;
    const okX = (W - okW) / 2;
    const okY = py + ph - okH - 18;
    controlsOut.settingsClose = { x: okX, y: okY, w: okW, h: okH };

    const grad = c.createLinearGradient(okX, okY, okX + okW, okY + okH);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#4f8dff');
    drawRoundRect(c, okX, okY, okW, okH, 8);
    c.fillStyle = grad;
    c.fill();
    c.fillStyle = '#04101a';
    c.font = `700 14px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('确 定', okX + okW / 2, okY + okH / 2 + 5);
  }
}
