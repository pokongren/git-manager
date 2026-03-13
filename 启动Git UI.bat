@echo off
chcp 65001 >nul
title Git UI
echo ==========================================
echo    Git UI
echo ==========================================
echo.

REM Path settings
set "PROJECT_PATH=%~dp0"
set "BACKEND_PATH=%PROJECT_PATH%backend"
set "VENV_PYTHON=%~dp0..\.venv\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
    echo [ERROR] Python not found: %VENV_PYTHON%
    pause
    exit /b 1
)

if not exist "%BACKEND_PATH%\main.py" (
    echo [ERROR] main.py not found: %BACKEND_PATH%\main.py
    pause
    exit /b 1
)

echo [1/3] Checking backend...

netstat -ano | findstr ":8765" >nul 2>&1
if %errorlevel% equ 0 (
    echo     Port 8765 in use, service may be running
) else (
    echo     Starting backend...
    start /min "" cmd /c "cd /d %BACKEND_PATH% & %VENV_PYTHON% main.py"
    echo     Waiting for startup...
    timeout /t 3 /nobreak >nul
)

echo.
echo [2/3] Opening browser...
start http://localhost:8765

echo.
echo [3/3] Done!
echo.
echo ==========================================
echo    Press any key to close this window
echo ==========================================
pause >nul