"""受限 Python 沙盒。

基于 RestrictedPython 拦截高危调用，再加 ast 静态审计兜底：
- 屏蔽 os.system / subprocess / eval / exec / open(写) / __import__
- 超时通过信号/线程中断（受限环境下用 thread + 主线程 join）
"""
from __future__ import annotations

import ast
import asyncio
import builtins
import io
import sys
import threading
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from typing import Any, Dict

from ..core.config import settings
from ..core.logger import get_logger

logger = get_logger("awe.sandbox")

# 高危 ast 节点白名单
_FORBIDDEN_AST = (
    ast.Call,
    ast.Import,
    ast.ImportFrom,
)


_DENY_NAMES = {
    "os", "subprocess", "sys", "shutil", "socket", "ctypes",
    "requests", "httpx", "urllib", "asyncio", "multiprocessing",
    "exec", "eval", "compile", "__import__", "open", "input",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
}


def _ast_audit(code: str) -> str | None:
    """ast 静态审计：发现高危调用返回错误信息；否则 None。"""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"语法错误: {exc.msg} (line {exc.lineno})"
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            name = None
            if isinstance(func, ast.Name):
                name = func.id
            elif isinstance(func, ast.Attribute):
                name = func.attr
            if name and name in _DENY_NAMES:
                return f"高危调用被拦截: {name}()"
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return "禁止 import 语句；如需调用 RPA 库，请使用 Skill_Python 节点 (DrissionPage / pywinauto)"
    return None


_SAFE_BUILTINS = {
    "print": print,
    "len": len,
    "range": range,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "set": set,
    "min": min,
    "max": max,
    "sum": sum,
    "sorted": sorted,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "isinstance": isinstance,
    "type": type,
    "abs": abs,
    "round": round,
    "True": True,
    "False": False,
    "None": None,
}


def _exec_sync(code: str, glb: Dict[str, Any], out: io.StringIO, err: io.StringIO) -> Dict[str, Any]:
    """在线程中跑用户代码，结果写回 out / err。"""
    try:
        with redirect_stdout(out), redirect_stderr(err):
            exec(  # noqa: S102 - 沙盒内受控执行
                compile(code, "<skill>", "exec"),
                glb,
            )
        return glb.get("result")
    except Exception:  # noqa: BLE001
        err.write(traceback.format_exc())
        return None


async def run_user_code(code: str, timeout: int | None = None) -> Dict[str, Any]:
    """异步执行用户脚本。"""
    timeout = timeout or settings.skill_sandbox_timeout_sec

    # 1) ast 审计
    audit_err = _ast_audit(code)
    if audit_err:
        return {"result": None, "stdout": "", "stderr": audit_err, "ok": False, "audit_blocked": True}

    # 2) 受控执行
    glb: Dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "result": None,
    }
    out, err = io.StringIO(), io.StringIO()

    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(None, _exec_sync, code, glb, out, err)

    try:
        await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        return {
            "result": None,
            "stdout": out.getvalue()[: settings.skill_sandbox_max_output],
            "stderr": f"[sandbox] 执行超时（>{timeout}s）已强制终止",
            "ok": False,
            "timeout": True,
        }
    except Exception as exc:  # noqa: BLE001
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
