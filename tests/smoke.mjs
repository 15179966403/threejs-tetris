// 临时逻辑冒烟测试：node tests/smoke.mjs
import { TetrisGame } from '../src/TetrisGame.js';
import { COLS, ROWS, SHAPES } from '../src/constants.js';

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

// 1. 基本开局
{
  const g = new TetrisGame();
  g.start();
  check('start 后进入 playing', g.state === 'playing');
  check('生成当前方块', g.current !== null);
  check('nextType 有效', typeof g.nextType === 'string');
}

// 2. 移动与边界
{
  const g = new TetrisGame();
  g.start();
  for (let i = 0; i < 50; i++) g.move(-1, 0); // 一直往左
  const xs = [];
  const { matrix } = g.current;
  for (let r = 0; r < matrix.length; r++)
    for (let c = 0; c < matrix[r].length; c++)
      if (matrix[r][c]) xs.push(g.current.x + c);
  check('左移不越界', Math.min(...xs) >= 0);
  check('未发生碰撞仍存活', g.state === 'playing');
}

// 3. 硬降必然锁定并生成新方块
{
  const g = new TetrisGame();
  g.start();
  g.hardDrop();
  check('硬降后仍有活动方块', g.current !== null);
  const filled = g.board.flat().filter(Boolean).length;
  check('锁定 4 格', filled === 4);
  check('硬降得 2 分 x 格数', g.score >= 2);
}

// 4. 消行链路：填满底行除最后一列，用竖 I 补位触发 clearing
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS - 1; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  let sawClearing = false;
  for (let i = 0; i < 80 && !sawClearing; i++) {
    if (g.state === 'gameover' || !g.current) break;
    if (g.current.type === 'I') {
      g.rotate(1); // 转竖，只占 1 列
      for (let k = 0; k < 6; k++) g.move(1, 0); // 推到最右列
      g.hardDrop();
      if (g.state === 'clearing') sawClearing = true;
    } else {
      // 非 I 方块丢到最左，保持右侧空旷
      for (let k = 0; k < 10; k++) g.move(-1, 0);
      g.hardDrop();
    }
  }
  check('补满底行能触发消行状态', sawClearing);
  check('消行得分 100 x 等级', g.score >= 100);
}

// 5. 满行消除后行数守恒、上方下移
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'I', fx: null };
  g.board[ROWS - 2][3] = { t: 'T', fx: null };
  g.clearingRows = [ROWS - 1];
  g.state = 'clearing';
  g.clearTimer = 1; // >= CLEAR_TIME
  g.update(0.016);
  check('消行后行数守恒', g.board.length === ROWS);
  check('上方块下移一行', g.board[ROWS - 1][3] && g.board[ROWS - 1][3].t === 'T');
  check('被消行不存在残留', g.board[ROWS - 2][3] === null && g.board[ROWS - 2].every((v) => v === null));
  check('消行后回到 playing 并生成新方块', g.state === 'playing' && g.current !== null);
}

// 6. 计分与等级（走真实消行链路：反复补满底行累计 10 行）
{
  const g = new TetrisGame();
  g.start();
  const s0 = g.score;
  check('软降加 1 分', (g.softDrop(), g.score === s0 + 1));

  let guard = 0;
  while (g.level < 2 && g.state !== 'gameover' && guard++ < 500) {
    if (g.state === 'clearing') {
      g.update(1); // 快进消行动画
      continue;
    }
    if (!g.current) break;
    // 维持底行：除最右列外全部填满
    for (let c = 0; c < COLS - 1; c++) if (!g.board[ROWS - 1][c]) g.board[ROWS - 1][c] = { t: 'O', fx: null };
    const snapshot = g.board.map((r) => r.map((v) => (v ? { ...v } : null)));
    if (g.current.type === 'I') {
      g.rotate(1); // 转竖补最右列
      for (let k = 0; k < 6; k++) g.move(1, 0);
      g.hardDrop();
    } else {
      for (let k = 0; k < 10; k++) g.move(-1, 0);
      g.hardDrop();
      // 不触发消行的干扰方块直接回滚，避免左侧堆死
      if (g.state === 'playing') {
        g.board = snapshot.map((r) => r.map((v) => (v ? { ...v } : null)));
      }
    }
  }
  check('累计消 10 行升到 2 级', g.level === 2 && g.lines === 10);
  check('消行累计得分正确', g.score >= 10 * 100);
  check('升级后下落更快', g.dropInterval < 0.9);
}

