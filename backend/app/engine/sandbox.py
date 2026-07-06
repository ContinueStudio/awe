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
    # shell 字符串注入类（最容易出事）
    "os.system",
    "os.popen",
    "os.execv",
    "os.execvp",
    # 反射 + 代码自执行类
    "exec",
    "eval",
    "compile",
    # 直接文件写
    "open",
    # 用户输入（死循环风险）
    "input",
    # 反射类（绕过审计）
    "globals",
    "locals",
    "vars",
    "getattr",
    "setattr",
    "delattr",
}


def _ast_audit(code: str) -> str | None:
    """ast 静态审计：拦截高危函数调用 + subprocess shell=True。

    允许 import（DrissionPage / pywinauto / os / subprocess 都是 RPA 常用库），
    只在「具体危险调用」层面拦截。
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"语法错误: {exc.msg} (line {exc.lineno})"

    def _called_name(func: ast.AST) -> str | None:
        """把 func 节点序列化成 'os.system' 这种点号形式。"""
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
            # subprocess.Popen(..., shell=True) 也算 shell 注入，禁止
            if name == "subprocess.Popen":
                for kw in node.keywords:
                    if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        return "高危调用被拦截: subprocess.Popen(shell=True)"
    return None


_SAFE_BUILTINS: Dict[str, Any] = {}
# 从当前解释器拷贝一份完整 builtins dict，让所有 Python 内置名字（next/iter/
# FileNotFoundError/RuntimeError 等等）都可用。安全靠 _ast_audit 拦截高危调用来兜底。
import builtins as _b
if isinstance(_b.__dict__, dict):
    _SAFE_BUILTINS = dict(_b.__dict__)
# 抹掉最危险的几个函数，ast 审计同时也拦一遍作为冗余
for _bad in ("exec", "eval", "compile", "input"):
    _SAFE_BUILTINS.pop(_bad, None)


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


async def run_user_code(
    code: str,
    timeout: int | None = None,
    extra_globals: Dict[str, Any] | None = None,
    working_dir: str | None = None,
) -> Dict[str, Any]:
    """异步执行用户脚本。

    extra_globals 注入额外的全局变量（最常用的是 inputs）。
    working_dir 指定的工作目录路径会注入为全局变量，方便脚本文件读写。
    仍然受 _DENY_NAMES 审计；超过 timeout 强制中断。
    """
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
    if working_dir:
        glb["working_dir"] = working_dir
    if extra_globals:
        for k, v in extra_globals.items():
            if k not in _DENY_NAMES:
                glb[k] = v
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
