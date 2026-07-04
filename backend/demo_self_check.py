"""通过 MCP 风格的 API 直接保存 + 跑一个最小工作流。"""
import asyncio
import json
import sys
import io

# Force UTF-8 stdout (Windows 默认 GBK 编码)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from app.core.database import db
from app.engine.builder import WorkflowBuilder
from app.engine.state import RunState

WORKFLOW = {
    "name": "AWE 自检 - Skill Hello World",
    "description": "no LLM, 只用 webhook -> skill -> end",
    "graph": {
        "nodes": [
            {"id": "n1", "type": "webhook", "config": {"path": "/self-check"}},
            {"id": "n2", "type": "skill", "config": {
                "code": "result = {'greeting': 'AWE 收到自检信号', 'length': 7, 'ok': True}",
                "timeout_sec": 5,
            }},
            {"id": "n3", "type": "end", "config": {"message": "✅ end 直接读取：payload={{n2.outputs.result}}"}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
        ],
    },
}


async def main():
    # 跑 3 次让用户能看到运行历史
    for i in range(3):
        wid = db.save_workflow(WORKFLOW["name"], WORKFLOW["graph"], WORKFLOW["description"])
        print(f"[1.{i+1}] saved workflow_id={wid}")
        wf = db.get_workflow(wid)
        builder = WorkflowBuilder(wf["graph"])
        compiled, order = builder.compile()
        print(f"[2.{i+1}] compiled topo order = {order}")
        run_id = db.start_run(wid, {})
        init_state: RunState = {
            "inputs": {"text": f"第 {i+1} 次自检信号"},
            "outputs": {},
            "variables": {"__run_id__": run_id},
            "logs": [],
            "messages": [],
            "finished": False,
            "error": "",
        }
        try:
            result = await compiled.ainvoke(init_state)
            status = "failed" if result.get("error") else "succeeded"
            db.update_run(
                run_id,
                status=status,
                state={"outputs": result.get("outputs", {}), "logs": result.get("logs", [])},
                error=result.get("error", ""),
                finished=True,
            )
            print(f"[3.{i+1}] run_id={run_id[:8]}  status={status}")
        except Exception as exc:
            print(f"[3.{i+1}] EXEC EXCEPTION: {exc}")
            db.update_run(run_id, status="failed", error=str(exc), finished=True)
            raise
        print()

    # 最后清理掉前两次的旧 workflow（让用户只看到最新的 1 个）
    # 找所有同名的 wf，按 last_started_at 倒序，保留最新，删旧的
    all_wfs = sorted(db.list_workflows(), key=lambda w: w.get("last_started_at") or 0, reverse=True)
    print(f"[final] {len(all_wfs)} workflows exist")
    for w in all_wfs:
        print(f"  {w['id'][:8]}..  {w['name']}  last={w.get('last_status')}  started={w.get('last_started_at')}")


if __name__ == "__main__":
    asyncio.run(main())
