// 临时逻辑冒烟测试：node tests/smoke.mjs
import { TetrisGame } from '../src/TetrisGame.js';
import { COLS, ROWS, SHAPES, FX_TYPES } from '../src/constants.js';

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

// 6. 计分与等级（走真实消行链路：反复补满底行累计 10 行；关闭特殊格保证确定性）
{
  const g = new TetrisGame({ specialChance: 0 });
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

// 9. 特殊格生成（概率 0.35，随机重开确保覆盖两种分支）
{
  const g = new TetrisGame();
  let guard = 0;
  while (!g.nextSpecial && guard++ < 200) g.reset(); // 必然能遇到特殊格
  check('能生成特殊格', !!g.nextSpecial && FX_TYPES.includes(g.nextSpecial.fx));
  g.start();
  const s = g.current.special;
  check('当前方块携带特殊格且方向合法', !!s && FX_TYPES.includes(s.fx));
  check('特殊格位于有效格上', !!SHAPES[g.current.type][s.r][s.c]);
  check('next 预览特殊格合法（概率可为空）', g.nextSpecial === null || FX_TYPES.includes(g.nextSpecial.fx));
  check('锁定后特殊格写入棋盘', (() => {
    const { x, special } = g.current;
    const gy = g.ghostY();
    g.hardDrop();
    const cell = g.board[gy + special.r][x + special.c];
    return !!cell && cell.fx === special.fx;
  })());
  const g2 = new TetrisGame();
  g2.nextSpecial = null; // 概率分支：无特殊格时也能正常进行
  g2.start();
  check('无特殊格分支正常', g2.current.special === null && g2.state === 'playing');
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
    '旋转后特殊格坐标与方向同步变换（CW：up→right）',
    g.current.special.r === 0 && g.current.special.c === 1 && g.current.special.fx === 'right'
  );
  check('变换后的特殊格仍在有效格上', g.current.matrix[g.current.special.r][g.current.special.c] === 1);
  g.rotate(-1); // 转回去：坐标复原、方向也复原
  check(
    '逆旋转后复原',
    g.current.special.r === 1 &&
      g.current.special.c === 0 &&
      g.current.special.fx === 'up'
  );
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

// 13. 横向激光（经 NW 取反连锁触发）+ 斜向取反（消除 + 补块）
// 注意：手动设置 clearingRows 后行会整体下移一格，所有预设坐标按消行后的位置反推
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  g.board[ROWS - 1][5] = { t: 'O', fx: 'nw' };
  // 消行后 NW 对角线为 (4,18)(3,17)(2,16)，预设位置需上移一行
  g.board[17][4] = { t: 'J', fx: 'right' }; // 被取反消除 → 连锁右向激光
  g.board[16][3] = { t: 'S', fx: null };
  g.board[15][2] = { t: 'T', fx: null };
  // 右向激光路径（消行后同行）上放两个方块
  g.board[17][6] = { t: 'L', fx: null };
  g.board[17][8] = { t: 'Z', fx: null };
  g.clearingRows = [ROWS - 1];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  check('NW 取反消除对角方块', g.board[18][4] === null && g.board[17][3] === null && g.board[16][2] === null);
  check('NW 取反在对角空位补异形块', g.board[15][1] && g.board[15][1].t === 'X' && g.board[14][0] && g.board[14][0].t === 'X');
  check('连锁右向激光清除同行方块', g.board[18][6] === null && g.board[18][8] === null);
  check('得分 = 清除5格×10（手动清行无消行分）', g.score === 50);
}

// 14. 斜向取反补全整行 → combo 连锁消行
{
  const g = new TetrisGame();
  g.start();
  // 消行后缺口需落在 NW 对角线上：预设放在上一行（缺口 (6,15)(7,16)(8,17) → 消行后 (6,16)(7,17)(8,18)）
  for (let r = 15; r <= 18; r++)
    for (let c = 0; c < COLS; c++) g.board[r][c] = { t: 'O', fx: null };
  g.board[15][6] = null;
  g.board[16][7] = null;
  g.board[17][8] = null;
  g.board[19][9] = { t: 'O', fx: 'nw' };
  g.clearingRows = [19];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  // 第1波：消第19行 → NW 取反把 16/17/18 的缺口全部补上（旧的满行18也下移到19）→ 四行同时全满 → combo=1
  check('取反补全整行后进入连锁', g.state === 'clearing' && g.combo === 1);
  check('连锁行正确', g.clearingRows.length === 4);
  g.update(1);
  // 第2波：四行消除（800×2 倍率），无新连锁 → 收尾
  check('连锁后回到 playing', g.state === 'playing' && g.current !== null);
  check('连锁波次归零', g.combo === 0);
  check('连锁得分（800×2 倍率）', g.score === 1600);
}

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
