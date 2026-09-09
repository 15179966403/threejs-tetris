// ============ 全局常量 ============

export const COLS = 10;
export const ROWS = 20;
export const CELL = 1;

/** 消行闪光动画时长（秒），逻辑与视图共用 */
export const CLEAR_TIME = 0.35;

/** 7 种方块的经典配色 + 异形块 X（斜向取反生成的紫色填充块） */
export const COLORS = {
  I: 0x22d3ee, // 青
  O: 0xfacc15, // 黄
  T: 0xa855f7, // 紫
  S: 0x22c55e, // 绿
  Z: 0xef4444, // 红
  J: 0x3b82f6, // 蓝
  L: 0xf97316, // 橙
  X: 0xa78bfa, // 异形块（仅由斜向取反产生，不参与 7-bag 生成）
};

/** 方块形状矩阵（1 表示占格） */
export const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

export const TYPES = Object.keys(SHAPES);

/** 4 行消行的基础得分，乘以当前等级 */
export const LINE_SCORES = [0, 100, 300, 500, 800];

/** 特殊方格出现概率（原 1.0 全体出现太高，降至约 1/3） */
export const SPECIAL_CHANCE = 0.35;

/** 特殊方格的 8 个方向：正交 = 直线激光清除，斜向 = 取反（有则消、无则加） */
export const FX_TYPES = ['up', 'down', 'left', 'right', 'ne', 'nw', 'se', 'sw'];

/** 激光效果提示色：正交直线（青）/ 斜向取反（紫） */
export const FX_COLORS = {
  up: 0x22d3ee,
  down: 0x22d3ee,
  left: 0x22d3ee,
  right: 0x22d3ee,
  ne: 0xa78bfa,
  nw: 0xa78bfa,
  se: 0xa78bfa,
  sw: 0xa78bfa,
};

/** 激光每清除一个方格的得分（× 当前等级） */
export const LASER_CELL_SCORE = 10;

/** 连锁消行最大波数（防止斜向取反无限循环） */
export const MAX_COMBO = 8;
