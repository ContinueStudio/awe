"""清空 AWE 数据库中所有测试工作流 + 关联运行/检查点/调度。"""
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

con = sqlite3.connect(db_path)
print("db:", db_path)

# 备份
bak = db_path + ".bak-" + time.strftime("%Y%m%d-%H%M%S")
import shutil
shutil.copy2(db_path, bak)
print("backup:", bak)

# 清表
for table in ["checkpoints", "schedules", "runs", "workflows"]:
    n = con.execute(f"delete from {table}").rowcount
    print(f"  cleared {table}: {n} rows")
con.commit()
con.close()
print("done.")
