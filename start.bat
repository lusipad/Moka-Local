@echo off
chcp 65001 >nul
echo ========================================
echo   简历管理系统
echo ========================================
echo.
echo   启动中...
echo   主服务:     http://localhost:3001
echo   Mock Moka:  http://localhost:3002
echo.
echo   按 Ctrl+C 停止所有服务
echo ========================================
echo.

:: Start Mock Moka in background
start "Moka-Mock" /MIN cmd /c "node dist/moka-mock.js"

:: Start main server in foreground
node dist/server.js

:: Cleanup on exit
taskkill /FI "WINDOWTITLE eq Moka-Mock*" /F >nul 2>&1
echo.
echo 服务已停止
pause
