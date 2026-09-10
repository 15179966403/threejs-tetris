// 临时逻辑冒烟测试：node tests/smoke.mjs
import { TetrisGame } from '../src/TetrisGame.js';
import {
  COLS,
  ROWS,
  SHAPES,
  FX_TYPES,
  CLEAR_TIME,
  SETTLE_TIME,
  MAX_ITEMS,
  BASE_ITEM_ENERGY,
  ITEM_ENERGY_STEP,
} from '../src/constants.js';

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
  check('连锁得分入账（4格×10×1级，含连锁光束消掉的特殊格自身）', g.score === 40);
  check('连锁后状态合法', g.state === 'playing' && g.current !== null);
}

// 13. 横向激光（经 NW 取反连锁触发）+ 斜向取反（消除 + 补块）
// 注意：效果在「消除前的棋盘」上施加（与玩家所见方向语义一致），预设直接用原坐标
{
  const g = new TetrisGame();
  g.start();
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  g.board[ROWS - 1][5] = { t: 'O', fx: 'nw' };
  // NW 对角线（消除前）：(4,18)(3,17)(2,16)(1,15)(0,14)
  g.board[18][4] = { t: 'J', fx: 'right' }; // 被取反消除 → 连锁右向激光
  g.board[17][3] = { t: 'S', fx: null };
  g.board[16][2] = { t: 'T', fx: null };
  // 右向激光路径（同行）上放两个方块
  g.board[18][6] = { t: 'L', fx: null };
  g.board[18][8] = { t: 'Z', fx: null };
  g.clearingRows = [ROWS - 1];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  check('NW 取反消除对角方块', g.board[18][4] === null && g.board[17][3] === null && g.board[16][2] === null);
  check('NW 取反在对角空位补异形块（含消行下移）', g.board[16][1] && g.board[16][1].t === 'X' && g.board[15][0] && g.board[15][0].t === 'X');
  check('连锁右向激光清除同行方块', g.board[18][6] === null && g.board[18][8] === null);
  check('得分 = 清除5格×10（手动清行无消行分）', g.score === 50);
}

// 14. 斜向取反补全整行 → combo 连锁消行
{
  const g = new TetrisGame();
  g.start();
  // 第16/17/18行各行差一格（缺口在 NW 对角线上，取反时被补全）；
  // 第10~15行留空（对角线末段补入异形块）；第19行满行，特殊格在 (9,19) fx=nw
  for (let r = 16; r <= 18; r++)
    for (let c = 0; c < COLS; c++) g.board[r][c] = { t: 'O', fx: null };
  g.board[16][6] = null;
  g.board[17][7] = null;
  g.board[18][8] = null;
  g.board[19][9] = { t: 'O', fx: 'nw' };
  g.clearingRows = [19];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);
  // 第1波：消第19行 → NW 取反：缺口 (6,16)(7,17)(8,18) 全部补上 → 三行全满；
  // 对角线末段 (5,15)..(0,10) 补入 6 个异形块。消行下移后三行位于 17/18/19 → combo=1
  check('取反补全整行后进入连锁', g.state === 'clearing' && g.combo === 1);
  check('连锁行正确', g.clearingRows.length === 3);
  g.update(1);
  // 第2波：三行消除（500×2 倍率），无新连锁 → 收尾
  check('连锁后回到 playing', g.state === 'playing' && g.current !== null);
  check('连锁波次归零', g.combo === 0);
  check('连锁得分（500×2 倍率）', g.score === 1000);
  check('对角线末端补入异形块', g.board[19][5] && g.board[19][5].t === 'X' && g.board[14][0] && g.board[14][0].t === 'X');
}

