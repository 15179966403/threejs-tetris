import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, CELL, COLORS, CLEAR_TIME, FX_COLORS } from './constants.js';
import { FxMarkerPool } from './fxMarker.js';

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
    this.activeFx = new THREE.Mesh(this.fx.geometry, this.fx.materials.up);
    this.activeFx.visible = false;
    scene.add(this.activeFx);

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
  sync(game) {
    // 1. 已锁定方块
    const clearing = new Set(game.clearingRows);
    this.fx.begin();
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
          // 消行动画：闪白 + 收缩
          const phase = Math.min(1, game.clearTimer / CLEAR_TIME);
          mesh.material.emissive.setHex(0xffffff);
          mesh.material.emissiveIntensity = 1.6 * phase;
          mesh.scale.setScalar(1 - 0.6 * phase);
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
            this.activeFx.rotation.z = special.fx === 'down' ? Math.PI : 0;
            this.activeFx.material = this.fx.materials[special.fx];
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
  }
}
