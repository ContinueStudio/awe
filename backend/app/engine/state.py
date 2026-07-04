"""执行引擎用的全局状态。

LangGraph 的状态在节点之间流转；AWE 的状态主要包括：
- inputs: 工作流初始入参
- outputs: {node_id: {port_name: value}}
- variables: 全局变量池（可跨节点共享）
- messages: LLM 对话历史
- logs: 节点执行日志（供前端实时流）
"""
from __future__ import annotations

from typing import Annotated, Any, Dict, List, TypedDict

from langgraph.graph import add_messages  # noqa: F401  保留供未来使用


def _merge_outputs(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    """合并不同节点的 outputs（覆盖式合并）。"""
    if not left:
        return dict(right or {})
    if not right:
        return dict(left)
    out = dict(left)
    out.update(right)
    return out


class RunState(TypedDict, total=False):
    """LangGraph 工作流运行时状态。"""

    inputs: Dict[str, Any]
    outputs: Annotated[Dict[str, Any], _merge_outputs]
    variables: Dict[str, Any]
    messages: List[Dict[str, Any]]
    logs: List[Dict[str, Any]]
    # 控制流
    next_node: str
    pending_human: bool
    pending_node: str
    pending_context: Dict[str, Any]
    # 终止
    finished: bool
    error: str
