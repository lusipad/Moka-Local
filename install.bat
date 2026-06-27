@echo off
chcp 65001 >nul
echo ========================================
echo   简历管理系统 - 环境安装
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Node.js，请先安装 https://nodejs.org
    pause
    exit /b 1
)
echo [✓] Node.js: %node_version%
for /f "tokens=*" %%i in ('node -v') do set node_version=%%i
echo     版本: %node_version%

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未检测到 Python，请先安装 https://www.python.org
    pause
    exit /b 1
)
echo [✓] Python:
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set py_version=%%i
echo     版本: %py_version%

:: Install Node dependencies
echo.
echo [1/3] 安装 Node.js 依赖...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install 失败
    pause
    exit /b 1
)
echo [✓] Node 依赖安装完成

:: Install Python dependencies
echo.
echo [2/3] 安装 Python 依赖（PaddleOCR + pdf2image）...
pip install paddlepaddle paddleocr pdf2image
if %errorlevel% neq 0 (
    echo [WARN] PaddleOCR 安装可能失败，图片识别功能不可用
    echo       可手动执行: pip install paddlepaddle paddleocr
)
echo [✓] Python 依赖安装完成

:: Build TypeScript
echo.
echo [3/3] 编译 TypeScript...
call npx tsc
if %errorlevel% neq 0 (
    echo [ERROR] TypeScript 编译失败
    pause
    exit /b 1
)
echo [✓] 编译完成

:: Pre-warm PaddleOCR models
echo.
echo [可选] 预下载 PaddleOCR 模型（首次启动更快）...
python scripts/ocr.py --help >nul 2>&1

echo.
echo ========================================
echo   安装完成！双击 start.bat 启动系统
echo ========================================
pause
