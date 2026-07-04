"""AI Agent 通过 MCP 编排 AWE 的端到端演示。

模拟场景：
  假设有一个 AI Agent（无 LLM，决策用脚本内置），它：
  1. 通过 MCP list_nodes 拿节点字典
  2. 决策出一个 4 节点工作流（webhook → 意图分类 → 两条分支 → end）
  3. 通过 MCP save_workflow 写入数据库
  4. 通过 MCP run_workflow 真实执行
  5. 通过 MCP get_run 拿结果

通过 streamable-http 传输（与 stdio 行为完全一致，但走 HTTP）。
"""
import asyncio
import json
import sys
import time
from pathlib import Path

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

MCP_URL = "http://127.0.0.1:8766/mcp"


def banner(s: str) -> None:
    bar = "=" * 60
    print(f"\n{bar}\n  {s}\n{bar}")


async def main() -> None:
    banner("AI Agent → AWE MCP Server (streamable-http)")
    print(f"  server: {MCP_URL}")

    async with streamablehttp_client(MCP_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            si = init.serverInfo
            print(f"  connected: {si.name} v{si.version}")

            # ── 1. 决策步骤：先看节点字典 ─────────────────────────
            banner("STEP 1 · Agent 用 list_nodes 拿到节点字典")
            r = await session.call_tool("list_nodes", {})
            catalog = json.loads(r.content[0].text)
            nodes = catalog["nodes"]
            print(f"  节点共 {len(nodes)} 个；Agent 选定以下节点类型：")
            for want in ["webhook", "intent", "llm", "end"]:
                n = next(x for x in nodes if x["type"] == want)
                print(f"    ✓ {n['type']:10s} {n['name']:8s} | in:{len(n['inputs'])} out:{len(n['outputs'])}")

            # ── 2. 决策：构建一个"中文问候 vs 询问"分支工作流 ─────
            banner("STEP 2 · Agent 决策工作流（模拟 LLM 输出）")
            workflow = {
                "name": "ai-agent-demo-中文问候与询问分流",
                "description": "AI Agent 通过 MCP 自动编排的演示工作流：用户输入走意图分类，"
                               "问候走 friendly 分支（llm_1 + end_hi），询问走 informative 分支（llm_2 + end_ans）。",
                "graph": {
                    "nodes": [
                        {"id": "n1", "type": "webhook", "config": {"path": "/agent"}},
                        {"id": "n2", "type": "intent",  "config": {
                            "labels": ["greet", "ask", "other"],
                            "text": "{{n1.outputs.body.text}}",
                        }},
                        {"id": "n3", "type": "llm",     "config": {
                            "model": "gpt-4o-mini",
                            "system": "你是一个热情的中文客服，专管问候。",
                            "prompt": "用户说：{{n1.outputs.body.text}}。请用一句热情的中文回应。",
                        }},
                        {"id": "n4", "type": "llm",     "config": {
                            "model": "gpt-4o-mini",
                            "system": "你是一个知识渊博的中文助理，专管回答问题。",
                            "prompt": "用户问：{{n1.outputs.body.text}}。请用一段简洁中文回答。",
                        }},
                        {"id": "n5", "type": "end",     "config": {
                            "message": "👋 客服回复：{{n3.outputs.text}}",
                        }},
                        {"id": "n6", "type": "end",     "config": {
                            "message": "📚 知识回答：{{n4.outputs.text}}",
                        }},
                    ],
                    "edges": [
                        {"id": "e1", "source": "n1", "target": "n2"},
                        {"id": "e2", "source": "n2", "target": "n3"},  # intent -> 走问候分支
                        {"id": "e3", "source": "n3", "target": "n5"},
                        {"id": "e4", "source": "n2", "target": "n4"},  # 备用：intent -> 询问分支
                        {"id": "e5", "source": "n4", "target": "n6"},
                    ],
                },
            }
            print(f"  决策出 {len(workflow['graph']['nodes'])} 节点 / {len(workflow['graph']['edges'])} 边")

            # ── 3. 校验 + 保存 ─────────────────────────────────────
            banner("STEP 3 · Agent 校验图谱 + 调 save_workflow 写入")
            r = await session.call_tool("validate_workflow", {"graph": workflow["graph"]})
            errs = json.loads(r.content[0].text).get("result", [])
            print(f"  validate: {'ok' if not errs else 'errs=' + str(errs)}")
            assert not errs

            r = await session.call_tool("save_workflow", workflow)
            wid = json.loads(r.content[0].text)["id"]
            print(f"  saved: workflow_id={wid}")

            # ── 4. 真实运行：分两个 case 测两条分支 ───────────────
            for case, text in [
                ("问候场景", "你好呀！"),
                ("询问场景", "Python 的 GIL 是什么？"),
            ]:
                banner(f"STEP 4 · Agent 运行 [{case}] inputs.text={text!r}")
                t0 = time.time()
                r = await session.call_tool("run_workflow", {
                    "workflow_id": wid,
                    "inputs": {"text": text},
                })
                dt = time.time() - t0
                run = json.loads(r.content[0].text)
                print(f"  status: {run['status']}  ({dt:.1f}s)  run_id: {run['run_id']}")
                print(f"  outputs:")
                for nid, out in (run.get("outputs") or {}).items():
                    sample = json.dumps(out, ensure_ascii=False)
                    if len(sample) > 160: sample = sample[:160] + "..."
                    print(f"    {nid}: {sample}")
                print(f"  执行顺序（来自 logs）:")
                for lg in run.get("logs", []):
                    print(f"    {lg['node']:4s} {lg['type']:8s}  ok={lg['ok']}  {lg.get('ms', 0)}ms")
                assert run["status"] == "succeeded", f"run failed: {run}"

            # ── 5. 拿持久化的运行历史 ─────────────────────────────
            banner("STEP 5 · Agent 调 list_runs 拿历史")
            r = await session.call_tool("list_runs", {"workflow_id": wid, "limit": 5})
            runs = json.loads(r.content[0].text)["runs"]
            print(f"  本工作流共 {len(runs)} 次运行:")
            for ri in runs:
                ts = time.strftime("%H:%M:%S", time.localtime(ri["started_at"]))
                print(f"    {ri['id'][:8]}.. {ri['status']:10s} {ts}")

            print()
            print("=" * 60)
            print("  AI Agent 通过 MCP 编排 AWE 全流程  ✅ PASSED")
            print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
