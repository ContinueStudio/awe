@echo off
REM AWE 一键停止 (杀掉 8765 / 5173 端口占用)
chcp 65001 >nul
title AWE 停止服务

echo.
echo [AWE] 正在停止服务...

for %%P in (8765 5173) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P "') do (
    if not "%%I"=="0" (
      taskkill /F /PID %%I >nul 2>&1
      echo   - 杀掉 :%%P PID=%%I
    )
  )
)

REM 兜底：杀 uvicorn / node 残留
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq AWE*" >nul 2>&1

echo [AWE] 已停止。
echo.
pause
