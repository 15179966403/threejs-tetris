import { COLS, ROWS, SHAPES } from './constants.js';

/** 矩阵顺时针旋转 90° */
function rotateCW(m) {
  const n = m.length;
  const o = m.map((r) => r.slice());
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      o[x][n - 1 - y] = m[y][x];
    }
  }
  return o;
}

const HOLES = ['no holes', 'one hole', 'two holes', 'three holes', 'many holes'];
const BUMPS = ['no bump', 'a small bump', 'a big bump', 'a tall tower'];
const LINES = ['', 'one line', 'two lines', 'three lines', 'four lines'];

const QUESTIONS = {
  look: {
    type: 'choice',
    instructions: 'How does the stack look after the piece lands?',
    criteria: {
      clean: 'flat with no holes',
      messy: 'holes or a tall tower',
    },
  },
};

const grade = (v, from, step) => Math.max(0, Math.min(3, Math.ceil((v - from) / step)));

export class LayaAgent {
  constructor() {
    this.enabled = false;
    this.status = 'IDLE'; // 'IDLE' | 'THINKING' | 'NAVIGATING' | 'ACTIVE'
    this.currentPieceId = null;
    this.target = null; // { rot: number, px: number, py: number, text: string, compositeScore: number }
    this.currentRot = 0; // 当前方块已顺时针旋转次数 (0~3)
    this.stepTimer = 0;
    this.stepInterval = 0.045; // 动作间隔（45ms），流畅而平稳
    this.cache = new Map(); // 句子预测结果缓存: text -> p(clean)
    this.lastThought = '';
    this.onStatusChange = null;
    this.gravityCooldown = 0; // 重力道具释放节流
  }

  toggle() {
    this.enabled = !this.enabled;
    this.target = null;
    this.currentPieceId = null;
    this.status = this.enabled ? 'ACTIVE' : 'IDLE';
    if (this.onStatusChange) this.onStatusChange(this.status, this.lastThought);
    return this.enabled;
  }

  /**
   * 主循环中的更新方法
   * @param {import('./TetrisGame.js').TetrisGame} game
   * @param {number} dt 秒
   */
  tick(game, dt) {
    if (!this.enabled) return;
    if (game.state !== 'playing' || !game.current) {
      this.target = null;
      return;
    }

    // 1. 特技模式专属：重力技能自动检测与智能释放（垂直压实与水平消井）
    if (this.gravityCooldown > 0) this.gravityCooldown -= dt;
    if (this.gravityCooldown <= 0 && game.rules.itemsEnabled) {
      if (this.checkAndUseGravity(game)) {
        this.gravityCooldown = 0.8; // 释放后冷却 0.8 秒
        return;
      }
      if (this.checkAndUseHorizontalGravity(game)) {
        this.gravityCooldown = 0.8;
        return;
      }
    }

    // 2. 生成方块唯一指纹，检测新方块
    const pieceId = `${game.current.type}-${game.score}-${game.lines}`;
    if (pieceId !== this.currentPieceId) {
      this.currentPieceId = pieceId;
      this.currentRot = 0;
      this.target = null;
      this.status = 'THINKING';
      this.plan(game);
      return;
    }

    if (!this.target) return;

    // 3. 动作节流驱动导航
    this.stepTimer += dt;
    if (this.stepTimer < this.stepInterval) return;
    this.stepTimer = 0;

    this.executeStep(game);
  }

  /** 智能释放重力道具：发现全盘中存在多个悬空空洞或高位风险时，自动调用全盘重力技能压实 */
  checkAndUseGravity(game) {
    if (!game.items || !game.items.length) return false;
    const hasGravity = game.items.some((it) => it.type === 'gravity');
    if (!hasGravity) return false;

    // 扫描全盘所有 10 列中被方块压在下方的空洞总数与最高高度
    let totalHollows = 0;
    let maxHeight = 0;
    for (let c = 0; c < COLS; c++) {
      let hasBlock = false;
      let colH = 0;
      for (let y = 0; y < ROWS; y++) {
        if (game.board[y][c]) {
          hasBlock = true;
          if (colH === 0) colH = ROWS - y;
        } else if (hasBlock) {
          totalHollows++;
        }
      }
      if (colH > maxHeight) maxHeight = colH;
    }

    // 全局空洞达到 2 个以上，或堆叠较高（>=10）且存在空洞时，即刻使用全盘重力道具压实棋盘
    if (totalHollows >= 2 || (maxHeight >= 10 && totalHollows >= 1)) {
      const ok = game.useGravity('all', 0, 'down');
      if (ok) {
        this.lastThought = `⚡ 全屏重力释放！全体方块下坠压实 (消除 ${totalHollows} 空洞)`;
        if (this.onStatusChange) this.onStatusChange(this.status, this.lastThought);
        return true;
      }
    }
    return false;
  }

