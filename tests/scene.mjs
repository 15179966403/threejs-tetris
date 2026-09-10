import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SceneManager, SCENES } from '../src/services/SceneManager.js';

describe('SceneManager 单元测试', () => {
  it('默认初始化为 TITLE 场景', () => {
    const sm = new SceneManager();
    assert.equal(sm.currentScene, SCENES.TITLE);
    assert.equal(sm.isTitle(), true);
    assert.equal(sm.isGame(), false);
  });

  it('正确切换至 GAME 场景', () => {
    const sm = new SceneManager();
    sm.setScene(SCENES.GAME);
    assert.equal(sm.currentScene, SCENES.GAME);
    assert.equal(sm.isGame(), true);
    assert.equal(sm.isTitle(), false);
  });

  it('场景切换时触发通知监听器', () => {
    const sm = new SceneManager();
    let transition = null;
    const unsub = sm.onSceneChange((next, prev, params) => {
      transition = { next, prev, params };
    });

    sm.setScene(SCENES.GAME, { mode: 'classic' });
    assert.deepEqual(transition, {
      next: SCENES.GAME,
      prev: SCENES.TITLE,
      params: { mode: 'classic' },
    });

    // 取消订阅
    unsub();
    transition = null;
    sm.setScene(SCENES.TITLE);
    assert.equal(transition, null);
  });

  it('非合法场景名称被安全拦截并忽略', () => {
    const sm = new SceneManager();
    sm.setScene('invalid_scene');
    assert.equal(sm.currentScene, SCENES.TITLE);
  });
});
