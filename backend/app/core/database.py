"""SQLite 持久化层。

用于工作流定义、运行历史、断点快照、调度计划。
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from .config import settings
from .logger import get_logger

logger = get_logger("awe.db")

_LOCK = threading.Lock()


def _now() -> float:
    return time.time()


def _uuid() -> str:
    return uuid.uuid4().hex


SCHEMA = """
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    graph_json TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    inputs_json TEXT DEFAULT '{}',
    state_json TEXT DEFAULT '{}',
    error TEXT DEFAULT '',
    started_at REAL NOT NULL,
    finished_at REAL
);
CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);

CREATE TABLE IF NOT EXISTS checkpoints (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    saved_at REAL NOT NULL,
    PRIMARY KEY (run_id, node_id)
);

CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    cron TEXT NOT NULL,
    inputs_json TEXT DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL
);
"""


def _safe_json(obj: Any) -> str:
    """把对象安全地 JSON 化：剥离环引用 + 不可序列化对象转 str。"""
    seen: set[int] = set()

    def _clean(o: Any) -> Any:
        oid = id(o)
        if oid in seen:
            return None  # 切断环
        if isinstance(o, (str, int, float, bool, type(None))):
            return o
        if isinstance(o, dict):
            seen.add(oid)
            try:
                return {k: _clean(v) for k, v in o.items()}
            finally:
                seen.discard(oid)
        if isinstance(o, (list, tuple, set)):
            seen.add(oid)
            try:
                return [_clean(v) for v in o]
            finally:
                seen.discard(oid)
        # 不可序列化 -> 转字符串
        try:
            return str(o)
        except Exception:  # noqa: BLE001
            return None

    return json.dumps(_clean(obj), ensure_ascii=False, default=str)


class Database:
    """轻量 SQLite 包装，线程安全。"""

    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or settings.db_path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with _LOCK, self._conn() as conn:
            conn.executescript(SCHEMA)

    # ---------- workflow ----------

    def save_workflow(
        self,
        name: str,
        graph: Dict[str, Any],
        description: str = "",
        workflow_id: Optional[str] = None,
    ) -> str:
        wid = workflow_id or _uuid()
        graph_json = json.dumps(graph, ensure_ascii=False)
        now = _now()
        with _LOCK, self._conn() as conn:
            conn.execute(
                """
                INSERT INTO workflows(id,name,description,graph_json,created_at,updated_at)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    graph_json=excluded.graph_json,
                    updated_at=excluded.updated_at
                """,
                (wid, name, description, graph_json, now, now),
            )
        return wid

    def get_workflow(self, wid: str) -> Optional[Dict[str, Any]]:
        with _LOCK, self._conn() as conn:
            row = conn.execute("SELECT * FROM workflows WHERE id=?", (wid,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "graph": json.loads(row["graph_json"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def list_workflows(self) -> List[Dict[str, Any]]:
        """列出工作流，每个附 run_count / last_status / last_started_at。"""
        with _LOCK, self._conn() as conn:
            rows = conn.execute(
                """
                SELECT w.id, w.name, w.description, w.created_at, w.updated_at,
                       (SELECT COUNT(*) FROM runs r WHERE r.workflow_id = w.id) AS run_count,
                       (SELECT status    FROM runs r WHERE r.workflow_id = w.id ORDER BY started_at DESC LIMIT 1) AS last_status,
                       (SELECT started_at FROM runs r WHERE r.workflow_id = w.id ORDER BY started_at DESC LIMIT 1) AS last_started_at
                FROM workflows w
                ORDER BY w.updated_at DESC
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_workflow(self, wid: str) -> bool:
        """删除工作流，并级联清理其 runs / checkpoints / schedules。"""
        with _LOCK, self._conn() as conn:
            # 先清掉关联数据，避免悬空记录
            conn.execute("DELETE FROM checkpoints WHERE run_id IN (SELECT id FROM runs WHERE workflow_id=?)", (wid,))
            conn.execute("DELETE FROM runs WHERE workflow_id=?", (wid,))
            conn.execute("DELETE FROM schedules WHERE workflow_id=?", (wid,))
            cur = conn.execute("DELETE FROM workflows WHERE id=?", (wid,))
        return cur.rowcount > 0

    # ---------- run ----------

    def start_run(self, workflow_id: str, inputs: Dict[str, Any]) -> str:
        rid = _uuid()
        with _LOCK, self._conn() as conn:
            conn.execute(
                "INSERT INTO runs(id,workflow_id,status,inputs_json,started_at) VALUES(?,?,?,?,?)",
                (rid, workflow_id, "running", json.dumps(inputs, ensure_ascii=False), _now()),
            )
        return rid

    def update_run(
        self,
        run_id: str,
        *,
        status: Optional[str] = None,
        state: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        finished: bool = False,
    ) -> None:
        fields, args = [], []
        if status is not None:
            fields.append("status=?")
            args.append(status)
        if state is not None:
            fields.append("state_json=?")
            args.append(_safe_json(state))
        if error is not None:
            fields.append("error=?")
            args.append(error)
        if finished:
            fields.append("finished_at=?")
            args.append(_now())
        if not fields:
            return
        args.append(run_id)
        with _LOCK, self._conn() as conn:
            conn.execute(f"UPDATE runs SET {','.join(fields)} WHERE id=?", args)

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        with _LOCK, self._conn() as conn:
            row = conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "workflow_id": row["workflow_id"],
            "status": row["status"],
            "inputs": json.loads(row["inputs_json"]),
            "state": json.loads(row["state_json"]),
            "error": row["error"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
        }

    def list_runs(self, workflow_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with _LOCK, self._conn() as conn:
            if workflow_id:
                rows = conn.execute(
                    "SELECT id,workflow_id,status,started_at,finished_at FROM runs WHERE workflow_id=? ORDER BY started_at DESC LIMIT ?",
                    (workflow_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id,workflow_id,status,started_at,finished_at FROM runs ORDER BY started_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [dict(r) for r in rows]

    # ---------- checkpoint ----------

    def save_checkpoint(self, run_id: str, node_id: str, state: Dict[str, Any]) -> None:
        with _LOCK, self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO checkpoints(run_id,node_id,state_json,saved_at) VALUES(?,?,?,?)",
                (run_id, node_id, _safe_json(state), _now()),
            )

    def get_latest_checkpoint(self, run_id: str) -> Optional[Dict[str, Any]]:
        with _LOCK, self._conn() as conn:
            row = conn.execute(
                "SELECT node_id,state_json,saved_at FROM checkpoints WHERE run_id=? ORDER BY saved_at DESC LIMIT 1",
                (run_id,),
            ).fetchone()
        if not row:
            return None
        return {
            "node_id": row["node_id"],
            "state": json.loads(row["state_json"]),
            "saved_at": row["saved_at"],
        }


db = Database()
