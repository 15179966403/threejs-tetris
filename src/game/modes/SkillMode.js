import { SPECIAL_CHANCE, SPECIAL_CHANCE_STEP, MAX_SPECIAL_CHANCE } from '../../constants.js';

/**
 * 特技模式（skill）策略：
 * - 下落速度恒定 0.9s，压力来自特殊格与道具规则本身而非手速；
 * - 特殊格出现概率随等级递增（封顶 80%），显式覆盖（测试/教学）优先级最高；
 * - 道具（重力）系统开启。
 */
export const SkillMode = {
  id: 'skill',

  /** 道具（重力）系统开关 */
  itemsEnabled: true,

  /** 每级下落间隔（秒），恒定不随等级变化 */
  dropInterval() {
    return 0.9;
  },

  /**
   * 特殊格出现概率：随等级递增，封顶 80%。
   * @param level 当前等级
   * @param override 显式覆盖值（测试/教学模式），非 null/undefined 时优先
   */
  specialChance(level, override) {
    if (override !== null && override !== undefined) return override;
    return Math.min(MAX_SPECIAL_CHANCE, SPECIAL_CHANCE + (level - 1) * SPECIAL_CHANCE_STEP);
  },
};
