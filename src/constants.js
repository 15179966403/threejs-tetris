// ============ 全局常量 ============

export const COLS = 10;
export const ROWS = 20;
export const CELL = 1;

/** 消行闪光动画时长（秒），逻辑与视图共用 */
export const CLEAR_TIME = 0.35;

/** 7 种方块的经典配色 */
export const COLORS = {
  I: 0x22d3ee, // 青
  O: 0xfacc15, // 黄
  T: 0xa855f7, // 紫
  S: 0x22c55e, // 绿
  Z: 0xef4444, // 红
  J: 0x3b82f6, // 蓝
  L: 0xf97316, // 橙
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
