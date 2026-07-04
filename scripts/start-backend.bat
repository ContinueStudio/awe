@echo off
REM 仅启动后端 (开发调试用)
chcp 65001 > nul
setlocal
set ROOT=%~dp0..
cd /d "%ROOT%\backend"
if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
python run.py
endlocal
