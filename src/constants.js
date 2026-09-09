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

/** 特殊方格出现概率（1 = 每个方块必带一个，可下调调难度） */
export const SPECIAL_CHANCE = 1;

/** 特殊方格的激光效果：up = 消除同列上方 / down = 消除同列下方 */
export const FX_TYPES = ['up', 'down'];

/** 激光效果提示色（视图用）：↑青色 / ↓橙色 */
export const FX_COLORS = { up: 0x22d3ee, down: 0xf97316 };

/** 激光每清除一个方格的得分（× 当前等级） */
export const LASER_CELL_SCORE = 10;
