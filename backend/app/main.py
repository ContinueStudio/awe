"""AWE 后端 FastAPI 入口。"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .api.workflows import router as workflows_router
from .core.config import settings
from .core.logger import get_logger

logger = get_logger("awe.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AWE 后端启动 v%s  port=%s", settings.version, settings.port)
    yield
    logger.info("AWE 后端关闭")


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows_router, prefix="/api", tags=["workflows"])


@app.get("/")
def root() -> dict:
    """根路径直接返回前端 index.html。"""
    if _FRONTEND_DIST.exists():
        from fastapi.responses import FileResponse
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
    return {
        "name": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "api": "/api",
    }


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "version": settings.version}


# ---------------- 静态前端 (built dist) ----------------

# 前端构建产物目录：<AWE>/frontend/dist
_FRONTEND_DIST: Path = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    # 挂载 assets
    _assets = _FRONTEND_DIST / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        """SPA fallback：先尝试文件，再返回 index.html。"""
        # API 路径走 404
        if full_path.startswith("api/") or full_path == "docs" or full_path.startswith("docs/"):
            return {"error": "not found"}
        # 空路径 / → index.html
        if not full_path:
            return FileResponse(str(_FRONTEND_DIST / "index.html"))
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
else:
    @app.get("/")
    def _no_frontend() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.version,
            "frontend": "NOT_BUILT",
            "hint": "cd frontend && npm install && npm run build",
        }
