/**
 * 小游戏包无头仿真：stub 掉 wx / WebGL / 2D canvas，
 * 在 Node 里执行真实 bundle（.debug/game.js），跑主循环 + 模拟触屏。
 * 用于在进微信开发者工具之前抓运行时错误，并对关键动作做断言。
 *
 * 用法：先构建未压缩包 npx vite build --config vite.minigame.config.js --minify false --outDir .debug
 *       再 node tools/harness.mjs
 *
 * 屏幕模型：390x844 @2x，安全区 top=47，十字键默认在左侧：
 *   十字键 ↑(80,729) ↓(80,820) ←(33,776) →(127,776)
 *   选择键 左手布局(216,759) / 右手布局(166,759)
 *   开始键 左手布局(216,793) / 右手布局(166,793)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- GL 常量表（够 stub 分支判断即可） ---------- */
const C = {
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ACTIVE_UNIFORMS: 0x8b86,
  ACTIVE_ATTRIBUTES: 0x8b89,
  ACTIVE_UNIFORM_BLOCKS: 0x8a36,
  FRAMEBUFFER_COMPLETE: 0x8cd5,
  MAX_TEXTURE_SIZE: 0x0d33,
  MAX_TEXTURE_IMAGE_UNITS: 0x8872,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
  IMPLEMENTATION_COLOR_READ_TYPE: 0x8b3a,
  IMPLEMENTATION_COLOR_READ_FORMAT: 0x8b3b,
  VERSION: 0x1f00,
  VENDOR: 0x1f01,
  RENDERER: 0x1f02,
  SHADING_LANGUAGE_VERSION: 0x8b8c,
};

const noop = () => {};
let id = 1;
const obj = () => ({ __id: id++ });

/** WebGL 上下文桩 */
function makeGL() {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop in C) return C[prop];
        if (/^[A-Z][A-Z0-9_]*$/.test(prop)) return 1; // 其余常量兜底
        switch (prop) {
          case 'getParameter':
            return (p) =>
              p === C.VERSION || p === C.VENDOR || p === C.RENDERER || p === C.SHADING_LANGUAGE_VERSION
                ? 'WebGL 1 (stub)'
                : p === C.MAX_TEXTURE_SIZE
                  ? 2048
                  : 64;
          case 'getShaderPrecisionFormat':
            return () => ({ rangeMin: 127, rangeMax: 127, precision: 23 });
          case 'isContextLost':
            return () => false;
          case 'getContextAttributes':
            return () => ({ alpha: false, antialias: true, depth: true, stencil: false });
          case 'getExtension':
            return () => new Proxy({}, { get: () => noop });
          case 'createShader':
          case 'createProgram':
          case 'createBuffer':
          case 'createTexture':
          case 'createFramebuffer':
          case 'createRenderbuffer':
          case 'createQuery':
          case 'createSampler':
          case 'createVertexArray':
            return obj;
          case 'getShaderParameter':
            return () => true;
          case 'getProgramParameter':
            return (_, p) =>
              p === C.ACTIVE_UNIFORMS ||
              p === C.ACTIVE_ATTRIBUTES ||
              p === C.ACTIVE_UNIFORM_BLOCKS
                ? 0
                : true;
          case 'getShaderInfoLog':
          case 'getProgramInfoLog':
            return () => '';
          case 'getAttribLocation':
            return () => 0;
          case 'getUniformLocation':
            return obj;
          case 'getError':
            return () => 0;
          case 'checkFramebufferStatus':
            return () => C.FRAMEBUFFER_COMPLETE;
          default:
            return noop;
        }
      },
      set() {
        return true;
      },
    }
  );
}

/** 2D 上下文桩 */
function makeCtx2D() {
  const store = {};
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'createLinearGradient') return () => ({ addColorStop: noop });
        if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (prop in store) return store[prop];
        return noop;
      },
      set(_, prop, v) {
        store[prop] = v;
        return true;
      },
    }
  );
}

function makeCanvas() {
  return {
    width: 300,
    height: 300,
    addEventListener: noop,
    removeEventListener: noop,
    getContext(type) {
      return type === '2d' ? makeCtx2D() : makeGL();
    },
  };
}

