import * as THREE from 'three';
import { FX_COLORS } from './constants.js';

/** 8 方向 -> 箭头旋转角（弧度，up 为 0 朝上，逆时针为正） */
export const FX_ANGLE = {
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

function createOffscreenCanvas(width, height) {
  let cvs = null;
  if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
    cvs = wx.createCanvas();
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    cvs = document.createElement('canvas');
  }
  if (cvs) {
    cvs.width = width;
    cvs.height = height;
  }
  return cvs;
}

function makeDigitTexture(num) {
  const cvs = createOffscreenCanvas(64, 64);
  if (!cvs) return null;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);

  // 金橙色圆环底纹
  ctx.beginPath();
  ctx.arc(32, 32, 27, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.92)';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // 居中倒计时数字
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 32, 33);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * 倒计时销毁方块标记池（展示 1, 2, 3, 4 等步数数字）
 */
export class DecayMarkerPool {
  constructor(scene, max = 32) {
    this.geo = new THREE.PlaneGeometry(0.55, 0.55);
    this.textures = {};
    this.materials = {};
    for (let i = 1; i <= 8; i++) {
      const tex = makeDigitTexture(i);
      this.textures[i] = tex;
      this.materials[i] = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
    }

    this.pool = [];
    this._n = 0;
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(this.geo, this.materials[1]);
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  begin() {
    this._n = 0;
  }

  place(x, y, num) {
    const m = this.pool[this._n++];
    if (!m) return;
    const n = Math.max(1, Math.min(8, num || 1));
    m.material = this.materials[n];
    m.position.set(x, y, 0.52);
    m.visible = true;
  }

  end() {
    for (let i = this._n; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
  }
}
