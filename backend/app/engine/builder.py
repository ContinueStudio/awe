"""LangGraph StateGraph 构建器。
把前端传入的图谱 JSON 编译为可执行的 StateGraph。
每个 AWE 节点对应一个 LangGraph 节点函数 (执行单元)。
"""
from __future__ import annotations

import asyncio
import json
import time
import traceback
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from langgraph.graph import END, StateGraph

from ..core.database import db
from ..core.logger import get_logger
from ..nodes.registry import registry
from .state import RunState
from .validator import validate_graph

logger = get_logger("awe.engine")

NodeRunner = Callable[[Dict[str, Any], RunState, str], Awaitable[Dict[str, Any]]]
# 参数: (node_def, state, run_id) -> outputs dict


class WorkflowBuilder:
    """从画布 JSON 编译出可执行 LangGraph 图。"""

    def __init__(self, graph: Dict[str, Any]) -> None:
        self.graph = graph
        self.errors: List[str] = validate_graph(graph)
        if self.errors:
            raise ValueError("图谱校验失败:\n  - " + "\n  - ".join(self.errors))

    # ---------- 节点执行器 ----------

    async def _run_node(
        self,
        node: Dict[str, Any],
        state: RunState,
        run_id: str,
    ) -> Dict[str, Any]:
        nid = node["id"]
        ntype = node["type"]
        ndef = registry.get(ntype)
        cfg = (node.get("config") or {}).copy()
        # 模板渲染：把 {{a.outputs.x}} 替换为 state['outputs'][a][x]
        try:
            cfg = _render_templates(cfg, state)
        except Exception as exc:  # noqa: BLE001
            logger.warning("模板渲染失败: %s", exc)

        # 不同节点类型的执行
        if ntype == "webhook":
            outputs = {"body": state.get("inputs", {})}
        elif ntype == "end":
            # 优先使用 config.message（已渲染过模板）作为响应；
            # 未配置时退到 state.outputs（兼容旧用法）。
            msg = (cfg or {}).get("message")
            outputs = {"payload": msg if msg else state.get("variables", {}).get("__final__", state.get("outputs", {}))}
        elif ntype == "llm":
            outputs = await _run_llm(cfg)
        elif ntype == "intent":
            outputs = await _run_intent(cfg)
        elif ntype == "extract":
            outputs = await _run_extract(cfg)
        elif ntype == "rewrite":
            outputs = await _run_rewrite(cfg)
        elif ntype == "knowledge":
            outputs = await _run_knowledge(cfg)
        elif ntype == "sqlite":
            outputs = await _run_sqlite(cfg)
        elif ntype == "http":
            outputs = await _run_http(cfg)
        elif ntype == "mcp":
            outputs = {"result": {"stub": True, "tool": cfg.get("tool"), "args": cfg.get("args")}}
        elif ntype == "skill":
            # 把当前节点所有上游 outputs 合并，作为 Skill 沙盒的 inputs
            # edges 通过 compile() 缓存在 self._edges_cache 上（闭包共享）
            upstream: Dict[str, Any] = {}
            for e in getattr(self, "_edges_cache", []):
                if e.get("target") == nid:
                    src_out = state.get("outputs", {}).get(e["source"])
                    if src_out is not None:
                        upstream[e["source"]] = src_out
            outputs = await _run_skill(cfg, upstream)
        elif ntype == "human":
            # 人类审批：挂起；前端需要调用 /runs/{id}/resume
            state["pending_human"] = True
            state["pending_node"] = nid
            state["pending_context"] = cfg
            outputs = {"__pending__": True}
            db.save_checkpoint(run_id, nid, state)
        else:
            outputs = {"__unknown__": ntype}

        return {nid: outputs}

    # ---------- 编译 ----------

    def compile(self) -> Tuple[Any, List[str]]:
        """返回 (compiled_graph, execution_order)。

        - compiled_graph: LangGraph 可执行对象
        - execution_order: 节点执行顺序（用于断点恢复）
        """
        nodes: List[Dict[str, Any]] = self.graph["nodes"]
        edges: List[Dict[str, Any]] = self.graph["edges"]
        # 把 edges 缓存在 self 上，给 _run_node 用（避免改函数签名影响 LangGraph 节点包装）
        self._edges_cache = edges

        order = _topo_order(nodes, edges)
        start = order[0] if order else "__start__"

        sg = StateGraph(RunState)
        # 注册节点
        for n in nodes:
            nid = n["id"]
            sg.add_node(nid, _make_node_fn(self._run_node, n, db))
        # 入口
        sg.set_entry_point(start)
        # 边
        succ_map: Dict[str, List[str]] = {n["id"]: [] for n in nodes}
        for e in edges:
            succ_map[e["source"]].append(e["target"])
        for src, tgts in succ_map.items():
            if not tgts:
                sg.add_edge(src, END)
            elif len(tgts) == 1:
                sg.add_edge(src, tgts[0])
            else:
                # 条件路由：暂用首个分支；后续可基于 intent 输出做动态路由
                sg.add_conditional_edges(
                    src,
                    _pick_branch_factory(tgts),
                    {t: t for t in tgts},
                )
        compiled = sg.compile()
        return compiled, order


