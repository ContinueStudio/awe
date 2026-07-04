"""端到端真实工作流测试：保存一个工作流 → 实际运行 → 打印结果。

工作流：webhook (输入) → LLM 推断 (调用大模型) → end (输出)
"""
import json
import time
import urllib.request
import urllib.error
from multiprocessing import Process
import uvicorn
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))


def run_server():
    uvicorn.run("app.main:app", host="127.0.0.1", port=18766, log_level="warning")


def post(url, body):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def get(url):
    with urllib.request.urlopen(url) as r:
        return r.status, json.loads(r.read().decode())


def main():
    p = Process(target=run_server, daemon=True)
    p.start()
    print(f"[e2e] backend pid={p.pid}")
    time.sleep(2.5)
    base = "http://127.0.0.1:18766"

    # 1) 健康
    code, h = get(f"{base}/api/health")
    assert code == 200, h
    print(f"[1] health: {h}")

    # 2) 构造一个真实工作流：webhook -> LLM -> end
    # LLM 节点的 config.prompt 用 {{n1.outputs.body.prompt}} 引用 webhook 的输入
    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "webhook",
                "config": {"path": "/hello", "method": "POST"},
            },
            {
                "id": "n2",
                "type": "llm",
                "config": {
                    "model": "gpt-4o-mini",
                    "system": "你是一个友好的助手，请用一句话回答。",
                    "temperature": 0.5,
                    "prompt": "{{n1.outputs.body.prompt}}",
                },
            },
            {
                "id": "n3",
                "type": "end",
                "config": {
                    "message": "Q: {{n1.outputs.body.prompt}} | A: {{n2.outputs.text}}"
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
        ],
    }

    # 3) 校验
    code, v = post(f"{base}/api/workflows/validate", {"name": "tmp", "graph": graph})
    print(f"[2] validate: ok={v.get('ok')} errors={v.get('errors', [])}")
    assert v.get("ok"), v

    # 4) 保存
    code, r = post(f"{base}/api/workflows", {
        "name": "hello-llm",
        "description": "测试：webhook -> LLM -> end",
        "graph": graph,
    })
    wid = r["id"]
    print(f"[3] save workflow: id={wid}")

    # 5) 列表能看到
    code, lst = get(f"{base}/api/workflows")
    names = [w["name"] for w in lst["workflows"]]
    print(f"[4] list workflows ({len(names)}): {names[:5]}...")
    assert "hello-llm" in names

    # 6) 真的跑一次
    code, run = post(f"{base}/api/workflows/{wid}/run", {
        "inputs": {"prompt": "你好，请自我介绍"}
    })
    print(f"\n[5] RUN RESULT")
    print(f"   status:   {run.get('status')}")
    print(f"   run_id:   {run.get('run_id')}")
    print(f"   error:    {run.get('error') or '(none)'}")
    print(f"   outputs:")
    for nid, out in (run.get('outputs') or {}).items():
        print(f"     {nid}: {json.dumps(out, ensure_ascii=False, indent=6)}")
    print(f"   logs (last 3):")
    for lg in (run.get('logs') or [])[-3:]:
        print(f"     {json.dumps(lg, ensure_ascii=False)}")

    # 7) 运行历史
    code, runs = get(f"{base}/api/runs?workflow_id={wid}&limit=3")
    print(f"\n[6] run history: {len(runs['runs'])} runs")
    for r in runs['runs']:
        print(f"     {r['id'][:8]}.. status={r['status']} started={time.strftime('%H:%M:%S', time.localtime(r['started_at']))}")

    assert run.get("status") == "succeeded", f"run failed: {run}"
    print("\nALL E2E PASSED")
    p.terminate()


if __name__ == "__main__":
    main()
