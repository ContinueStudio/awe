"""RPA 浏览器管理模块（PRD §4.6 §8.3）。

- Launch Chrome with CDP debug port on 127.0.0.1（安全绑定）
- Browser session pool with max 5 concurrent sessions
- RPA recording: capture user interactions via CDP
- Event-to-code: convert recorded actions → DrissionPage Python code
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..core.config import settings
from ..core.logger import get_logger

logger = get_logger("awe.browser")

# ── 并发控制 ──────────────────────────────────────────
_MAX_CONCURRENT = 5
_SESSION_SEMAPHORE = threading.BoundedSemaphore(_MAX_CONCURRENT)


# ── 录制事件数据结构 ─────────────────────────────────
@dataclass
class RecordedAction:
    type: str               # "navigate" | "click" | "type" | "scroll" | "wait" | "screenshot" | "select"
    url: str = ""
    selector: str = ""
    value: str = ""         # typed text / selected option
    tag: str = ""           # HTML tag name
    text: str = ""          # element text (for click)
    timestamp: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "url": self.url,
            "selector": self.selector,
            "value": self.value,
            "tag": self.tag,
            "text": self.text,
            "timestamp": self.timestamp,
        }


# ── 浏览器会话 ───────────────────────────────────────
class BrowserSession:
    """单个浏览器会话：管理 Chrome 进程 + DrissionPage 控制。"""

    def __init__(self, session_id: str, start_url: str = "") -> None:
        self.id = session_id
        self.start_url = start_url or "about:blank"
        self.actions: List[RecordedAction] = []
        self.recording = False
        self.page = None
        self._browser = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

    def start(self) -> Dict[str, Any]:
        """启动 Chrome 浏览器并连接 CDP。"""
        try:
            import DrissionPage
        except ImportError:
            return {"ok": False, "error": "DrissionPage 未安装"}
        from DrissionPage import ChromiumOptions, ChromiumPage

        _SESSION_SEMAPHORE.acquire()  # 并发控制
        self._running = True

        port = self._find_free_port()
        co = ChromiumOptions()
        co.set_argument("--remote-debugging-port", str(port))
        co.set_argument("--remote-debugging-address", "127.0.0.1")  # PRD §8.3 安全绑定
        co.set_argument("--no-first-run")
        co.set_argument("--no-default-browser-check")
        co.set_argument("--disable-extensions")
        co.set_argument("--disable-popup-blocking")

        try:
            self.page = ChromiumPage(co)
            if self.start_url and self.start_url != "about:blank":
                self.page.get(self.start_url)
            logger.info("Browser session %s started on port %d", self.id, port)
            return {"ok": True, "session_id": self.id, "port": port, "url": self.page.url}
        except Exception as exc:
            _SESSION_SEMAPHORE.release()
            self._running = False
            logger.exception("Browser start failed")
            return {"ok": False, "error": str(exc)}

    def stop(self) -> None:
        """关闭浏览器，释放资源。"""
        self.recording = False
        self._running = False
        try:
            if self.page:
                self.page.quit()
                self.page = None
        except Exception:
            pass
        try:
            _SESSION_SEMAPHORE.release()
        except ValueError:
            pass
        logger.info("Browser session %s stopped", self.id)

    def navigate(self, url: str) -> Dict[str, Any]:
        if not self.page:
            return {"ok": False, "error": "browser not started"}
        try:
            self.page.get(url)
            if self.recording:
                self.actions.append(RecordedAction(
                    type="navigate", url=url, timestamp=time.time(),
                ))
            return {"ok": True, "url": self.page.url, "title": self.page.title}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def start_recording(self) -> Dict[str, Any]:
        """开始录制，注入事件监听 JS。"""
        if not self.page:
            return {"ok": False, "error": "browser not started"}
        self.actions = []
        self.recording = True

        # Inject click/input listeners via JS
        js = """
        (function() {
          if (window.__awe_recorder_active) return;
          window.__awe_recorder_active = true;
          document.addEventListener('click', function(e) {
            var el = e.target;
            var sel = __awe_getSelector(el);
            window.__awe_last_action = JSON.stringify({
              type:'click', selector:sel, tag:el.tagName||'', text:(el.textContent||'').slice(0,120), timestamp:Date.now()/1000
            });
          }, true);
          document.addEventListener('change', function(e) {
            var el = e.target;
            var sel = __awe_getSelector(el);
            window.__awe_last_action = JSON.stringify({
              type:'type', selector:sel, value:el.value||'', tag:el.tagName||'', timestamp:Date.now()/1000
            });
          }, true);
          window.__awe_getSelector = function(el) {
            if (!el || el === document) return '';
            if (el.id) return '#' + el.id;
            if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
            if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
            if (el.className && typeof el.className === 'string') {
              var cls = el.className.trim().split(/\\s+/).slice(0,2).join('.');
              if (cls) return el.tagName.toLowerCase() + '.' + cls;
            }
            return el.tagName.toLowerCase();
          };
        })();
        """
        self.page.run_js(js)
        logger.info("Recording started for session %s", self.id)
        return {"ok": True, "session_id": self.id}

    def stop_recording(self) -> Dict[str, Any]:
        """停止录制，返回录制的操作序列。"""
        if not self.page:
            return {"ok": False, "error": "browser not started"}
        self.recording = False
        self.page.run_js("window.__awe_recorder_active = false;")
        return {
            "ok": True,
            "session_id": self.id,
            "actions": [a.to_dict() for a in self.actions],
            "count": len(self.actions),
        }

    def _find_free_port(self) -> int:
        """在配置的端口范围内查找空闲端口。"""
        low, high = settings.browser_debug_port_range
        import socket
        for p in range(low, high):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("127.0.0.1", p)) != 0:
                    return p
        return low


# ── 全局会话管理器 ───────────────────────────────────
_sessions: Dict[str, BrowserSession] = {}


def create_session(start_url: str = "") -> Dict[str, Any]:
    """创建新的浏览器录制会话。"""
    sid = uuid.uuid4().hex[:12]
    session = BrowserSession(sid, start_url)
    result = session.start()
    if result["ok"]:
        _sessions[sid] = session
    return result


def get_session(sid: str) -> Optional[BrowserSession]:
    return _sessions.get(sid)


def close_session(sid: str) -> Dict[str, Any]:
    """关闭并清理会话。"""
    session = _sessions.pop(sid, None)
    if session:
        session.stop()
        return {"ok": True}
    return {"ok": False, "error": "session not found"}


def list_sessions() -> List[Dict[str, Any]]:
    """列出所有活跃会话。"""
    return [
        {
            "id": s.id,
            "url": s.page.url if s.page else "",
            "recording": s.recording,
            "actions_count": len(s.actions),
        }
        for s in _sessions.values()
    ]


# ── 事件 → 代码生成 ──────────────────────────────────
def actions_to_python_code(actions: List[RecordedAction], tabs: bool = False) -> str:
    """将录制操作序列转换为 DrissionPage Python 脚本。

    tabs: 是否生成多标签页处理代码
    """
    lines = [
        "from DrissionPage import ChromiumPage, ChromiumOptions",
        "",
        "# 注意：此脚本依赖 DrissionPage 库",
        "# 运行前请确保 Chrome 浏览器已安装",
        "co = ChromiumOptions()",
        'co.set_argument("--remote-debugging-port", "9222")',
        "page = ChromiumPage(co)",
        "",
    ]

    for action in actions:
        ts = f"  # {time.strftime('%H:%M:%S', time.localtime(action.timestamp))}"
        sel = action.selector
        sel_repr = repr(sel) if sel else None

        if action.type == "navigate":
            lines.append(f'page.get("{action.url}"){ts}')
        elif action.type == "click":
            if sel_repr:
                lines.append(f'page.ele({sel_repr}).click(){ts}')
        elif action.type == "type":
            if sel_repr:
                val = action.value.replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'page.ele({sel_repr}).input("{val}"){ts}')
        elif action.type == "scroll":
            lines.append(f'page.scroll.down(300){ts}')
        elif action.type == "wait":
            lines.append(f'page.wait(1){ts}')
        elif action.type == "select":
            if sel_repr:
                val = action.value.replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'page.ele({sel_repr}).select("{val}"){ts}')

    lines.append("")
    lines.append(f"# 录制生成，共 {len(actions)} 步操作")
    return "\n".join(lines)
