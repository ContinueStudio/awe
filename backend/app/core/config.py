"""AWE 应用配置。

集中管理后端配置，支持 .env 覆盖。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


# 项目根目录（AWE/）
PROJECT_ROOT: Path = Path(__file__).resolve().parents[3]
DATA_DIR: Path = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_env() -> None:
    """轻量 .env 加载（避免引入额外依赖）。"""
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()


@dataclass
class Settings:
    """应用全局配置。"""

    # 服务
    app_name: str = "AWE - Agentic Workflow Engine"
    version: str = "0.2.0"
    host: str = os.getenv("AWE_HOST", "127.0.0.1")
    port: int = int(os.getenv("AWE_PORT", "8765"))
    debug: bool = os.getenv("AWE_DEBUG", "1") == "1"

    # 跨域
    cors_origins: List[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.getenv("AWE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
            if o.strip()
        ]
    )

    # 持久化
    db_path: Path = DATA_DIR / "awe.db"
    chroma_path: Path = DATA_DIR / "chroma"

    # AI/LLM（通过 LiteLLM 统一适配）
    llm_default_model: str = os.getenv("AWE_LLM_MODEL", "gpt-4o-mini")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")

    # RPA / 浏览器
    browser_debug_port_range: tuple = (9200, 9300)
    chrome_download_url: str = (
        "https://storage.googleapis.com/chrome-for-testing-public/"
    )

    # 调度
    scheduler_enabled: bool = os.getenv("AWE_SCHEDULER", "0") == "1"

    # Skill 沙盒
    skill_sandbox_timeout_sec: int = 30
    skill_sandbox_max_output: int = 64_000  # 字符


settings = Settings()
