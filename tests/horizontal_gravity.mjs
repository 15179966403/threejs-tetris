import test from 'node:test';
import assert from 'node:assert/strict';
import { TetrisGame } from '../src/TetrisGame.js';
import { COLS, ROWS } from '../src/constants.js';
import { LayaAgent } from '../src/LayaAgent.js';

test('水平重力物理位移：向左聚拢消除多井与垂直沉降', () => {
  const game = new TetrisGame();
  game.start();

  // 构造散乱的多井盘面：
  // 第 19 行（最底）：在列 0, 2, 4 各放 1 个方块（列 1, 3 为井）
  game.board[19][0] = { t: 'I', fx: null };
  game.board[19][2] = { t: 'T', fx: null };
  game.board[19][4] = { t: 'O', fx: null };

  // 第 18 行：在列 2, 4 各放 1 个方块
  game.board[18][2] = { t: 'S', fx: null };
  game.board[18][4] = { t: 'Z', fx: null };

  // 赠送 1 个水平重力道具
  game.items.push({ id: 101, type: 'horizontal_gravity', name: '水平重力', dir: 'auto' });

  const ok = game.useHorizontalGravity('left');
  assert.equal(ok, true, '成功使用水平重力道具');
  assert.equal(game.items.length, 0, '道具已被消耗');

  // 验证第 19 行：原本 0, 2, 4 的 3 个方块，加上第 18 行悬空掉下来的方块，紧密聚集在最左侧
  // 19 行原先 3 个方块聚在 0, 1, 2
  // 18 行原先 2 个方块聚在 0, 1，并与 19 行已有方块堆叠，其中悬空的会沉降到底部
  assert.ok(game.board[19][0] !== null, '第 19 行第 0 列应有方块');
  assert.ok(game.board[19][1] !== null, '第 19 行第 1 列应有方块（原井消除）');
  assert.ok(game.board[19][2] !== null, '第 19 行第 2 列应有方块');
  assert.equal(game.board[19][3], null, '第 19 行第 3 列应为空（井隙已被挤至右侧）');
  assert.equal(game.board[19][4], null, '第 19 行第 4 列应为空');
});

test('水平重力物理位移：向右聚拢', () => {
  const game = new TetrisGame();
  game.start();

  // 第 19 行：在列 5, 7, 9 放方块
  game.board[19][5] = { t: 'I', fx: null };
  game.board[19][7] = { t: 'T', fx: null };
  game.board[19][9] = { t: 'O', fx: null };

  game.items.push({ id: 102, type: 'horizontal_gravity', name: '水平重力', dir: 'right' });

  const ok = game.useHorizontalGravity('right');
  assert.equal(ok, true);

  // 向右聚拢后，方块应聚集在列 7, 8, 9
  assert.ok(game.board[19][7] !== null);
  assert.ok(game.board[19][8] !== null);
  assert.ok(game.board[19][9] !== null);
  assert.equal(game.board[19][5], null);
  assert.equal(game.board[19][6], null);
});

test('水平重力触发连锁消行', () => {
  const game = new TetrisGame();
  game.start();

  // 填满第 19 行（10 格）
  for (let c = 0; c < COLS; c++) {
    game.board[19][c] = { t: 'J', fx: null };
  }

  // 在第 18 行放置 3 个方块（列 1, 3, 5）
  game.board[18][1] = { t: 'L', fx: null };
  game.board[18][3] = { t: 'L', fx: null };
  game.board[18][5] = { t: 'L', fx: null };

  // 赋予水平重力道具
  game.items.push({ id: 103, type: 'horizontal_gravity', name: '水平重力', dir: 'auto' });

  const ok = game.useHorizontalGravity('left');
  assert.equal(ok, true);

  // 第 19 行满足 10 格满行，触发消行状态
  assert.equal(game.state, 'clearing', '聚拢补满整行后应触发消行状态');
  assert.ok(game.clearingRows.includes(19), '应消除第 19 行');
  assert.ok(game.score > 0, '消行应得分');
});

test('LayaAgent 自动检测多井局面并释放水平重力', () => {
  const game = new TetrisGame();
  game.start();

  // 构造多井局面：列 1 为 4 格高立柱，列 3 为 4 格高立柱，列 2 与列 4 为深井
  for (let r = 16; r < ROWS; r++) {
    game.board[r][1] = { t: 'I', fx: null };
    game.board[r][3] = { t: 'I', fx: null };
  }

  // 赋予水平重力道具
  game.items.push({ id: 104, type: 'horizontal_gravity', name: '水平重力', dir: 'auto' });

  const agent = new LayaAgent();
  const triggered = agent.checkAndUseHorizontalGravity(game);

  assert.equal(triggered, true, 'LayaAgent 应在多井局面下自动触发水平重力');
  assert.equal(game.items.length, 0, '道具已被消耗');
  assert.match(agent.lastThought, /水平重力释放/, 'Agent 思考反馈应包含水平重力');
});

test('LayaAgent 在方块堆叠过高危急局面下（高度 >= 12）即使无深井也自动释放水平重力防暴毙', () => {
  const game = new TetrisGame();
  game.start();

  // 构造高位平缓堆叠（高度达 13 格，距顶部仅剩 7 格，但表面平缓无深井，原逻辑会死憋不放）
  // 比如从第 7 行堆到底部第 19 行（共 13 格高）
  for (let r = 7; r < ROWS; r++) {
    game.board[r][0] = { t: 'O', fx: null };
    game.board[r][1] = { t: 'O', fx: null };
    game.board[r][2] = { t: 'O', fx: null };
  }

  // 赋予水平重力道具
  game.items.push({ id: 201, type: 'horizontal_gravity', name: '水平重力', dir: 'auto' });

  const agent = new LayaAgent();
  agent.target = { px: 5, rot: 0 };
  agent.currentPieceId = 'old-piece-id';

  const triggered = agent.checkAndUseHorizontalGravity(game);

  assert.equal(triggered, true, '高位危急状态下，必须触发水平重力释放！');
  assert.equal(game.items.length, 0, '道具已被使用消耗');
  assert.equal(agent.target, null, '释放后必须清空旧 target');
  assert.equal(agent.currentPieceId, null, '释放后必须重置 pieceId 以触发重新 plan');
  assert.match(agent.lastThought, /防暴毙/, '思考反馈应体现紧急防暴毙');
});

test('LayaAgent 在高位且能通过水平重力降低堆叠高度时主动释放', () => {
  const game = new TetrisGame();
  game.start();

  // 构造第 10 行到底部的阶梯（高度 10 格）
  // 行 10 ~ 13: 只有列 3 有方块（高立柱单点支撑）
  // 行 14 ~ 19: 列 0, 1 有方块，列 3 无支撑
  for (let r = 10; r <= 13; r++) {
    game.board[r][3] = { t: 'I', fx: null };
  }
  for (let r = 14; r < ROWS; r++) {
    game.board[r][0] = { t: 'I', fx: null };
    game.board[r][1] = { t: 'I', fx: null };
  }

  game.items.push({ id: 202, type: 'horizontal_gravity', name: '水平重力', dir: 'auto' });

  const agent = new LayaAgent();
  const triggered = agent.checkAndUseHorizontalGravity(game);

  assert.equal(triggered, true, '高位且能大幅降低高度时，应主动释放水平重力');
  assert.equal(game.items.length, 0);
});