/* ---------- wx 桩 ---------- */
const touch = {};
const vibes = [];
const stored = {};
let firstCanvas = true;
globalThis.wx = {
  createCanvas: () => {
    if (firstCanvas) {
      firstCanvas = false;
      return makeCanvas();
    }
    return makeCanvas();
  },
  getWindowInfo: () => ({
    windowWidth: 390,
    windowHeight: 844,
    pixelRatio: 2,
    safeArea: { top: 47 },
  }),
  onTouchStart: (cb) => (touch.start = cb),
  onTouchMove: (cb) => (touch.move = cb),
  onTouchEnd: (cb) => (touch.end = cb),
  onTouchCancel: (cb) => (touch.cancel = cb),
  onWindowResize: noop,
  onHide: noop,
  onShow: noop,
  getStorageSync: (k) => stored[k] || '',
  setStorageSync: (k, v) => (stored[k] = v),
  vibrateShort: (o) => vibes.push(o && o.type),
};

/* ---------- rAF 桩：手动步进 ---------- */
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => {
  rafCb = cb;
  return 1;
};
globalThis.cancelAnimationFrame = noop;

/* ---------- 工具 ---------- */
const busy = (ms) => {
  const t = Date.now() + ms;
  while (Date.now() < t);
};
const assert = (cond, msg) => {
  if (!cond) throw new Error('断言失败：' + msg);
};

/* ---------- 执行 bundle ---------- */
const bundle = readFileSync(resolve(root, '.debug/game.js'), 'utf8');
new Function(bundle)();

const step = (n, label) => {
  for (let i = 0; i < n; i++) {
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error('rAF 链条断了 @ ' + label);
    cb();
  }
  console.log(`  ${label} x${n} ✔`);
};

const tap = (x, y) => {
  touch.start({ touches: [{ identifier: 1, clientX: x, clientY: y }] });
  touch.end({ touches: [], changedTouches: [{ identifier: 1, clientX: x, clientY: y }] });
};
const vibesSince = (n) => vibes.slice(n);

console.log('== 初始化 + 首屏 ==');
step(5, 'ready 状态帧');

console.log('== 浮层上切换左右手（SELECT） ==');
let mark = vibes.length;
tap(216, 759); // 左手布局的选择键 → 换到右手
assert(vibesSince(mark).includes('light'), '选择键应触发换边震动');
tap(166, 759); // 右手布局的选择键 → 换回左手
assert(stored['tetris3d_dpad_side'] === 'left', '布局应持久化为 left');
console.log('  换边 + 持久化 ✔');

console.log('== 点按开始游戏 ==');
tap(195, 500); // 浮层任意处 = 主操作
step(10, 'playing 渲染帧');

console.log('== 十字键：↑旋转 / ←→移动 ==');
tap(80, 729); // ↑ 旋转
tap(33, 776); // ←
tap(127, 776); // →
step(5, '方向键点按');

console.log('== 长按 → 连发（DAS） ==');
touch.start({ touches: [{ identifier: 3, clientX: 127, clientY: 776 }] });
busy(250); // 超过 180ms DAS 延迟
step(6, '长按 6 帧（应连发数次）');
touch.end({ touches: [], changedTouches: [{ identifier: 3, clientX: 127, clientY: 776 }] });

console.log('== 滑动切换臂（← 滑到 ↓） ==');
touch.start({ touches: [{ identifier: 2, clientX: 33, clientY: 776 }] });
touch.move({ touches: [{ identifier: 2, clientX: 80, clientY: 820 }] });
step(2, '滑到 ↓');
touch.end({ touches: [], changedTouches: [{ identifier: 2, clientX: 80, clientY: 820 }] });
busy(320); // 让双击窗口过期：滑动不算「点按」

console.log('== 单击 ↓ 只软降、连按两下 ↓ 硬降 ==');
mark = vibes.length;
tap(80, 820); // 第一次点按 → 仅软降
assert(!vibesSince(mark).includes('light'), '单击↓ 不应触发硬降');
console.log('  单击↓ 仅软降 ✔');
tap(80, 820); // 280ms 内第二次快速点按 → 硬降
assert(vibesSince(mark).includes('light'), '连按两下↓ 应触发硬降');
console.log('  连按两下↓ 硬降 ✔');
step(30, '硬降后帧（覆盖锁定/消行渲染）');

console.log('== 开始键暂停 / 浮层换边 / 恢复 ==');
tap(216, 793); // 开始 → 暂停
step(3, 'paused 浮层');
tap(216, 759); // 浮层上的选择键 → 换到右手（布局镜像）
tap(195, 500); // 任意处恢复
step(3, '恢复 playing（右手布局）');
tap(166, 793); // 右手布局的开始键 → 暂停
step(2, '再次暂停');
tap(195, 500); // 恢复
tap(166, 759); // 右手布局的选择键 → 换回左手
step(3, '换回左手');
assert(stored['tetris3d_dpad_side'] === 'left', '最终布局应为 left');

console.log('\n全部通过 ✔ bundle 在仿真环境中无异常，动作断言全过');
