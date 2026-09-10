import * as THREE from 'three';
import { TetrisGame } from './TetrisGame.js';
import { BoardView } from './BoardView.js';
import { COLS, ROWS, SHAPES, COLORS, FX_COLORS } from './constants.js';

/* ================= 渲染器与场景 ================= */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 42, 90);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);

/* ================= 灯光 ================= */

scene.add(new THREE.AmbientLight(0x8899ff, 0.6));

// 主光：投影
const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
keyLight.position.set(10, 20, 14);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -16;
keyLight.shadow.camera.right = 16;
keyLight.shadow.camera.top = 16;
keyLight.shadow.camera.bottom = -16;
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.updateProjectionMatrix();
scene.add(keyLight);

// 补光：冷色
const fillLight = new THREE.DirectionalLight(0x4488ff, 0.55);
fillLight.position.set(-12, 6, 10);
scene.add(fillLight);

// 背后勾边氛围光
const rimLight = new THREE.PointLight(0xff5588, 60, 80, 1.8);
rimLight.position.set(0, -4, -16);
scene.add(rimLight);

/* ================= 游戏与视图 ================= */

const view = new BoardView(scene);
const game = new TetrisGame();

/* ================= 相机取景（自适应窗口） ================= */

const CAM_BASE = { x: 0, y: 0 };
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const halfH = (ROWS + 6) / 2;
  const halfW = (COLS + 6) / 2;
  // 保证棋盘（含余量）完整入画
  const dist = Math.max(halfH / Math.tan(fov / 2), halfW / (Math.tan(fov / 2) * aspect));
  camera.position.set(0, halfH * 0.28, dist);
  CAM_BASE.x = camera.position.x;
  CAM_BASE.y = camera.position.y;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
fitCamera();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitCamera();
});

/* ================= HUD ================= */

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const nextGrid = document.getElementById('next-grid');
for (let i = 0; i < 16; i++) {
  const d = document.createElement('div');
  d.style.display = 'flex';
  d.style.alignItems = 'center';
  d.style.justifyContent = 'center';
  d.style.fontSize = '11px';
  d.style.fontWeight = '700';
  nextGrid.appendChild(d);
}

/** 特殊格方向 -> 字形 */
const FX_GLYPH = {
  up: '↑', ne: '↗', right: '→', se: '↘',
  down: '↓', sw: '↙', left: '←', nw: '↖',
};

let lastNext = null;
function updateNextPreview(type, special) {
  const sig = type + (special ? `:${special.r},${special.c},${special.fx}` : '');
  if (sig === lastNext) return;
  lastNext = sig;
  const divs = nextGrid.children;
  for (const d of divs) {
    d.style.background = 'transparent';
    d.style.boxShadow = 'none';
    d.textContent = '';
  }
  const shape = SHAPES[type];
  let minR = 4, maxR = -1, minC = 4, maxC = -1;
  shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    })
  );
  const offX = ((4 - (maxC - minC + 1)) / 2) | 0;
  const offY = ((4 - (maxR - minR + 1)) / 2) | 0;
  const hex = '#' + COLORS[type].toString(16).padStart(6, '0');
  shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      const idx = (r - minR + offY) * 4 + (c - minC + offX);
      divs[idx].style.background = hex;
    })
  );
  // 特殊格：按效果色描边 + 方向字形
  if (special) {
    const idx = (special.r - minR + offY) * 4 + (special.c - minC + offX);
    const fxHex = '#' + FX_COLORS[special.fx].toString(16).padStart(6, '0');
    divs[idx].style.boxShadow = `inset 0 0 0 2px ${fxHex}`;
    divs[idx].textContent = FX_GLYPH[special.fx];
    divs[idx].style.color = fxHex;
  }
}

/* ================= 浮层（开始 / 暂停 / 结束） ================= */

const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('overlay-title');
const ovText = document.getElementById('overlay-text');
const ovBtn = document.getElementById('overlay-btn');

