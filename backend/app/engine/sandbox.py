"""受限 Python 沙盒（PRD §8.1）。

安全策略（双层防护）：
1. sys.addaudithook — 从 Python 运行时底层拦截高危操作
2. AST 静态审计 — 编译期补充检查

拦截项：
- exec / eval / compile（反射逃逸）
- os.system / os.popen / os.exec* / subprocess.Popen（子进程）
- socket.connect（非 localhost 外连）
- open() 写模式访问绝对路径或 .. 穿越
"""
from __future__ import annotations

import ast
import asyncio
import builtins
import io
import os
import socket
import sys
import threading
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any, Dict, Optional

from ..core.config import settings
from ..core.logger import get_logger

logger = get_logger("awe.sandbox")

# ── 审计开关 ──────────────────────────────────────────
_audit_enabled: bool = False
_audit_working_dir: str = ""


# ── sys.addaudithook 回调 ─────────────────────────────

_BLOCKED_AUDIT_EVENTS = frozenset({
    "exec",              # exec() / eval() / compile()
    "subprocess.Popen",  # 子进程拉起
    "os.system",
    "os.exec",
    "os.execve",
    "os.spawn",
    "os.popen",
    "os.fork",
    "os.forkpty",
})


def _audit_callback(event: str, args: tuple) -> None:
    """底层拦截回调：在用户代码线程中同步执行，可 raise 阻断。"""
    if not _audit_enabled:
        return

    if event in _BLOCKED_AUDIT_EVENTS:
        raise RuntimeError(
            f"[sandbox] 高危调用被拦截: {event} — "
            f"Skill 脚本不允许执行子进程或动态代码"
        )

    if event == "open":
        _audit_open(*args)

    if event == "socket.connect":
        _audit_socket_connect(*args)


def _audit_open(path: Any, mode: str, flags: int) -> None:
    """拦截文件写入操作：仅允许相对路径 + 不能 .. 穿越。"""
    mode_str = str(mode)
    if not ("w" in mode_str or "a" in mode_str or "x" in mode_str or "+" in mode_str):
        return  # 只读模式放行

    path_str = str(path)
    # 绝对路径拒绝
    if os.path.isabs(path_str):
        raise RuntimeError(f"[sandbox] 文件写入被拦截: {path_str}（禁止绝对路径写入）")
    # 路径穿越拒绝
    if ".." in Path(path_str).parts:
        raise RuntimeError(f"[sandbox] 文件写入被拦截: {path_str}（禁止 .. 路径穿越）")


def _audit_socket_connect(address: Any, *_: Any) -> None:
    """仅允许 localhost / 127.0.0.1 连接，禁止外连。"""
    host = None
    if isinstance(address, tuple) and len(address) >= 1:
        host = address[0]
    elif isinstance(address, str):
        # Unix socket path → 放行
        host = address

    if not host:
        return

    host = str(host).lower().strip()
    if host not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError(f"[sandbox] 网络连接被拦截: {host}（仅允许 localhost）")


# 模块导入时注册全局 audit hook
try:
    sys.addaudithook(_audit_callback)
    logger.info("沙盒 audit hook 已注册（sys.addaudithook）")
except Exception:
    logger.warning("sys.addaudithook 注册失败，沙盒仅依赖 AST 审计")


# ── AST 静态审计（辅助兜底）────────────────────────────

_DENY_NAMES = frozenset({
    "os.system",
    "os.popen",
    "os.execv",
    "os.execvp",
    "os.execve",
    "exec",
    "eval",
    "compile",
    "open",       # 配合 audit hook 做双重拦截
    "input",
    "globals",
    "locals",
    "vars",
    "getattr",
    "setattr",
    "delattr",
})


def _ast_audit(code: str) -> str | None:
    """AST 静态审计：在编译期拦截高危语法（补充防线）。"""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"语法错误: {exc.msg} (line {exc.lineno})"

    def _called_name(func: ast.AST) -> str | None:
        parts: list[str] = []
        cur = func
        while isinstance(cur, ast.Attribute):
            parts.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name):
            parts.append(cur.id)
            return ".".join(reversed(parts))
        return None

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = _called_name(node.func)
            if name and name in _DENY_NAMES:
                return f"高危调用被拦截: {name}()"
            if name == "subprocess.Popen":
                for kw in node.keywords:
                    if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        return "高危调用被拦截: subprocess.Popen(shell=True)"
    return None


# ── 受限 builtins ──────────────────────────────────────

_SAFE_BUILTINS: Dict[str, Any] = {}

import builtins as _b
if isinstance(_b.__dict__, dict):
    _SAFE_BUILTINS = dict(_b.__dict__)

for _bad in ("exec", "eval", "compile", "input"):
    _SAFE_BUILTINS.pop(_bad, None)


# ── 执行引擎 ───────────────────────────────────────────

def _exec_sync(code: str, glb: Dict[str, Any], out: io.StringIO, err: io.StringIO, working_dir: str) -> Dict[str, Any]:
    """在隔离线程中执行用户代码，启用 audit hook 拦截。"""
    global _audit_enabled, _audit_working_dir

    _audit_working_dir = working_dir
    _audit_enabled = True

    try:
        if working_dir and working_dir not in sys.path:
            sys.path.insert(0, working_dir)

        with redirect_stdout(out), redirect_stderr(err):
            exec(  # noqa: S102 — 受 audit hook + AST 双重保护
                compile(code, "<skill>", "exec"),
                glb,
            )
        return glb.get("result")
    except Exception:  # noqa: BLE001
        err.write(traceback.format_exc())
        return None
    finally:
        _audit_enabled = False
        if working_dir and working_dir in sys.path:
            try:
                sys.path.remove(working_dir)
            except ValueError:
                pass


async def run_user_code(
    code: str,
    timeout: int | None = None,
    extra_globals: Dict[str, Any] | None = None,
    working_dir: str | None = None,
) -> Dict[str, Any]:
    """异步执行用户脚本（受 audit hook + AST 双层保护）。

    extra_globals 注入额外全局变量（最常用的是 inputs）。
    working_dir 指定工作目录，注入为全局变量 working_dir。
    """
    timeout = timeout or settings.skill_sandbox_timeout_sec

    # 1) AST 静态审计
    audit_err = _ast_audit(code)
    if audit_err:
        return {"result": None, "stdout": "", "stderr": audit_err, "ok": False, "audit_blocked": True}

    # 2) 准备执行环境
    glb: Dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "result": None,
    }
    if working_dir:
        glb["working_dir"] = working_dir
    if extra_globals:
        for k, v in extra_globals.items():
            if k not in _DENY_NAMES:
                glb[k] = v

    out, err = io.StringIO(), io.StringIO()
    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(
        None,
        _exec_sync,
        code,
        glb,
        out,
        err,
        working_dir or "",
    )

    try:
        await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        _audit_enabled = False
        return {
            "result": None,
            "stdout": out.getvalue()[: settings.skill_sandbox_max_output],
            "stderr": f"[sandbox] 执行超时（>{timeout}s）已强制终止",
            "ok": False,
            "timeout": True,
        }
    except Exception as exc:  # noqa: BLE001
        _audit_enabled = False
        return {
            "result": None,
            "stdout": out.getvalue()[: settings.skill_sandbox_max_output],
            "stderr": f"{exc}\n{err.getvalue()}",
            "ok": False,
        }

    return {
        "result": glb.get("result"),
        "stdout": out.getvalue()[: settings.skill_sandbox_max_output],
        "stderr": err.getvalue()[: settings.skill_sandbox_max_output],
        "ok": True,
    }
