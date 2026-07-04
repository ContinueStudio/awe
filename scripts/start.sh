#!/usr/bin/env bash
# AWE 一键启动 (后端 + 前端 dev)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d backend/venv ]; then
  echo "[AWE] 创建 Python 虚拟环境..."
  python3 -m venv backend/venv
fi

source backend/venv/bin/activate

echo "[AWE] 安装后端依赖..."
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

if [ ! -d frontend/node_modules ]; then
  echo "[AWE] 安装前端依赖..."
  (cd frontend && npm install)
fi

echo "[AWE] 启动后端 (端口 8765) ..."
(cd backend && python run.py) &

echo "[AWE] 启动前端 dev server (端口 5173) ..."
(cd frontend && npm run dev) &

sleep 5
open http://127.0.0.1:5173 || xdg-open http://127.0.0.1:5173 || true
echo "[AWE] 访问: http://127.0.0.1:5173"
wait