// 7. 随机操作 2000 步压力测试，不崩溃且状态合法
{
  const g = new TetrisGame();
  g.start();
  const acts = ['moveL', 'moveR', 'rot', 'soft', 'hard'];
  let ok = true;
  for (let i = 0; i < 2000 && g.state !== 'gameover'; i++) {
    const a = acts[(Math.random() * acts.length) | 0];
    if (a === 'moveL') g.move(-1, 0);
    else if (a === 'moveR') g.move(1, 0);
    else if (a === 'rot') g.rotate(1);
    else if (a === 'soft') g.softDrop();
    else g.hardDrop();
    g.update(1); // 大步推进触发自然下落/锁定
    if (g.state === 'clearing') g.update(1); // 快进消行动画
    const filled = g.board.flat().filter(Boolean).length;
    if (filled > COLS * ROWS) ok = false;
  }
  check('2000 步随机操作未崩溃且棋盘占用合法', ok);
  check('最终状态合法', ['playing', 'clearing', 'gameover'].includes(g.state));
}

// 8. 暂停
{
  const g = new TetrisGame();
  g.start();
  g.togglePause();
  check('暂停后状态 paused', g.state === 'paused');
  const y = g.current.y;
  g.update(10);
  check('暂停时方块不下落', g.current.y === y);
  g.togglePause();
  check('恢复 playing', g.state === 'playing');
}

// 9. 特殊格生成
{
  const g = new TetrisGame();
  g.start();
  const s = g.current.special;
  check('当前方块携带特殊格', !!s && (s.fx === 'up' || s.fx === 'down'));
  check('特殊格位于有效格上', !!SHAPES[g.current.type][s.r][s.c]);
  check('next 预览携带特殊格', !!g.nextSpecial && !!SHAPES[g.nextType][g.nextSpecial.r][g.nextSpecial.c]);
  check('锁定后特殊格写入棋盘', (() => {
    const { x, special } = g.current;
    const gy = g.ghostY();
    g.hardDrop();
    const cell = g.board[gy + special.r][x + special.c];
    return !!cell && cell.fx === special.fx;
  })());
}

// 10. 特殊格坐标随旋转变换（顺时针 (r,c) -> (c, n-1-r)）
{
  const g = new TetrisGame();
  g.start();
  g.current.type = 'T';
  g.current.matrix = [[1, 0, 0], [1, 1, 1], [0, 0, 0]];
  g.current.x = 3;
  g.current.y = 2;
  g.current.special = { r: 1, c: 0, fx: 'up' };
  g.rotate(1);
  check(
    '旋转后特殊格坐标变换',
    g.current.special.r === 0 && g.current.special.c === 1 && g.current.special.fx === 'up'
  );
  check('变换后的特殊格仍在有效格上', g.current.matrix[g.current.special.r][g.current.special.c] === 1);
}

// 11. 消行触发 up 激光：清除同列上方全部方块
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  g.board[ROWS - 1][5] = { t: 'O', fx: 'up' };
  g.board[10][5] = { t: 'I', fx: null };
  g.board[4][5] = { t: 'I', fx: null };
  g.board[18][0] = { t: 'Z', fx: null }; // 干扰：不在同列
  g.clearingRows = [ROWS - 1];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  check('up 激光清除同列上方全部方块', g.board[10][5] === null && g.board[4][5] === null);
  check('消行后其他列方块下移一行', g.board[19][0] && g.board[19][0].t === 'Z');
  check('激光得分入账（2格×10×1级）', g.score === 20);
  check('激光后正常生成新方块', g.state === 'playing' && g.current !== null);
}

// 12. down 激光 + 被激光清除的特殊格连锁触发
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS; c++) g.board[15][c] = { t: 'O', fx: null };
  g.board[15][2] = { t: 'O', fx: 'down' };
  g.board[16][2] = { t: 'J', fx: null };
  g.board[18][2] = { t: 'L', fx: 'up' }; // 被第一个激光清掉 → 连锁
  g.board[10][2] = { t: 'I', fx: null }; // 连锁 up 激光应清除它
  g.board[14][7] = { t: 'Z', fx: null }; // 无关列
  g.clearingRows = [15];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  check('down 激光清除同列下方', g.board[16][2] === null && g.board[18][2] === null);
  check('连锁触发 up 激光', g.board[10][2] === null);
  check('消行后无关列方块下移一行', g.board[15][7] && g.board[15][7].t === 'Z');
  check('连锁得分入账（3格×10×1级）', g.score === 30);
  check('连锁后状态合法', g.state === 'playing' && g.current !== null);
}

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
