/**
 * 经典模式（classic）策略：
 * - 传统俄罗斯方块：下落速度随等级指数加快（下限 0.05s）；
 * - 无特殊格、无道具系统。
 */
export const ClassicMode = {
  id: 'classic',

  /** 道具（重力）系统开关 */
  itemsEnabled: false,

  /** 每级下落间隔（秒）：0.9s × 0.82^(level-1)，下限 0.05s */
  dropInterval(level) {
    return Math.max(0.05, 0.9 * Math.pow(0.82, level - 1));
  },

  /** 经典模式恒无特殊格（显式覆盖同样不生效） */
  specialChance() {
    return 0;
  },
};
