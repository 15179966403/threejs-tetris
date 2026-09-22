import test from 'node:test';
import assert from 'node:assert/strict';
import { TetrisGame } from '../src/TetrisGame.js';
import { LayaAgent } from '../src/LayaAgent.js';

test('LayaAgent 基础状态与开关切换', () => {
  const agent = new LayaAgent();
  assert.equal(agent.enabled, false);
  assert.equal(agent.status, 'IDLE');

  const on = agent.toggle();
  assert.equal(on, true);
  assert.equal(agent.enabled, true);
  assert.equal(agent.status, 'ACTIVE');

  const off = agent.toggle();
  assert.equal(off, false);
  assert.equal(agent.enabled, false);
  assert.equal(agent.status, 'IDLE');
});

test('LayaAgent 候选落点推演与格式化', () => {
  const game = new TetrisGame();
  game.start();

  const agent = new LayaAgent();
  const { candidates } = agent.survey(game);

  assert.ok(candidates && candidates.length > 0, '应该能够推演出至少一个合法落点');

  const first = candidates[0];
  assert.ok('rot' in first);
  assert.ok('px' in first);
  assert.ok('py' in first);
  assert.ok('text' in first);
  assert.match(first.text, /^The piece leaves (no holes|one hole|two holes|three holes|many holes) under it and makes (no bump|a small bump|a big bump|a tall tower) on top/);
});

test('LayaAgent 决策与自动操作执行 (Auto-pilot)', async () => {
  const game = new TetrisGame();
  game.start();

  const agent = new LayaAgent();
  agent.enabled = true;

  // 触发规划
  await agent.plan(game);
  assert.ok(agent.target !== null, '应该选出最优落点目标');
  assert.equal(agent.status, 'NAVIGATING');

  const targetPx = agent.target.px;
  const targetRot = agent.target.rot;

  // 逐步模拟 tick 执行若干步
  for (let i = 0; i < 30; i++) {
    agent.tick(game, 0.1);
    if (!game.current || game.current.x === targetPx) break;
  }
});

test('全盘重力道具模式与 LayaAgent 智能全屏压实释放', () => {
  const game = new TetrisGame();
  game.start();

  // 构造悬空棋盘：在第 1 列和第 8 列分别悬空方块
  game.board[15][1] = { color: 1 };
  game.board[19][1] = null; // 悬空空洞
  game.board[14][8] = { color: 2 };
  game.board[19][8] = null; // 悬空空洞

  // 赋予道具
  game.items.push({ id: 999, type: 'gravity', name: '重力', dir: 'down' });

  const agent = new LayaAgent();
  const triggered = agent.checkAndUseGravity(game);

  assert.equal(triggered, true, '当全盘存在悬空空洞时，LayaAgent 应自动释放全屏重力');
  assert.equal(game.board[19][1]?.color, 1, '第 1 列方块应坠落到底部第 19 行');
  assert.equal(game.board[15][1], null, '第 1 列原本悬空位置已空');
  assert.equal(game.board[19][8]?.color, 2, '第 8 列方块应坠落到底部第 19 行（全盘作用不受列范围限制）');
  assert.equal(game.board[14][8], null, '第 8 列原本悬空位置已空');
  assert.equal(game.items.length, 0, '道具已被消耗');
});

