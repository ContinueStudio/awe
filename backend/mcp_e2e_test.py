"""AWE MCP Server 端到端测试（用 stdio 启动 server，验证 tools 可调用）。

完整流程：
  1. 启动 AWE MCP Server（子进程，stdio 传输）
  2. initialize / list_tools
  3. list_nodes → 确认 12 节点
  4. save_workflow → 写入 webhook → LLM → end
  5. list_workflows / get_workflow
  6. run_workflow → 真实执行
  7. get_run / list_runs
"""
import asyncio
import json
import sys
import time
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

BACKEND = Path(__file__).resolve().parent
PYTHON = BACKEND / "venv" / "Scripts" / "python.exe"


def _dump(obj) -> str:
    """美化打印 MCP 返回内容。"""
    if hasattr(obj, "text"):
        try:
            return json.dumps(json.loads(obj.text), ensure_ascii=False, indent=2)
        except Exception:
            return obj.text
    return str(obj)


async def main():
    params = StdioServerParameters(
        command=str(PYTHON),
        args=["-m", "app.mcp_server"],
        cwd=str(BACKEND),
        env=None,
    )

    print("[mcp-e2e] starting AWE MCP Server (stdio) ...")
    t0 = time.time()
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            si = init.serverInfo
            print(f"[1] initialize OK: server={si.name} v{si.version} ({time.time()-t0:.1f}s)")

            tools = await session.list_tools()
            print(f"[2] list_tools: {len(tools.tools)} tools")
            for t in tools.tools:
                print(f"     - {t.name}: {t.description[:60] if t.description else ''}")

            # 3) list_nodes
            r = await session.call_tool("list_nodes", {})
            text = r.content[0].text if r.content else ""
            print(f"\n[3] list_nodes raw: isError={r.isError} text_len={len(text)} text_head={text[:100]!r}")
            if r.isError or not text:
                return
            nodes = json.loads(text)["nodes"]
            print(f"     {len(nodes)} 节点")
            for n in nodes[:4]:
                print(f"     - {n['type']:12s} {n['name']} | in:{len(n['inputs'])} out:{len(n['outputs'])}")
            assert len(nodes) == 12, f"expected 12 nodes, got {len(nodes)}"

            # 4) save_workflow
            graph = {
                "nodes": [
                    {"id": "n1", "type": "webhook", "config": {"path": "/mcp-hello"}},
                    {"id": "n2", "type": "llm",     "config": {
                        "model": "gpt-4o-mini",
                        "system": "用一句话回答问题。",
                        "prompt": "{{n1.outputs.body.prompt}}",
                    }},
                    {"id": "n3", "type": "end",     "config": {
                        "message": "Q:{{n1.outputs.body.prompt}} | A:{{n2.outputs.text}}"
                    }},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                ],
            }
            r = await session.call_tool("save_workflow", {
                "name": "mcp-hello-llm",
                "description": "通过 MCP 创建的工作流",
                "graph": graph,
            })
            wid = json.loads(r.content[0].text)["id"]
            print(f"\n[4] save_workflow: id={wid}")

            # 5) list_workflows / get_workflow
            r = await session.call_tool("list_workflows", {})
            wfs = json.loads(r.content[0].text)["workflows"]
            print(f"[5] list_workflows: {len(wfs)} 个，包含 mcp-hello-llm: {any(w['name']=='mcp-hello-llm' for w in wfs)}")
            r = await session.call_tool("get_workflow", {"workflow_id": wid})
            wf = json.loads(r.content[0].text)
            assert wf["id"] == wid
            assert len(wf["graph"]["nodes"]) == 3
            print(f"     get_workflow OK: name={wf['name']} nodes={len(wf['graph']['nodes'])} edges={len(wf['graph']['edges'])}")

            # 6) run_workflow - 真实跑
            print(f"\n[6] run_workflow: 真实执行中...")
            t0 = time.time()
            r = await session.call_tool("run_workflow", {
                "workflow_id": wid,
                "inputs": {"prompt": "用中文说'MCP 模式跑通了'"},
            })
            elapsed = time.time() - t0
            print(f"     raw response: type={type(r).__name__} isError={r.isError} content={r.content!r}")
            text = r.content[0].text if r.content else ""
            print(f"     text len: {len(text)}")
            if not text:
                print("     EMPTY content, dumping full r:")
                print(repr(r))
                return
            run = json.loads(text)
            print(f"     status:   {run['status']}  ({elapsed:.1f}s)")
            print(f"     run_id:   {run['run_id']}")
            print(f"     error:    {run.get('error') or '(none)'}")
            print(f"     outputs:")
            for nid, out in (run.get("outputs") or {}).items():
                if isinstance(out, dict):
                    sample = json.dumps(out, ensure_ascii=False)
                    if len(sample) > 200: sample = sample[:200] + "..."
                    print(f"       {nid}: {sample}")
                else:
                    print(f"       {nid}: {out}")
            print(f"     logs (per node):")
            for lg in run.get("logs", []):
                print(f"       - {lg['node']:6s} {lg['type']:8s} ok={lg['ok']} ms={lg.get('ms','?')}")
            assert run["status"] == "succeeded", f"run failed: {run}"

            # 7) get_run / list_runs
            r = await session.call_tool("get_run", {"run_id": run["run_id"]})
            persisted = json.loads(r.content[0].text)
            assert persisted["status"] == "succeeded"
            print(f"\n[7] get_run: status={persisted['status']} (持久化 OK)")

            r = await session.call_tool("list_runs", {"workflow_id": wid, "limit": 5})
            runs = json.loads(r.content[0].text)["runs"]
            print(f"     list_runs: {len(runs)} 条")
            for ri in runs:
                print(f"       - {ri['id'][:8]}.. status={ri['status']}")

            print("\n========================================")
            print(" ALL MCP TESTS PASSED")
            print("========================================")


if __name__ == "__main__":
    asyncio.run(main())
