"""查看 AWE 数据库状态。"""
import os
import sqlite3
import time

for p in [
    r"D:\AWE\data\awe.db",
    r"C:\Users\11\AppData\Roaming\awe\awe.db",
    r"D:\AWE\backend\awe.db",
]:
    if os.path.exists(p):
        db_path = p
        break
else:
    print("no db found"); raise SystemExit(1)

print("db:", db_path)
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
print("tables:", [r[0] for r in con.execute("select name from sqlite_master where type='table'")])
print()
print("--- workflows ---")
for r in con.execute("select id, name, updated_at from workflows order by updated_at desc"):
    runs = con.execute("select count(*) from runs where workflow_id=?", (r["id"],)).fetchone()[0]
    last = con.execute("select status, started_at from runs where workflow_id=? order by started_at desc limit 1", (r["id"],)).fetchone()
    if last:
        last_s = "{}@{}".format(last["status"], time.strftime("%m-%d %H:%M", time.localtime(last["started_at"])))
    else:
        last_s = "never"
    print("  {}..  {:35s}  runs={}  last={}".format(r["id"][:8], r["name"], runs, last_s))
print()
print("--- runs (last 8) ---")
for r in con.execute("select id, workflow_id, status, started_at, error from runs order by started_at desc limit 8"):
    print("  {}..  wf={}..  {:10s}  {}  err={}".format(
        r["id"][:8], r["workflow_id"][:8], r["status"],
        time.strftime("%m-%d %H:%M:%S", time.localtime(r["started_at"])),
        r["error"] or "",
    ))
