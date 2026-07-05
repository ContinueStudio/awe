"""AWE 独立桌面窗口入口（v2.27 frameless 模式）。

假设后端已经在 127.0.0.1:8765 运行，本脚本只负责：
1. 加载 frontend/dist/index.html（已构建的静态资源）
2. 用 PyWebview 打开一个无边框窗口（frameless）
3. 窗口关闭后退出

为什么要 frameless？
- Windows 原生标题栏不可定制（图标/颜色都改不了）
- 老大要求：去掉 Python 图标、标题栏与窗口内同色
- 解决方案：去掉原生 chrome，前端自绘标题栏（统一 slate-50 配色）

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
    frontend_url = f"{BACKEND}/"

    print(f"[AWE] 启动桌面窗口（frameless 模式）")
    print(f"[AWE]   前端: {frontend_url}")
    print(f"[AWE]   后端: {BACKEND}")

    # frameless=True：去掉原生标题栏（含 Python 图标 + 黑色菜单栏）
    # background_color 设为 slate-50，与窗口内顶栏同色 → 视觉无黑边
    window = webview.create_window(
        title="AWE",
        url=frontend_url,
        width=1440,
        height=900,
        min_size=(1100, 720),
        confirm_close=True,
        text_select=True,
        frameless=True,           # 关键：去掉原生 chrome
        easy_drag=False,          # 关掉整窗拖动，前端标题栏接管
        background_color="#f8fafc",  # slate-50
    )

    # 暴露窗口控制 API 给前端（pywebview.expose 只接受函数）
    def minimize():
        window.minimize()

    def close_window():
        window.destroy()

    window.expose(minimize)
    window.expose(close_window)

    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
