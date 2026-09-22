# 3D Tetris with Laya AI Decision Model

基于 **Three.js** 开发的次世代 3D 俄罗斯方块游戏，融合独创的**「8 向特殊箭头激光与取反机制」**、**「全屏垂直重力与水平重力消井系统」**，并深度集成了 **[Laya](https://github.com/NandhaKishorM/laya)** 开源端侧决策模型实现智能 AI 全自动代打托管（Auto-pilot）。

同时支持 **Web 端（Vite）** 与 **微信小游戏端（Canvas/WebGL 适配层）**。

---

## 快速开始

### 1. 启动 3D 游戏前端
```bash
npm install
npm run dev
```
打开浏览器访问 `http://localhost:5173` 即可开始游玩。

---

### 2. 启动 Laya AI 托管决策服务（可选，提供 AI 自动代打）

AI 后端服务已整合在 `laya-server/` 目录下，开箱即用：

#### 首次环境安装（拉取仓库后只需执行一次）：
```bash
# 自动通过 uv 创建独立 Python 虚拟环境并安装所有依赖
npm run laya:install
```

#### 模型预下载（模型权重不入库，拉取代码后运行一次）：
```bash
# 自动从 Hugging Face Hub 下载并缓存 Laya 决策模型权重（本地 ~/.cache）
npm run laya:download
```

#### 启动决策服务：
```bash
npm run laya:server
```
服务将在 `http://127.0.0.1:8770` 启动，Vite 开发服务器已内置反向代理，前端将自动与模型通信。

---

## 游戏操作与功能

| 按键 | 功能 | 说明 |
| :--- | :--- | :--- |
| **`←`** / **`→`** | 水平移动 | 移动当前下落方块 |
| **`↑`** / **`X`** | 顺时针旋转 | 瞄准特殊方格激光朝向 |
| **`Z`** | 逆时针反转 | 反向旋转 |
| **`↓`** | 软降 | 加速下落（+1 分/格） |
| **`空格`** | 硬降 | 瞬间落底锁定（+2 分/格） |
| **`A`** | **LAYA AI 托管开关** | 启动 / 暂停 Laya 端侧决策模型自动代打 |
| **`M`** | **游玩模式切换** | 在【特技模式】与【经典纯净模式】之间无缝切换 |
| **`G`** / **`1`** | **全屏垂直重力** | 消耗重力道具，所有方块垂直下坠压实 |
| **`H`** / **`2`** | **全屏水平重力** | 消耗水平重力道具，所有方块向最优侧横向聚拢消井 |
| **`P`** | 暂停 / 继续 | 暂停游戏 |
| **`R`** | 重新开始 | 重置当局对战 |

---

## 微信小游戏构建

```bash
npm run minigame
```
生成产物位于 `minigame/game.js`，可直接在微信开发者工具中打开 `minigame/` 目录进行调试预览与上传发布。

---

## 项目结构

```text
├── src/                    # 3D 网页端游戏核心引擎
│   ├── TetrisGame.js       # 核心游戏状态机、物理规则、双模式与道具系统
│   ├── BoardView.js        # Three.js 3D 棋盘、激光特效与粒子物理渲染
│   ├── LayaAgent.js        # Laya 语义转译、候选推演与自适应代打策略
│   └── main.js             # 页面主循环与键盘事件
├── laya-server/            # Laya 端侧决策模型本地服务
│   ├── server.py           # 本地推理服务与 Playground
│   ├── download_model.py   # 模型权重一键预下载脚本
│   ├── requirements.txt    # 锁定环境依赖清单
│   └── .venv/              # 本地虚拟环境（已配置 .gitignore 忽略）
├── minigame/               # 微信小游戏环境与 UI
├── tests/                  # 单元测试与自动化验证套件
└── vite.config.js          # Vite 构建配置（含 laya-api 代理）
```
