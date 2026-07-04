"""快速冒烟测试：直接 in-process 启动 FastAPI 并测试核心 API。"""
import json
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

import uvicorn
from multiprocessing import Process


def run_server():
    uvicorn.run("app.main:app", host="127.0.0.1", port=18765, log_level="warning")


def main():
    p = Process(target=run_server, daemon=True)
    p.start()
    print(f"[test] backend pid={p.pid} starting...")
    time.sleep(2.5)

    import urllib.request

    base = "http://127.0.0.1:18765"

    # 1) health
    with urllib.request.urlopen(f"{base}/api/health") as r:
        assert r.status == 200, r.status
        print("[1] health OK:", r.read().decode())

    # 2) nodes
    with urllib.request.urlopen(f"{base}/api/nodes") as r:
        data = json.loads(r.read().decode())
        types = [n["type"] for n in data["nodes"]]
        print(f"[2] nodes OK: {len(types)} types -> {types[:4]}...")
        assert len(types) == 12, len(types)

    # 3) save workflow
    graph = {
        "nodes": [
            {"id": "n1", "type": "webhook", "config": {}},
            {"id": "n2", "type": "end", "config": {}},
        ],
        "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
    }
    body = json.dumps({"name": "smoke", "description": "", "graph": graph}).encode()
    req = urllib.request.Request(f"{base}/api/workflows", data=body, method="POST",
                                  headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        wid = json.loads(r.read().decode())["id"]
        print(f"[3] save workflow OK: id={wid}")

    # 4) run
    body = json.dumps({"inputs": {"hello": "world"}}).encode()
    req = urllib.request.Request(f"{base}/api/workflows/{wid}/run", data=body, method="POST",
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            result = json.loads(r.read().decode())
            print(f"[4] run OK: status={result['status']} outputs={list(result['outputs'].keys())}")
            assert result["status"] == "succeeded", result
    except urllib.error.HTTPError as e:
        print(f"[4] run FAILED: {e.code} {e.read().decode()}")
        raise

    # 5) validate (negative) - 缺 url 必填字段
    bad = {"nodes": [{"id": "x", "type": "http", "config": {}}], "edges": []}
    body = json.dumps({"name": "bad", "description": "", "graph": bad}).encode()
    req = urllib.request.Request(f"{base}/api/workflows/validate", data=body, method="POST",
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            v = json.loads(r.read().decode())
            print(f"[5] validate negative OK: ok={v.get('ok')} errors={v.get('errors', [])[:2]}")
            assert v.get("ok") is False
            assert any("url" in e for e in v.get("errors", []))
    except urllib.error.HTTPError as e:
        body_resp = json.loads(e.read().decode())
        print(f"[5] validate 400: {body_resp}")

    print("\nALL TESTS PASSED")
    p.terminate()


if __name__ == "__main__":
    main()
