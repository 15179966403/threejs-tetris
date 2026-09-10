import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TetrisGame } from '../src/TetrisGame.js';
import { settingsManager } from '../src/services/SettingsManager.js';

describe('双游玩模式架构测试（经典纯净模式 & 特技模式）', () => {
  it('经典模式初始化参数与特殊格概率为 0', () => {
    const game = new TetrisGame({ mode: 'classic' });
    assert.equal(game.mode, 'classic');
    assert.equal(game.specialChance, 0);

    // 等级提升后概率依然保持为 0
    game.level = 5;
    assert.equal(game.specialChance, 0);
  });

  it('经典模式连续生成 300 块绝无任何特殊箭头格', () => {
    const game = new TetrisGame({ mode: 'classic' });
    game.start();
    for (let i = 0; i < 300; i++) {
      assert.equal(game.nextSpecial, null, `第 ${i} 块不应携带特殊格`);
      game.hardDrop();
    }
  });

  it('经典模式禁用重力道具与能量积攒', () => {
    const game = new TetrisGame({ mode: 'classic' });
    game.start();

    // 手动调用私有或公开逻辑尝试积攒能量
    assert.equal(game.items.length, 0);
    assert.equal(game.itemEnergy, 0);

    // 尝试使用重力道具应被直接拒绝
    const ok = game.useGravity('cols', 3, 'down');
    assert.equal(ok, false);
  });

  it('特技模式正常生成特殊格与道具系统', () => {
    const game = new TetrisGame({ mode: 'skill' });
    assert.equal(game.mode, 'skill');
    assert.ok(game.specialChance > 0);
    assert.equal(game.requiredEnergy, 3);
  });

  it('双模式历史最高分完全独立隔离持久化', () => {
    settingsManager.setBest('classic', 8888);
    settingsManager.setBest('skill', 16666);

    assert.equal(settingsManager.getBest('classic'), 8888);
    assert.equal(settingsManager.getBest('skill'), 16666);
  });

  it('模式切换后 reset 状态正确重置', () => {
    const game = new TetrisGame({ mode: 'skill' });
    assert.equal(game.mode, 'skill');

    game.reset({ mode: 'classic' });
    assert.equal(game.mode, 'classic');
    assert.equal(game.specialChance, 0);

    game.reset({ mode: 'skill' });
    assert.equal(game.mode, 'skill');
    assert.ok(game.specialChance > 0);
  });
});
