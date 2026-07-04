@echo off
REM 仅启动前端 dev (开发调试用)
chcp 65001 > nul
setlocal
set ROOT=%~dp0..
cd /d "%ROOT%\frontend"
call npm run dev
endlocal
