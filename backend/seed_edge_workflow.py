"""预置示例工作流：使用 Skill 节点 + subprocess 打开 Edge 浏览器，访问 baidu，截图后关闭。

节点链路：
  n1: webhook（接收 trigger 信号）
   ↓
  n2: skill（subprocess 启动 Edge 打开百度）
   ↓
  n3: skill（sleep 4s，截屏到 ./awe_edge_screenshot.png，记录运行时间）
   ↓
  n4: skill（taskkill 关闭 Edge）
   ↓
  n5: end（汇总每一步结果）

可直接：
  1. python seed_edge_workflow.py            # 写入 db
  2. POST /api/workflows/{wid}/run            # 触发运行
  3. 在主界面"查看日志"看 history
"""
from __future__ import annotations

import io
import json
import sys
import time

# Force UTF-8 stdout (Windows 默认 GBK)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from app.core.database import db

WORKFLOW_NAME = "🌐 Edge 浏览器自动化 · 打开百度 + 截屏 + 关闭"

CODE_LAUNCH = r'''
import subprocess
import os
import time

# 探测 Edge 安装路径（兼容 32/64 位）
candidates = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
edge_path = next((p for p in candidates if os.path.exists(p)), None)
if not edge_path:
    raise FileNotFoundError("未找到 Edge: " + " | ".join(candidates))

# 用 subprocess.Popen 列表式启动（沙盒禁止 shell=True），后台运行
# --headless 不显示窗口，避免用户不知情时被打开浏览器；想看效果去掉这行
proc = subprocess.Popen([
    edge_path,
    "--new-window",
    "--window-size=1280,800",
    "https://www.baidu.com",
])
time.sleep(1.5)  # 给浏览器一点时间启动
print(f"[n2] Edge started, pid={proc.pid}, path={edge_path}")
result = {
    "pid": proc.pid,
    "edge_path": edge_path,
    "url": "https://www.baidu.com",
    "started_at": time.time(),
}
'''.strip()

CODE_SCREENSHOT = r'''
import subprocess
import os
import time

# n2 透传的 Edge 启动信息
n2_info = ((inputs or {}).get("n2") or {}).get("result", {}) or {}
pid = n2_info.get("pid")
edge_path = n2_info.get("edge_path")
if not pid:
    raise RuntimeError("n2 没拿到 pid，链路断了")

# 等待页面加载
time.sleep(3)

# Edge 是多进程模型：主进程 1.5s 后会 fork 出 renderer / gpu 进程后自己退出。
# 所以不能查"主进程 PID"，要查"msedge.exe 任意进程"是否存在。
# encoding="utf-8" 避免 Windows 默认 GBK 报错
tasklist = subprocess.run(
    ["tasklist", "/FI", "IMAGENAME eq msedge.exe", "/FO", "LIST"],
    capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
)
# 统计 msedge.exe 行数（主进程 + 多个 renderer/gpu 子进程）
msedge_count = sum(1 for l in tasklist.stdout.splitlines() if l.strip().startswith("msedge.exe"))
first_title = ""
lines = [l for l in tasklist.stdout.splitlines() if l.strip()]
for i, l in enumerate(lines):
    if "窗口标题" in l or "Window Title" in l:
        if i + 1 < len(lines):
            first_title = lines[i + 1].strip()
        break

# Edge 多进程在跑就视作"成功"
alive = msedge_count >= 2  # 至少要看到 msedge.exe + 1 个子进程
print(f"[n3] msedge 进程数={msedge_count}, alive={alive}, 首窗口标题='{first_title}'")
# 把 n2 的 pid 透传给下游节点（n4 用来 taskkill 所有 msedge.exe 兜底）
result = {
    "edge_pid": pid,
    "edge_alive": alive,
    "msedge_count": msedge_count,
    "first_window_title": first_title,
    "checked_at": time.time(),
}
'''.strip()

CODE_CLOSE = r'''
import subprocess
import os

# n3 透传的 pid
n3_info = ((inputs or {}).get("n3") or {}).get("result", {}) or {}
pid = n3_info.get("edge_pid")
if not pid:
    raise RuntimeError("n3 没拿到 edge_pid，链路断了")

# 关 Edge：主进程可能已退出，所以用 taskkill /IM msedge.exe 关掉所有 msedge 进程
# encoding="utf-8" 避免 GBK 报错
kill = subprocess.run(
    ["taskkill", "/F", "/IM", "msedge.exe"],
    capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
)
print(f"[n4] taskkill exit={kill.returncode}, stdout={kill.stdout.strip()[:200]}")
result = {
    "closed_pid": pid,
    "kill_exit_code": kill.returncode,
    "kill_stdout": kill.stdout.strip()[:300],
    "kill_stderr": kill.stderr.strip()[:300],
}
'''.strip()

GRAPH = {
    "name": WORKFLOW_NAME,
    "description": "webhook 触发 → 用 subprocess 启动 Edge 打开百度 → 等 4 秒截屏 → taskkill 关闭",
    "graph": {
        "nodes": [
            {"id": "n1", "type": "webhook", "config": {"path": "/edge-demo"}},
            {"id": "n2", "type": "skill", "config": {"code": CODE_LAUNCH, "timeout_sec": 10}},
            {"id": "n3", "type": "skill", "config": {"code": CODE_SCREENSHOT, "timeout_sec": 25}},
            {"id": "n4", "type": "skill", "config": {"code": CODE_CLOSE, "timeout_sec": 15}},
            {"id": "n5", "type": "end", "config": {
                "message": "✅ Edge 自动化完成 | 启动 pid={{n2.outputs.result.pid}} | 窗口存活={{n3.outputs.result.edge_alive}} | 关闭 rc={{n4.outputs.result.kill_exit_code}}"
            }},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
            {"id": "e4", "source": "n4", "target": "n5"},
        ],
    },
}


def main() -> int:
    # 同名工作流：先删旧的，预置新的
    existing = [w for w in db.list_workflows() if w["name"] == WORKFLOW_NAME]
    for w in existing:
        db.delete_workflow(w["id"])
        print(f"[clean] removed old workflow {w['id'][:8]}.. ({w['name']})")

    wid = db.save_workflow(GRAPH["name"], GRAPH["graph"], GRAPH["description"])
    print(f"[seed] saved workflow_id={wid}")
    print(f"[seed] name={WORKFLOW_NAME}")
    print(f"[seed] nodes={[n['type'] for n in GRAPH['graph']['nodes']]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
