import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, CELL, COLORS, CLEAR_TIME, FX_COLORS } from './constants.js';
import { FxMarkerPool, DecayMarkerPool, FX_ANGLE } from './fxMarker.js';
import { FxParticles, FxBeams } from './fxParticles.js';

/** 格子坐标 -> 世界坐标（棋盘中心为原点，行 0 在顶部） */
function cellToWorld(row, col) {
  return [(col + 0.5 - COLS / 2) * CELL, (ROWS / 2 - row - 0.5) * CELL];
}

/**
 * 3D 视图：把 TetrisGame 的状态同步到场景中。
 * 所有格子立方体预先创建并池化，运行时只改可见性 / 颜色 / 位置。
 */
export class BoardView {
  constructor(scene) {
    this.scene = scene;
    this.cellGeo = new RoundedBoxGeometry(CELL * 0.94, CELL * 0.94, CELL * 0.94, 3, 0.09);
    this.ghostGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.88, 0.88, 0.88));

    // ---- 已锁定的方块池（20 x 10）----
    this.settled = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const mesh = new THREE.Mesh(this.cellGeo, this.#makeMaterial());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.visible = false;
        const [x, y] = cellToWorld(r, c);
        mesh.position.set(x, y, 0);
        scene.add(mesh);
        row.push(mesh);
      }
      this.settled.push(row);
    }

    // ---- 当前活动方块的 4 个立方体 ----
    this.active = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.cellGeo, this.#makeMaterial());
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      this.active.push(mesh);
    }

    // ---- 落点投影（线框）----
    this.ghost = [];
    for (let i = 0; i < 4; i++) {
      const line = new THREE.LineSegments(
        this.ghostGeo,
        new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 })
      );
      line.visible = false;
      scene.add(line);
      this.ghost.push(line);
    }

    // 特殊格激光方向箭头（锁定后 / 下落中都能一眼看出位置与朝向）
    this.fx = new FxMarkerPool(scene);
    this.decay = new DecayMarkerPool(scene);
    this.activeFx = new THREE.Mesh(this.fx.geometry, this.fx.materials.laser);
    this.activeFx.visible = false;
    scene.add(this.activeFx);

    // 粒子 / 光束 / 震屏
    this.particles = new FxParticles(scene);
    this.beams = new FxBeams(scene);
    this.shake = 0;

    this.#buildArena();
  }

  #makeMaterial() {
    return new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
  }

  /** 场景布景：背板、网格线、边框、地面 */
  #buildArena() {
    const group = new THREE.Group();
    const W = COLS * CELL;
    const H = ROWS * CELL;

    // 背板（接收阴影的凹槽底）
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(W + 1.4, H + 1.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x11162a, roughness: 0.9, metalness: 0.1 })
    );
    back.position.set(0, 0, -0.75);
    back.receiveShadow = true;
    group.add(back);

    // 网格线
    const pts = [];
    for (let c = 0; c <= COLS; c++) {
      const x = -W / 2 + c * CELL;
      pts.push(x, -H / 2, 0, x, H / 2, 0);
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = H / 2 - r * CELL;
      pts.push(-W / 2, y, 0, W / 2, y, 0);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0x2a3560, transparent: true, opacity: 0.55 })
    );
    grid.position.z = -0.52;
    group.add(grid);

    // 边框（左 / 右 / 底，顶部开放）
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x3b4a86,
      roughness: 0.4,
      metalness: 0.5,
    });
    const mkFrame = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.1), frameMat);
      m.position.set(x, y, -0.05);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    };
    mkFrame(0.7, H + 1.4, -W / 2 - 0.35, 0);
    mkFrame(0.7, H + 1.4, W / 2 + 0.35, 0);
    mkFrame(W + 1.4, 0.7, 0, -H / 2 - 0.35);

    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 60),
      new THREE.MeshStandardMaterial({ color: 0x070a14, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -H / 2 - 0.71;
    ground.receiveShadow = true;
    group.add(ground);

    this.scene.add(group);
  }

  /** 将游戏状态同步到 3D 场景（每帧调用） */
  /** 消费游戏逻辑产出的特效事件（粒子 / 光束 / 震屏） */
  _consumeEvents(game) {
    const events = game.fxEvents;
    if (!events || !events.length) return;
    for (const ev of events) {
      if (ev.type === 'clear') {
        // 消行：每个格子按自身颜色炸出碎块
        for (const r of ev.rows) {
          for (let c = 0; c < COLS; c++) {
            const cell = game.board[r][c];
            if (!cell) continue;
            const [x, y] = cellToWorld(r, c);
            this.particles.burst(x, y, COLORS[cell.t], 3, 1);
          }
        }
        this.shake = Math.min(0.3, this.shake + 0.15);
      } else if (ev.type === 'beam') {
        // 光束：从触发格贯穿到边界
        const stepsX =
          ev.dx > 0 ? COLS - 1 - ev.x : ev.dx < 0 ? ev.x : Infinity;
        const stepsY =
          ev.dy > 0 ? ROWS - 1 - ev.y : ev.dy < 0 ? ev.y : Infinity;
        const k = Math.min(stepsX, stepsY);
        if (isFinite(k) && k >= 0) {
          const [x0, y0] = cellToWorld(ev.y, ev.x);
          const [x1, y1] = cellToWorld(ev.y + ev.dy * k, ev.x + ev.dx * k);
          this.beams.fire(x0, y0, x1, y1, FX_COLORS[ev.fx]);
        }
        const col = FX_COLORS[ev.fx];
        const [tx, ty] = cellToWorld(ev.y, ev.x);
        this.particles.burst(tx, ty, col, 6, 1.4); // 触发点爆一下
        for (const [cx, cy, added] of ev.cells) {
          const [px, py] = cellToWorld(cy, cx);
          this.particles.burst(px, py, col, added ? 2 : 3, 0.8);
        }
        this.shake = Math.min(0.35, this.shake + 0.12);
      } else if (ev.type === 'decay') {
        const [x, y] = cellToWorld(ev.y, ev.x);
        this.particles.burst(x, y, 0xfbbf24, 8, 1.2);
        this.particles.burst(x, y, 0xa78bfa, 5, 0.9);
        this.shake = Math.min(0.25, this.shake + 0.08);
      }
    }
    events.length = 0;
  }

  sync(game, dt) {
    // 1. 已锁定方块
    const clearing = new Set(game.clearingRows);
    this.fx.begin();
    this.decay.begin();
    this._consumeEvents(game);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const mesh = this.settled[r][c];
        const cell = game.board[r][c];
        if (!cell) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.material.color.setHex(COLORS[cell.t]);
        if (clearing.has(r)) {
          // 消行动画：先膨胀再收缩消失，闪白拉满
          const phase = Math.min(1, game.clearTimer / CLEAR_TIME);
          mesh.material.emissive.setHex(0xffffff);
          mesh.material.emissiveIntensity = 1.2 + 1.4 * phase;
          const s =
            phase < 0.3
              ? 1 + 0.3 * (phase / 0.3)
              : Math.max(0, 1.3 * (1 - (phase - 0.3) / 0.7));
          mesh.scale.setScalar(s);
        } else if (cell.decay) {
          // 倒计时方块：琥珀金橙色脉冲高亮
          mesh.material.emissive.setHex(0xf59e0b);
          mesh.material.emissiveIntensity = 0.55;
          mesh.scale.setScalar(1);
          const [fx, fy] = cellToWorld(r, c);
          this.decay.place(fx, fy, cell.decay);
        } else if (cell.fx) {
          // 特殊格：按激光方向常亮发光提示（↑青 / ↓橙）
          mesh.material.emissive.setHex(FX_COLORS[cell.fx]);
          mesh.material.emissiveIntensity = 0.45;
          mesh.scale.setScalar(1);
          const [fx, fy] = cellToWorld(r, c);
          this.fx.place(fx, fy, cell.fx);
        } else {
          mesh.material.emissiveIntensity = 0;
          mesh.scale.setScalar(1);
        }
      }
    }
    this.fx.end();
    this.decay.end();

    // 2. 活动方块 + 落点投影
    let ai = 0;
    this.activeFx.visible = false;
    if (game.current && game.state === 'playing') {
      const { matrix, x, y, type, special } = game.current;
      const color = COLORS[type];
      const gy = game.ghostY();
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const cell = this.active[ai];
          cell.visible = true;
          const isSpecial = special && special.r === r && special.c === c;
          cell.material.color.setHex(color);
          if (isSpecial) {
            // 活动方块上的特殊格：按效果色高亮，提示玩家调整旋转/落点
            cell.material.emissive.setHex(FX_COLORS[special.fx]);
            cell.material.emissiveIntensity = 0.55;
          } else {
            cell.material.emissive.setHex(color);
            cell.material.emissiveIntensity = 0.18;
          }
          const [wx, wy] = cellToWorld(y + r, x + c);
          cell.position.set(wx, wy, 0);

          // 下落中的特殊格：箭头标记实时跟随
          if (special && special.r === r && special.c === c) {
            this.activeFx.position.set(wx, wy, 0.5);
            this.activeFx.rotation.z = FX_ANGLE[special.fx] ?? 0;
            this.activeFx.material = this.fx.matFor(special.fx);
            this.activeFx.visible = true;
          }

          const g = this.ghost[ai];
          if (gy > y) {
            const [gx, gwy] = cellToWorld(gy + r, x + c);
            g.visible = gwy >= -ROWS / 2;
            g.position.set(gx, gwy, 0);
            g.material.color.setHex(color);
          } else {
            g.visible = false;
          }
          ai++;
        }
      }
    }
    for (let i = ai; i < 4; i++) {
      this.active[i].visible = false;
      this.ghost[i].visible = false;
    }

    this.fx.end();
    this.fx.pulse(performance.now() / 1000);
    this.particles.update(dt);
    this.beams.update(dt);
  }
}
