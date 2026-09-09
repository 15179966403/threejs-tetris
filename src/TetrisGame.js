import {
  COLS,
  ROWS,
  SHAPES,
  TYPES,
  LINE_SCORES,
  CLEAR_TIME,
  SPECIAL_CHANCE,
  FX_TYPES,
  LASER_CELL_SCORE,
  MAX_COMBO,
} from './constants.js';

/** 方向 -> (列增量, 行增量)；行号向下增长，up 即 dy=-1 */
const FX_DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

/** 旋转时特殊格方向的变换（方向随方块一起旋转，玩家旋转即瞄准） */
const FX_CW = {
  up: 'right', right: 'down', down: 'left', left: 'up',
  ne: 'se', se: 'sw', sw: 'nw', nw: 'ne',
};
const FX_CCW = {
  up: 'left', left: 'down', down: 'right', right: 'up',
  ne: 'nw', nw: 'sw', sw: 'se', se: 'ne',
};

/** 矩阵顺时针旋转 90° */
function rotateCW(m) {
  const n = m.length;
  const o = m.map((r) => r.slice());
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) o[x][n - 1 - y] = m[y][x];
  return o;
}

/** 矩阵逆时针旋转 90° */
function rotateCCW(m) {
  const n = m.length;
  const o = m.map((r) => r.slice());
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) o[n - 1 - x][y] = m[y][x];
  return o;
}

/**
 * 俄罗斯方块纯逻辑（不依赖 Three.js），便于测试与扩展。
 *
 * 状态机：ready -> playing <-> paused -> clearing -> playing ... -> gameover
 */
export class TetrisGame {
  /**
   * @param options.specialChance 特殊格出现概率覆盖（默认取 SPECIAL_CHANCE；
   *        测试/教学模式可传 0 关闭）
   */
  constructor(options = {}) {
    this.specialChance = options.specialChance ?? SPECIAL_CHANCE;
    this.reset();
  }

  reset() {
    /** board[row][col]：null 为空，否则为 { t: 方块类型字母, fx: null | 'up' | 'down' } */
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.bag = [];
    this.nextSpecial = null; // next 方块上的特殊格 { r, c, fx }（矩阵坐标）
    this.nextType = this.#draw();
    this.current = null; // { type, matrix, x, y, special }
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = 'ready'; // ready | playing | clearing | paused | gameover
    this.combo = 0; // 连锁波次（消行后由特殊格引发的额外消行轮数）
    this.dropTimer = 0;
    this.clearTimer = 0;
    this.clearingRows = [];
    this.fxEvents = []; // 视图特效事件队列（视图每帧消费后清空）
  }

  /** 每级下落间隔（秒），随等级加快 */
  get dropInterval() {
    return Math.max(0.05, 0.9 * Math.pow(0.82, this.level - 1));
  }

  /** 7-bag 随机器：每 7 个方块一组洗牌，保证分布均匀；同时随机生成特殊格 */
  #draw() {
    if (!this.bag.length) {
      this.bag = [...TYPES];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const type = this.bag.pop();
    // 特殊格：在方块的有效格中随机选一个，效果随机「8 向」之一
    this.nextSpecial = null;
    if (Math.random() < this.specialChance) {
      const cells = [];
      SHAPES[type].forEach((row, r) => row.forEach((v, c) => v && cells.push({ r, c })));
      const pick = cells[(Math.random() * cells.length) | 0];
      this.nextSpecial = {
        r: pick.r,
        c: pick.c,
        fx: FX_TYPES[(Math.random() * FX_TYPES.length) | 0],
      };
    }
    return type;
  }

