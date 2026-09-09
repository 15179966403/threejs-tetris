import * as THREE from 'three';

/**
 * 粒子爆裂系统：单个 InstancedMesh 承载全部粒子（1 次绘制调用）。
 * - 消行时按格子颜色炸出碎块；激光/取反时按效果色迸射
 * - 无存活粒子时不更新、不渲染（零开销）
 */
export class FxParticles {
  constructor(scene, max = 160) {
    this.max = max;
    this.geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.parts = [];
    const dead = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) {
      this.parts.push({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1, color: 0xffffff,
      });
      this.mesh.setMatrixAt(i, dead);
      this.mesh.setColorAt(i, white);
    }

    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._dirty = false;
  }

  /** 在世界坐标 (x,y) 处爆裂 count 个粒子（power 控制初速） */
  burst(x, y, colorHex, count = 3, power = 1) {
    let spawned = 0;
    for (const p of this.parts) {
      if (p.alive) continue;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 0.5;
      p.y = y + (Math.random() - 0.5) * 0.5;
      p.z = 0.3;
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 3) * power;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.abs(Math.sin(a)) * sp * 0.8 + 1.5 * power; // 向上偏置
      p.vz = (Math.random() - 0.5) * 1.2;
      p.life = p.maxLife = 0.45 + Math.random() * 0.4;
      p.size = 0.5 + Math.random() * 0.7;
      p.color = colorHex;
      if (++spawned >= count) break;
    }
    this._dirty = true;
  }

  /** 每帧推进；dt 为秒 */
  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      alive++;
      p.vy -= 9.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      this._e.set(p.life * 6, p.life * 4, 0);
      this._q.setFromEuler(this._e);
      const s = p.size * t;
      this._s.set(s, s, s);
      this._p.set(p.x, p.y, p.z);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.setHex(p.color));
    }
    if (alive > 0 || this._dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.mesh.visible = alive > 0;
      this._dirty = false;
    }
  }
}

/**
 * 激光光束：加法混合的亮色长条，从触发格贯穿到边界后快速淡出。
 * 池化复用（环形覆盖最旧的）。
 */
export class FxBeams {
  constructor(scene, max = 12) {
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.pool = [];
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.position.z = 0.6;
      scene.add(mesh);
      this.pool.push({ mesh, life: 0, maxLife: 0.28 });
    }
    this._n = 0;
  }

  /** 世界坐标两点之间打一条光束 */
  fire(x0, y0, x1, y1, colorHex) {
    const b = this.pool[this._n];
    this._n = (this._n + 1) % this.pool.length;
    b.life = b.maxLife = 0.28;
    const m = b.mesh;
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.6);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    m.scale.set(Math.hypot(x1 - x0, y1 - y0) + 0.9, 0.55, 1);
    m.material.color.setHex(colorHex);
    m.visible = true;
  }

  update(dt) {
    for (const b of this.pool) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        continue;
      }
      const t = b.life / b.maxLife;
      b.mesh.material.opacity = t * 0.85;
      b.mesh.scale.y = 0.55 * (0.4 + 0.6 * t);
    }
  }
}
