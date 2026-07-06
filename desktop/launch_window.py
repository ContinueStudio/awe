"""AWE 独立桌面窗口入口（v2.36 Win32 拖动版）。

完全掌控后端生命周期，避免子进程僵尸：
- 后端 uvicorn 跑在 daemon 线程里
- PyWebview 关闭窗口时 set 事件，daemon 线程自然退出
- 不再有 subprocess 父死子不收的问题

v2.36 关键：拖动走 Python 端 set_window_pos 机制
- 直接 ctypes 调 user32.SetWindowPos
- 从 window.native (winforms BrowserForm) 拿 HWND
- 前端 mousedown/move/up 调暴露的 start_drag/move_window_delta
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST_INDEX = ROOT / "frontend" / "dist" / "index.html"
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8765
BACKEND = f"http://{BACKEND_HOST}:{BACKEND_PORT}"


def start_backend_in_thread(stop_event: threading.Event) -> None:
    """在 daemon 线程中启动 FastAPI + uvicorn。"""
    import uvicorn
    sys.path.insert(0, str(ROOT / "backend"))
    from app.main import app

    config = uvicorn.Config(
        app,
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        log_level="warning",
        log_config=None,
    )
    server = uvicorn.Server(config)

    def _watch():
        stop_event.wait()
        server.should_exit = True

    threading.Thread(target=_watch, daemon=True).start()
    server.run()


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

    # 检查端口是否被占
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex((BACKEND_HOST, BACKEND_PORT)) == 0:
            print(f"[AWE] 端口 {BACKEND_PORT} 被占，请先关掉占用进程")
            return 1

    print(f"[AWE] 启动桌面窗口（v2.36 Win32 拖动版）")
    print(f"[AWE]   前端: {BACKEND}/")
    print(f"[AWE]   后端: {BACKEND}")

    # 启动后端线程
    stop_event = threading.Event()
    backend_thread = threading.Thread(
        target=start_backend_in_thread, args=(stop_event,), daemon=True
    )
    backend_thread.start()

    # 等待后端就绪
    import urllib.request
    import time
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BACKEND}/api/health", timeout=1) as r:
                if r.status < 500:
                    print(f"[AWE]   后端就绪 ✓")
                    break
        except Exception:
            time.sleep(0.3)
    else:
        print(f"[AWE] 后端启动超时")
        stop_event.set()
        return 1

    try:
        _run_gui(webview, stop_event)
    except SystemExit:
        raise
    except Exception:
        import traceback
        # 打印完整 traceback 到 stdout（方便 start.py 捕获）
        print(f"[AWE] 致命错误:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # 同时 flush stdout 确保日志被 start.py 捕获
        traceback.print_exc(file=sys.stdout)
        return 1
    finally:
        print(f"[AWE] 窗口已关闭，停止后端...")
        stop_event.set()
        backend_thread.join(timeout=5)
        print(f"[AWE] 已退出")
    return 0


def _run_gui(webview, stop_event: threading.Event) -> None:
    """GUI 主循环。"""

    print(f"[AWE] 创建 pywebview 窗口...", flush=True)
    try:
        window = webview.create_window(
            title="AWE",
            url=f"{BACKEND}/",
            width=1440,
            height=900,
            min_size=(1100, 720),
            confirm_close=False,
            text_select=True,
            frameless=True,
            easy_drag=False,
            background_color="#f8fafc",
        )
    except Exception as e:
        print(f"[AWE] 窗口创建失败: {e}", flush=True)
        raise

    # v2.36：修复高 DPI 缩放下的拖动偏移
    # 关键：window.move() 接收逻辑像素，GetWindowRect 返回物理像素
    # Python 端权威位置必须全程用逻辑像素，与 window.move() 保持一致
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.WinDLL("user32", use_last_error=True)

        _win_x = [0]
        _win_y = [0]

        def _get_scale() -> float:
            try:
                return float(window.native._scale)
            except Exception:
                try:
                    return float(window.screen.scale)
                except Exception:
                    return 1.0

        def get_window_pos() -> dict:
            return {"x": _win_x[0], "y": _win_y[0]}

        def start_drag() -> dict:
            try:
                native = getattr(window, "native", None)
                if native is None:
                    return {"x": _win_x[0], "y": _win_y[0]}
                hwnd = int(native.Handle.ToInt32())
                rect = wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                scale = _get_scale()
                _win_x[0] = int(rect.left / scale)
                _win_y[0] = int(rect.top / scale)
                return {"x": _win_x[0], "y": _win_y[0]}
            except Exception:
                return {"x": _win_x[0], "y": _win_y[0]}

        def move_window_delta(dx: int, dy: int) -> None:
            new_x = _win_x[0] + int(dx)
            new_y = _win_y[0] + int(dy)
            _win_x[0] = new_x
            _win_y[0] = new_y
            try:
                window.move(new_x, new_y)
            except Exception as e:
                print(f"[AWE] move 失败: {e}")

        window.expose(get_window_pos)
        window.expose(start_drag)
        window.expose(move_window_delta)

    def minimize():
        window.minimize()

    def close_window():
        window.destroy()

    window.expose(minimize)
    window.expose(close_window)

    webview.start()


if __name__ == "__main__":
    sys.exit(main())