  /** 智能释放水平重力道具：发现棋盘出现多个深井、列间割裂或可一键聚合消行时触发 */
  checkAndUseHorizontalGravity(game) {
    if (!game.items || !game.items.length) return false;
    const hasHGravity = game.items.some((it) => it.type === 'horizontal_gravity');
    if (!hasHGravity) return false;

    // 扫描各列高度与井数
    const heights = Array.from({ length: COLS }, (_, x) => {
      let r = 0;
      while (r < ROWS && !game.board[r][x]) r++;
      return ROWS - r;
    });

    // 计算深井数量与总井深
    let wellsCount = 0;
    let totalWellDepth = 0;
    for (let c = 0; c < COLS; c++) {
      const leftH = c > 0 ? heights[c - 1] : heights[c];
      const rightH = c < COLS - 1 ? heights[c + 1] : heights[c];
      const minNeighbor = Math.min(leftH, rightH);
      const depth = minNeighbor - heights[c];
      if (depth >= 2) {
        wellsCount++;
        totalWellDepth += depth;
      }
    }

    // 计算表面粗糙度
    let roughness = 0;
    for (let c = 1; c < COLS; c++) {
      roughness += Math.abs(heights[c] - heights[c - 1]);
    }

    // 触发条件：存在 2 个及以上深井、累计井深 >= 5，或粗糙度 >= 12 且有深井
    if (wellsCount >= 2 || totalWellDepth >= 5 || (roughness >= 12 && wellsCount >= 1)) {
      const ok = game.useHorizontalGravity('auto');
      if (ok) {
        this.lastThought = `⚡ 水平重力释放！方块聚拢消井 (消除 ${wellsCount} 个井)`;
        if (this.onStatusChange) this.onStatusChange(this.status, this.lastThought);
        return true;
      }
    }
    return false;
  }

