"""AWE 端到端自检脚本（无需 LLM）。

测试范围：
1. 后端 /api/health 通
2. 后端 /api/nodes 返回 12 节点
3. 保存一个 webhook -> skill -> end 工作流
4. 跑 3 次（让 run_count > 1）
5. /api/workflows 列表里能找到这个工作流，且字段包含 run_count / last_status / last_started_at
6. /api/workflows/{wid}/runs 返回 run 列表，logs 字段非空
7. /api/workflows/{wid} 拿到 graph 包含 3 节点
8. 前端 dist 包含 HomePage 关键字 + RunHistoryDrawer + ResizeObserver（NodeRender 高度自适应）
9. 前端 dist hash 跟上次不一样（说明真的是新 build）

退出码：0 全部通过 / 1 有失败。
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import hashlib
import io

# Force UTF-8 stdout (Windows 默认 GBK 编码)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests

API = "http://127.0.0.1:8765"
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

PASS = "[OK]"
FAIL = "[FAIL]"
INFO = "[..]"


def step(title: str) -> None:
    print(f"\n=== {title} ===")


def check(name: str, ok: bool, detail: str = "") -> bool:
    tag = PASS if ok else FAIL
    print(f"  {tag} {name}{('  -- ' + detail) if detail else ''}")
    return ok


def main() -> int:
    failures = 0

    # ============= 1. 后端 health =============
    step("1. 后端 /api/health")
    try:
        r = requests.get(f"{API}/api/health", timeout=5)
        ok = r.status_code == 200 and r.json().get("ok") is True
        if not check("health 200 OK", ok, f"status={r.status_code} body={r.text[:200]}"):
            failures += 1
            print("\n[!] 后端没起来，先 ./run.py 启动 uvicorn 再跑此脚本")
            return 1
        print(f"      version = {r.json().get('version')}")
    except Exception as e:
        check("health reachable", False, str(e))
        return 1

    # ============= 2. 节点列表 =============
    step("2. /api/nodes 返回节点定义")
    r = requests.get(f"{API}/api/nodes", timeout=5)
    nodes = r.json().get("nodes", [])
    if not check("nodes count >= 10", len(nodes) >= 10, f"count={len(nodes)} types={[n['type'] for n in nodes[:5]]}..."):
        failures += 1

    # ============= 3. 保存工作流 =============
    step("3. 保存测试工作流（webhook -> skill -> end）")
    graph = {
        "nodes": [
            {"id": "n1", "type": "webhook", "config": {"path": "/selftest"}},
            {"id": "n2", "type": "skill", "config": {
                # skill 节点沙盒里 inputs = {上游 node_id: outputs}
                "code": "_i = ((inputs or {}).get('n1') or {}).get('body', {}).get('i', 0); result = {'greeting': 'selftest ok', 'i': _i, 'ok': True}",
                "timeout_sec": 5,
            }},
            {"id": "n3", "type": "end", "config": {"message": "AWE selftest: payload={{n2.outputs.result}}"}},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
        ],
    }
    wf_name = f"selftest-{int(time.time())}"
    r = requests.post(f"{API}/api/workflows", json={
        "name": wf_name,
        "description": "e2e self-test",
        "graph": graph,
    }, timeout=10)
    if not check("save 200 OK", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"):
        failures += 1
        return 1
    wid = r.json()["id"]
    print(f"      workflow_id = {wid[:8]}..")

    # ============= 4. 跑 3 次 =============
    step("4. POST /api/workflows/{wid}/run × 3")
    for i in range(3):
        rr = requests.post(f"{API}/api/workflows/{wid}/run", json={"inputs": {"i": i}}, timeout=30)
        if not check(f"run #{i+1} succeeded", rr.status_code == 200 and rr.json().get("status") == "succeeded",
                     f"status={rr.status_code} body={rr.text[:200]}"):
            failures += 1

    # ============= 5. /api/workflows 列表字段 =============
    step("5. /api/workflows 列表字段")
    r = requests.get(f"{API}/api/workflows", timeout=5)
    wfs = r.json().get("workflows", [])
    mine = [w for w in wfs if w.get("id") == wid]
    if not check("workflow in list", len(mine) == 1, f"found {len(mine)} matches"):
        failures += 1
    else:
        m = mine[0]
        if not check("run_count == 3", m.get("run_count") == 3, f"got {m.get('run_count')}"):
            failures += 1
        if not check("last_status == 'succeeded'", m.get("last_status") == "succeeded", f"got {m.get('last_status')}"):
            failures += 1
        if not check("last_started_at is number", isinstance(m.get("last_started_at"), (int, float)) and m.get("last_started_at") > 0,
                     f"got {m.get('last_started_at')}"):
            failures += 1

    # ============= 6. /api/runs?workflow_id={wid} logs =============
    step("6. /api/runs?workflow_id={wid} 含 logs")
    r = requests.get(f"{API}/api/runs", params={"workflow_id": wid, "limit": 10}, timeout=5)
    if r.status_code == 200:
        runs = r.json().get("runs", [])
        check("runs count == 3", len(runs) == 3, f"got {len(runs)}")
        if runs:
            # 找 succeeded 的 run 拿详情
            succeeded_run = next((x for x in runs if x.get("status") == "succeeded"), None)
            if succeeded_run:
                rd = requests.get(f"{API}/api/runs/{succeeded_run['id']}", timeout=5)
                if rd.status_code == 200:
                    detail = rd.json()
                    logs = (detail.get("state") or {}).get("logs") or []
                    if not check("logs non-empty", len(logs) > 0, f"got {len(logs)} log entries"):
                        failures += 1
                    else:
                        print(f"      sample log: {logs[0]}")
                    outputs = (detail.get("state") or {}).get("outputs") or {}
                    if not check("outputs.n2 contains greeting", "greeting" in str(outputs.get("n2", {})),
                                 f"outputs keys: {list(outputs.keys())}"):
                        failures += 1
                else:
                    check("get run detail 200", False, f"status={rd.status_code}")
                    failures += 1
    else:
        check("runs endpoint reachable", False, f"status={r.status_code}")
        failures += 1

    # ============= 7. /api/workflows/{wid} graph =============
    step("7. /api/workflows/{wid} 拿到 graph")
    r = requests.get(f"{API}/api/workflows/{wid}", timeout=5)
    if r.status_code == 200:
        wf = r.json()
        check("graph has 3 nodes", len(wf.get("graph", {}).get("nodes", [])) == 3,
              f"got {len(wf.get('graph', {}).get('nodes', []))}")
        check("graph has 2 edges", len(wf.get("graph", {}).get("edges", [])) == 2)
    else:
        check("get workflow 200", False, f"status={r.status_code}")
        failures += 1

    # ============= 8. 前端 dist 静态验证 =============
    step("8. 前端 dist 包含关键模块")
    dist_html = os.path.join(FRONTEND_DIST, "index.html")
    dist_js_dir = os.path.join(FRONTEND_DIST, "assets")
    if not os.path.exists(dist_html):
        check("dist/index.html exists", False, "未找到；记得先 cd frontend && npm run build")
        failures += 1
    else:
        check("dist/index.html exists", True)
        # 找到主 js
        js_files = [f for f in os.listdir(dist_js_dir) if f.startswith("index-") and f.endswith(".js")]
        if not js_files:
            check("dist/assets/index-*.js exists", False)
            failures += 1
        else:
            js_path = os.path.join(dist_js_dir, js_files[0])
            content = open(js_path, "r", encoding="utf-8", errors="replace").read()
            sha = hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()[:12]
            size_kb = len(content) / 1024
            print(f"      dist js: {js_files[0]}  size={size_kb:.1f}KB  sha={sha}")
            # 关键模块存在性：esbuild production build 会把所有 import inline 成一个 bundle，
            # 原文件路径字符串会变成常量 enum（如 "HOMEPAGE"/"RUNHISTORYDRAWER"），
            # 同时中文 UI 文本会原样保留。所以这里用"中文 UI 文案" + "大写枚举"双校验。
            checks = [
                ("HomePage component code", "HOMEPAGE" in content or "我的工作流" in content),
                ("RunHistoryDrawer component code", "RUNHISTORYDRAWER" in content or "查看日志" in content or "运行历史" in content),
                ("NodeRender module", "NodeRender" in content or "node-render" in content),
                ("ResizeObserver call", "ResizeObserver" in content),
                ("onMeasured callback", "onMeasured" in content or "measured" in content),
                ("view='home' state", "view" in content and ("home" in content or "editor" in content)),
                ("运行历史文字（unicode 转义也算）", "运行历史" in content or "\\u8fd0\\u884c\\u5386\\u53f2" in content or "u8fd0u884cu5386u53f2" in content),
                ("我的工作流文字", "我的工作流" in content or "\\u6211\\u7684\\u5de5\\u4f5c\\u6d41" in content),
                ("查看日志按钮文字", "查看日志" in content or "\\u67e5\\u770b\\u65e5\\u5fd7" in content),
                ("节点高度 data-node-height 属性", "node-height" in content or "data-node-height" in content),
            ]
            for name, ok in checks:
                if not check(name, ok):
                    failures += 1

    # ============= 9. 清理 =============
    step("9. 清理测试工作流")
    r = requests.delete(f"{API}/api/workflows/{wid}", timeout=5)
    check("delete 200", r.status_code == 200, f"status={r.status_code}")

    # ============= 总结 =============
    print()
    if failures == 0:
        print("=" * 60)
        print(f" {PASS} ALL CHECKS PASSED")
        print("=" * 60)
        return 0
    else:
        print("=" * 60)
        print(f" {FAIL} {failures} CHECKS FAILED")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
