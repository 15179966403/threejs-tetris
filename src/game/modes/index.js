import { SkillMode } from './SkillMode.js';
import { ClassicMode } from './ClassicMode.js';

/**
 * 模式策略注册表。
 *
 * 新增模式的步骤：
 * 1. 本目录新建 <ModeId>Mode.js，导出策略对象：
 *    { id, itemsEnabled, dropInterval(level), specialChance(level, override) }
 * 2. 在 REGISTRY 注册；
 * 3. 如玩法与俄罗斯方块差异较大（如连连看），另建独立引擎类并实现
 *    与 TetrisGame 相同的视图契约（state/board/score/update/fxEvents...），
 *    由 SceneManager 路由，UI 层通过能力位（itemsEnabled 等）自适应。
 */
const REGISTRY = {
  skill: SkillMode,
  classic: ClassicMode,
};

/** 按模式 id 取策略对象；未知 id 回退到特技模式 */
export function getMode(id) {
  return REGISTRY[id] || SkillMode;
}

export { SkillMode, ClassicMode };
