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

# Windows 关键：DETACHED_PROCESS (0x00000008) + CREATE_NEW_PROCESS_GROUP (0x00000200)
# 不加这两个 flag，Edge 进程会跟沙盒 executor 线程的 console handle 绑定，
# 沙盒节点 return 时子进程会被一起回收 —— 表现就是"窗口闪一下就消失"。
DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200

# 用 subprocess.Popen 列表式启动（沙盒禁止 shell=True），后台运行
# --new-window: 强制开新窗口
# --window-size: 固定 1280x800
# 第一个参数如果是 URL，Edge 会自动定位到该 URL
proc = subprocess.Popen(
    [edge_path, "--new-window", "--window-size=1280,800", "https://www.baidu.com"],
    creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
    close_fds=True,
)
print(f"[n2] Edge Popen returned, pid={proc.pid}")
# 不再 sleep —— 立刻让 n3 / n4 跑。n3 会 sleep 几秒后再查任务列表。
result = {
    "pid": proc.pid,
    "edge_path": edge_path,
    "url": "https://www.baidu.com",
    "started_at": time.time(),
    "creation_flags": "DETACHED_PROCESS|CREATE_NEW_PROCESS_GROUP",
}
'''.strip()

CODE_SCREENSHOT = r'''
import subprocess
import os
import time

# n2 透传的 Edge 启动信息
n2_info = ((inputs or {}).get("n2") or {}).get("result", {}) or {}
pid = n2_info.get("pid")
if not pid:
    raise RuntimeError("n2 没拿到 pid，链路断了")

# 等待 Edge 完成 fork + 加载百度（首次启动可能需要 4~6s）
time.sleep(5)

# Edge 是多进程模型：主进程 fork 出 renderer / gpu 进程后，主进程会退出，
# 但 msedge.exe 会有多个子进程在跑（1 个 browser 主进程 + N 个 renderer/gpu/utility）。
# encoding="utf-8" 避免 Windows 默认 GBK 报错
tasklist = subprocess.run(
    ["tasklist", "/FI", "IMAGENAME eq msedge.exe", "/FO", "LIST", "/V"],
    capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
)
# 统计 msedge.exe 行数
msedge_count = sum(1 for l in tasklist.stdout.splitlines() if l.strip().startswith("msedge.exe"))
# 解析窗口标题
first_title = ""
lines = [l for l in tasklist.stdout.splitlines() if l.strip()]
for i, l in enumerate(lines):
    if "窗口标题" in l or "Window Title" in l:
        if i + 1 < len(lines):
            first_title = lines[i + 1].strip()
        break

# 真正判定 Edge 浏览器 UI 在运行：进程数 >= 2 (主进程 + 1 个子进程)
ui_keywords = ("百度", "Baidu", "新标签页", "New tab", "Edge", "Microsoft\u00a0Edge")
title_match = any(k in first_title for k in ui_keywords) if first_title else False
alive = msedge_count >= 2 and (title_match or first_title == "")

print(f"[n3] msedge 进程数={msedge_count}, alive={alive}, 首窗口标题='{first_title}'")
result = {
    "edge_pid": pid,
    "edge_alive": alive,
    "msedge_count": msedge_count,
    "first_window_title": first_title,
    "title_match": title_match,
    "checked_at": time.time(),
}
'''.strip()

CODE_CLOSE = r'''
import subprocess

# n3 透传的 pid
n3_info = ((inputs or {}).get("n3") or {}).get("result", {}) or {}
pid = n3_info.get("edge_pid")

# 接收 __user_inputs__.close 决定是否关 Edge（默认 false —— 让用户真看到 Edge 窗口）
should_close = bool(((inputs or {}).get("__user_inputs__") or {}).get("close", False))

if not should_close:
    print(f"[n4] 跳过关闭 (inputs.close=false)。Edge 浏览器保持打开 pid={pid}")
    result = {
        "closed_pid": None,
        "skipped": True,
        "reason": "inputs.close=false, 保留 Edge 窗口给用户查看",
        "edge_pid": pid,
    }
else:
    kill = subprocess.run(
        ["taskkill", "/F", "/IM", "msedge.exe"],
        capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
    )
    print(f"[n4] taskkill exit={kill.returncode}")
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
                "message": "✅ Edge 启动 | pid={{n2.outputs.result.pid}} | msedge 进程数={{n3.outputs.result.msedge_count}} | 窗口标题='{{n3.outputs.result.first_window_title}}' | 关闭状态={{n4.outputs.result.skipped}}"
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