function refreshOverlay() {
  const s = game.state;
  if (s === 'playing' || s === 'clearing') {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');
  if (s === 'ready') {
    ovTitle.textContent = '3D TETRIS';
    ovText.innerHTML =
      '← → 移动 · ↑ 旋转 · ↓ 软降<br>空格 硬降 · P 暂停 · R 重新开始<br>发光格 8 向效果：直线清除 · 斜向取反补块';
    ovBtn.textContent = '开始游戏';
  } else if (s === 'paused') {
    ovTitle.textContent = 'PAUSED';
    ovText.textContent = '按 P 或点击按钮继续';
    ovBtn.textContent = '继续游戏';
  } else {
    ovTitle.textContent = 'GAME OVER';
    ovText.innerHTML = `本局得分 <b>${game.score}</b> · 消除 ${game.lines} 行 · 等级 ${game.level}`;
    ovBtn.textContent = '再来一局';
  }
}

ovBtn.addEventListener('click', () => {
  if (game.state === 'ready') game.start();
  else if (game.state === 'paused') game.togglePause();
  else {
    game.reset();
    game.start();
  }
  refreshOverlay();
});

/* ================= 键盘输入 ================= */

window.addEventListener('keydown', (e) => {
  const s = game.state;

  if (e.code === 'KeyR') {
    game.reset();
    game.start();
    refreshOverlay();
    return;
  }
  if (e.code === 'KeyP' && (s === 'playing' || s === 'paused')) {
    game.togglePause();
    refreshOverlay();
    return;
  }
  // 开始 / 重开（空格或回车）
  if ((e.code === 'Space' || e.code === 'Enter') && (s === 'ready' || s === 'gameover')) {
    e.preventDefault();
    if (s === 'gameover') game.reset();
    game.start();
    refreshOverlay();
    return;
  }
  if (s !== 'playing') return;

  switch (e.code) {
    case 'ArrowLeft': game.move(-1, 0); e.preventDefault(); break;
    case 'ArrowRight': game.move(1, 0); e.preventDefault(); break;
    case 'ArrowDown': game.softDrop(); e.preventDefault(); break;
    case 'ArrowUp': case 'KeyX': game.rotate(1); e.preventDefault(); break;
    case 'KeyZ': game.rotate(-1); e.preventDefault(); break;
    case 'Space': game.hardDrop(); e.preventDefault(); break;
    case 'KeyG': case 'Digit1':
      if (game.items && game.items.length) {
        game.useGravity('cols', 4, 'down');
      }
      e.preventDefault();
      break;
  }
});

/* ================= 主循环 ================= */

const comboEl = document.getElementById('combo');
let lastComboKey = null;

const clock = new THREE.Clock();
let lastState = null;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); // 防止切后台后 dt 过大
  game.update(dt);
  view.sync(game, dt);
  updateNextPreview(game.nextType, game.nextSpecial);

  // 震屏：特效强度驱动的相机抖动，线性衰减
  view.shake = Math.max(0, view.shake - dt * 1.2);
  if (view.shake > 0.001) {
    camera.position.x = CAM_BASE.x + (Math.random() - 0.5) * view.shake;
    camera.position.y = CAM_BASE.y + (Math.random() - 0.5) * view.shake;
  } else {
    camera.position.x = CAM_BASE.x;
    camera.position.y = CAM_BASE.y;
  }

  scoreEl.textContent = game.score;
  linesEl.textContent = game.lines;
  levelEl.textContent = game.level;

  // 连锁波次提示
  const comboKey = game.state === 'clearing' && game.combo >= 1 ? game.combo : null;
  if (comboKey !== lastComboKey) {
    lastComboKey = comboKey;
    comboEl.textContent = comboKey ? `COMBO ×${comboKey + 1}` : '';
    comboEl.classList.toggle('on', !!comboKey);
  }

  if (game.state !== lastState) {
    lastState = game.state;
    refreshOverlay();
  }

  renderer.render(scene, camera);
}
refreshOverlay();
tick();
