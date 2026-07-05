@echo off
REM AWE one-click launcher (v2.25.1).
REM Pure ASCII only (cmd.exe decodes .bat as GBK; Chinese chars cause mojibake).
REM
REM Usage:
REM   start.bat                  ->  backend + desktop window (default)
REM   start.bat --dev            ->  + Vite dev (HMR)
REM   start.bat --skip-port-clean  ->  skip killing old :8765 / :5173
title AWE Launcher

cd /d "%~dp0"

set "PY="
if exist "backend\venv\Scripts\python.exe" (
    set "PY=backend\venv\Scripts\python.exe"
)

set "ARGS=--window %*"

if defined PY (
    "%PY%" start.py %ARGS%
) else (
    where py >nul 2>nul
    if %ERRORLEVEL%==0 (
        py start.py %ARGS%
    ) else (
        python start.py %ARGS%
    )
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AWE] Start failed with code %ERRORLEVEL%
)

echo.
echo Press any key to exit...
pause >nul
