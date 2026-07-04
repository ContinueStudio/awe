"""清理 AWE 数据库中「从未运行成功」的工作流。
- 保留：至少有一次 status='succeeded' 的工作流
- 删除：从未运行 或 只有 failed / running 的工作流
- 级联删除关联的 runs / checkpoints / schedules

用法：python db_clean_failed.py
"""
import os
import shutil
import sqlite3
import sys
import time

# Force UTF-8 stdout
sys.stdout = sys.stdout
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# 找到 db 路径
for p in [
    r"D:\AWE\data\awe.db",
    r"C:\Users\11\AppData\Roaming\awe\awe.db",
    r"D:\AWE\backend\awe.db",
]:
    if os.path.exists(p):
        db_path = p
        break
else:
    print("no db found")
    raise SystemExit(1)

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
print("db:", db_path)

# 备份
bak = db_path + ".bak-" + time.strftime("%Y%m%d-%H%M%S")
shutil.copy2(db_path, bak)
print("backup:", bak)

# 列出所有工作流的运行状态
workflows = con.execute("SELECT id, name FROM workflows ORDER BY updated_at DESC").fetchall()
print()
print("--- 当前所有工作流 ---")
to_delete = []
for r in workflows:
    wid = r["id"]
    success = con.execute(
        "SELECT COUNT(*) FROM runs WHERE workflow_id=? AND status='succeeded'", (wid,)
    ).fetchone()[0]
    total = con.execute(
        "SELECT COUNT(*) FROM runs WHERE workflow_id=?", (wid,)
    ).fetchone()[0]
    last = con.execute(
        "SELECT status, started_at FROM runs WHERE workflow_id=? ORDER BY started_at DESC LIMIT 1", (wid,)
    ).fetchone()
    last_s = "{}@{}".format(last["status"], time.strftime("%m-%d %H:%M", time.localtime(last["started_at"]))) if last else "never"
    keep = "✓ 保留" if success > 0 else "✗ 删除"
    print(f"  {keep}  {r['id'][:8]}..  {r['name'][:35]:35s}  runs={total}  success={success}  last={last_s}")
    if success == 0:
        to_delete.append(wid)

if not to_delete:
    print()
    print("没有需要清理的工作流（全部都至少成功运行过一次）。")
    con.close()
    raise SystemExit(0)

print()
print(f"准备删除 {len(to_delete)} 个从未成功运行的工作流...")
for wid in to_delete:
    n_runs = con.execute("DELETE FROM runs WHERE workflow_id=?", (wid,)).rowcount
    n_cp = con.execute("DELETE FROM checkpoints WHERE run_id IN (SELECT id FROM runs WHERE workflow_id=?)", (wid,)).rowcount
    n_sched = con.execute("DELETE FROM schedules WHERE workflow_id=?", (wid,)).rowcount
    n_wf = con.execute("DELETE FROM workflows WHERE id=?", (wid,)).rowcount
    print(f"  删 {wid[:8]}..  runs={n_runs}  cp={n_cp}  sched={n_sched}  wf={n_wf}")

con.commit()
con.close()
print()
print("done.")
