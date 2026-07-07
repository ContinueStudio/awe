"""密钥加密模块（PRD §8.4）。

使用 Fernet (AES-128-CBC + HMAC) 对称加密 API Key。
主密钥于首次启动时随机生成，存入 .env 的 AWE_SECRET_KEY 字段。
加密后的 Key 存入 SQLite settings 表，实现密钥与数据分离存储。
"""
from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet

from .config import PROJECT_ROOT

_ENV_PATH = PROJECT_ROOT / ".env"


def _load_secret_key() -> bytes:
    """从 .env 文件读取主密钥，若不存在则生成并写入。"""
    key: str | None = None

    if _ENV_PATH.exists():
        for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("AWE_SECRET_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

    if key:
        return key.encode("utf-8")

    # 首次启动：生成新密钥并写入 .env
    key = Fernet.generate_key().decode("ascii")
    content = _ENV_PATH.read_text(encoding="utf-8") if _ENV_PATH.exists() else ""
    if "AWE_SECRET_KEY=" not in content:
        new_line = f"\nAWE_SECRET_KEY={key}\n" if content and not content.endswith("\n") else f"AWE_SECRET_KEY={key}\n"
        content += new_line
        _ENV_PATH.write_text(content, encoding="utf-8")
    else:
        # 已存在但未加载到（罕见），更新值
        import re
        content = re.sub(r"AWE_SECRET_KEY=.*", f"AWE_SECRET_KEY={key}", content)
        _ENV_PATH.write_text(content, encoding="utf-8")

    return key.encode("utf-8")


_secret_key: bytes | None = None


def _get_fernet() -> Fernet:
    """懒加载 Fernet 实例。"""
    global _secret_key
    if _secret_key is None:
        _secret_key = _load_secret_key()
    return Fernet(_secret_key)


def encrypt(plaintext: str) -> str:
    """加密明文字符串，返回 base64 编码的密文。"""
    if not plaintext:
        return ""
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    """解密密文字符串，返回明文。"""
    if not ciphertext:
        return ""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode("ascii")).decode("utf-8")
