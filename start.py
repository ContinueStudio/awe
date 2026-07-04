r"""
AWE 一键启动脚本
- 杀掉占用端口的旧进程（8765/5173）
- 启动后端 (FastAPI on 8765, 自动 serve frontend/dist)
- --dev 模式：额外启动 Vite dev (5173) 用于 HMR
- 等待服务就绪后自动打开浏览器
- Ctrl+C 同时关闭所有子进程

参照 D:\APA\lawe_project\start.py 实现。
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

# 强制 UTF-8 stdout（Windows GBK 默认编码会导致 ✓/✗ 等 Unicode 报错）
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

BACKEND_PORT = 8765
FRONTEND_PORT = 5173
BACKEND_HEALTH = f"http://127.0.0.1:{BACKEND_PORT}/api/health"
FRONTEND_URL_PROD = f"http://127.0.0.1:{BACKEND_PORT}/"
FRONTEND_URL_DEV = f"http://127.0.0.1:{FRONTEND_PORT}/"


# -------- Python 解释器选择 --------
def find_python() -> str | None:
    """优先 venv，否则 PATH 上的 python / py。"""
    candidates = [
        BACKEND_DIR / "venv" / "Scripts" / "python.exe",  # Windows venv
        BACKEND_DIR / "venv" / "bin" / "python",          # POSIX venv
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return shutil.which("python") or shutil.which("python3") or shutil.which("py")


# -------- npm 查找 --------
def find_npm() -> str:
    candidates = [
        r"C:\Users\11\.workbuddy\binaries\node\versions\22.22.2\npm.cmd",
        r"C:\Program Files\nodejs\npm.cmd",
        r"C:\Program Files (x86)\nodejs\npm.cmd",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return shutil.which("npm") or shutil.which("npm.cmd") or "npm"


# -------- 杀掉占用端口的进程 --------
def kill_port(port: int) -> None:
    """通过 netstat 找到占用端口的 PID 并 kill（Windows）。"""
    try:
        out = subprocess.check_output(
            f'netstat -ano | findstr ":{port} "',
            shell=True, text=True, stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return
    pids = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[1].endswith(f":{port}"):
            try:
                pids.add(int(parts[-1]))
            except ValueError:
                pass
    for pid in pids:
        try:
            subprocess.run(f"taskkill /F /PID {pid}", shell=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"  - 杀掉占用 :{port} 的旧进程 PID={pid}")
        except Exception:
            pass


# -------- HTTP 轮询 --------
def wait_http(url: str, timeout: float, label: str) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                if r.status < 500:
                    return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.5)
    print(f"  ✗ {label} 启动超时（{timeout:.0f}s）")
    return False


# -------- 后端启动 --------
def start_backend() -> subprocess.Popen:
    py = find_python()
    if not py:
        print("  ✗ 找不到 python，请安装 Python 3.10+ 并加入 PATH")
        sys.exit(1)
    print(f"  Python: {py}")

    env = os.environ.copy()
    # 透传 .env 配置（config.py 已自动加载）

    proc = subprocess.Popen(
        [py, "-m", "uvicorn", "app.main:app", "--app-dir", str(BACKEND_DIR),
         "--host", "127.0.0.1", "--port", str(BACKEND_PORT), "--log-level", "info"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    return proc


def start_frontend_dev() -> subprocess.Popen:
    npm = find_npm()
    print(f"  npm: {npm}")
    proc = subprocess.Popen(
        f'"{npm}" run dev',
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    return proc


# -------- 子进程输出流（去重显示 + 保存到 log） --------
def stream_output(proc: subprocess.Popen, prefix: str, log_path: Path) -> None:
    import threading
    def _pump():
        with log_path.open("a", encoding="utf-8") as f:
            for line in proc.stdout:
                f.write(line)
                f.flush()
                line = line.rstrip()
                if line:
                    print(f"  [{prefix}] {line}")
    t = threading.Thread(target=_pump, daemon=True)
    t.start()


# -------- 主流程 --------
def main() -> None:
    ap = argparse.ArgumentParser(description="AWE 一键启动器")
    ap.add_argument("--dev", action="store_true",
                    help="同时启动 Vite dev server (5173, 支持 HMR)")
    ap.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    ap.add_argument("--skip-port-clean", action="store_true", help="跳过端口清理")
    args = ap.parse_args()

    print("=" * 56)
    print("   AWE - Agentic Workflow Engine v0.2.9")
    print("=" * 56)
    print(f"  模式: {'dev (后端 + Vite HMR)' if args.dev else 'prod (后端 + 内置 dist)'}")
    print()

    # ---- 前置检查 ----
    if not BACKEND_DIR.exists():
        print(f"✗ 后端目录不存在: {BACKEND_DIR}")
        sys.exit(1)
    if not args.dev and not (DIST_DIR / "index.html").exists():
        print(f"⚠ 未找到 {DIST_DIR / 'index.html'}，将自动启动 Vite dev (--dev)")
        args.dev = True
    if args.dev and not (FRONTEND_DIR / "node_modules").exists():
        print(f"✗ 未找到 {FRONTEND_DIR / 'node_modules'}，请先运行: cd frontend && npm install")
        sys.exit(1)

    # ---- 清理旧进程 ----
    if not args.skip_port_clean:
        print("[1/4] 清理旧进程...")
        kill_port(BACKEND_PORT)
        if args.dev:
            kill_port(FRONTEND_PORT)
        time.sleep(0.5)
    else:
        print("[1/4] 跳过端口清理")

    # ---- 准备日志 ----
    log_dir = ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    backend_log = log_dir / "backend.log"
    frontend_log = log_dir / "frontend.log"
    backend_log.write_text("", encoding="utf-8")
    frontend_log.write_text("", encoding="utf-8")

    # ---- 启动后端 ----
    print(f"\n[2/4] 启动后端 :{BACKEND_PORT} ...")
    backend = start_backend()
    stream_output(backend, "backend", backend_log)
    if not wait_http(BACKEND_HEALTH, timeout=20, label="后端"):
        backend.terminate()
        print(f"  详细日志: {backend_log}")
        sys.exit(1)
    print("  ✓ 后端就绪")

    frontend = None
    url = FRONTEND_URL_PROD

    # ---- (可选) 启动 Vite dev ----
    if args.dev:
        print(f"\n[3/4] 启动 Vite dev :{FRONTEND_PORT} ...")
        frontend = start_frontend_dev()
        stream_output(frontend, "frontend", frontend_log)
        if not wait_http(f"http://127.0.0.1:{FRONTEND_PORT}/", timeout=30, label="Vite dev"):
            frontend.terminate()
            backend.terminate()
            print(f"  详细日志: {frontend_log}")
            sys.exit(1)
        print("  ✓ Vite dev 就绪")
        url = FRONTEND_URL_DEV
    else:
        print("\n[3/4] 跳过 Vite dev（使用后端内置 dist）")

    # ---- 打开浏览器 ----
    print(f"\n[4/4] 打开浏览器 → {url}")
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"  ⚠ 自动打开浏览器失败: {e}")

    print(f"""
{'-' * 56}
  后端 API    :  {BACKEND_HEALTH}
  前端界面    :  {url}
  后端日志    :  {backend_log}
{'  前端日志   :  ' + str(frontend_log) if args.dev else ''}

  按 Ctrl+C 停止所有服务
{'-' * 56}
""")

    # ---- 等待子进程 ----
    procs = [p for p in (backend, frontend) if p]
    try:
        while True:
            for p in procs:
                if p.poll() is not None:
                    print(f"\n[!] 子进程异常退出 (code={p.returncode})")
                    raise KeyboardInterrupt
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n正在关闭...")
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        print("已停止所有服务。")
        sys.exit(0)


if __name__ == "__main__":
    main()
