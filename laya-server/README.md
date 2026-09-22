# Laya Decision Inference Server

专为 3D 俄罗斯方块智能决策 Agent (`LayaAgent.js`) 提供推理支持的轻量级后台服务。

基于 [Laya](https://github.com/NandhaKishorM/laya) 开源决策模型（Convai Innovations 出品）：
输入当前盘面与落点特征的自然语言状态，以单次前向传播输出置信度概率（`p(clean)`），驱动 AI 做出人类直觉般的平整铺叠决策。

---

## 快速使用

### 1. 安装依赖（首次运行）
```bash
# 进入 laya-server 目录
cd laya-server

# 创建虚拟环境（推荐 Python 3.10 ~ 3.12）
python -m venv .venv

# 激活环境并安装依赖
# Windows:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

*(如果在项目根目录下，也可直接运行根目录配置的 npm 快捷指令：`npm run laya:install`)*

### 2. 预下载模型权重（约 700MB）
```bash
python download_model.py
```
*(或在项目根目录下执行 `npm run laya:download`)*

### 3. 启动后台推理服务
```bash
python server.py
```
*(或在项目根目录下执行 `npm run laya:server`)*

服务将默认监听在 `http://127.0.0.1:8770`。

---

## API 接口说明

### 1. 健康检查与就绪探针
- **GET** `/api/health`
- **响应示例**:
```json
{
  "status": "ok",
  "service": "laya-tetris-server",
  "models": { "english": "ready" },
  "version": "0.3.4",
  "torch": "2.14.0+cpu",
  "device": "cpu"
}
```

### 2. 方块落点特征评估
- **POST** `/api/predict`
- **请求体**:
```json
{
  "state": "The piece leaves no holes, creates 1 complete row, keeps top flat at height 4.",
  "questions": {
    "look": {
      "type": "choice",
      "instructions": "Is the board surface clean, flat, and well-managed?",
      "criteria": {
        "clean": "The board is stable, flat, with no deep holes or messy jagged peaks.",
        "messy": "The board is jagged, full of overhangs, steep spires, or inaccessible gaps."
      }
    }
  }
}
```
- **响应体**:
```json
{
  "answers": {
    "look": {
      "choice": "clean",
      "probabilities": {
        "clean": 0.842,
        "messy": 0.158
      }
    }
  },
  "latency_ms": 14.2,
  "device": "cpu"
}
```

---

## 目录结构（精简版）

```
laya-server/
├── server.py             # 轻量级推理 HTTP 服务（仅包含 /api/predict 与 /api/health）
├── download_model.py     # 决策模型权重一键预下载脚本
├── requirements.txt      # Python 依赖清单
├── README.md             # 本说明文档
└── .venv/                # Python 独立虚拟环境（已被 gitignore 忽略）
```
