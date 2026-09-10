/**
 * UI 主题常量与 Canvas 2D 绘图通用工具函数。
 */
export const PANEL = 'rgba(13, 18, 38, 0.72)';
export const BORDER = 'rgba(120, 140, 255, 0.25)';
export const ACCENT = '#22d3ee';
export const TEXT = '#e2e8f0';
export const MUTED = '#7d8bb0';
export const FONT = `"PingFang SC", "Heiti SC", "Microsoft YaHei", sans-serif`;

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
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 绘制半透明微立体玻璃质感面板 */
export function drawPanel(ctx, x, y, w, h, r = 10) {
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** 绘制发光微立体圆形按键 */
export function drawGlowingCircle(ctx, cx, cy, r, opt) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);

  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, opt.grad1 || '#1e294f');
  grad.addColorStop(1, opt.grad2 || '#0f172a');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = opt.border || BORDER;
  ctx.lineWidth = opt.lineWidth || 1.5;
  if (opt.glow) {
    ctx.shadowColor = opt.border;
    ctx.shadowBlur = opt.glow;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (opt.icon) {
    ctx.textAlign = 'center';
    ctx.fillStyle = opt.iconColor || '#38bdf8';
    ctx.font = `700 ${opt.iconSize || Math.round(r * 0.72)}px ${FONT}`;
    ctx.fillText(opt.icon, cx, cy + (opt.iconYOffset ?? Math.round(r * 0.04)));
  }

  if (opt.text) {
    ctx.fillStyle = opt.textColor || '#94a3b8';
    ctx.font = `600 ${opt.textSize || Math.max(9, Math.round(r * 0.36))}px ${FONT}`;
    ctx.fillText(opt.text, cx, cy + (opt.textYOffset ?? Math.round(r * 0.62)));
  }
  ctx.restore();
}
