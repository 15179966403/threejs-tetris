// ============ 全局常量 ============

export const COLS = 10;
export const ROWS = 20;
export const CELL = 1;

/** 消行闪光动画时长（秒），逻辑与视图共用 */
export const CLEAR_TIME = 0.35;

/** 消行及特效执行完毕后，暂停图形下落供玩家观察新布局的停顿时间（秒） */
export const SETTLE_TIME = 0.5;

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

/** 
 * 消行基础得分表（0~20 行全覆盖）：
 * 1 行: 100, 2 行: 300, 3 行: 500, 4 行: 800
 * 5 行及以上（重力压实或大范围连锁消除）：每多一行 +300 分，防止出现越界 undefined 造成 NaN
 */
export const LINE_SCORES = [
  0,
  100,
  300,
  500,
  800,
  1100,
  1400,
  1700,
  2000,
  2300,
  2600,
  2900,
  3200,
  3500,
  3800,
  4100,
  4400,
  4700,
  5000,
  5300,
  5600,
];

/**
 * 安全获取消行基础得分，保证任何行数均能计算出确定性数值，绝不返回 undefined 或产生 NaN
 * @param {number} n 消行数量
 * @returns {number} 基础得分
 */
export function getLineScore(n) {
  if (!n || n <= 0) return 0;
  if (n < LINE_SCORES.length) return LINE_SCORES[n];
  return 800 + (n - 4) * 300;
}

/** 初始（1级）特殊方格出现概率（原 1.0 全体出现太高，降至约 1/3） */
export const SPECIAL_CHANCE = 0.35;

/** 每升 1 级特殊方格生成概率增量（等级越高，特殊箭头方块越频繁） */
export const SPECIAL_CHANCE_STEP = 0.05;

/** 特殊方格最大生成概率上限（封顶 80%） */
export const MAX_SPECIAL_CHANCE = 0.80;

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

// ============ 道具系统常量 ============

/** 道具池最大容量（最多可持有 5 个道具） */
export const MAX_ITEMS = 5;

/** 1 级时获取道具所需的基础能量 */
export const BASE_ITEM_ENERGY = 3;

/** 每升 1 级所需能量增量：requiredEnergy = BASE_ITEM_ENERGY + (level - 1) * ITEM_ENERGY_STEP */
export const ITEM_ENERGY_STEP = 1;