def _make_node_fn(
    runner: NodeRunner,
    node: Dict[str, Any],
    _db,
) -> Callable[[RunState], Awaitable[RunState]]:
    """将节点执行包装为 LangGraph 节点函数。"""

    async def _fn(state: RunState) -> RunState:
        run_id = state.get("variables", {}).get("__run_id__", "")
        nid = node["id"]
        # 人类挂起时跳过再执行
        if state.get("pending_human") and state.get("pending_node") != nid:
            return state
        try:
            t0 = time.time()
            out = await runner(node, state, run_id)
            dt = round((time.time() - t0) * 1000)
            state.setdefault("outputs", {})
            state["outputs"].update(out)
            state.setdefault("logs", []).append(
                {"node": nid, "type": node["type"], "ok": True, "ms": dt, "ts": time.time()}
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("节点 %s 执行失败", nid)
            state.setdefault("logs", []).append(
                {
                    "node": nid,
                    "type": node["type"],
                    "ok": False,
                    "error": str(exc),
                    "trace": traceback.format_exc(limit=4),
                    "ts": time.time(),
                }
            )
            state["error"] = f"{nid}: {exc}"
            # 立即终止：写入错误并切到 END（由条件边处理）
            state["finished"] = True
        return state

    return _fn


def _pick_branch_factory(branches: List[str]):
    """简易分支选择器：从 state.outputs 中找 label 对应分支。"""

    async def _pick(state: RunState) -> str:
        return branches[0]

    return _pick


# ---------------- 节点执行实现（最小可用） ----------------


def _render_templates(obj: Any, state: RunState) -> Any:
    """递归替换字符串中的 `{{a.outputs.b.c}}`。

    - `a` 是节点 id
    - `b.c` 支持点号嵌套路径，逐层取 dict/list
    - 找不到路径或值非标量时替换为空字符串
    """
    import re

    pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\.outputs\.([a-zA-Z0-9_.\[\]\"']+)\s*\}\}")

    def _resolve(root: Any, path: str) -> Any:
        """按点号路径从 root 解析值，支持 [n] / ['k'] 下标。"""
        cur: Any = root
        # 把路径切成段：'a.b[0].c' → ['a','b[0]','c']
        parts = re.findall(r"[a-zA-Z0-9_]+|\[[^\]]+\]", path)
        for seg in parts:
            if cur is None:
                return None
            if seg.startswith("[") and seg.endswith("]"):
                key = seg[1:-1].strip().strip("'\"")
                if isinstance(cur, dict):
                    cur = cur.get(key)
                elif isinstance(cur, (list, tuple)):
                    try:
                        cur = cur[int(key)]
                    except (ValueError, IndexError):
                        return None
                else:
                    return None
            else:
                if isinstance(cur, dict):
                    cur = cur.get(seg)
                else:
                    return None
        return cur

    def _sub(s: str) -> str:
        def repl(m: re.Match) -> str:
            uid, port_path = m.group(1), m.group(2)
            node_out = (state.get("outputs") or {}).get(uid)
            if node_out is None:
                return ""
            val = _resolve(node_out, port_path)
            if val is None:
                return ""
            if isinstance(val, (dict, list)):
                return json.dumps(val, ensure_ascii=False)
            return str(val)
        return pattern.sub(repl, s)

    if isinstance(obj, str):
        return _sub(obj)
    if isinstance(obj, dict):
        return {k: _render_templates(v, state) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_render_templates(v, state) for v in obj]
    return obj


async def _run_llm(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """通过 LiteLLM 调用大模型（API Key 缺失时降级为 stub）。"""
    prompt = cfg.get("prompt") or cfg.get("system") or ""
    model = cfg.get("model") or "gpt-4o-mini"
    try:
        from litellm import acompletion  # type: ignore

        resp = await acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=cfg.get("temperature", 0.7),
        )
        text = resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM 调用降级为 stub: %s", exc)
        text = f"[stub:{model}] echo: {prompt[:200]}"
    return {"text": text}


async def _run_intent(cfg: Dict[str, Any]) -> Dict[str, Any]:
    labels = cfg.get("labels") or ["default"]
    text = cfg.get("text") or ""
    # 简化实现：返回第一个标签；真实实现走 LLM
    return {"label": labels[0], "text": text}


async def _run_extract(cfg: Dict[str, Any]) -> Dict[str, Any]:
    schema = cfg.get("schema") or {}
    return {"data": {"_stub": True, "_schema_keys": list(schema.keys())}}


async def _run_rewrite(cfg: Dict[str, Any]) -> Dict[str, Any]:
    q = cfg.get("query") or ""
    return {"query": q}


async def _run_knowledge(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """ChromaDB 读写（依赖缺失时降级 stub）。"""
    try:
        import chromadb  # type: ignore

        client = chromadb.PersistentClient(path=str(_chroma_path()))
        coll = client.get_or_create_collection(cfg.get("collection") or "default")
        if cfg.get("operation") == "upsert":
            coll.add(documents=[cfg.get("text", "")], ids=[str(time.time())])
            return {"docs": []}
        res = coll.query(query_texts=[cfg.get("text", "")], n_results=cfg.get("top_k", 4))
        return {"docs": (res.get("documents") or [[]])[0]}
    except Exception as exc:  # noqa: BLE001
        logger.info("ChromaDB 不可用，返回 stub: %s", exc)
        return {"docs": []}


def _chroma_path():
    from ..core.config import settings
    return settings.chroma_path


async def _run_sqlite(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """在 AWE 自己的 db 中执行简单 SQL（仅供演示）。"""
    import sqlite3

    op = cfg.get("operation", "select")
    table = cfg.get("table")
    if not table:
        return {"rows": []}
    sql_path = db.path
    conn = sqlite3.connect(sql_path)
    try:
        if op == "select":
            cur = conn.execute(f"SELECT * FROM {table} LIMIT 100")
            cols = [c[0] for c in cur.description] if cur.description else []
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            return {"rows": rows}
        if op == "insert":
            data = cfg.get("data") or {}
            cols_s = ", ".join(data.keys())
            qs = ", ".join(["?"] * len(data))
            conn.execute(f"INSERT INTO {table}({cols_s}) VALUES({qs})", list(data.values()))
            conn.commit()
            return {"rows": [{"affected": 1}]}
    except Exception as exc:  # noqa: BLE001
        return {"rows": [], "error": str(exc)}
    finally:
        conn.close()
    return {"rows": []}


async def _run_http(cfg: Dict[str, Any]) -> Dict[str, Any]:
    import httpx  # type: ignore

    method = cfg.get("method", "GET").upper()
    url = cfg.get("url", "")
    if not url:
        return {"response": {"error": "url is required"}}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.request(method, url, headers=cfg.get("headers"), json=cfg.get("body"))
        try:
            data = r.json()
        except Exception:  # noqa: BLE001
            data = r.text
        return {"response": {"status": r.status_code, "data": data}}
    except Exception as exc:  # noqa: BLE001
        return {"response": {"error": str(exc)}}


async def _run_skill(cfg: Dict[str, Any], upstream: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """受限 Python 沙盒：基于 RestrictedPython + 超时阻断。

    `upstream` 是该 Skill 节点的所有上游节点的 outputs 合并 dict（key=node_id），
    作为沙盒里的 `inputs` 变量暴露给用户脚本。例如上游是 n1=webhook / n2=skill，
    沙盒里就能 `inputs = {"n1": {...}, "n2": {...}}`。
    """
    from .sandbox import run_user_code

    code = cfg.get("code", "")
    timeout = int(cfg.get("timeout_sec") or 30)
    # 把 upstream 包成带 inputs 键的 dict，跟 _run_skill 调用点对齐
    sandbox_inputs = {"inputs": upstream or {}}
    return await run_user_code(code, timeout=timeout, extra_globals=sandbox_inputs)


def _topo_order(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[str]:
    from collections import defaultdict, deque

    indeg = {n["id"]: 0 for n in nodes}
    adj: Dict[str, List[str]] = defaultdict(list)
    for e in edges:
        if e.get("source") in indeg and e.get("target") in indeg:
            adj[e["source"]].append(e["target"])
            indeg[e["target"]] += 1
    q = deque([nid for nid, d in indeg.items() if d == 0])
    order: List[str] = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    # 若有环，剩余节点按原序追加（兜底）
    if len(order) < len(indeg):
        rest = [nid for nid in indeg if nid not in order]
        order.extend(rest)
    return order
