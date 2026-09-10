/**
 * UI 主题常量与 Canvas 2D 绘图通用工具函数（Neo-Cyber Glassmorphism 赛博毛玻璃视觉体系）。
 */
export const PANEL = 'rgba(10, 15, 34, 0.78)';
export const PANEL_BG_TOP = '#121a38';
export const PANEL_BG_BOT = '#080d20';
export const BORDER = 'rgba(120, 160, 255, 0.22)';
export const BORDER_BRIGHT = 'rgba(34, 211, 238, 0.45)';
export const ACCENT = '#22d3ee';
export const ACCENT_CYAN = '#00f2fe';
export const ACCENT_BLUE = '#3b82f6';
export const ACCENT_PURPLE = '#a855f7';
export const ACCENT_GOLD = '#facc15';
export const ACCENT_EMERALD = '#10b981';
export const TEXT = '#f1f5f9';
export const MUTED = '#8899b8';
export const FONT = 'sans-serif';

/** 8 方向 -> NEXT 预览箭头旋转角（canvas y 轴向下，顺时针为正） */
export const CANVAS_ANGLE = {
  up: 0,
  ne: Math.PI / 4,
  right: Math.PI / 2,
  se: (3 * Math.PI) / 4,
  down: Math.PI,
  sw: (-3 * Math.PI) / 4,
  left: -Math.PI / 2,
  nw: -Math.PI / 4,
};

/** 绘制圆角矩形路径 */
export function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 绘制半透明微立体玻璃质感面板（带顶部高光折射微边缘） */
export function drawPanel(ctx, x, y, w, h, r = 12, options = {}) {
  const c = ctx;
  c.save();

  // 1. 底板渐变（毛玻璃深邃质感）
  drawRoundRect(c, x, y, w, h, r);
  const grad = c.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, options.bgTop || 'rgba(18, 26, 56, 0.82)');
  grad.addColorStop(1, options.bgBot || 'rgba(8, 12, 28, 0.90)');
  c.fillStyle = grad;
  c.fill();

  // 2. 边框发光 / 基础描边
  c.strokeStyle = options.border || BORDER;
  c.lineWidth = options.lineWidth || 1;
  c.stroke();

  // 3. 顶部边缘物理高光玻璃反光折射线 (Rim Light)
  c.beginPath();
  c.moveTo(x + r, y + 0.75);
  c.lineTo(x + w - r, y + 0.75);
  const rimGrad = c.createLinearGradient(x, y, x + w, y);
  rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  rimGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.22)');
  rimGrad.addColorStop(0.7, 'rgba(34, 211, 238, 0.35)');
  rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
  c.strokeStyle = rimGrad;
  c.lineWidth = 1;
  c.stroke();

  c.restore();
}

/** 绘制科技风微型四角标 (Tech Corner Brackets) */
export function drawTechCorners(ctx, x, y, w, h, size = 6, color = 'rgba(34, 211, 238, 0.6)') {
  const c = ctx;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.lineCap = 'round';

  // 左上
  c.beginPath();
  c.moveTo(x, y + size);
  c.lineTo(x, y);
  c.lineTo(x + size, y);
  c.stroke();

  // 右上
  c.beginPath();
  c.moveTo(x + w - size, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + size);
  c.stroke();

  // 左下
  c.beginPath();
  c.moveTo(x, y + h - size);
  c.lineTo(x, y + h);
  c.lineTo(x + size, y + h);
  c.stroke();

  // 右下
  c.beginPath();
  c.moveTo(x + w - size, y + h);
  c.lineTo(x + w, y + h);
  c.lineTo(x + w, y + h - size);
  c.stroke();

  c.restore();
}

/** 绘制发光微立体圆形按键 */
export function drawGlowingCircle(ctx, cx, cy, r, opt = {}) {
  ctx.save();

  // 外晕发光
  if (opt.glow) {
    ctx.shadowColor = opt.glowColor || opt.border || ACCENT;
    ctx.shadowBlur = opt.glow;
  }

  // 底盘圆心渐变
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, opt.grad1 || '#1e294f');
  grad.addColorStop(1, opt.grad2 || '#0b1122');
  ctx.fillStyle = grad;
  ctx.fill();

  // 描边
  ctx.strokeStyle = opt.border || BORDER;
  ctx.lineWidth = opt.lineWidth || 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 内圈金属质感高光弧
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 中心图标
  if (opt.icon) {
    ctx.textAlign = 'center';
    ctx.fillStyle = opt.iconColor || '#38bdf8';
    ctx.font = `700 ${opt.iconSize || Math.round(r * 0.72)}px ${FONT}`;
    ctx.fillText(opt.icon, cx, cy + (opt.iconYOffset ?? Math.round(r * 0.04)));
  }

  // 底部辅助标签
  if (opt.text) {
    ctx.fillStyle = opt.textColor || '#94a3b8';
    ctx.font = `600 ${opt.textSize || Math.max(9, Math.round(r * 0.36))}px ${FONT}`;
    ctx.fillText(opt.text, cx, cy + (opt.textYOffset ?? Math.round(r * 0.62)));
  }

  ctx.restore();
}
