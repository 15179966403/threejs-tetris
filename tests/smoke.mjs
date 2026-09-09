// 临时逻辑冒烟测试：node tests/smoke.mjs
import { TetrisGame } from '../src/TetrisGame.js';
import { COLS, ROWS } from '../src/constants.js';

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
  for (let c = 0; c < COLS - 1; c++) g.board[ROWS - 1][c] = 'O';
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
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = 'I';
  g.board[ROWS - 2][3] = 'T';
  g.clearingRows = [ROWS - 1];
  g.state = 'clearing';
  g.clearTimer = 1; // >= CLEAR_TIME
  g.update(0.016);
  check('消行后行数守恒', g.board.length === ROWS);
  check('上方块下移一行', g.board[ROWS - 1][3] === 'T');
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
    for (let c = 0; c < COLS - 1; c++) if (!g.board[ROWS - 1][c]) g.board[ROWS - 1][c] = 'O';
    const snapshot = g.board.map((r) => r.join('|'));
    if (g.current.type === 'I') {
      g.rotate(1); // 转竖补最右列
      for (let k = 0; k < 6; k++) g.move(1, 0);
      g.hardDrop();
    } else {
      for (let k = 0; k < 10; k++) g.move(-1, 0);
      g.hardDrop();
      // 不触发消行的干扰方块直接回滚，避免左侧堆死
      if (g.state === 'playing') {
        g.board = snapshot.map((r) => r.split('|').map((v) => (v === 'null' ? null : v)));
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

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
