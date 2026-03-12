@echo off
chcp 65001 >nul
title Git UI 管理工具
echo ==========================================
echo    Git UI 管理工具启动器
echo ==========================================
echo.

REM 设置项目路径
set "PROJECT_PATH=%~dp0"
set "BACKEND_PATH=%PROJECT_PATH%backend"
set "VENV_PYTHON=D:\Git\.venv\Scripts\python.exe"

echo [1/3] 检查后端服务...

REM 检查端口是否被占用
netstat -ano | findstr ":8765" >nul
if %errorlevel% equ 0 (
    echo     端口 8765 已被占用，服务可能已在运行
) else (
    echo     启动后端服务...
    start /min "Git UI Backend" cmd /c "cd /d "%BACKEND_PATH%" && "%VENV_PYTHON%" main.py"
    
    REM 等待服务启动
    echo     等待服务启动...
    timeout /t 3 /nobreak >nul
)

echo.
echo [2/3] 打开浏览器...
start http://localhost:8765

echo.
echo [3/3] 完成！
echo     浏览器已打开，请稍候...
echo.
echo ==========================================
echo    按任意键关闭此窗口（不会关闭服务）
echo ==========================================
pause >nul
