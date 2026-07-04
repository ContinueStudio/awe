@echo off
REM AWE one-click stop. Kills processes on 8765 / 5173.
title AWE Stop

echo.
echo [AWE] Stopping services on :8765 and :5173...

for %%P in (8765 5173) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P "') do (
    if not "%%I"=="0" (
      taskkill /F /PID %%I >nul 2>&1
      echo   - killed :%%P PID=%%I
    )
  )
)

REM Fallback: kill lingering uvicorn / node windows
taskkill /F /IM uvicorn.exe >nul 2>&1

echo [AWE] Done.
echo.
pause
