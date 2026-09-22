"""
Laya Decision Inference Server for 3D Tetris AI Agent.

Provides a lightweight local HTTP service:
- POST /api/predict: Evaluates candidate Tetris placements using Laya decision model.
- GET  /api/health:  Health-check and model readiness probe.
"""
import os
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Suppress unnecessary framework telemetry / noisy logs
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

_CACHE = os.path.expanduser("~/.cache/huggingface/hub/models--convaiinnovations--laya/snapshots")
if os.path.isdir(_CACHE):
    os.environ.setdefault("HF_HUB_OFFLINE", "1")

import torch
import laya
from laya import Router

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8770"))
MAX_BODY = 1 << 20  # 1 MB limit

# By default, Tetris AI uses the 'english' model
DEFAULT_MODELS = ("english",)
ROUTER = Router(max_loaded=3)
LOCK = threading.Lock()
STATUS = {m: "pending" for m in DEFAULT_MODELS}


def ensure_loaded(name):
    """Load model checkpoint into memory if not already cached."""
    if name not in ROUTER.loaded:
        STATUS[name] = "loading"
        try:
            ROUTER.load(name)
        except Exception as e:
            STATUS[name] = f"error: {e}"
            raise
    STATUS[name] = "ready"
    return ROUTER.load(name)


def preload():
    """Background preloader for the primary decision model."""
    for name in DEFAULT_MODELS:
        try:
            with LOCK:
                t0 = time.perf_counter()
                ensure_loaded(name)
            print(f"[laya] '{name}' model ready in {time.perf_counter() - t0:.1f}s", flush=True)
        except Exception as e:
            print(f"[laya] failed to preload '{name}': {e}", flush=True)


def validate_questions(questions):
    """Validate question dictionary schema."""
    if not isinstance(questions, dict) or not questions:
        raise ValueError("questions must be a non-empty object of id -> definition")
    for qid, q in questions.items():
        if not isinstance(q, dict) or q.get("type") not in ("choice", "score", "noul"):
            raise ValueError(f"question {qid!r}: type must be choice, score or noul")
        if not q.get("instructions"):
            raise ValueError(f"question {qid!r}: instructions are required")
        crit = q.get("criteria")
        if q["type"] == "choice" and not (isinstance(crit, (dict, list)) and len(crit) >= 2):
            raise ValueError(f"question {qid!r}: a choice needs at least 2 options")
        if q["type"] == "score" and not (isinstance(crit, list) and len(crit) >= 2):
            raise ValueError(f"question {qid!r}: a score needs at least 2 ordered levels")


def predict(payload):
    """Perform forward decision inference on the given state and questions."""
    state = payload.get("state")
    questions = payload.get("questions")
    if state in (None, "", {}, []):
        raise ValueError("state is empty")
    validate_questions(questions)

    model = payload.get("model") or None
    lang = payload.get("lang") or None
    decision = ROUTER.route(state, questions, model=model, lang=lang)

    with LOCK:
        agent = ensure_loaded(decision["model"])
        sync = torch.mps.synchronize if agent.device.type == "mps" else (lambda: None)
        t0 = time.perf_counter()
        result = agent.system_one(state, questions)
        sync()
        ms = (time.perf_counter() - t0) * 1000

    result["routing"] = dict(decision)
    result["latency_ms"] = round(ms, 1)
    result["device"] = str(agent.device)
    return result


class InferenceHandler(BaseHTTPRequestHandler):
    server_version = "laya-tetris-server"
    protocol_version = "HTTP/1.1"

    def log_request(self, code="-", size="-"):
        # Keep terminal clean during active game loops
        if str(code) == "200" and self.path.startswith(("/api/health", "/api/predict")):
            return
        super().log_request(code, size)

    def log_message(self, fmt, *args):
        print("[http] " + fmt % args, flush=True)

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path in ("/api/health", "/health", ""):
            device = "cpu"
            if torch.backends.mps.is_available():
                device = "mps"
            elif torch.cuda.is_available():
                device = "cuda"

            self._send(200, {
                "status": "ok",
                "service": "laya-tetris-server",
                "models": STATUS,
                "version": getattr(laya, "__version__", "0.3.4"),
                "torch": torch.__version__,
                "device": device
            })
        else:
            self._send(404, {"error": "Not Found", "message": "Only /api/predict (POST) and /api/health (GET) are available."})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        if path not in ("/api/predict", "/predict"):
            self._send(404, {"error": "Not Found", "message": "Endpoint not supported. Use /api/predict"})
            return

        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_BODY:
                raise ValueError("request body must be between 1 byte and 1 MB")
            body = json.loads(self.rfile.read(n).decode("utf-8"))
            result = predict(body)
            self._send(200, result)
        except (ValueError, KeyError, TypeError) as e:
            self._send(400, {"error": str(e)})
        except Exception as e:
            self._send(500, {"error": f"{type(e).__name__}: {e}"})


def main():
    threading.Thread(target=preload, daemon=True).start()
    print("=" * 60)
    print(f" Laya Tetris Decision Server (v{getattr(laya, '__version__', '0.3.4')})")
    print(f" Address: http://{HOST}:{PORT}")
    print(f" Endpoints:")
    print(f"   POST http://{HOST}:{PORT}/api/predict")
    print(f"   GET  http://{HOST}:{PORT}/api/health")
    print("=" * 60, flush=True)

    server = ThreadingHTTPServer((HOST, PORT), InferenceHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()


if __name__ == "__main__":
    main()
