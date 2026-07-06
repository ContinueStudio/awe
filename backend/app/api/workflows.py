"""工作流与节点 API。"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..core.database import db, _safe_json
from ..core.logger import get_logger
from ..engine.builder import WorkflowBuilder
from ..engine.state import RunState
from ..engine.validator import validate_graph
from ..nodes.registry import registry

logger = get_logger("awe.api.workflows")
router = APIRouter()


# ---------------- Pydantic 模型 ----------------


class WorkflowUpsert(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    graph: Dict[str, Any]


class RunStart(BaseModel):
    inputs: Dict[str, Any] = Field(default_factory=dict)


class RunNodes(BaseModel):
    """框选/部分节点运行。"""
    node_ids: List[str] = Field(..., min_length=1)
    inputs: Dict[str, Any] = Field(default_factory=dict)


class BatchDeleteRequest(BaseModel):
    ids: List[str]


class HumanDecision(BaseModel):
    decision: Any


# ---------------- 工具 ----------------


def _validate_or_400(graph: Dict[str, Any]) -> List[str]:
    from ..engine.validator import validate_graph

    errs = validate_graph(graph)
    if errs:
        raise HTTPException(status_code=400, detail={"errors": errs})
    return errs


# ---------------- 工作流 CRUD ----------------


@router.get("/nodes")
def list_nodes() -> Dict[str, Any]:
    """返回所有节点定义，供前端渲染节点面板 + AI 编排注入。"""
    return {
        "nodes": [n.to_dict() for n in registry.all()],
        "prompt": registry.to_prompt(),
    }


@router.get("/workflows")
def list_workflows() -> Dict[str, Any]:
    return {"workflows": db.list_workflows()}


@router.post("/workflows")
def upsert_workflow(body: WorkflowUpsert) -> Dict[str, Any]:
    _validate_or_400(body.graph)
    wid = db.save_workflow(body.name, body.graph, body.description, body.id)
    return {"id": wid}


@router.get("/workflows/{wid}")
def get_workflow(wid: str) -> Dict[str, Any]:
    wf = db.get_workflow(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")
    return wf


@router.delete("/workflows/{wid}")
def delete_workflow(wid: str) -> Dict[str, Any]:
    if not db.delete_workflow(wid):
        raise HTTPException(404, "workflow not found")
    return {"ok": True}


@router.post("/workflows/batch-delete")
def batch_delete_workflows(body: BatchDeleteRequest) -> Dict[str, Any]:
    """批量删除工作流。"""
    deleted = 0
    for wid in body.ids:
        if db.delete_workflow(wid):
            deleted += 1
    return {"ok": True, "deleted": deleted, "total": len(body.ids)}


@router.post("/workflows/validate")
def validate_workflow(body: WorkflowUpsert) -> Dict[str, Any]:
    errs = validate_graph(body.graph)
    return {"ok": not errs, "errors": errs}


# ---------------- 运行 ----------------


@router.post("/workflows/{wid}/run")
async def run_workflow(wid: str, body: RunStart) -> Dict[str, Any]:
    wf = db.get_workflow(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")
    try:
        builder = WorkflowBuilder(wf["graph"])
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    compiled, _ = builder.compile()
    run_id = db.start_run(wid, body.inputs)

    init_state: RunState = {
        "inputs": body.inputs,
        "outputs": {},
        "variables": {"__run_id__": run_id},
        "logs": [],
        "messages": [],
        "finished": False,
        "error": "",
    }

    try:
        # LangGraph 的 invoke 在节点内 await；外层跑在 asyncio 线程
        result = await compiled.ainvoke(init_state)
    except Exception as exc:  # noqa: BLE001
        logger.exception("工作流执行失败")
        db.update_run(run_id, status="failed", error=str(exc), finished=True)
        raise HTTPException(500, f"exec failed: {exc}")

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
    # 使用 _safe_json 防止 LangGraph state 中可能的环引用导致 Pydantic 序列化失败
    body = {
        "run_id": run_id,
        "status": status,
        "outputs": result.get("outputs", {}),
        "logs": result.get("logs", []),
        "error": result.get("error", ""),
    }
    return JSONResponse(content=json.loads(_safe_json(body)))


@router.post("/workflows/{wid}/nodes/{nid}/run")
async def run_single_node(wid: str, nid: str, body: RunStart) -> Dict[str, Any]:
    """单节点测试运行：仅执行指定节点的逻辑，不触发上下游。"""
    wf = db.get_workflow(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")

    graph = wf["graph"]
    node = next((n for n in graph.get("nodes", []) if n["id"] == nid), None)
    if not node:
        raise HTTPException(404, f"node {nid} not found")

    ntype = node["type"]
    ndef = registry.get(ntype)
    if not ndef:
        raise HTTPException(400, f"unknown node type: {ntype}")

    # 构建单节点图
    mini_graph = {"nodes": [node], "edges": []}
    try:
        builder = WorkflowBuilder(mini_graph)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    compiled, _ = builder.compile()
    run_id = db.start_run(wid, body.inputs)

    init_state: RunState = {
        "inputs": body.inputs,
        "outputs": {},
        "variables": {"__run_id__": run_id},
        "logs": [],
        "messages": [],
        "finished": False,
        "error": "",
    }

    try:
        result = await compiled.ainvoke(init_state)
    except Exception as exc:
        logger.exception("单节点执行失败")
        db.update_run(run_id, status="failed", error=str(exc), finished=True)
        raise HTTPException(500, f"exec failed: {exc}")

    status = "failed" if result.get("error") else "succeeded"
    db.update_run(
        run_id, status=status,
        state={"outputs": result.get("outputs", {}), "logs": result.get("logs", [])},
        error=result.get("error", ""), finished=True,
    )
    body_out = {
        "run_id": run_id, "status": status,
        "outputs": result.get("outputs", {}), "logs": result.get("logs", []),
        "error": result.get("error", ""),
    }
    return JSONResponse(content=json.loads(_safe_json(body_out)))


@router.post("/workflows/{wid}/run-selected")
async def run_selected_nodes(wid: str, body: RunNodes) -> Dict[str, Any]:
    """框选运行：仅执行指定的节点及其之间的边。"""
    wf = db.get_workflow(wid)
    if not wf:
        raise HTTPException(404, "workflow not found")

    graph = wf["graph"]
    selected = set(body.node_ids)
    all_nodes = graph.get("nodes", [])
    filtered = [n for n in all_nodes if n["id"] in selected]
    all_edges = graph.get("edges", [])
    filtered_edges = [e for e in all_edges if e["source"] in selected and e["target"] in selected]

    if not filtered:
        raise HTTPException(400, "没有选中任何节点")

    mini_graph = {"nodes": filtered, "edges": filtered_edges}
    try:
        builder = WorkflowBuilder(mini_graph)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    compiled, _ = builder.compile()
    run_id = db.start_run(wid, body.inputs)

    init_state: RunState = {
        "inputs": body.inputs, "outputs": {}, "variables": {"__run_id__": run_id},
        "logs": [], "messages": [], "finished": False, "error": "",
    }

    try:
        result = await compiled.ainvoke(init_state)
    except Exception as exc:
        logger.exception("框选运行失败")
        db.update_run(run_id, status="failed", error=str(exc), finished=True)
        raise HTTPException(500, f"exec failed: {exc}")

    status = "failed" if result.get("error") else "succeeded"
    db.update_run(
        run_id, status=status,
        state={"outputs": result.get("outputs", {}), "logs": result.get("logs", [])},
        error=result.get("error", ""), finished=True,
    )
    body_out = {
        "run_id": run_id, "status": status,
        "outputs": result.get("outputs", {}), "logs": result.get("logs", []),
        "error": result.get("error", ""),
    }
    return JSONResponse(content=json.loads(_safe_json(body_out)))


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> Dict[str, Any]:
    r = db.get_run(run_id)
    if not r:
        raise HTTPException(404, "run not found")
    return r


@router.get("/runs")
def list_runs(workflow_id: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    return {"runs": db.list_runs(workflow_id, limit)}


@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: str, body: HumanDecision) -> Dict[str, Any]:
    """人工审批通过后，从断点恢复执行。"""
    cp = db.get_latest_checkpoint(run_id)
    if not cp:
        raise HTTPException(404, "no checkpoint to resume")
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    wf = db.get_workflow(run["workflow_id"])
    if not wf:
        raise HTTPException(404, "workflow gone")

    try:
        builder = WorkflowBuilder(wf["graph"])
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    compiled, _ = builder.compile()

    state: RunState = {
        "inputs": run["inputs"],
        "outputs": cp["state"].get("outputs", {}),
        "variables": {**cp["state"].get("variables", {}), "__run_id__": run_id, "__decision__": body.decision},
        "logs": cp["state"].get("logs", []),
        "messages": [],
        "pending_human": False,
        "finished": False,
    }
    result = await compiled.ainvoke(state)
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
    return {
        "run_id": run_id,
        "status": status,
        "outputs": result.get("outputs", {}),
        "logs": result.get("logs", []),
    }