// 12. 东北/西北斜向箭头超量孤立方块倒计时销毁机制
{
  const g = new TetrisGame();
  g.start();
  // 底部第 19 行放一个 nw 箭头，上方全部为空
  g.board[19][9] = { t: 'O', fx: 'nw' };
  g.clearingRows = [19];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1); // 触发消行与 nw 激光取反（取反在消除前棋盘上生效，随后下移一格）
  // nw 会在消除前棋盘的 (8,18)..(0,10) 共生成 9 个方块，下移一格后位于 (8,19)..(0,11)
  // 各所在行均只有 1 个方块；9 > 4，excess = 5，需安排 5 个孤立方块倒计时销毁
  check('nw 生成 9 个方块超量触发倒计时队列', g.decayQueue.length === 5);
  check('最顶层孤立块被标记为第 1 个销毁', g.decayQueue[0].y === 11 && g.decayQueue[0].countdown === 1);
  check('对应格子上带有 decay 属性', g.board[11][0].decay === 1);

  // 玩家放置第 1 个方块（通过 hardDrop 模拟锁定）
  g.hardDrop();
  check('放置 1 块后消除了 1 个超量孤立块', g.board[11][0] === null);
  check('倒计时队列剩余 4 个', g.decayQueue.length === 4);
  check('下一块倒计时递减为 1', g.decayQueue[0].countdown === 1 && g.board[12][1].decay === 1);

  // 连续再放置 4 个方块，直到超量孤立块全部销毁完毕
  for (let i = 0; i < 4; i++) {
    if (g.state === 'playing') g.hardDrop();
  }
  check('超量孤立方块已全部倒计时销毁', g.decayQueue.length === 0);
  // 统计原来 nw 在棋盘上生成的剩余方块数（下移后位于 16~19 行，排除放置过程中落在这些位置的方块）
  const remainingGenerated = [16, 17, 18, 19].filter((r) => g.board[r] && g.board[r][r - 10] && g.board[r][r - 10].t === 'X');
  check('箭头生成的剩余方块数量不大于 4', remainingGenerated.length <= 4);
}

// 13. 东北/西北斜向箭头在顶部四行（y < 4）取消生成
{
  const g = new TetrisGame();
  g.start();
  // 在第 8 行放置一个 nw 特殊格，上方全为空
  // nw 轨迹为 (c-1, r-1): (6, 7), (5, 6), (4, 5), (3, 4), (2, 3), (1, 2), (0, 1)
  g.board[8][7] = { t: 'O', fx: 'nw' };
  g.clearingRows = [8];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1); // 触发消行

  // 消行后上方行整体下移一格：预生成的 (3,4)(4,5) 位于 (4,4)(5,5)
  // 检查顶部 4 行（行号 0, 1, 2, 3）是否全部未生成方块
  const top4RowsBlocks = [0, 1, 2, 3].flatMap((r) => g.board[r].filter(Boolean));
  check('顶部四行（y < 4）取消生成任何方块', top4RowsBlocks.length === 0);

  // 检查行 4..7 上是否正常生成了方块（消行下移一格后位于 5/6 两行）
  check('非顶部四行（y >= 4）正常生成取反方块', g.board[5][3] !== null && g.board[6][4] !== null);
}

// 14. 消行两阶段：动画期(CLEAR_TIME)与观察期(SETTLE_TIME)暂停图形下落
{
  const g = new TetrisGame({ specialChance: 0 });
  g.start();
  // 填满第 19 行除最后 1 列
  for (let c = 0; c < COLS - 1; c++) g.board[ROWS - 1][c] = { t: 'I', fx: null };
  g.board[ROWS - 2][3] = { t: 'T', fx: null };

  // 人工触发消行：进入第 0 阶段（闪光缩放）
  g.clearingRows = [ROWS - 1];
  g.clearPhase = 0;
  g.clearTimer = 0;
  g.state = 'clearing';
  g.current = null;

  // 推进 0.2 秒（未达到 CLEAR_TIME=0.35s）
  g.update(0.2);
  check('消行动画期间保持 clearing 状态', g.state === 'clearing');
  check('消行动画期间处于 phase 0', g.clearPhase === 0);
  check('消行动画期间无下落方块', g.current === null);
  check('消行动画期间禁止移动操作', g.move(1, 0) === false);

  // 再推进 0.2 秒（累计 0.4s > CLEAR_TIME 0.35s，但仍在 SETTLE_TIME 0.5s 观察期内）
  g.update(0.2);
  check('动画结束进入 phase 1 布局观察期', g.clearPhase === 1);
  check('观察期内状态保持 clearing', g.state === 'clearing');
  check('观察期内棋盘已消除下移', g.board[ROWS - 1][3] && g.board[ROWS - 1][3].t === 'T');
  check('观察期内暂停图形下落（current 仍为 null）', g.current === null);
  check('观察期内禁止移动或旋转', g.rotate(1) === false && g.softDrop() === false);

  // 推进至观察期结束（再推进 0.5s，超过 SETTLE_TIME）
  g.update(0.5);
  check('观察期结束后回到 phase 0', g.clearPhase === 0);
  check('观察期结束后恢复 playing 状态', g.state === 'playing');
  check('新方块生成并开始下落', g.current !== null && g.current.y === -1);
}

