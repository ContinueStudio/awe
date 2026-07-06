"""v0.3.9 — 创建「飞书读取并打印记录」工作流。

工作流结构：
  n1(飞书-读取所有记录) → n2(Skill 沙盒)

使用方法：
  1. 启动后端:  python start.py --skip-port-clean
  2. 运行本脚本: python seed_feishu_read.py
  3. 脚本会创建工作流并触发一次运行（需要你提前填好飞书 App ID/Secret）
  4. 运行结果会打印在控制台

注意：请先在本脚本末尾的 config 中填入你的飞书 App ID 和 App Secret。
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8765"

# ---- 你的飞书应用凭证（必填） ----
FEISHU_APP_ID = "cli_xxxxxxxxxxxxx"
FEISHU_APP_SECRET = "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# ---- 目标多维表格信息（从 URL 提取） ----
APP_TOKEN = "J0HXbul5Ma8nnQs0UrgcoN0Vntg"
TABLE_ID = "tblY37UDB2llkZLd"


def api_post(path: str, body: dict) -> dict:
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ✗ HTTP {e.code} {url}")
        print(f"    {e.read().decode()}")
        sys.exit(1)
    except Exception as e:
        print(f"  ✗ 请求失败 {url}: {e}")
        sys.exit(1)


def main():
    print("=" * 56)
    print("   飞书读取记录工作流创建工具 v0.3.9")
    print("=" * 56)

    # 1. 检查服务是否就绪
    print("\n[1/3] 检查后端服务...")
    try:
        with urllib.request.urlopen(f"{BASE}/api/health", timeout=3) as r:
            print("  ✓ 后端就绪")
    except Exception:
        print("  ✗ 后端未启动，请先运行 python start.py")
        sys.exit(1)

    # 2. 创建工作流
    print("\n[2/3] 创建工作流...")
    workflow_body = {
        "name": "飞书读取所有记录并打印",
        "description": "读取指定飞书多维表格的所有记录，在 Skill 沙盒中逐条打印字段内容",
        "graph": {
            "nodes": [
                {
                    "id": "n1",
                    "type": "feishu_bitable_list_records",
                    "config": {
                        "app_id": FEISHU_APP_ID,
                        "app_secret": FEISHU_APP_SECRET,
                        "app_token": APP_TOKEN,
                        "table_id": TABLE_ID,
                    },
                },
                {
                    "id": "n2",
                    "type": "skill",
                    "config": {
                        "code": """import json

# n1 输出的 records 数组
records = inputs.get('n1', {}).get('records', [])
total = inputs.get('n1', {}).get('total', 0)

print(f"共 {total} 条记录")
print("=" * 40)

for i, rec in enumerate(records):
    record_id = rec.get('record_id', '?')
    fields = rec.get('fields', {})
    print(f"[{i+1}] record_id={record_id}")
    for k, v in fields.items():
        print(f"    {k}: {v}")
    print()

# 返回给下游
result = {
    "total": total,
    "record_count": len(records),
    "sample": records[:3] if records else [],
}
""",
                        "timeout_sec": 60,
                    },
                },
            ],
            "edges": [
                {"source": "n1", "target": "n2"},
            ],
        },
    }

    resp = api_post("/api/workflows", workflow_body)
    wid = resp.get("id", "?")
    print(f"  ✓ 工作流已创建, id={wid}")

    # 3. 触发运行
    print("\n[3/3] 触发运行...")
    run_resp = api_post(f"/api/workflows/{wid}/run", {"inputs": {}})
    run_id = run_resp.get("run_id", "?")
    print(f"  ✓ 运行已触发, run_id={run_id}")

    # 4. 轮询运行结果
    print("\n  等待运行完成...")
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(f"{BASE}/api/runs/{run_id}", timeout=3) as r:
                run_data = json.loads(r.read().decode())
                status = run_data.get("status", "unknown")
                if status == "completed":
                    print(f"\n  ✓ 运行完成!")
                    log_outputs = run_data.get("outputs", {})
                    n2_out = log_outputs.get("n2", {})
                    # skill 节点的 result 中会包含沙盒 stdout
                    print(f"\n  打印结果:")
                    print(f"  {json.dumps(n2_out, indent=2, ensure_ascii=False)}")
                    break
                elif status == "failed":
                    print(f"\n  ✗ 运行失败: {run_data.get('error', 'unknown')}")
                    break
        except Exception:
            pass
    else:
        print("  ⏰ 运行超时")


if __name__ == "__main__":
    main()
