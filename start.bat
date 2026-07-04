@echo off
REM AWE 一键启动 (后端 8765 + 可选 Vite dev 5173)
REM 参照 D:\APA\lawe_project\start.bat 实现
chcp 65001 >nul
title AWE v0.2.9 启动器

cd /d "%~dp0"

echo.
echo ======================================================
echo   AWE - Agentic Workflow Engine v0.2.9
echo ======================================================
echo.

REM 优先使用 backend\venv 的 Python；如无则降级到 PATH
set "PY="
if exist "backend\venv\Scripts\python.exe" set "PY=backend\venv\Scripts\python.exe"

if defined PY (
  "%PY%" start.py %*
) else (
  where py >nul 2>nul
  if %ERRORLEVEL%==0 (
    py start.py %*
  ) else (
    python start.py %*
  )
)

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [AWE] 启动失败，错误码 %ERRORLEVEL%
)

echo.
echo Press any key to exit...
pause >nul
