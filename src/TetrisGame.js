import {
  COLS,
  ROWS,
  SHAPES,
  TYPES,
  LINE_SCORES,
  CLEAR_TIME,
  SETTLE_TIME,
  FX_TYPES,
  LASER_CELL_SCORE,
  MAX_COMBO,
  MAX_ITEMS,
  BASE_ITEM_ENERGY,
  ITEM_ENERGY_STEP,
} from './constants.js';
import { getMode } from './game/modes/index.js';

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
    this.mode = options.mode || 'skill'; // 'skill' | 'classic'
    this.rules = getMode(this.mode); // 模式策略对象：下落间隔 / 特殊格概率 / 道具开关
    this._specialChanceOverride = options.specialChance !== undefined ? options.specialChance : null;
    this.reset(options);
  }

  /** 当前特殊格生成概率：随等级递增，或优先使用显式覆盖设置；经典模式恒为 0 */
  get specialChance() {
    return this.rules.specialChance(this.level, this._specialChanceOverride);
  }

  set specialChance(val) {
    this._specialChanceOverride = val;
  }

  reset(options = {}) {
    if (options && options.mode) {
      this.mode = options.mode;
      this.rules = getMode(this.mode);
    }
    if (options && options.specialChance !== undefined) {
      this._specialChanceOverride = options.specialChance;
    }
    /** board[row][col]：null 为空，否则为 { t: 方块类型字母, fx: null | 'up' | 'down' } */
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = 'ready'; // ready | playing | clearing | paused | gameover
    this.bag = [];
    this.nextSpecial = null; // next 方块上的特殊格 { r, c, fx }（矩阵坐标）
    this.nextType = this.#draw();
    this.current = null; // { type, matrix, x, y, special }
    this.combo = 0; // 连锁波次（消行后由特殊格引发的额外消行轮数）
    this.dropTimer = 0;
    this.clearTimer = 0;
    this.clearPhase = 0; // 0: 消行闪烁动画 (CLEAR_TIME); 1: 消除后棋盘观察期 (SETTLE_TIME)
    this.clearingRows = [];
    this.decayQueue = []; // 待倒计时销毁的方块队列 [{ x, y, countdown }]
    this.fxEvents = []; // 视图特效事件队列（视图每帧消费后清空）

    // 道具系统：道具池（最多 5 个）与能量
    this.items = []; // [{ id, type: 'gravity', name: '重力', dir: 'down' }]
    this.itemEnergy = 0; // 当前累积的能量
  }

  /** 当前等级获得下一个道具所需的能量需求 */
  get requiredEnergy() {
    return BASE_ITEM_ENERGY + (this.level - 1) * ITEM_ENERGY_STEP;
  }

  /**
   * 每级下落间隔（秒）。数值策略由模式对象提供：
   * 经典模式随等级指数加快；特技模式恒定 0.9s。
   */
  get dropInterval() {
    return this.rules.dropInterval(this.level);
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
      if (this.clearPhase === 0) {
        // 第 0 阶段：消行行闪烁与缩放动画
        if (this.clearTimer >= CLEAR_TIME) {
          const rem = this.clearTimer - CLEAR_TIME;
          this.#finishClear();
          // 如果未触发新连击消行，#finishClear 会将 clearPhase 切换为 1（观察停顿期）
          if (this.clearPhase === 1) {
            this.clearTimer += rem;
            if (this.clearTimer >= SETTLE_TIME) {
              this.#finishSettle();
            }
          }
        }
      } else if (this.clearPhase === 1) {
        // 第 1 阶段：消除后停顿观察期，暂停图形下落
        if (this.clearTimer >= SETTLE_TIME) {
          this.#finishSettle();
        }
      }
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

    // 推进倒计时销毁：在玩家放置图形时，依次消除刚刚生成的满足条件的方块
    this.#stepDecay();

    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every((v) => v)) full.push(r);
    }

    if (full.length) {
      // 进入消行状态，视图层会播放闪光动画；combo 归零表示连锁波次的起点
      this.combo = 0;
      this.clearingRows = full;
      this.clearPhase = 0;
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

  /** 放置图形时推进倒计时销毁：依次消除刚刚生成的满足条件的方块 */
  #stepDecay() {
    if (!this.decayQueue || !this.decayQueue.length) return;

    // 弹出并销毁队首的 1 个有效方块
    while (this.decayQueue.length) {
      const target = this.decayQueue.shift();
      const cell = this.board[target.y] && this.board[target.y][target.x];
      if (cell && cell.decay) {
        this.board[target.y][target.x] = null;
        this.fxEvents.push({ type: 'decay', x: target.x, y: target.y });
        break; // 本次放置只消除 1 个
      }
    }

    // 重新校准队列中剩余方块的倒计时步数（从 1 开始依序递增）
    for (let i = 0; i < this.decayQueue.length; i++) {
      const item = this.decayQueue[i];
      const cell = this.board[item.y] && this.board[item.y][item.x];
      if (cell && cell.decay) {
        cell.decay = i + 1;
        item.countdown = i + 1;
      }
    }
  }

  /** 消行后校准待销毁队列中方块的坐标 */
  #updateDecayQueueAfterClear(clearingRows) {
    if (!this.decayQueue || !this.decayQueue.length) return;
    const nextQueue = [];
    for (const item of this.decayQueue) {
      if (clearingRows.includes(item.y)) {
        continue; // 该行被消除了
      }
      const below = clearingRows.filter((r) => r > item.y).length;
      item.y += below;
      const cell = this.board[item.y] && this.board[item.y][item.x];
      if (cell && cell.decay) {
        nextQueue.push(item);
      }
    }
    this.decayQueue = nextQueue;
  }

  /**
   * 消行动画结束：触发特殊格效果 → 检测连锁整行 → 下一波或收尾。
   * 斜向取反可能补全整行，因此消行会级联成 combo 连锁。
   */
  #finishClear() {
    // 1. 收集被消除行中的特殊格（行尚未移除，直接使用原坐标）：
    //    横向箭头推迟到「行落定后」结算，其余方向立即生效
    const immediate = [];
    const deferred = [];
    for (const r of this.clearingRows) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r][c];
        if (cell && cell.fx) {
          if (cell.fx === 'left' || cell.fx === 'right') {
            // 推迟起点 = 消行下移后该特殊格列所在的落定行
            const below = this.clearingRows.filter((rr) => rr > r).length;
            deferred.push({ x: c, y: r + below, fx: cell.fx });
          } else {
            immediate.push({ x: c, y: r, fx: cell.fx });
          }
        }
      }
    }

    // 2. 移除行之前：垂直激光与斜向取反立即生效；
    //    横向箭头推迟到「行落定后」结算（收集阶段已换算落定行号）
    // 触发特殊格积攒道具能量（立即 + 推迟的横向一并计入）
    this.#addEnergy(immediate.length + deferred.length);
    let cellsCleared = this.#runBeams(immediate, false, deferred);

    // 3. 移除已消除的行 + 上方下移，随后按新布局校准倒计时销毁队列
    this.board = this.board.filter((_, r) => !this.clearingRows.includes(r));
    while (this.board.length < ROWS) this.board.unshift(Array(COLS).fill(null));
    this.#updateDecayQueueAfterClear(this.clearingRows); // 必须在下移后校准（依赖新棋盘验证）
    this.clearingRows = [];

    // 4. 棋盘落定后：发射推迟的横向激光——沿落定行横扫一侧，
    //    对下移后的残余堆叠产生真实的开沟效果（可继续连锁垂直/斜向效果）
    cellsCleared += this.#runBeams(deferred, true, deferred);

    if (cellsCleared) this.score += cellsCleared * LASER_CELL_SCORE * this.level;

    const full = [];
    for (let r = 0; r < ROWS; r++) if (this.board[r].every((v) => v)) full.push(r);
    if (full.length && this.combo < MAX_COMBO) {
      this.combo += 1;
      this.clearingRows = full;
      this.clearPhase = 0;
      this.clearTimer = 0;
      this.state = 'clearing'; // 留在 clearing：下一波动画结束后再次进入本方法
      this.fxEvents.push({ type: 'clear', rows: full.slice() });
      this.score += LINE_SCORES[full.length] * this.level * (this.combo + 1);
      this.lines += full.length;
      this.level = Math.floor(this.lines / 10) + 1;
      return;
    }

    // 5. 消行与连锁结束，进入消除后棋盘布局观察期（暂停图形下落，给玩家时间观察消除后的棋盘）
    this.combo = 0;
    this.clearPhase = 1;
    this.clearTimer = 0;
    this.state = 'clearing';
  }

  /**
   * 依次施加一队方向效果。
   * @param postShift false = 棋盘落定前（横向箭头推迟结算）；true = 已落定（横向立即结算）
   * @returns 清除的格子数（用于计分）
   */
  #runBeams(queue, postShift, deferred) {
    let cellsCleared = 0;
    const ctx = { queue, deferred, postShift, clearingRows: this.clearingRows, fx: null, touched: null };
    while (queue.length) {
      const { x, y, fx } = queue.shift();
      const [dx, dy] = FX_DIRS[fx];
      const touched = [];
      ctx.touched = touched; // 每条光束独立的触达记录，挂到 ctx 供 #applyFx 写入
      ctx.fx = fx; // 当前光束的方向（供 #applyFx 判断 ne/nw 顶部保护）

      // 棋盘落定前：横向箭头推迟结算——它所在行即将整行移除，
      // 立即沿行清空毫无作用；推迟到行落定后横扫一侧，才对残余堆叠有真实效果
      if (!postShift && (fx === 'left' || fx === 'right')) {
        const below = this.clearingRows.filter((rr) => rr > y).length;
        deferred.push({ x, y: y + below, fx });
        continue;
      }

      let xx = x + dx;
      let yy = y + dy;
      while (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS) {
        cellsCleared += this.#applyFx(xx, yy, dx, dy, ctx);
        xx += dx;
        yy += dy;
      }
      this.fxEvents.push({ type: 'beam', x, y, dx, dy, fx, cells: touched });

      // 东北 (ne) / 西北 (nw) 斜向箭头生成超量方块的缓解机制：
      // 如果生成的方块数量大于 4，并且生成的方块所在行只有一个方块的时候，
      // 添加倒计时销毁效果。在玩家放置图形时，依次消除刚刚生成的满足条件的方块，
      // 直到箭头生成的方块数量不大于 4。
      if (fx === 'ne' || fx === 'nw') {
        const generated = touched.filter(([, , added]) => added === 1);
        if (generated.length > 4) {
          const excess = generated.length - 4;
          // 筛选：生成的方块所在行只有一个方块
          const loneBlocks = generated
            .map(([cx, cy]) => ({ x: cx, y: cy }))
            .filter((pos) => this.board[pos.y].filter(Boolean).length === 1)
            // 优先消除靠上方的危险孤立方块（y 升序）
            .sort((a, b) => a.y - b.y);

          const toDecay = loneBlocks.slice(0, excess);
          for (let i = 0; i < toDecay.length; i++) {
            const block = toDecay[i];
            const currentCell = this.board[block.y][block.x];
            if (currentCell) {
              const countdown = this.decayQueue.length + 1;
              currentCell.decay = countdown;
              this.decayQueue.push({ x: block.x, y: block.y, countdown });
            }
          }
        }
      }
    }
    return cellsCleared;
  }

  #finishSettle() {
    this.clearPhase = 0;
    this.combo = 0;
    this.state = 'playing';
    this.#spawn();
  }

  /** 对单个格子施加方向效果：正交=清除，斜向=取反；返回清除的格子数 */
  #applyFx(x, y, dx, dy, ctx) {
    console.log('[fx] (' + x + ',' + y + ') dir=' + ctx.fx + ' post=' + ctx.postShift + ' cell=' + (this.board[y][x] ? this.board[y][x].t : '.') + ' -> ' + (this.board[y][x] ? 'remove' : 'addX'));
    console.log('    board:');
    for (let r = 19; r >= 0; r--) {
      const row = this.board[r].map(v => v ? (v.t + (v.fx ? '*' : '')) : '.').join('');
      if (row !== '..........') console.log('      r' + String(r).padStart(2), row);
    }
    console.log('[fx] cell', x, y, 'dir', ctx.fx, ctx.dx + ',' + ctx.dy, 'postShift', ctx.postShift, 'cell:', this.board[y][x] ? this.board[y][x].t + (this.board[y][x].fx || '') : 'empty');
    const diagonal = dx !== 0 && dy !== 0;
    const cell = this.board[y][x];
    if (diagonal) {
      // 取反：有方块则消除（特殊格连锁入队），空位则生成异形块
      if (cell) {
        this.board[y][x] = null;
        if (cell.fx) {
          this.#enqueueFx(cell.fx, x, y, ctx);
          this.#addEnergy(1);
        }
        ctx.touched.push([x, y, 0]);
        return 1;
      }
      // 东北 / 西北斜向箭头：如果生成的方块在顶部四行范围内（y < 4），则取消生成
      // 防止堵住新生方块下落位置导致游戏直接结束
      const isDiagonalArrow = ctx.fx === 'ne' || ctx.fx === 'nw';
      if (isDiagonalArrow && y < 4) {
        return 0;
      }
      this.board[y][x] = { t: 'X', fx: null };
      ctx.touched.push([x, y, 1]);
      return 0;
    }
    if (!cell) return 0;
    this.board[y][x] = null;
    if (cell.fx) {
      this.#enqueueFx(cell.fx, x, y, ctx);
      this.#addEnergy(1);
    }
    ctx.touched.push([x, y, 0]);
    return 1;
  }

  /** 连锁入队：横向箭头在棋盘落定前被清除时推迟到落定后结算，其余立即入队 */
  #enqueueFx(fx, x, y, ctx) {
    if (!ctx.postShift && (fx === 'left' || fx === 'right')) {
      const below = ctx.clearingRows.filter((rr) => rr > y).length;
      ctx.deferred.push({ x, y: y + below, fx });
    } else {
      ctx.queue.push({ x, y, fx });
    }
  }

  /** 触发特殊箭头方块时积攒道具能量（经典模式关闭） */
  #addEnergy(amount = 1) {
    if (!this.rules.itemsEnabled) return;
    this.itemEnergy += amount;
    while (this.itemEnergy >= this.requiredEnergy && this.items.length < MAX_ITEMS) {
      this.itemEnergy -= this.requiredEnergy;
      const item = {
        id: Date.now() + Math.random(),
        type: 'gravity',
        name: '重力',
        dir: 'down',
      };
      this.items.push(item);
      this.fxEvents.push({ type: 'item_gain', item: 'gravity' });
    }
    // 道具池已满时，能量在当前需求上限处封顶，不溢出浪费
    if (this.items.length >= MAX_ITEMS) {
      this.itemEnergy = Math.min(this.itemEnergy, this.requiredEnergy);
    }
  }

  /**
   * 使用重力道具（经典模式不可用）
   * @param {'rows' | 'cols'} mode 指定连续 2 行还是连续 3 列
   * @param {number} startIdx 起始行号 (0 <= startIdx <= ROWS - 2) 或起始列号 (0 <= startIdx <= COLS - 3)
   * @param {'down' | 'up' | 'left' | 'right'} [dir='down'] 位移方向，默认向下
   * @returns {boolean} 是否成功使用
   */
  useGravity(mode, startIdx, dir = 'down') {
    if (!this.rules.itemsEnabled || this.state !== 'playing') return false;
    const itemIdx = this.items.findIndex((it) => it.type === 'gravity');
    if (itemIdx === -1) return false;

    // 规范化起始坐标（列模式影响连续 3 列，行模式影响连续 2 行）
    const safeStartIdx =
      mode === 'cols'
        ? Math.max(0, Math.min(COLS - 3, startIdx))
        : Math.max(0, Math.min(ROWS - 2, startIdx));

    // 消耗该道具
    this.items.splice(itemIdx, 1);

    // 先将下落中的方块落定并入棋盘（等同瞬间锁定）：
    // 重力位移只作用于棋盘方块。若不先落定：位移可能把棋盘方块移进
    // 活动方块的位置造成重叠；且位移补全整行进入消行结算后，活动方块
    // 会被新方块直接顶掉（表现为下落中的方块凭空消失）
    if (this.current) {
      const { matrix, x, y, type, special } = this.current;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const bx = x + c;
          const by = y + r;
          if (by < 0) continue; // 高出可见区的部分丢弃（道具场景不判负）
          const isSpecial = special && special.r === r && special.c === c;
          this.board[by][bx] = { t: type, fx: isSpecial ? special.fx : null };
        }
      }
      this.current = null;
    }

    // 执行重力位移
    this.#applyGravityShift(mode, safeStartIdx, dir);

    // 同步校准 decayQueue
    this.#syncDecayQueue();

    // 产生特效事件
    this.fxEvents.push({
      type: 'gravity_pulse',
      mode,
      startIdx: safeStartIdx,
      dir,
    });

    // 消耗道具后，若原本能量封顶满溢，则立刻兑换下一个道具
    if (this.itemEnergy >= this.requiredEnergy && this.items.length < MAX_ITEMS) {
      this.itemEnergy -= this.requiredEnergy;
      const newItem = {
        id: Date.now() + Math.random(),
        type: 'gravity',
        name: '重力',
        dir: 'down',
      };
      this.items.push(newItem);
      this.fxEvents.push({ type: 'item_gain', item: 'gravity' });
    }

    // 检查重力位移后是否补全了整行（连锁消行）
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every((v) => v)) full.push(r);
    }

    if (full.length) {
      this.combo = 0;
      this.clearingRows = full;
      this.clearPhase = 0;
      this.clearTimer = 0;
      this.state = 'clearing';
      this.fxEvents.push({ type: 'clear', rows: full.slice() });
      this.score += LINE_SCORES[full.length] * this.level;
      this.lines += full.length;
      this.level = Math.floor(this.lines / 10) + 1;
      // 进入消行连锁：观察期结束后由 #finishSettle 生成新方块
      return true;
    }

    // 无连锁：活动方块已在上方落定，立即生成新方块避免操作空窗
    if (!this.current) this.#spawn();

    return true;
  }

  /** 执行重力物理位移：连续 2 行或连续 3 列朝指定方向下落/滑动直到受阻 */
  #applyGravityShift(mode, startIdx, dir = 'down') {
    if (mode === 'cols') {
      const c1 = Math.max(0, Math.min(COLS - 3, startIdx));
      const colsToShift = [c1, c1 + 1, c1 + 2];
      for (const c of colsToShift) {
        if (dir === 'down') {
          // 自下而上压实下坠
          for (let r = ROWS - 2; r >= 0; r--) {
            if (this.board[r][c]) {
              let targetY = r;
              while (targetY + 1 < ROWS && !this.board[targetY + 1][c]) {
                targetY++;
              }
              if (targetY !== r) {
                this.board[targetY][c] = this.board[r][c];
                this.board[r][c] = null;
              }
            }
          }
        } else if (dir === 'up') {
          for (let r = 1; r < ROWS; r++) {
            if (this.board[r][c]) {
              let targetY = r;
              while (targetY - 1 >= 0 && !this.board[targetY - 1][c]) {
                targetY--;
              }
              if (targetY !== r) {
                this.board[targetY][c] = this.board[r][c];
                this.board[r][c] = null;
              }
            }
          }
        }
      }
    } else if (mode === 'rows') {
      const r1 = Math.max(0, Math.min(ROWS - 2, startIdx));
      const r2 = r1 + 1;
      if (dir === 'down') {
        // 先处理下行，再处理上行，向下坠落
        for (const r of [r2, r1]) {
          for (let c = 0; c < COLS; c++) {
            if (this.board[r][c]) {
              let targetY = r;
              while (targetY + 1 < ROWS && !this.board[targetY + 1][c]) {
                targetY++;
              }
              if (targetY !== r) {
                this.board[targetY][c] = this.board[r][c];
                this.board[r][c] = null;
              }
            }
          }
        }
      } else if (dir === 'left') {
        for (const r of [r1, r2]) {
          for (let c = 1; c < COLS; c++) {
            if (this.board[r][c]) {
              let targetX = c;
              while (targetX - 1 >= 0 && !this.board[r][targetX - 1]) {
                targetX--;
              }
              if (targetX !== c) {
                this.board[r][targetX] = this.board[r][c];
                this.board[r][c] = null;
              }
            }
          }
        }
      } else if (dir === 'right') {
        for (const r of [r1, r2]) {
          for (let c = COLS - 2; c >= 0; c--) {
            if (this.board[r][c]) {
              let targetX = c;
              while (targetX + 1 < COLS && !this.board[r][targetX + 1]) {
                targetX++;
              }
              if (targetX !== c) {
                this.board[r][targetX] = this.board[r][c];
                this.board[r][c] = null;
              }
            }
          }
        }
      }
    }
  }

  /** 重力位移后同步校准 decayQueue 中方块的实际坐标 */
  #syncDecayQueue() {
    if (!this.decayQueue || !this.decayQueue.length) return;
    for (const item of this.decayQueue) {
      const cell = this.board[item.y] && this.board[item.y][item.x];
      if (cell && cell.decay === item.countdown) continue;
      let found = false;
      for (let r = 0; r < ROWS && !found; r++) {
        for (let c = 0; c < COLS && !found; c++) {
          if (this.board[r][c] && this.board[r][c].decay === item.countdown) {
            item.x = c;
            item.y = r;
            found = true;
          }
        }
      }
    }
  }
}

