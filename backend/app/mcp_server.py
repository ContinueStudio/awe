"""AWE MCP Server（Mode B：标准 MCP Server，stdIO 传输）。

把 AWE 工作流引擎的能力以 MCP tools 形式暴露给外部 Client：
- list_nodes：12 节点字典
- list_workflows：工作流列表
- get_workflow：工作流详情
- save_workflow：创建/更新工作流
- run_workflow：执行工作流
- get_run：运行结果
- list_runs：运行历史

启动方式：
    python -m app.mcp_server          # stdio
    python -m app.mcp_server --http   # streamable-http（默认 :8766）
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

from .core.database import db, _safe_json
from .core.logger import get_logger
from .engine.builder import WorkflowBuilder
from .engine.state import RunState
from .nodes.registry import registry
from .engine.validator import validate_graph

logger = get_logger("awe.mcp")


def _redirect_root_logger_to_stderr() -> None:
    """MCP stdio 协议要求 stdout 只能输出 JSON-RPC 帧。

    把 root logger 重新指向 stderr，并移除其他可能写 stdout 的 handler，
    避免污染 stdio 通信。
    """
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    h = logging.StreamHandler(sys.stderr)
    h.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"))
    root.addHandler(h)
    root.setLevel(logging.INFO)
    # 重置 awe.* logger（继承 root 后会走 stderr）
    for name in list(logging.Logger.manager.loggerDict):
        if name.startswith("awe"):
            lg = logging.getLogger(name)
            for hh in list(lg.handlers):
                lg.removeHandler(hh)
            lg.propagate = True


_redirect_root_logger_to_stderr()

mcp = FastMCP(
    name="awe-workflow",
    instructions=(
        "AWE - Agentic Workflow Engine. 通过这些工具可创建、保存、运行工作流，"
        "以及查询节点字典与运行历史。"
    ),
)


# ---------------- 工具函数 ----------------


def _ok(payload: Any) -> str:
    """把 Python 对象序列化为 JSON 字符串返回给 MCP client。

    使用 _safe_json 防止 LangGraph state 中可能的环引用。
    注意：_safe_json 内部已 ensure_ascii=False。
    """
    return _safe_json(payload)


def _err(msg: str) -> str:
    return json.dumps({"error": msg}, ensure_ascii=False)


# ---------------- Tools ----------------


@mcp.tool()
def list_nodes() -> str:
    """返回 AWE 支持的所有原子节点定义（含 inputs/outputs/config_schema）。"""
    return _ok({
        "nodes": [n.to_dict() for n in registry.all()],
        "prompt": registry.to_prompt(),
    })


@mcp.tool()
def list_workflows() -> str:
    """列出所有已保存的工作流（按更新时间倒序）。"""
    return _ok({"workflows": db.list_workflows()})


@mcp.tool()
def get_workflow(workflow_id: str) -> str:
    """获取工作流详情（含完整 graph）。"""
    wf = db.get_workflow(workflow_id)
    if not wf:
        return _err(f"workflow not found: {workflow_id}")
    return _ok(wf)


@mcp.tool()
def save_workflow(
    name: str,
    graph: Dict[str, Any],
    description: str = "",
    workflow_id: Optional[str] = None,
) -> str:
    """创建或更新工作流。

    参数:
        name: 工作流名称
        graph: 图谱 JSON，格式 {"nodes":[...], "edges":[...]}
        description: 描述（可选）
        workflow_id: 已存在 id 时为更新，否则为新建（可选）
    """
    errs = validate_graph(graph)
    if errs:
        return _err("图谱校验失败: " + "; ".join(errs))
    wid = db.save_workflow(name, graph, description, workflow_id)
    return _ok({"id": wid, "name": name, "updated": True})


@mcp.tool()
def validate_workflow(graph: Dict[str, Any]) -> str:
    """校验图谱结构（节点类型、必填字段、模板引用拓扑）。"""
    return _ok({"ok": True, "errors": [], "result": validate_graph(graph)})


@mcp.tool()
async def run_workflow(workflow_id: str, inputs: Optional[Dict[str, Any]] = None) -> str:
    """执行一个已保存的工作流，返回最终 outputs + logs。

    内部走 LangGraph StateGraph 编译 + ainvoke。
    """
    wf = db.get_workflow(workflow_id)
    if not wf:
        return _err(f"workflow not found: {workflow_id}")
    inputs = inputs or {}
    try:
        builder = WorkflowBuilder(wf["graph"])
        compiled, _ = builder.compile()
    except ValueError as exc:
        return _err(f"compile failed: {exc}")

    run_id = db.start_run(workflow_id, inputs)
    init_state: RunState = {
        "inputs": inputs,
        "outputs": {},
        "variables": {"__run_id__": run_id},
        "logs": [],
        "messages": [],
        "finished": False,
        "error": "",
    }
    try:
        result = await compiled.ainvoke(init_state)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MCP run_workflow 执行失败")
        db.update_run(run_id, status="failed", error=str(exc), finished=True)
        return _err(f"exec failed: {exc}")
    status = "failed" if result.get("error") else "succeeded"
    db.update_run(
        run_id,
        status=status,
        state={
            "outputs": result.get("outputs", {}),
            "logs": result.get("logs", []),
        },
        error=result.get("error", ""),
        finished=True,
    )
    return _ok({
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "outputs": result.get("outputs", {}),
        "logs": result.get("logs", []),
        "error": result.get("error", ""),
    })


@mcp.tool()
def get_run(run_id: str) -> str:
    """获取某次运行的完整记录（状态、输出、日志、错误）。"""
    r = db.get_run(run_id)
    if not r:
        return _err(f"run not found: {run_id}")
    return _ok(r)


@mcp.tool()
def list_runs(workflow_id: Optional[str] = None, limit: int = 20) -> str:
    """列出运行历史；可按 workflow_id 过滤。"""
    return _ok({"runs": db.list_runs(workflow_id, limit)})


# ---------------- 入口 ----------------


def main() -> None:
    """启动 MCP Server。

    --stdio（默认）：标准输入输出，适配 Claude Desktop / Cursor / Trae 等 MCP Client
    --http       : 走 streamable-http，监听 127.0.0.1:8766/mcp
    """
    parser = argparse.ArgumentParser(description="AWE MCP Server (Mode B)")
    parser.add_argument("--http", action="store_true", help="用 streamable-http 传输")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()

    logger.info("AWE MCP Server 启动: transport=%s host=%s port=%s",
                "streamable-http" if args.http else "stdio", args.host, args.port)
    if args.http:
        # FastMCP 0.x 用 run("streamable-http")；host/port 通过构造设置
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
