/**
 * 弹窗系统组件：就绪/首页 (ready)、暂停 (paused)、结算 (gameover) 以及全局设置 (settings) 弹窗。
 */
import {
  BORDER,
  BORDER_BRIGHT,
  ACCENT,
  ACCENT_CYAN,
  ACCENT_BLUE,
  ACCENT_PURPLE,
  ACCENT_GOLD,
  ACCENT_EMERALD,
  TEXT,
  MUTED,
  FONT,
  drawRoundRect,
  drawPanel,
  drawTechCorners,
} from './UITheme.js';

export class ModalView {
  constructor() {
    this.isSettingsOpen = false;
  }

  draw(ctx, W, H, game, best, side, settings, controlsOut) {
    const c = ctx;

    // 半透明极简深邃磨砂底色
    c.fillStyle = 'rgba(5, 8, 20, 0.72)';
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

    // 核心面板容器（深色毛玻璃微立体玻璃面）
    drawPanel(c, px, py, pw, ph, 14, {
      bgTop: 'rgba(16, 24, 54, 0.90)',
      bgBot: 'rgba(7, 11, 26, 0.96)',
      border: 'rgba(120, 160, 255, 0.32)',
    });
    drawTechCorners(c, px, py, pw, ph, 7, 'rgba(34, 211, 238, 0.55)');

    c.textAlign = 'center';

    // 标题区域（科技感发光 Logo）
    if (state === 'ready') {
      // 装饰横翼线条
      c.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(px + 28, py + 42);
      c.lineTo(W / 2 - 86, py + 42);
      c.moveTo(W / 2 + 86, py + 42);
      c.lineTo(px + pw - 28, py + 42);
      c.stroke();

      // 小科技棱形点
      c.fillStyle = ACCENT_CYAN;
      c.beginPath();
      c.arc(W / 2 - 86, py + 42, 2, 0, Math.PI * 2);
      c.arc(W / 2 + 86, py + 42, 2, 0, Math.PI * 2);
      c.fill();

      // 主标题
      c.shadowColor = 'rgba(0, 242, 254, 0.65)';
      c.shadowBlur = 18;
      c.fillStyle = '#ffffff';
      c.font = `700 30px ${FONT}`;
      c.fillText('3D TETRIS', W / 2, py + 49);
      c.shadowBlur = 0;

      // 副标题微字
      c.font = `700 9px ${FONT}`;
      c.fillStyle = '#94a3b8';
      c.fillText('CYBERNETIC EDITION · 立体方块', W / 2, py + 62);
    } else if (state === 'paused') {
      c.shadowColor = 'rgba(56, 189, 248, 0.6)';
      c.shadowBlur = 16;
      c.fillStyle = '#38bdf8';
      c.font = `700 28px ${FONT}`;
      c.fillText('⏸ PAUSED', W / 2, py + 52);
      c.shadowBlur = 0;
    } else {
      c.shadowColor = 'rgba(248, 113, 113, 0.65)';
      c.shadowBlur = 20;
      c.fillStyle = '#f87171';
      c.font = `700 28px ${FONT}`;
      c.fillText('GAME OVER', W / 2, py + 52);
      c.shadowBlur = 0;
    }

    // 右上角辅助胶囊按键（首页显示设置，暂停/结算显示返回首页）
    if (state === 'ready') {
      const setW = 84;
      const setH = 24;
      const setX = px + pw - setW - 14;
      const setY = py + 14;
      controlsOut.btnSettings = { x: setX, y: setY, w: setW, h: setH };

      drawPanel(c, setX, setY, setW, setH, setH / 2, {
        bgTop: 'rgba(25, 35, 75, 0.85)',
        bgBot: 'rgba(12, 18, 42, 0.92)',
        border: 'rgba(120, 160, 255, 0.4)',
      });

      c.font = `700 11px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('⚙️ 设置', setX + setW / 2, setY + setH / 2);
    } else {
      const homeW = 84;
      const homeH = 24;
      const homeX = px + pw - homeW - 14;
      const homeY = py + 14;
      controlsOut.btnHome = { x: homeX, y: homeY, w: homeW, h: homeH };

      drawPanel(c, homeX, homeY, homeW, homeH, homeH / 2, {
        bgTop: 'rgba(25, 35, 75, 0.85)',
        bgBot: 'rgba(12, 18, 42, 0.92)',
        border: 'rgba(120, 160, 255, 0.4)',
      });

      c.font = `700 11px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🏠 首页', homeX + homeW / 2, homeY + homeH / 2);
    }

    c.textBaseline = 'alphabetic';
    c.font = `12px ${FONT}`;
    c.fillStyle = '#9fb0d8';
    let swY = py + 160;

    if (state === 'ready') {
      // 模式双选分段切换 Tab
      const tabW = Math.floor((pw - 48 - 10) / 2);
      const tabH = 28;
      const tabY = py + 74;
      const isClassic = game.mode === 'classic';

      controlsOut.modeTabs = [
        { mode: 'skill', x: px + 24, y: tabY, w: tabW, h: tabH },
        { mode: 'classic', x: px + 24 + tabW + 10, y: tabY, w: tabW, h: tabH },
      ];

      // 1. 特技模式 Tab
      drawRoundRect(c, px + 24, tabY, tabW, tabH, 7);
      if (!isClassic) {
        c.fillStyle = 'rgba(2, 132, 199, 0.55)';
        c.fill();
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 6;
        c.stroke();
        c.shadowBlur = 0;
        c.font = `700 12px ${FONT}`;
        c.fillStyle = '#ffffff';
      } else {
        c.fillStyle = 'rgba(15, 22, 48, 0.75)';
        c.fill();
        c.strokeStyle = 'rgba(120, 140, 255, 0.35)';
        c.lineWidth = 1;
        c.stroke();
        c.font = `700 12px ${FONT}`;
        c.fillStyle = '#cbd5e1';
      }
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('特技模式', px + 24 + tabW / 2, tabY + tabH / 2);

      // 2. 经典模式 Tab
      const clX = px + 24 + tabW + 10;
      drawRoundRect(c, clX, tabY, tabW, tabH, 7);
      if (isClassic) {
        c.fillStyle = 'rgba(2, 132, 199, 0.55)';
        c.fill();
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 6;
        c.stroke();
        c.shadowBlur = 0;
        c.font = `700 12px ${FONT}`;
        c.fillStyle = '#ffffff';
      } else {
        c.fillStyle = 'rgba(15, 22, 48, 0.75)';
        c.fill();
        c.strokeStyle = 'rgba(120, 140, 255, 0.35)';
        c.lineWidth = 1;
        c.stroke();
        c.font = `700 12px ${FONT}`;
        c.fillStyle = '#cbd5e1';
      }
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('经典纯净', clX + tabW / 2, tabY + tabH / 2);

      c.textBaseline = 'alphabetic';

      // 模式特色介绍与最高分
      c.font = `500 11px ${FONT}`;
      c.fillStyle = '#cbd5e1';
      if (isClassic) {
        c.fillText('纯粹方块消除 · 经典速度考验 · 无特殊格', W / 2, py + 120);
        c.font = `700 11px ${FONT}`;
        c.fillStyle = '#facc15';
        c.fillText(best > 0 ? `🏆 经典最高纪录  ${best}` : '🏆 纯粹竞技 · 冲击个人极限', W / 2, py + 138);
      } else {
        c.fillText('8向激光穿透 · 重力道具位移 · 刺激连锁', W / 2, py + 120);
        c.font = `700 11px ${FONT}`;
        c.fillStyle = '#facc15';
        c.fillText(best > 0 ? `🏆 特技最高纪录  ${best}` : '🏆 消除箭头方块积攒重力能量', W / 2, py + 138);
      }
      swY = py + 158;
    } else if (state === 'paused') {
      c.textBaseline = 'alphabetic';
      const modeLabel = game.mode === 'classic' ? '经典纯净模式' : '特技模式';
      c.font = `700 13px ${FONT}`;
      c.fillStyle = '#f1f5f9';
      c.fillText(`游戏已暂停 · ${modeLabel}`, W / 2, py + 86);
      c.font = `500 11px ${FONT}`;
      c.fillStyle = '#94a3b8';
      c.fillText(`当前得分  ${game.score}   |   消除行数  ${game.lines}`, W / 2, py + 104);
      swY = py + 120;
    } else {
      c.textBaseline = 'alphabetic';
      c.font = `700 24px ${FONT}`;
      c.fillStyle = '#00f2fe';
      c.shadowColor = '#00f2fe';
      c.shadowBlur = 10;
      c.fillText(`本局得分  ${game.score}`, W / 2, py + 92);
      c.shadowBlur = 0;

      c.font = `600 12px ${FONT}`;
      c.fillStyle = '#cbd5e1';
      const modeLabel = game.mode === 'classic' ? '经典模式' : '特技模式';
      c.fillText(`消除 ${game.lines} 行  ·  等级 ${game.level}  ·  ${modeLabel}`, W / 2, py + 118);

      c.fillStyle = '#facc15';
      c.font = `700 12px ${FONT}`;
      c.fillText(`🏆 历史最高纪录  ${Math.max(best, game.score)}`, W / 2, py + 142);
      swY = py + 164;
    }

    // 模式切换快捷按键与分享按钮尺寸基准
    const swW = 200;
    const swH = 34;
    const swX = px + (pw - swW) / 2;

    if (state === 'gameover') {
      // 结算状态：一键分享战绩给微信好友/群（鲜明翡翠绿，超高对比白色文字）
      controlsOut.btnShare = { x: swX, y: swY, w: swW, h: swH };
      const sGrad = c.createLinearGradient(swX, swY, swX, swY + swH);
      sGrad.addColorStop(0, '#059669');
      sGrad.addColorStop(1, '#047857');
      drawRoundRect(c, swX, swY, swW, swH, swH / 2);
      c.fillStyle = sGrad;
      c.fill();
      c.strokeStyle = '#34d399';
      c.lineWidth = 1.5;
      c.shadowColor = '#34d399';
      c.shadowBlur = 6;
      c.stroke();
      c.shadowBlur = 0;

      // 顶部高光弧线
      c.beginPath();
      c.moveTo(swX + 16, swY + 1.2);
      c.lineTo(swX + swW - 16, swY + 1.2);
      c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      c.lineWidth = 1;
      c.stroke();

      c.font = `700 13px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0, 0, 0, 0.7)';
      c.shadowBlur = 4;
      c.fillText('分享战绩给好友', swX + swW / 2, swY + swH / 2);
      c.shadowBlur = 0;
    } else {
      // 模式切换快捷按键（ready / paused 状态保持原样）
      controlsOut.swapOverlay = { x: swX, y: swY, w: swW, h: swH };

      drawPanel(c, swX, swY, swW, swH, swH / 2, {
        bgTop: 'rgba(24, 34, 72, 0.85)',
        bgBot: 'rgba(12, 18, 42, 0.92)',
        border: 'rgba(120, 160, 255, 0.45)',
      });

      c.font = `700 12px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const modeText =
        side === 'dual'
          ? '操作布局：双手 (点击切换)'
          : side === 'right'
            ? '操作布局：右手 (点击切换)'
            : '操作布局：左手 (点击切换)';
      c.fillText(modeText, swX + swW / 2, swY + swH / 2);
    }

    // 主操作按钮（深邃科技蓝渐变 + 霓虹青边框 + 纯白高对比立体文字，绝对醒目清晰）
    const bw = 184;
    const bh = 44;
    const bx = (W - bw) / 2;
    const by = py + ph - bh - 20;
    controlsOut.primary = { x: bx, y: by, w: bw, h: bh };

    const grad = c.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#1d4ed8');
    drawRoundRect(c, bx, by, bw, bh, 10);
    c.fillStyle = grad;
    c.shadowColor = 'rgba(0, 242, 254, 0.45)';
    c.shadowBlur = 10;
    c.fill();
    c.shadowBlur = 0;

    // 霓虹发光边框
    c.strokeStyle = '#00f2fe';
    c.lineWidth = 1.8;
    c.shadowColor = '#00f2fe';
    c.shadowBlur = 8;
    c.stroke();
    c.shadowBlur = 0;

    // 顶部反光高光细线
    c.beginPath();
    c.moveTo(bx + 12, by + 1.2);
    c.lineTo(bx + bw - 12, by + 1.2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    c.lineWidth = 1;
    c.stroke();

    // 纯白清晰文字（带柔和阴影，确保在任何屏幕上都100%清晰突出）
    c.fillStyle = '#ffffff';
    c.font = `700 16px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0, 0, 0, 0.85)';
    c.shadowBlur = 4;
    const primaryLabel = state === 'ready' ? '开始游戏' : state === 'paused' ? '继续游戏' : '再来一局';
    c.fillText(primaryLabel, bx + bw / 2, by + bh / 2);
    c.shadowBlur = 0;

    c.textBaseline = 'alphabetic';

    // 适龄提示规范：CADPA 8+ 标志（首屏合规要求）
    if (state === 'ready') {
      c.font = `600 9px ${FONT}`;
      c.fillStyle = '#64748b';
      c.textAlign = 'center';
      c.fillText('💚 CADPA 适龄提示 8+ | 适合8岁及以上用户', W / 2, py + ph - 6);
    }
  }

  _drawSettingsModal(c, W, H, side, settings, controlsOut) {
    const pw = Math.min(W - 48, 330);
    const ph = 300;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - 20;

    drawPanel(c, px, py, pw, ph, 14, {
      bgTop: 'rgba(16, 24, 54, 0.90)',
      bgBot: 'rgba(7, 11, 26, 0.96)',
      border: 'rgba(120, 160, 255, 0.32)',
    });
    drawTechCorners(c, px, py, pw, ph, 7, 'rgba(34, 211, 238, 0.55)');

    c.textAlign = 'center';
    c.shadowColor = 'rgba(0, 242, 254, 0.55)';
    c.shadowBlur = 14;
    c.fillStyle = '#ffffff';
    c.font = `700 22px ${FONT}`;
    c.fillText('⚙️ 游戏设置', W / 2, py + 38);
    c.shadowBlur = 0;

    // 1. 操作模式分段选择器
    c.font = `700 12px ${FONT}`;
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

      drawRoundRect(c, m.x, segY, segW, segH, 7);
      if (active) {
        const aGrad = c.createLinearGradient(m.x, segY, m.x + segW, segY + segH);
        aGrad.addColorStop(0, 'rgba(2, 132, 199, 0.55)');
        aGrad.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
        c.fillStyle = aGrad;
        c.fill();
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        c.shadowColor = '#00f2fe';
        c.shadowBlur = 8;
        c.stroke();
        c.shadowBlur = 0;
      } else {
        c.fillStyle = 'rgba(15, 23, 48, 0.65)';
        c.fill();
        c.strokeStyle = 'rgba(120, 160, 255, 0.25)';
        c.lineWidth = 1;
        c.stroke();
      }

      c.font = `700 11px ${FONT}`;
      c.fillStyle = active ? '#ffffff' : '#cbd5e1';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(m.label, m.x + segW / 2, segY + segH / 2);
    }

    // 2. 触感震动反馈开关
    const vibeY = py + 126;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.font = `700 12px ${FONT}`;
    c.fillStyle = '#cbd5e1';
    c.fillText('触感震动反馈', px + 24, vibeY + 18);

    const toggleBtnW = 88;
    const toggleBtnH = 28;
    const toggleBtnX = px + pw - 24 - toggleBtnW;
    controlsOut.settingVibe = { x: toggleBtnX, y: vibeY, w: toggleBtnW, h: toggleBtnH };

    const vibeOn = settings ? settings.vibrateEnabled !== false : true;
    drawPanel(c, toggleBtnX, vibeY, toggleBtnW, toggleBtnH, toggleBtnH / 2, {
      bgTop: vibeOn ? 'rgba(2, 132, 199, 0.45)' : 'rgba(15, 23, 48, 0.75)',
      bgBot: vibeOn ? 'rgba(14, 165, 233, 0.25)' : 'rgba(10, 15, 34, 0.85)',
      border: vibeOn ? '#00f2fe' : 'rgba(120, 160, 255, 0.28)',
    });

    c.font = `700 11px ${FONT}`;
    c.fillStyle = vibeOn ? '#ffffff' : '#94a3b8';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(vibeOn ? '📳 已开启' : '关闭', toggleBtnX + toggleBtnW / 2, vibeY + toggleBtnH / 2);

    // 3. 音效声音反馈开关
    const sfxY = py + 168;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.font = `700 12px ${FONT}`;
    c.fillStyle = '#cbd5e1';
    c.fillText('音效声音反馈', px + 24, sfxY + 18);

    controlsOut.settingSfx = { x: toggleBtnX, y: sfxY, w: toggleBtnW, h: toggleBtnH };

    const sfxOn = settings ? settings.sfxEnabled !== false : true;
    drawPanel(c, toggleBtnX, sfxY, toggleBtnW, toggleBtnH, toggleBtnH / 2, {
      bgTop: sfxOn ? 'rgba(2, 132, 199, 0.45)' : 'rgba(15, 23, 48, 0.75)',
      bgBot: sfxOn ? 'rgba(14, 165, 233, 0.25)' : 'rgba(10, 15, 34, 0.85)',
      border: sfxOn ? '#00f2fe' : 'rgba(120, 160, 255, 0.28)',
    });

    c.font = `700 11px ${FONT}`;
    c.fillStyle = sfxOn ? '#ffffff' : '#94a3b8';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(sfxOn ? '🔊 已开启' : '🔇 静音', toggleBtnX + toggleBtnW / 2, sfxY + toggleBtnH / 2);

    // 4. 关闭/确定按钮
    const okW = 160;
    const okH = 38;
    const okX = (W - okW) / 2;
    const okY = py + ph - okH - 18;
    controlsOut.settingsClose = { x: okX, y: okY, w: okW, h: okH };

    const grad = c.createLinearGradient(okX, okY, okX + okW, okY + okH);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#1d4ed8');
    drawRoundRect(c, okX, okY, okW, okH, 9);
    c.fillStyle = grad;
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
    c.moveTo(okX + 10, okY + 1.2);
    c.lineTo(okX + okW - 10, okY + 1.2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    c.lineWidth = 1;
    c.stroke();

    c.fillStyle = '#ffffff';
    c.font = `700 15px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0, 0, 0, 0.85)';
    c.shadowBlur = 4;
    c.fillText('确 定', okX + okW / 2, okY + okH / 2);
    c.shadowBlur = 0;
    c.textBaseline = 'alphabetic';
  }
}
