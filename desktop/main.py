"""AWE Mode A 桌面端入口。

- 后端 FastAPI 作为子进程启动
- PyWebview 打开前端页面（Vite dev 或 build 后静态文件）
- 主进程退出时一并清理子进程与浏览器
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

import webview

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
LOG_DIR = ROOT / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


def _port_free(p: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", p)) != 0


def _wait_for(url: str, timeout: float = 30) -> bool:
    import urllib.request

    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as r:
                if r.status < 500:
                    return True
        except Exception:  # noqa: BLE001
            time.sleep(0.3)
    return False


def start_backend() -> subprocess.Popen:
    """启动 FastAPI 后端子进程。"""
    port = int(os.environ.get("AWE_PORT", "8765"))
    log_path = LOG_DIR / "backend.log"
    log_f = open(log_path, "ab", buffering=0)

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(BACKEND_DIR),
        stdout=log_f,
        stderr=subprocess.STDOUT,
        env=env,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    print(f"[AWE] backend pid={proc.pid} port={port} log={log_path}")
    return proc


def detect_frontend_url() -> tuple[str, bool]:
    """返回 (url, owns_dev_server)。

    优先检测 dist 静态资源；否则尝试启动 Vite dev server。
    """
    if (FRONTEND_DIST / "index.html").exists():
        return ("http://127.0.0.1:5173", False)  # 仍走 vite preview 或 dev
    return ("http://127.0.0.1:5173", True)


def start_frontend_dev() -> subprocess.Popen:
    """启动 Vite dev server。"""
    log_path = LOG_DIR / "frontend.log"
    log_f = open(log_path, "ab", buffering=0)

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=log_f,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    print(f"[AWE] frontend pid={proc.pid} log={log_path}")
    return proc


def kill_proc(proc: subprocess.Popen | None) -> None:
    if not proc:
        return
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:  # noqa: BLE001
        try:
            proc.kill()
        except Exception:  # noqa: BLE001
            pass


def kill_chrome_zombies() -> None:
    """清理可能残留的 Chromium/Chrome 调试进程。"""
    if sys.platform != "win32":
        return
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", "chrome.exe", "/T"],
            capture_output=True,
            check=False,
        )
    except Exception:  # noqa: BLE001
        pass


def main() -> int:
    print(f"[AWE] starting in {ROOT}")

    # 1) 后端
    backend = start_backend()
    if not _wait_for("http://127.0.0.1:8765/api/health", timeout=20):
        print("[AWE] backend failed to start, see data/logs/backend.log")
        kill_proc(backend)
        return 1

    # 2) 前端
    url, needs_dev = detect_frontend_url()
    frontend = start_frontend_dev() if needs_dev else None
    if needs_dev and not _wait_for(url, timeout=40):
        print("[AWE] frontend failed to start, see data/logs/frontend.log")
        kill_proc(frontend)
        kill_proc(backend)
        return 1

    # 3) 桌面窗口
    try:
        window = webview.create_window(
            "AWE - 智能体工作流引擎",
            url=url,
            width=1440,
            height=900,
            min_size=(1100, 720),
            confirm_close=False,
        )

        def force_close():
            window.destroy()

        window.expose(force_close)

        # 拦截系统关闭按钮：通知前端显示自定义确认对话框（无系统提示音）
        def on_closing():
            try:
                window.evaluate_js(
                    'window.__showCloseConfirm && window.__showCloseConfirm()'
                )
            except Exception:
                pass
            return False  # 阻止默认关闭，由前端确认后调用 force_close

        window.events.closing += on_closing

        webview.start()
    finally:
        kill_proc(frontend)
        kill_proc(backend)
        kill_chrome_zombies()
    return 0


if __name__ == "__main__":
    sys.exit(main())