// 15. 道具系统：消除箭头积攒能量与随等级难度递增
{
  const g = new TetrisGame();
  g.start();
  check('初始道具池为空', g.items.length === 0);
  check('初始道具能量为 0', g.itemEnergy === 0);
  check('1 级所需能量为 BASE_ITEM_ENERGY (3)', g.requiredEnergy === BASE_ITEM_ENERGY);

  // 模拟消除 1 个携带 up 箭头的满行
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  g.board[ROWS - 1][3] = { t: 'O', fx: 'up' };
  g.clearingRows = [ROWS - 1];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1); // 触发消行和 up 激光

  check('触发 1 个箭头后积攒 1 点能量', g.itemEnergy === 1);
  check('能量未达 3 时不产生道具', g.items.length === 0);

  // 再模拟消除 2 个特殊格
  for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
  g.board[ROWS - 1][0] = { t: 'O', fx: 'up' };
  g.board[ROWS - 1][1] = { t: 'O', fx: 'up' };
  g.clearingRows = [ROWS - 1];
  g.clearTimer = 1;
  g.state = 'clearing';
  g.update(1);

  check('累计 3 点能量兑换 1 个重力道具', g.items.length === 1 && g.items[0].type === 'gravity');
  check('兑换后能量扣除并归零', g.itemEnergy === 0);

  // 等级提升时所需能量递增
  g.level = 2;
  check('升到 2 级后所需能量递增为 4', g.requiredEnergy === 4);
  g.level = 3;
  check('升到 3 级后所需能量递增为 5', g.requiredEnergy === 5);

  // 道具池上限（MAX_ITEMS = 5）测试
  g.level = 1;
  for (let i = 0; i < 10; i++) {
    for (let c = 0; c < COLS; c++) g.board[ROWS - 1][c] = { t: 'O', fx: null };
    g.board[ROWS - 1][0] = { t: 'O', fx: 'up' };
    g.board[ROWS - 1][1] = { t: 'O', fx: 'up' };
    g.board[ROWS - 1][2] = { t: 'O', fx: 'up' };
    g.clearingRows = [ROWS - 1];
    g.clearTimer = 1;
    g.state = 'clearing';
    g.update(1);
  }
  check('道具池上限封顶为 5 个', g.items.length === MAX_ITEMS);
}

// 16. 重力道具：连续 2 列向下物理位移压实
{
  const g = new TetrisGame();
  g.start();
  // 赠送 1 个重力道具
  g.items.push({ id: 1, type: 'gravity', name: '重力', dir: 'down' });

  // 在第 3 列和第 4 列悬空放置方块（底部 18/19 行全空）
  g.board[12][3] = { t: 'I', fx: null };
  g.board[15][3] = { t: 'T', fx: null };
  g.board[10][4] = { t: 'O', fx: null };

  const used = g.useGravity('cols', 3, 'down');
  check('成功使用重力道具', used === true);
  check('道具池减少 1 个', g.items.length === 0);
  check('第 3 列较下的方块落到最底第 19 行', g.board[19][3] && g.board[19][3].t === 'T');
  check('第 3 列较上的方块叠在第 18 行', g.board[18][3] && g.board[18][3].t === 'I');
  check('原悬空位置已清空', g.board[12][3] === null && g.board[15][3] === null);
  check('第 4 列方块落到最底第 19 行', g.board[19][4] && g.board[19][4].t === 'O');
}

// 17. 重力道具：连续 2 行向下位移与位移后触发消行连锁
{
  const g = new TetrisGame();
  g.start();
  g.items.push({ id: 2, type: 'gravity', name: '重力', dir: 'down' });

  // 铺设第 19 行（除第 4、5 两个缺口外全部填满）
  for (let c = 0; c < COLS; c++) {
    if (c !== 4 && c !== 5) g.board[19][c] = { t: 'Z', fx: null };
  }
  // 在上方第 15 行的第 4、5 列悬空放置两个方块
  g.board[15][4] = { t: 'S', fx: null };
  g.board[15][5] = { t: 'S', fx: null };

  // 对第 14、15 两行使用向下重力
  const used = g.useGravity('rows', 14, 'down');
  check('成功使用连续两行重力', used === true);
  check('悬空方块下落填满第 19 行触发消行状态', g.state === 'clearing');
  check('消行包含第 19 行', g.clearingRows.includes(19));
}

console.log(failures === 0 ? '\n全部通过 ✔' : `\n${failures} 项失败 ✘`);
process.exit(failures === 0 ? 0 : 1);
