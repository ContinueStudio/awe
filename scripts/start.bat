@echo off
REM AWE 一键启动 (后端 + 前端 dev)
chcp 65001 > nul
setlocal

set ROOT=%~dp0..
cd /d "%ROOT%"

if not exist backend\venv (
  echo [AWE] 创建 Python 虚拟环境...
  python -m venv backend\venv
)

call backend\venv\Scripts\activate.bat

echo [AWE] 安装后端依赖...
python -m pip install -q --upgrade pip
pip install -q -r backend\requirements.txt

if not exist frontend\node_modules (
  echo [AWE] 安装前端依赖...
  pushd frontend
  call npm install
  popd
)

echo.
echo [AWE] 启动后端 (端口 8765) ...
start "AWE-Backend" cmd /k "cd /d %ROOT%\backend && call venv\Scripts\activate && python run.py"

echo [AWE] 启动前端 dev server (端口 5173) ...
start "AWE-Frontend" cmd /k "cd /d %ROOT%\frontend && npm run dev"

echo.
echo [AWE] 等待服务就绪...
timeout /t 5 /nobreak > nul

start http://127.0.0.1:5173

echo.
echo [AWE] 浏览器已打开。若未自动打开请手动访问: http://127.0.0.1:5173
echo [AWE] 关闭对应命令行窗口即可停止服务。
endlocal
