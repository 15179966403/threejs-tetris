import './shim.js'; // 必须最先导入：先垫平 BOM 再执行 three
import * as THREE from 'three';
import { TetrisGame } from '../TetrisGame.js';
import { BoardView } from './BoardView.js';
import { GameUI } from './ui.js';
import { Input } from './input.js';
import { COLS, ROWS } from '../constants.js';

/* global wx */

/* ================= 窗口信息 ================= */

const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
let W = win.windowWidth;
let H = win.windowHeight;
const TOP = (win.safeArea && win.safeArea.top) || 0;

/* ================= 渲染器 ================= */

const canvas = wx.createCanvas(); // 首次调用 => 屏幕主画布
// iOS/Android 真机的 canvas 是原生桥接对象，没有 addEventListener/removeEventListener，
// 而 three 构造 WebGLRenderer 时会无条件注册 webglcontextlost 等事件（开发者工具的
// canvas 是 JS 实现有这些方法，真机上 undefined）。补空实现避免启动即崩。
try {
  if (typeof canvas.addEventListener !== 'function') {
    canvas.addEventListener = () => {};
    canvas.removeEventListener = () => {};
  }
} catch (e) { /* 极老机型原生对象不可扩展时仅降级，无事件也不影响渲染 */ }
// 强制 WebGL1：微信开发者工具(Windows) 的 WebGL2 模拟存在 GLSL 翻译缺陷，
// MeshStandardMaterial 片元着色器会编译失败；WebGL1 是小游戏最稳路径，
// 实例化渲染经 ANGLE_instanced_arrays 扩展（覆盖率接近 100%）。
const renderer = new THREE.WebGL1Renderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // 比 PCFSoft 便宜，移动端视觉差异很小
renderer.autoClear = false; // 手动控制清屏：主场景靠 background 清，UI 层叠加不擦除 3D 画面

// ---- 动态分辨率：dpr 封顶 2，帧率不足时自动降低渲染倍率 ----
const BASE_DPR = Math.min(win.pixelRatio || 2, 2);
let resScale = 1; // 1.0 ~ 0.6
function applySize() {
  renderer.setPixelRatio(BASE_DPR * resScale);
  renderer.setSize(W, H, false);
}
applySize();

/* ================= 场景 / 灯光 ================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 42, 90);

const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);

scene.add(new THREE.AmbientLight(0x8899ff, 0.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
keyLight.position.set(10, 20, 14);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024); // 2048 -> 1024：移动端阴影是最大开销之一
keyLight.shadow.camera.left = -16;
keyLight.shadow.camera.right = 16;
keyLight.shadow.camera.top = 16;
keyLight.shadow.camera.bottom = -16;
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.updateProjectionMatrix();
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.55);
fillLight.position.set(-12, 6, 10);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xff5588, 60, 80, 1.8);
rimLight.position.set(0, -4, -16);
scene.add(rimLight);

/* ================= 游戏与视图 ================= */

const view = new BoardView(scene);
const game = new TetrisGame();

/* ================= UI 叠加层（正交相机 + CanvasTexture 全屏面片） ================= */

// 左右手布局持久化：十字键在哪一侧
let dpadSide = 'left';
try {
  if (wx.getStorageSync('tetris3d_dpad_side') === 'right') dpadSide = 'right';
} catch (e) { /* 忽略 */ }

const ui = new GameUI(BASE_DPR, dpadSide);
ui.resize(W, H, TOP);

const uiScene = new THREE.Scene();
const uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const uiQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({
    map: ui.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
);
uiQuad.frustumCulled = false;
uiScene.add(uiQuad);

/* ================= 相机取景（自适应窗口） ================= */

function fitCamera() {
  camera.aspect = W / H;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const halfH = (ROWS + 6) / 2;
  const halfW = (COLS + 6) / 2;
  const dist = Math.max(halfH / Math.tan(fov / 2), halfW / (Math.tan(fov / 2) * camera.aspect));
  camera.position.set(0, halfH * 0.28, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
fitCamera();

wx.onWindowResize &&
  wx.onWindowResize((res) => {
    W = res.windowWidth;
    H = res.windowHeight;
    applySize();
    ui.resize(W, H, TOP);
    fitCamera();
  });

/* ================= 最高分持久化 ================= */

let best = 0;
try {
  best = wx.getStorageSync('tetris3d_best') | 0;
} catch (e) { /* 忽略存储异常 */ }

/* ================= 动作封装（带状态闸门） ================= */

const inPlay = () => game.state === 'playing';
const actions = {
  getState: () => game.state,
  move: (d) => inPlay() && game.move(d, 0),
  rotate: (d) => inPlay() && game.rotate(d),
  softDrop: () => inPlay() && game.softDrop(),
  hardDrop: () => {
    if (inPlay()) {
      game.hardDrop();
      vibrate('light');
    }
  },
  pause: () => {
    if (game.state === 'playing' || game.state === 'paused') game.togglePause();
  },
  swap: () => {
    const side = ui.side === 'left' ? 'right' : 'left';
    ui.setSide(side);
    try {
      wx.setStorageSync('tetris3d_dpad_side', side);
    } catch (e) { /* 忽略 */ }
    vibrate('light');
  },
  primary: () => {
    if (game.state === 'ready') game.start();
    else if (game.state === 'paused') game.togglePause();
    else if (game.state === 'gameover') {
      game.reset();
      game.start();
    }
    ui.dirty = true;
  },
};
const input = new Input(ui, actions);

function vibrate(type) {
  try {
    wx.vibrateShort({ type });
  } catch (e) { /* 老基础库无 type 参数等情况 */ }
}

/* ================= 生命周期：切后台自动暂停 ================= */

wx.onHide(() => {
  if (game.state === 'playing') game.togglePause();
});
wx.onShow(() => {
  ui.dirty = true;
});

/* ================= 动态分辨率控制器 ================= */

const adapter = {
  acc: 0,
  n: 0,
  cooldownUntil: 0,
  onFrame(rawDt) {
    this.acc += rawDt;
    if (++this.n < 90) return; // 约 1.5s 评估一次
    const avg = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    const now = Date.now();
    if (now < this.cooldownUntil) return;
    if (avg > 1 / 45 && resScale > 0.6) {
      resScale = Math.max(0.6, resScale - 0.15);
      applySize();
      this.cooldownUntil = now + 2500;
    } else if (avg < 1 / 58 && resScale < 1) {
      resScale = Math.min(1, resScale + 0.1);
      applySize();
      this.cooldownUntil = now + 2500;
    }
  },
};

/* ================= 主循环 ================= */

const clock = new THREE.Clock();
let prevState = '';

function tick() {
  requestAnimationFrame(tick);
  const rawDt = clock.getDelta();
  adapter.onFrame(rawDt);
  const dt = Math.min(rawDt, 0.05); // 防止切后台后 dt 过大
  input.update(dt);
  game.update(dt);
  view.sync(game);

  if (game.state !== prevState) {
    if (game.state === 'clearing') vibrate('medium');
    if (game.state === 'gameover' && game.score > best) {
      best = game.score;
      try {
        wx.setStorageSync('tetris3d_best', best);
      } catch (e) { /* 忽略 */ }
    }
    prevState = game.state;
  }

  // UI 有变化才重绘并上传纹理
  if (ui.update(game, best)) ui.texture.needsUpdate = true;

  renderer.render(scene, camera); // scene.background 会自动清屏
  renderer.clearDepth();
  renderer.render(uiScene, uiCam);
}
tick();