  /** 模拟评估并选出最优落点（结合 Laya 直觉与物理防暴毙策略） */
  async plan(game) {
    const type = game.current.type;
    const { candidates, currentBoardHoles, maxBoardHeight } = this.survey(game);
    if (!candidates.length) return;

    // 获取所有候选落点中不重复的自然语言描述句子
    const uniqueTexts = [...new Set(candidates.map((c) => c.text))];

    // 并行或从缓存请求 Laya 模型评估
    const promises = uniqueTexts.map(async (text) => {
      if (this.cache.has(text)) return { text, p: this.cache.get(text) };
      try {
        const res = await fetch('/laya-api/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: text, questions: QUESTIONS }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const p = data.answers.look.probabilities.clean;
        this.cache.set(text, p);
        return { text, p };
      } catch (err) {
        // 后端无法连接时的启发式后备评估
        const p = this.heuristicScore(text);
        return { text, p };
      }
    });

    const results = await Promise.all(promises);
    const scoreMap = new Map(results.map((r) => [r.text, r.p]));

    // 综合打分：融合 Laya 结构平整直觉 + 严禁留井防暴毙策略（平铺填槽、有行即消）
    for (const c of candidates) {
      const layaScore = scoreMap.get(c.text) ?? 0.5;
      c.layaScore = layaScore;

      // 1. Laya 原生 Clean 概率基础分 (0 ~ 1.0)
      let composite = layaScore;

      // 2. 积极消行激励：有行即消，降低堆叠高度，绝不憋大招等待长条
      composite += c.lines * 0.40;

      // 3. 严厉抑制新生成暗洞：每个暗洞都是潜在致命隐患
      const newHoles = Math.max(0, c.holes - currentBoardHoles);
      composite -= newHoles * 0.50;
      composite -= c.holes * 0.15;

      // 4. 【核心改进】严禁留空等待长条：深井深度惩罚与边列孤立惩罚
      composite -= c.wellDepth * 0.35;
      composite -= c.edgeEmptyPenalty;

      // 5. 【核心改进】平铺填坑奖励：优先填补最矮列，大幅缩小高低差
      if (c.isFillingLowest) {
        composite += 0.25; // 奖励平铺填平洼地
      }
      if (c.heightSpread > 2) {
        composite -= (c.heightSpread - 2) * 0.15; // 极差超过 2 扣分，保持像桌面一样平整
      }

      // 6. 高度危险指数惩罚：当整体盘面升高时，严惩向高处堆积
      const dangerHeight = Math.max(0, c.topHeight - 5);
      const heightFactor = maxBoardHeight >= 8 ? 0.09 : 0.04;
      composite -= (dangerHeight ** 1.6) * heightFactor;

      // 7. 表面粗糙度微调惩罚
      composite -= c.bump * 0.06;

      c.compositeScore = composite;
    }

    // 排序：综合分最高优先，相同时落点越低优先
    candidates.sort((a, b) => {
      if (Math.abs(b.compositeScore - a.compositeScore) > 0.0001) {
        return b.compositeScore - a.compositeScore;
      }
      return b.py - a.py;
    });

    const best = candidates[0];
    this.target = best;
    this.status = 'NAVIGATING';
    this.lastThought = `平铺填槽 | P(clean): ${(best.layaScore * 100).toFixed(0)}% | 极差: ${best.heightSpread} | ${best.text}`;

    if (this.onStatusChange) this.onStatusChange(this.status, this.lastThought);
  }

  /** 后备启发式打分（Laya 服务未就绪或断网时使用） */
  heuristicScore(text) {
    let score = 0.5;
    if (text.includes('no holes')) score += 0.3;
    else if (text.includes('one hole')) score -= 0.1;
    else score -= 0.3;

    if (text.includes('no bump')) score += 0.15;
    else if (text.includes('a tall tower')) score -= 0.25;

    if (text.includes('completes')) score += 0.25;
    return Math.max(0.01, Math.min(0.99, score));
  }

  /** 碰撞检测辅助函数 */
  collides(board, matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  /** 遍历当前方块所有合法旋转与落点，生成自然语言评估短句 */
  survey(game) {
    const board = game.board;
    const type = game.current.type;
    const baseMatrix = SHAPES[type];
    const candidates = [];
    const seen = new Set();

    // 计算放置前各列的高度（从下往上数占用的格数）
    const heightsBefore = Array.from({ length: COLS }, (_, x) => {
      let r = 0;
      while (r < ROWS && !board[r][x]) r++;
      return ROWS - r;
    });
    const roughBefore = heightsBefore.reduce((acc, h, i) => (i ? acc + Math.abs(h - heightsBefore[i - 1]) : 0), 0);
    const sumBefore = heightsBefore.reduce((a, b) => a + b, 0);
    const maxBoardHeight = Math.max(...heightsBefore);

    // 计算放置前当前棋盘的空洞数量
    let currentBoardHoles = 0;
    for (let x = 0; x < COLS; x++) {
      let hasBlock = false;
      for (let y = 0; y < ROWS; y++) {
        if (board[y][x]) hasBlock = true;
        else if (hasBlock) currentBoardHoles++;
      }
    }

    // 枚举 4 种旋转方向
    let curMatrix = baseMatrix.map((r) => [...r]);
    for (let rot = 0; rot < 4; rot++) {
      if (rot > 0) curMatrix = rotateCW(curMatrix);

      // 枚举横坐标 px
      for (let px = -2; px < COLS; px++) {
        // 如果顶部出生位置就已经碰撞，跳过
        let py = -1;
        while (py < 0 && !this.collides(board, curMatrix, px, py + 1)) py++;
        if (this.collides(board, curMatrix, px, py)) continue;

        // 持续下落至触底
        while (!this.collides(board, curMatrix, px, py + 1)) py++;

        // 提取该落点占用的格子坐标
        const cells = [];
        for (let r = 0; r < curMatrix.length; r++) {
          for (let c = 0; c < curMatrix[r].length; c++) {
            if (curMatrix[r][c]) cells.push([px + c, py + r]);
          }
        }

        // 超出顶部区域则不选
        if (cells.some(([_, y]) => y < 0)) continue;

        // 对称性去重
        const key = cells.map(([x, y]) => `${x},${y}`).sort().join(';');
        if (seen.has(key)) continue;
        seen.add(key);

        // 模拟落定后的盘面
        const simBoard = board.map((row) => row.slice());
        for (const [cx, cy] of cells) simBoard[cy][cx] = 1;

        // 计算消行
        const kept = simBoard.filter((row) => !row.every(Boolean));
        const lines = ROWS - kept.length;
        while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(null));

        // 计算空洞 (Holes): 格子上方有方块且自身为空
        let holes = 0;
        for (let x = 0; x < COLS; x++) {
          let hasBlockAbove = false;
          for (let y = 0; y < ROWS; y++) {
            if (simBoard[y][x]) hasBlockAbove = true;
            else if (hasBlockAbove) holes++;
          }
        }

        // 计算落定后的列高与粗糙度 (Bumps)
        const heightsAfter = Array.from({ length: COLS }, (_, x) => {
          let r = 0;
          while (r < ROWS && !kept[r][x]) r++;
          return ROWS - r;
        });
        const roughAfter = heightsAfter.reduce((acc, h, i) => (i ? acc + Math.abs(h - heightsAfter[i - 1]) : 0), 0);
        const topHeight = ROWS - Math.min(...cells.map(([_, y]) => y));
        const bump = Math.max(
          grade(roughAfter - roughBefore, 0, 2),
          grade(topHeight * COLS - sumBefore, 3 * COLS, COLS)
        );

        // 4. 【严禁留井指标】：计算每个落点后盘面出现的“井”（低于两侧的狭窄凹坑）
        let wellDepth = 0;
        for (let x = 0; x < COLS; x++) {
          let d = 0;
          if (x === 0) d = Math.max(0, heightsAfter[1] - heightsAfter[0]);
          else if (x === COLS - 1) d = Math.max(0, heightsAfter[COLS - 2] - heightsAfter[COLS - 1]);
          else d = Math.max(0, Math.min(heightsAfter[x - 1], heightsAfter[x + 1]) - heightsAfter[x]);

          if (d >= 2) wellDepth += (d - 1);
          if (d >= 3) wellDepth += (d - 2) * 2; // 深度 >= 3 的深井严厉惩罚
        }

        // 5. 【边缘留空等长条惩罚】：如果盘面已有一定高度，却把第 0 列或第 9 列空着
        const avgHeightAfter = heightsAfter.reduce((a, b) => a + b, 0) / COLS;
        let edgeEmptyPenalty = 0;
        if (avgHeightAfter >= 2.0) {
          if (heightsAfter[0] < avgHeightAfter - 1.5) {
            edgeEmptyPenalty += (avgHeightAfter - 1.5 - heightsAfter[0]) * 0.4;
          }
          if (heightsAfter[COLS - 1] < avgHeightAfter - 1.5) {
            edgeEmptyPenalty += (avgHeightAfter - 1.5 - heightsAfter[COLS - 1]) * 0.4;
          }
        }

        // 6. 【平铺填平洼地奖励】：是否填入了之前最矮的一列
        const minHeightBefore = Math.min(...heightsBefore);
        const isFillingLowest = cells.some(([cx]) => heightsBefore[cx] === minHeightBefore);

        // 7. 【列高极差】：最高的列与最矮的列的落差
        const heightSpread = Math.max(...heightsAfter) - Math.min(...heightsAfter);

        // 构造 Laya 标准格式语句
        const holesDesc = HOLES[Math.min(4, holes)];
        const bumpDesc = BUMPS[bump];
        const linesDesc = lines > 0 ? ` It completes ${LINES[lines]}.` : '';
        const text = `The piece leaves ${holesDesc} under it and makes ${bumpDesc} on top.${linesDesc}`;

        candidates.push({
          rot,
          px,
          py,
          text,
          lines,
          holes,
          bump,
          topHeight,
          wellDepth,
          edgeEmptyPenalty,
          isFillingLowest,
          heightSpread,
        });
      }
    }

    return { candidates, currentBoardHoles, maxBoardHeight };
  }

  /** 执行一步操作：旋转 -> 平移 -> 硬降 */
  executeStep(game) {
    const cur = game.current;
    if (!cur || !this.target) return;

    // 1. 旋转对齐
    if (this.currentRot !== this.target.rot) {
      if (game.rotate(1)) {
        this.currentRot = (this.currentRot + 1) % 4;
      }
      return;
    }

    // 2. 水平平移对齐
    if (cur.x < this.target.px) {
      game.move(1, 0);
      return;
    }
    if (cur.x > this.target.px) {
      game.move(-1, 0);
      return;
    }

    // 3. 已对齐目标，硬降落底锁定
    if (cur.x === this.target.px && this.currentRot === this.target.rot) {
      game.hardDrop();
      this.target = null;
    }
  }
}
