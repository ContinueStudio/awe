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

    # file:// 协议 + Windows 路径转换
    dist_url = DIST_INDEX.as_uri()  # 输出 file:///D:/AWE/frontend/dist/index.html

    print(f"[AWE] 启动桌面窗口")
    print(f"[AWE]   前端: {dist_url}")
    print(f"[AWE]   后端: {BACKEND}")

    window = webview.create_window(
        title="AWE - 智能体工作流引擎",
        url=dist_url,
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
