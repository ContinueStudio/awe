"""AWE 独立桌面窗口入口。

假设后端已经在 127.0.0.1:8765 运行，本脚本只负责：
1. 加载 frontend/dist/index.html（已构建的静态资源）
2. 用 PyWebview 打开一个独立窗口
3. 窗口关闭后退出

用法:
    python desktop/launch_window.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST_INDEX = ROOT / "frontend" / "dist" / "index.html"
BACKEND = "http://127.0.0.1:8765"


def main() -> int:
    if not DIST_INDEX.exists():
        print(f"[AWE] 前端 dist 不存在: {DIST_INDEX}")
        print(f"[AWE] 请先构建: cd {ROOT / 'frontend'} && npm run build")
        return 1

    try:
        import webview  # noqa: PLC0415
    except ImportError:
        print("[AWE] 缺少 pywebview，请安装: pip install pywebview")
        return 1

    # 用后端 URL 而不是 file:// 协议：
    # - file:// 下 <script src="/assets/xxx.js"> 绝对路径会解析成 file:///assets/xxx.js → 404
    # - 后端已 serve dist，且 CORS 全开，fetch 走 8765 没问题
    frontend_url = f"{BACKEND}/"

    print(f"[AWE] 启动桌面窗口")
    print(f"[AWE]   前端: {frontend_url}")
    print(f"[AWE]   后端: {BACKEND}")

    window = webview.create_window(
        title=" ",  # 缩短窗口标题，避免显示长字符串
        url=frontend_url,
        width=1440,
        height=900,
        min_size=(1100, 720),
        confirm_close=True,
        text_select=True,
    )

    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
