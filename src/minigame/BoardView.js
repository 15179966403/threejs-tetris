import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, CELL, COLORS, CLEAR_TIME, FX_COLORS } from '../constants.js';
import { FxMarkerPool } from '../fxMarker.js';

/** 格子坐标 -> 世界坐标（棋盘中心为原点，行 0 在顶部） */
function cellToWorld(row, col) {
  return [(col + 0.5 - COLS / 2) * CELL, (ROWS / 2 - row - 0.5) * CELL];
}

/**
 * 小游戏包内禁用 class #private 语法：
 * esbuild 降到 ES2018 时，「静态私有字段经类名访问」会被错误降级为从 this 读取，
 * 在微信开发者工具中抛 "Cannot read from private field"。
 * 因此这里全部使用模块级常量 + 普通成员。
 */
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * 3D 视图（小游戏优化版）：
 * - 已锁定方块用单个 InstancedMesh 渲染（200 格 => 1 次绘制调用），
 *   仅在棋盘变化或消行动画期间才重写实例数据；
 * - 活动方块 / 落点投影与 Web 版一致（各 4 个对象，材质复用）。
 */
export class BoardView {
  constructor(scene) {
    this.scene = scene;

    // 每帧复用的临时对象（避免同步循环里反复 new）
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._white = new THREE.Color(1, 1, 1);
    this._fxc = new THREE.Color(); // 特殊格效果色暂存（与 _c 分开，避免 lerp 覆盖）
    // 脏标记：棋盘内容指纹 + 消行状态
    this._boardKey = '';
    this._wasClearing = false;

    this.cellGeo = new RoundedBoxGeometry(CELL * 0.94, CELL * 0.94, CELL * 0.94, 3, 0.09);
    this.ghostGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.88, 0.88, 0.88));

    // ---- 已锁定的方块池：1 个 InstancedMesh（ROWS x COLS 实例）----
    this.settledMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
    // 注意签名：(geometry, material, count)，传反会把材质当几何体解析
    this.settled = new THREE.InstancedMesh(this.cellGeo, this.settledMat, COLS * ROWS);
    this.settled.castShadow = true;
    this.settled.receiveShadow = true;
    this.settled.frustumCulled = false; // 实例包围球不跟踪，直接关闭剔除
    this.settled.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < COLS * ROWS; i++) {
      this.settled.setMatrixAt(i, ZERO_MATRIX);
      this.settled.setColorAt(i, this._white);
    }
    scene.add(this.settled);

    // ---- 当前活动方块的 4 个立方体（需要单独的自发光）----
    this.active = [];
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.cellGeo, this._makeMaterial());
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      this.active.push(mesh);
    }

    // ---- 落点投影（线框，共享一份材质）----
    this.ghostMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 });
    this.ghost = [];
    for (let i = 0; i < 4; i++) {
      const line = new THREE.LineSegments(this.ghostGeo, this.ghostMat);
      line.visible = false;
      scene.add(line);
      this.ghost.push(line);
    }

    // 特殊格激光方向箭头（锁定后 / 下落中都能一眼看出位置与朝向）
    this.fx = new FxMarkerPool(scene);
    this.activeFx = new THREE.Mesh(this.fx.geometry, this.fx.materials.up);
    this.activeFx.visible = false;
    scene.add(this.activeFx);

    this._buildArena();
  }

  _makeMaterial() {
    return new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
  }

  /** 场景布景：背板、网格线、边框、地面（与 Web 版一致） */
  _buildArena() {
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

  /** 将游戏状态同步到 3D 场景（每帧调用，内部有脏检查） */
  sync(game) {
    const clearing = new Set(game.clearingRows);
    const isClearing = clearing.size > 0;

    // 1. 已锁定方块：仅棋盘变化或消行动画期间重写实例数据
    let key = '';
    for (let r = 0; r < ROWS; r++) {
      key += game.board[r].map((v) => (v ? v.t + (v.fx || '') : '')).join(',') + '|';
    }
    if (key !== this._boardKey || isClearing || this._wasClearing) {
      this._boardKey = key;
      this._wasClearing = isClearing;
      this.fx.begin();
      const phase = Math.min(1, game.clearTimer / CLEAR_TIME);
      let i = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++, i++) {
          const cell = game.board[r][c];
          if (!cell) {
            this.settled.setMatrixAt(i, ZERO_MATRIX);
            continue;
          }
          const [x, y] = cellToWorld(r, c);
          const s = clearing.has(r) ? 1 - 0.6 * phase : 1; // 消行收缩
          this._m.makeScale(s, s, s);
          this._m.setPosition(x, y, 0);
          this.settled.setMatrixAt(i, this._m);
          // 特殊格向效果色偏亮提示（↑青 / ↓橙）；消行时颜色向白色过渡
          this._c.setHex(COLORS[cell.t]);
          if (clearing.has(r)) this._c.lerp(this._white, phase);
          else if (cell.fx) this._c.lerp(this._fxc.setHex(FX_COLORS[cell.fx]), 0.5);
          this.settled.setColorAt(i, this._c);
          if (cell.fx) this.fx.place(x, y, cell.fx);
        }
      }
      this.fx.end();
      this.settled.instanceMatrix.needsUpdate = true;
      if (this.settled.instanceColor) this.settled.instanceColor.needsUpdate = true;
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
          // 活动格保持本色，仅自发光向效果色偏移；箭头标记实时跟随
          cell.material.color.setHex(color);
          cell.material.emissive.setHex(isSpecial ? FX_COLORS[special.fx] : color);
          cell.material.emissiveIntensity = isSpecial ? 0.55 : 0.18;
          const [wx, wy] = cellToWorld(y + r, x + c);
          cell.position.set(wx, wy, 0);

          if (isSpecial) {
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
          } else {
            g.visible = false;
          }
          ai++;
        }
      }
      this.ghostMat.color.setHex(color);
    }
    for (let i = ai; i < 4; i++) {
      this.active[i].visible = false;
      this.ghost[i].visible = false;
    }

    this.fx.pulse(performance.now() / 1000);
  }
}
