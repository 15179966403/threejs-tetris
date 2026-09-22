"""
Pre-download Laya decision model weights into local cache.
Run this script once after cloning to prepare offline weights:
    python download_model.py
"""
import os
import sys
import time

def main():
    print("=" * 60)
    print(" Laya Decision Model Pre-downloader")
    print("=" * 60)
    try:
        import laya
    except ImportError:
        print("[ERROR] 'laya' package is not installed.")
        print("Please run: uv pip install -r requirements.txt")
        sys.exit(1)

    router = laya.Router()
    # 优先下载英语模型（俄罗斯方块 AI 核心依赖），按需可选多语言
    models = ("english",)
    
    for name in models:
        print(f"\nDownloading / Verifying '{name}' model weights...")
        t0 = time.perf_counter()
        try:
            router.load(name)
            print(f"[OK] '{name}' model cached and ready in {time.perf_counter() - t0:.1f}s")
        except Exception as e:
            print(f"[WARN] Failed to load '{name}': {e}")

    print("\n" + "=" * 60)
    print(" Laya model is ready for 3D Tetris auto-pilot!")
    print(" Start the server with: python server.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
