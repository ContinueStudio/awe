"""日志封装。

使用标准 logging，避免引入额外依赖。
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from .config import DATA_DIR

_LOG_DIR: Path = DATA_DIR / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def get_logger(name: str = "awe") -> logging.Logger:
    """获取统一格式的 logger。"""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    # 控制台
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(logging.Formatter(_FORMAT))
    logger.addHandler(stream)

    # 文件
    fh = logging.FileHandler(_LOG_DIR / "awe.log", encoding="utf-8")
    fh.setFormatter(logging.Formatter(_FORMAT))
    logger.addHandler(fh)

    logger.propagate = False
    return logger
