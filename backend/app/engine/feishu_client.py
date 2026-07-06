"""飞书多维表格 API 客户端封装。

参考飞书开放平台文档：
- 创建多维表格: POST /open-apis/bitable/v1/apps
- 新增字段:     POST /open-apis/bitable/v1/apps/{app}/tables/{table}/fields
- 新增记录:     POST /open-apis/bitable/v1/apps/{app}/tables/{table}/records

认证：
- 自建应用获取 tenant_access_token: POST /open-apis/auth/v3/tenant_access_token/internal
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List, Optional

import httpx

BASE_URL = "https://open.feishu.cn/open-apis"

# 简单内存缓存：{ (app_id): (token, expire_at) }
_token_cache: Dict[str, tuple[str, float]] = {}
_token_lock = asyncio.Lock()


async def get_tenant_access_token(app_id: str, app_secret: str) -> str:
    """获取 tenant_access_token（带缓存，过期前 5min 自动刷新）。"""
    key = (app_id, app_secret)
    async with _token_lock:
        cached = _token_cache.get(key)
        if cached:
            token, expire_at = cached
            if time.time() < expire_at - 300:  # 提前 5min 刷新
                return token

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{BASE_URL}/auth/v3/tenant_access_token/internal",
                json={"app_id": app_id, "app_secret": app_secret},
            )
        data = resp.json()
        if data.get("code") != 0:
            raise ValueError(
                f"获取 tenant_access_token 失败: code={data.get('code')} msg={data.get('msg')}"
            )
        token = data["tenant_access_token"]
        expire = int(data["expire"])  # 秒
        _token_cache[key] = (token, time.time() + expire)
        return token


async def _request(
    method: str,
    path: str,
    app_id: str,
    app_secret: str,
    json_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """带自动鉴权的飞书 API 请求（POST/PUT/DELETE 用 json_body）。"""
    token = await get_tenant_access_token(app_id, app_secret)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    url = f"{BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, url, headers=headers, json=json_body)
    return resp.json()


async def _request_get(
    path: str,
    app_id: str,
    app_secret: str,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """带自动鉴权的 GET 请求（query params 形式）。"""
    token = await get_tenant_access_token(app_id, app_secret)
    headers = {
        "Authorization": f"Bearer {token}",
    }
    url = f"{BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)
    return resp.json()


# ---- 业务 API ----

async def create_bitable(
    app_id: str,
    app_secret: str,
    name: str,
    folder_token: Optional[str] = None,
) -> Dict[str, Any]:
    """创建多维表格，返回 app_token / url / table_id / revision。

    POST /open-apis/bitable/v1/apps
    """
    body: Dict[str, Any] = {"name": name}
    if folder_token:
        body["folder_token"] = folder_token
    data = await _request("POST", "/bitable/v1/apps", app_id, app_secret, body)
    if data.get("code") != 0:
        raise ValueError(f"创建多维表格失败: {data.get('code')} {data.get('msg')}")
    app = data.get("data", {}).get("app", {})
    return {
        "app_token": app.get("app_token", ""),
        "url": app.get("url", ""),
        "table_id": app.get("table_id", ""),
        "revision": app.get("revision", -1),
    }


async def create_field(
    app_id: str,
    app_secret: str,
    app_token: str,
    table_id: str,
    field_name: str,
    field_type: int = 1,  # 1=文本
    property: Optional[Dict[str, Any]] = None,
    ui_type: Optional[str] = None,
) -> Dict[str, Any]:
    """在指定数据表新增一个字段。

    POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields
    """
    body: Dict[str, Any] = {
        "field_name": field_name,
        "type": field_type,
    }
    if property:
        body["property"] = property
    if ui_type:
        body["ui_type"] = ui_type
    path = f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields"
    data = await _request("POST", path, app_id, app_secret, body)
    if data.get("code") != 0:
        raise ValueError(f"创建字段失败: {data.get('code')} {data.get('msg')}")
    return data.get("data", {})


async def list_records(
    app_id: str,
    app_secret: str,
    app_token: str,
    table_id: str,
    page_size: int = 500,
) -> List[Dict[str, Any]]:
    """分页读取数据表中所有记录，返回 records 列表。

    GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
    """
    records: List[Dict[str, Any]] = []
    page_token: Optional[str] = None
    while True:
        params: Dict[str, Any] = {"page_size": page_size}
        if page_token:
            params["page_token"] = page_token
        path = f"/bitable/v1/apps/{app_token}/tables/{table_id}/records"
        data = await _request_get(path, app_id, app_secret, params)
        if data.get("code") != 0:
            raise ValueError(f"读取记录失败: {data.get('code')} {data.get('msg')}")
        items = data.get("data", {}).get("items", [])
        records.extend(items)
        if not data.get("data", {}).get("has_more"):
            break
        page_token = data.get("data", {}).get("page_token")
    return records


async def create_record(
    app_id: str,
    app_secret: str,
    app_token: str,
    table_id: str,
    fields: Dict[str, Any],
) -> Dict[str, Any]:
    """在数据表中新增一条记录。

    POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
    """
    body: Dict[str, Any] = {"fields": fields}
    path = f"/bitable/v1/apps/{app_token}/tables/{table_id}/records"
    data = await _request("POST", path, app_id, app_secret, body)
    if data.get("code") != 0:
        raise ValueError(f"新增记录失败: {data.get('code')} {data.get('msg')}")
    return data.get("data", {})
