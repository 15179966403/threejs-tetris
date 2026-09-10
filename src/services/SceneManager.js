/**
 * 场景路由器 / 状态机 (SceneManager)
 *
 * 规范管理整个小游戏的顶级场景状态：
 * - SCENE_TITLE ('title'): 首页大厅 / 模式选择 / 规则教程
 * - SCENE_GAME ('game'): 游戏主对局（对局内部包含 ready / playing / clearing / paused / gameover 子状态）
 */

export const SCENES = {
  TITLE: 'title',
  GAME: 'game',
};

export class SceneManager {
  constructor(initialScene = SCENES.TITLE) {
    this._scene = initialScene;
    this._listeners = new Set();
  }

  get currentScene() {
    return this._scene;
  }

  isTitle() {
    return this._scene === SCENES.TITLE;
  }

  isGame() {
    return this._scene === SCENES.GAME;
  }

  /**
   * 切换场景
   * @param scene 'title' | 'game'
   * @param params 附加参数传递给目标场景
   */
  setScene(scene, params = {}) {
    if (scene !== SCENES.TITLE && scene !== SCENES.GAME) {
      console.warn('[SceneManager] 未知场景类型:', scene);
      return;
    }
    const prev = this._scene;
    if (prev === scene) return;

    this._scene = scene;
    this._notify(scene, prev, params);
  }

  /** 订阅场景切换通知 */
  onSceneChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify(next, prev, params) {
    for (const fn of this._listeners) {
      try {
        fn(next, prev, params);
      } catch (e) {
        console.error('[SceneManager] listener error', e);
      }
    }
  }
}

export const sceneManager = new SceneManager();
