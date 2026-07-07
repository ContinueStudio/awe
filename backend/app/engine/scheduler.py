"""定时调度服务。

管理 cron_trigger 节点的定时任务。
依赖 APScheduler（已在 requirements.txt 中）。
"""
from __future__ import annotations

import threading
from typing import Any, Callable, Dict, Optional

from ..core.logger import get_logger

logger = get_logger("awe.scheduler")

# 延迟导入 APScheduler（首次使用时加载）
BackgroundScheduler: Any = None
CronTrigger: Any = None

def _ensure_apscheduler() -> bool:
    global BackgroundScheduler, CronTrigger
    if BackgroundScheduler is not None:
        return True
    try:
        from apscheduler.schedulers.background import BackgroundScheduler as BS
        from apscheduler.triggers.cron import CronTrigger as CT
        BackgroundScheduler = BS
        CronTrigger = CT
        return True
    except ImportError:
        logger.warning("APScheduler 未安装，定时功能不可用")
        return False

# 全局单例
_scheduler: Optional[BackgroundScheduler] = None
_lock = threading.Lock()
# 已注册的任务: {workflow_id: job_id}
_jobs: Dict[str, str] = {}


def _get_scheduler() -> BackgroundScheduler:
    global _scheduler
    with _lock:
        if _scheduler is None:
            _scheduler = BackgroundScheduler(daemon=True)
            _scheduler.start()
        return _scheduler


def register_cron(
    workflow_id: str,
    cron_expr: str,
    timezone: str,
    callback: Callable[[], Any],
) -> str:
    """注册/更新定时任务。"""
    sched = _get_scheduler()

    # 如果已有相同 workflow 的任务，先移除
    if workflow_id in _jobs:
        try:
            sched.remove_job(_jobs[workflow_id])
        except Exception:
            pass

    trigger = CronTrigger.from_crontab(cron_expr, timezone=timezone)
    job = sched.add_job(callback, trigger, id=f"cron_{workflow_id}", replace_existing=True)
    _jobs[workflow_id] = job.id
    logger.info("注册定时任务: workflow=%s cron=%s next=%s", workflow_id, cron_expr, job.next_run_time)
    return job.id


def unregister(workflow_id: str) -> None:
    """移除指定 workflow 的定时任务。"""
    job_id = _jobs.pop(workflow_id, None)
    if job_id:
        sched = _get_scheduler()
        try:
            sched.remove_job(job_id)
            logger.info("移除定时任务: workflow=%s", workflow_id)
        except Exception:
            pass


def unregister_all() -> None:
    """移除所有定时任务。"""
    sched = _get_scheduler()
    for wf_id in list(_jobs.keys()):
        unregister(wf_id)
    logger.info("已清空所有定时任务")


def list_jobs() -> list:
    """列出所有已注册的定时任务。"""
    return [
        {"workflow_id": wf_id, "job_id": job_id, "next_run": str(job.next_run_time) if job.next_run_time else None}
        for wf_id, job_id in _jobs.items()
        if (job := _get_scheduler().get_job(job_id))
    ]
