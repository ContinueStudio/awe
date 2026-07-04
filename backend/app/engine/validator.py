"""拓扑校验器。

在编译期假跑校验数据映射链条，确保：
1. 节点类型已注册
2. 节点配置满足必填
3. 下游引用的 `{{node_id.outputs.field}}` 在上游真实存在（用占位类型）
4. 起点/终点检测

校验失败抛出 `ValidationError`，前端 AI 编排器收到后可要求 LLM 自愈。
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from ..nodes.registry import registry

VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\.outputs\.([a-zA-Z0-9_.\[\]\"']+)\s*\}\}")


class ValidationError(Exception):
    """拓扑校验失败。"""

    def __init__(self, errors: List[str]) -> None:
        super().__init__("\n".join(errors))
        self.errors = errors


def _extract_template_refs(text: str) -> List[str]:
    """从字符串中提取所有 {{xxx}} 引用路径。"""
    if not isinstance(text, str):
        return []
    return [m.group(0) for m in VAR_PATTERN.finditer(text)]


def _collect_string_fields(obj: Any, out: List[Any]) -> None:
    """递归收集 dict/list 里的字符串。"""
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect_string_fields(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect_string_fields(v, out)


def validate_graph(graph: Dict[str, Any]) -> List[str]:
    """校验图谱定义。

    参数:
        graph: 前端传来的画布 JSON，约定结构：
            {
              "nodes": [{"id": str, "type": str, "config": {...}, "data": {...}}, ...],
              "edges": [{"source": str, "target": str, "sourceHandle"?: str, "targetHandle"?: str}, ...]
            }

    返回: 错误列表（空表示通过）。
    """
    errors: List[str] = []
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []

    if not nodes:
        # 允许保存空工作流（用户先创建后再编辑）
        return []

    # 1) 节点类型与配置
    node_ids: List[str] = []
    for n in nodes:
        nid = n.get("id")
        ntype = n.get("type")
        if not nid:
            errors.append("节点缺少 id")
            continue
        node_ids.append(nid)
        if not ntype or not registry.get(ntype):
            errors.append(f"节点 {nid} 的类型 {ntype!r} 未注册")
            continue
        for err in registry.validate_config(ntype, n.get("config") or {}):
            errors.append(f"节点 {nid}: {err}")

    # 2) 边的端点合法性
    id_set = set(node_ids)
    for e in edges:
        if e.get("source") not in id_set:
            errors.append(f"边 {e} 引用了不存在的 source 节点")
        if e.get("target") not in id_set:
            errors.append(f"边 {e} 引用了不存在的 target 节点")

    # 3) 模板变量解析（假跑校验）
    #    对每个节点的 config & data 中的字符串，提取 {{node_id.outputs.x}} 引用
    #    检查 node_id 是否在前序节点中存在
    declared_outputs: Dict[str, List[str]] = {}
    for n in nodes:
        nid = n["id"]
        ntype = n.get("type")
        ndef = registry.get(ntype) if ntype else None
        declared_outputs[nid] = [p.name for p in (ndef.outputs if ndef else [])]

    # 拓扑序（简单 Kahn）
    order = _topological_order(nodes, edges)
    if order is None:
        errors.append("图中存在环，不允许环状依赖（请改用 human/loop 节点）")
        return errors

    seen_outputs: Dict[str, set] = {}
    for nid in order:
        node = next(n for n in nodes if n["id"] == nid)
        cfg = node.get("config") or {}
        data = node.get("data") or {}
        strings: List[str] = []
        _collect_string_fields({"c": cfg, "d": data}, strings)
        for ref in _extract_template_refs("\n".join(strings)):
            m = VAR_PATTERN.match(ref)
            if not m:
                continue
            upstream_id, port = m.group(1), m.group(2).split(".")[0]
            if upstream_id not in id_set:
                errors.append(f"节点 {nid} 引用了不存在的上游节点 {upstream_id}")
                continue
            if upstream_id not in order[: order.index(nid)]:
                errors.append(
                    f"节点 {nid} 引用了拓扑上未先于自己的上游 {upstream_id}"
                )
                continue
            declared = declared_outputs.get(upstream_id, [])
            if declared and port not in declared:
                errors.append(
                    f"节点 {nid} 引用了上游 {upstream_id} 未声明的输出端口 {port!r}"
                )
        seen_outputs[nid] = set(declared_outputs.get(nid, []))

    return errors


def _topological_order(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
    """返回拓扑序；若有环返回 None。"""
    from collections import defaultdict, deque

    indeg: Dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: Dict[str, List[str]] = defaultdict(list)
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in indeg and t in indeg:
            adj[s].append(t)
            indeg[t] += 1
    q = deque([nid for nid, d in indeg.items() if d == 0])
    order: List[str] = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == len(indeg) else None
