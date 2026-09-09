import * as THREE from 'three';
import { FX_COLORS } from './constants.js';

/** 8 方向 -> 箭头旋转角（弧度，up 为 0 朝上，逆时针为正） */
const FX_ANGLE = {
  up: 0,
  ne: -Math.PI / 4,
  right: -Math.PI / 2,
  se: (-3 * Math.PI) / 4,
  down: Math.PI,
  sw: (3 * Math.PI) / 4,
  left: Math.PI / 2,
  nw: Math.PI / 4,
};

/** 斜向 = 取反效果，用紫色系 */
const DIAGONAL = new Set(['ne', 'nw', 'se', 'sw']);

/**
 * 特殊格方向箭头：
 * - 形状：XY 平面上的箭头贴片，8 方向旋转
 * - MeshBasicMaterial 不受光照影响，保证在已锁定方块表面一眼可辨
 * - 双色语义：青色 = 直线激光清除，紫色 = 斜向取反
 * - 池化复用，带呼吸闪烁
 */
export class FxMarkerPool {
  constructor(scene, max = 48) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.3);
    shape.lineTo(0.24, 0.05);
    shape.lineTo(0.1, 0.05);
    shape.lineTo(0.1, -0.3);
    shape.lineTo(-0.1, -0.3);
    shape.lineTo(-0.1, 0.05);
    shape.lineTo(-0.24, 0.05);
    shape.closePath();
    this.geometry = new THREE.ShapeGeometry(shape);

    this.materials = {
      laser: new THREE.MeshBasicMaterial({
        color: FX_COLORS.up,
        transparent: true,
        opacity: 0.9,
        depthWrite: false, // 半透明贴片不写深度，避免与方块面闪烁
      }),
      magic: new THREE.MeshBasicMaterial({
        color: FX_COLORS.ne,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    };

    this.pool = [];
    this._n = 0;
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(this.geometry, this.materials.laser);
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  /** 每轮同步前调用：重置放置游标 */
  begin() {
    this._n = 0;
  }

  /** 选取材质：斜向用紫色（取反），正交用青色（激光） */
  matFor(fx) {
    return DIAGONAL.has(fx) ? this.materials.magic : this.materials.laser;
  }

  /** 放置一个箭头（在格子世界坐标 x,y 上，z 浮于方块表面） */
  place(x, y, fx) {
    const m = this.pool[this._n++];
    if (!m) return; // 超出池容量（极端情况）直接跳过，不影响逻辑
    m.position.set(x, y, 0.5);
    m.rotation.z = FX_ANGLE[fx] ?? 0;
    m.material = this.matFor(fx);
    m.visible = true;
  }

  /** 隐藏本轮未用到的箭头 */
  end() {
    for (let i = this._n; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  /** 呼吸闪烁（每帧调用一次即可，只更新两个共享材质） */
  pulse(time) {
    const o = 0.62 + 0.3 * Math.sin(time * 4);
    this.materials.laser.opacity = o;
    this.materials.magic.opacity = o;
  }
}
