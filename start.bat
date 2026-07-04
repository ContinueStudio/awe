@echo off
REM AWE one-click launcher. Thin wrapper around start.py.
REM All output goes through Python (which forces UTF-8 internally).
REM Do NOT use chcp 65001 or Chinese characters in this file
REM  (cmd.exe decodes .bat as GBK by default, which would mangle them).
title AWE Launcher

cd /d "%~dp0"

REM Prefer venv python; fall back to PATH
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
  echo [AWE] Start failed with code %ERRORLEVEL%
)

echo.
echo Press any key to exit...
pause >nul
