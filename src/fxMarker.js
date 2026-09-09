import * as THREE from 'three';
import { FX_COLORS } from './constants.js';

/**
 * 特殊格激光方向箭头：
 * - 形状：XY 平面上的箭头贴片（默认朝上），'down' 旋转 180° 朝下
 * - MeshBasicMaterial 不受光照影响，保证在已锁定方块表面一眼可辨
 * - 池化复用（锁定后的特殊格数量随对局增长），带呼吸闪烁
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
      up: new THREE.MeshBasicMaterial({
        color: FX_COLORS.up,
        transparent: true,
        opacity: 0.9,
        depthWrite: false, // 半透明贴片不写深度，避免与方块面闪烁
      }),
      down: new THREE.MeshBasicMaterial({
        color: FX_COLORS.down,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    };

    this.pool = [];
    this._n = 0;
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(this.geometry, this.materials.up);
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  /** 每轮同步前调用：重置放置游标 */
  begin() {
    this._n = 0;
  }

  /** 放置一个箭头（在格子世界坐标 x,y 上，z 浮于方块表面） */
  place(x, y, fx) {
    const m = this.pool[this._n++];
    if (!m) return; // 超出池容量（极端情况）直接跳过，不影响逻辑
    m.position.set(x, y, 0.5);
    m.rotation.z = fx === 'down' ? Math.PI : 0;
    m.material = this.materials[fx] || this.materials.up;
    m.visible = true;
  }

  /** 隐藏本轮未用到的箭头 */
  end() {
    for (let i = this._n; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  /** 呼吸闪烁（每帧调用一次即可，只更新两个共享材质） */
  pulse(time) {
    const o = 0.62 + 0.3 * Math.sin(time * 4);
    this.materials.up.opacity = o;
    this.materials.down.opacity = o;
  }
}
