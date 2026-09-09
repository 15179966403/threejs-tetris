# 3D Tetris · 微信小游戏版

Web 版（`src/main.js`）的微信小游戏移植，游戏逻辑层（`TetrisGame.js` / `constants.js`）与 Web 版完全共用。

## 目录结构

```
minigame/
├── game.js                # 构建产物（由 npm run minigame 生成，勿手改）
├── game.json              # 小游戏配置（竖屏）
├── project.config.json    # 微信开发者工具项目配置
└── README.md

src/minigame/
├── shim.js                # 环境垫片（补齐 window/document/performance，最先 import）
├── main.js                # 入口：场景/灯光/UI 合成/主循环/动态分辨率
├── BoardView.js           # 3D 视图（InstancedMesh 优化版）
├── ui.js                  # canvas 绘制的 HUD / 浮层 / 虚拟按键（脏检查）
└── input.js               # 触屏手势 + 按钮长按连发
```

## 使用步骤

1. 构建产物已随仓库生成；若改了代码，在项目根目录执行：

   ```bash
   npm run minigame          # 单次构建 → minigame/game.js
   npm run minigame:watch    # 监听模式
   ```

2. 打开「微信开发者工具」→ 导入项目 → 目录选择 **本 `minigame/` 文件夹**。
3. `project.config.json` 中 `appid` 默认为 `touristappid`（游客模式，可直接编译预览）；
   正式发布时换成自己的小游戏 AppID。
4. 真机预览请用开发者工具的「预览」二维码。

## 操作方式（小霸王十字键）

| 操作 | 效果 |
|---|---|
| 十字键 ← → | 移动（长按连发：180ms 延迟后每 45ms 一次） |
| 十字键 ↑ | 顺时针旋转 |
| 十字键 ↓ | 加速下落（长按连发） |
| **连按两下 ↓** | **硬降（280ms 双击窗口）** |
| 手指在十字键上滑动 | 直接切到相邻臂（实体手柄手感） |
| 「开始」药丸键 | 暂停 / 继续 |
| 「选择」药丸键 | 切换左右手布局（浮层界面也可用，持久化存储） |
| 浮层界面点任意处 | 开始 / 继续 / 再来一局 |

底部控制台：十字键 + 开始/选择药丸 + **A/B 道具预留槽**（虚线圆圈，后续道具按钮直接放这里，
在 `ui.js _drawItemPanel` / `_layout` 中扩展即可）。

## 性能优化清单

- **InstancedMesh**：200 个已锁定方块合并为 1 次绘制调用，且仅在棋盘变化或消行动画期间重写实例数据
- **动态分辨率**：dpr 封顶 2；连续 90 帧平均帧时超 22ms 自动降渲染倍率（最低 0.6×），帧况好转再回升，带 2.5s 冷却防抖
- **UI 脏检查**：HUD/浮层只在状态变化时重绘并上传纹理，避免每帧全屏 `texImage2D`
- **阴影降负**：shadow map 2048→1024，PCFSoft→PCF
- **几何/材质池化**：圆角立方体、线框等全部复用；活动方块 4 mesh + 投影 4 LineSegments 共享材质
- **纹理设置**：UI 纹理关闭 mipmap（小游戏 WebGL1 下 NPOT 纹理必须无 mip，否则 three 会静默重采样）
- **three 0.162**：最后一个同时支持 WebGL1/2 的版本线，兼容老版本微信客户端
- 切后台（`wx.onHide`）自动暂停，防止 dt 爆炸与漏帧

## 已知的坑（踩过的）

- **不要在小游戏包源码里用 class `#private` 语法**：esbuild 降到 ES2018 时对「静态私有字段经类名访问」的转换有 bug（生成从 this 读取），在开发者工具报 `Cannot read from private field`。全部改用普通成员/模块级常量。
- **`InstancedMesh` 签名是 `(geometry, material, count)`**，传反会把材质当几何体解析，报 `Cannot read property 'center' of undefined`。
- **强制 WebGL1**（`WebGL1Renderer`）：开发者工具 Windows 版的 WebGL2 模拟存在 GLSL 翻译缺陷，MeshStandardMaterial 片元着色器编译失败。
- **修改源码后需重新构建**（`npm run minigame`），开发者工具里直接改 game.js 无效。
- 本地无头仿真：`node tools/harness.mjs`（stub 掉 wx/WebGL，跑真实 bundle 的主循环 + 触屏，无需开开发者工具即可回归）。

## 与 Web 版的差异

- 无 DOM：HUD/浮层改为离屏 2D canvas → CanvasTexture → 正交相机全屏面片叠加
- 键盘输入改为触屏手势 + 虚拟按钮
- 消行闪光用实例颜色趋白替代自发光闪烁（实例化下零额外开销）
- 新增最高分持久化（`wx.setStorageSync`）、消行/硬降震动反馈、左右手布局持久化（`tetris3d_dpad_side`）