  start() {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    this.#spawn();
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  /** 生成新方块；与已有方块重叠则游戏结束 */
  #spawn() {
    const type = this.nextType;
    const special = this.nextSpecial;
    this.nextType = this.#draw();
    const matrix = SHAPES[type].map((r) => [...r]);
    this.current = {
      type,
      matrix,
      x: ((COLS - matrix.length) / 2) | 0,
      y: -1, // 从可见区顶部之上出现
      special,
    };
    this.dropTimer = 0;
    if (this.#collides(matrix, this.current.x, this.current.y)) {
      this.current = null;
      this.state = 'gameover';
    }
  }

  /** 目标位置是否合法（板外上方 row<0 视为空） */
  #collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && this.board[y][x]) return true;
      }
    }
    return false;
  }

  move(dx, dy) {
    if (this.state !== 'playing' || !this.current) return false;
    const { matrix, x, y } = this.current;
    if (this.#collides(matrix, x + dx, y + dy)) return false;
    this.current.x += dx;
    this.current.y += dy;
    return true;
  }

  /** 软降：下移一格并得 1 分 */
  softDrop() {
    if (this.move(0, 1)) {
      this.score += 1;
      return true;
    }
    return false;
  }

  /** 旋转（dir=1 顺时针 / -1 逆时针），带简单的踢墙尝试 */
  rotate(dir) {
    if (this.state !== 'playing' || !this.current) return false;
    const cur = this.current;
    if (cur.type === 'O') return true; // O 无需旋转
    const rotated = dir > 0 ? rotateCW(cur.matrix) : rotateCCW(cur.matrix);
    // 依次尝试水平偏移
    for (const dx of [0, -1, 1, -2, 2]) {
      if (!this.#collides(rotated, cur.x + dx, cur.y)) {
        cur.matrix = rotated;
        cur.x += dx;
        if (cur.special) cur.special = this.#rotateSpecial(cur.special, rotated.length, dir);
        return true;
      }
    }
    // 贴地时尝试抬高一格再旋转
    for (const dx of [0, -1, 1]) {
      if (!this.#collides(rotated, cur.x + dx, cur.y - 1)) {
        cur.matrix = rotated;
        cur.x += dx;
        cur.y -= 1;
        if (cur.special) cur.special = this.#rotateSpecial(cur.special, rotated.length, dir);
        return true;
      }
    }
    return false;
  }

  /** 特殊格坐标与方向随矩阵旋转变换（玩家旋转即瞄准） */
  #rotateSpecial(s, n, dir) {
    const fx = dir > 0 ? FX_CW[s.fx] : FX_CCW[s.fx];
    return dir > 0
      ? { r: s.c, c: n - 1 - s.r, fx } // 顺时针 (r,c) -> (c, n-1-r)
      : { r: n - 1 - s.c, c: s.r, fx }; // 逆时针 (r,c) -> (n-1-c, r)
  }

  /** 当前方块硬降后所在行 */
  ghostY() {
    const { matrix, x, y } = this.current;
    let gy = y;
    while (!this.#collides(matrix, x, gy + 1)) gy++;
    return gy;
  }

  /** 硬降：直接落底并锁定 */
  hardDrop() {
    if (this.state !== 'playing' || !this.current) return;
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.#lock();
  }

  /** 每帧推进（dt 为秒） */
  update(dt) {
    if (this.state === 'clearing') {
      this.clearTimer += dt;
      if (this.clearTimer >= CLEAR_TIME) this.#finishClear();
      return;
    }
    if (this.state !== 'playing' || !this.current) return;
    this.dropTimer += dt;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      if (!this.move(0, 1)) this.#lock();
    }
  }

  /** 将当前方块写入棋盘，检测消行 */
  #lock() {
    const { matrix, x, y, type, special } = this.current;
    let overflow = false;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (by < 0) {
          overflow = true; // 锁定在可见区之外 => 顶死
          continue;
        }
        const isSpecial = special && special.r === r && special.c === c;
        this.board[by][bx] = { t: type, fx: isSpecial ? special.fx : null };
      }
    }
    this.current = null;
    if (overflow) {
      this.state = 'gameover';
      return;
    }

    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every((v) => v)) full.push(r);
    }

    if (full.length) {
      // 进入消行状态，视图层会播放闪光动画；combo 归零表示连锁波次的起点
      this.combo = 0;
      this.clearingRows = full;
      this.clearTimer = 0;
      this.state = 'clearing';
      this.fxEvents.push({ type: 'clear', rows: full.slice() });
      this.score += LINE_SCORES[full.length] * this.level;
      this.lines += full.length;
      this.level = Math.floor(this.lines / 10) + 1;
    } else {
      this.#spawn();
    }
  }

  /**
   * 消行动画结束：触发特殊格效果 → 检测连锁整行 → 下一波或收尾。
   * 斜向取反可能补全整行，因此消行会级联成 combo 连锁。
   */
  #finishClear() {
    // 1. 收集被消除行中的特殊格，换算成消行下移后的列位作为效果起点
    const triggers = [];
    for (const r of this.clearingRows) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r][c];
        if (cell && cell.fx) {
          const below = this.clearingRows.filter((rr) => rr > r).length;
          triggers.push({ x: c, y: r + below, fx: cell.fx });
        }
      }
    }

    // 2. 常规消行 + 上方下移
    this.board = this.board.filter((_, r) => !this.clearingRows.includes(r));
    while (this.board.length < ROWS) this.board.unshift(Array(COLS).fill(null));
    this.clearingRows = [];
    this.state = 'playing';

    // 3. 依次施加方向效果（正交激光清除 / 斜向取反，被清除的特殊格连锁入队）
    let cellsCleared = 0;
    const queue = triggers;
    while (queue.length) {
      const { x, y, fx } = queue.shift();
      const [dx, dy] = FX_DIRS[fx];
      const touched = [];
      let xx = x + dx;
      let yy = y + dy;
      while (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) {
        cellsCleared += this.#applyFx(xx, yy, dx, dy, queue, touched);
        xx += dx;
        yy += dy;
      }
      this.fxEvents.push({ type: 'beam', x, y, dx, dy, fx, cells: touched });
    }
    if (cellsCleared) this.score += cellsCleared * LASER_CELL_SCORE * this.level;

    // 4. 连锁检测：效果可能补全整行 → 开启下一波（combo+1，得分倍率 ×(combo+1)）
    const full = [];
    for (let r = 0; r < ROWS; r++) if (this.board[r].every((v) => v)) full.push(r);
    if (full.length && this.combo < MAX_COMBO) {
      this.combo += 1;
      this.clearingRows = full;
      this.clearTimer = 0;
      this.state = 'clearing'; // 留在 clearing：下一波动画结束后再次进入本方法
      this.fxEvents.push({ type: 'clear', rows: full.slice() });
      this.score += LINE_SCORES[full.length] * this.level * (this.combo + 1);
      this.lines += full.length;
      this.level = Math.floor(this.lines / 10) + 1;
      return;
    }

    // 5. 连锁结束，恢复常规下落
    this.combo = 0;
    this.#spawn();
  }

  /** 对单个格子施加方向效果：正交=清除，斜向=取反；返回清除的格子数 */
  #applyFx(x, y, dx, dy, queue, touched) {
    const diagonal = dx !== 0 && dy !== 0;
    const cell = this.board[y][x];
    if (diagonal) {
      // 取反：有方块则消除（特殊格连锁入队），空位则生成异形块
      if (cell) {
        this.board[y][x] = null;
        if (cell.fx) queue.push({ x, y, fx: cell.fx });
        touched.push([x, y, 0]);
        return 1;
      }
      this.board[y][x] = { t: 'X', fx: null };
      touched.push([x, y, 1]);
      return 0;
    }
    if (!cell) return 0;
    this.board[y][x] = null;
    if (cell.fx) queue.push({ x, y, fx: cell.fx });
    touched.push([x, y, 0]);
    return 1;
  }
}
