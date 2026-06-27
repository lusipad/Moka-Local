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
for /f "tokens=*" %%i in ('"node -v"') do echo [✓] Node.js: %%i

:: ── Python setup ──
set "HAS_BUNDLED=0"
set "HAS_SYSTEM=0"

if exist "python\python.exe" (
    set "HAS_BUNDLED=1"
    echo [✓] 检测到内置 Python
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set "HAS_SYSTEM=1"
        for /f "tokens=*" %%i in ('"python --version 2>&1"') do echo [✓] 系统 Python: %%i
    )
)

if "%HAS_BUNDLED%"=="0" if "%HAS_SYSTEM%"=="0" (
    echo.
    echo [INFO] 未检测到 Python，正在自动下载嵌入式 Python 3.12...
    echo        下载约 10 MB，安装 PaddleOCR 约需 2-5 分钟（取决于网速）
    echo.
    PowerShell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip' -OutFile 'python-embed.zip'"
    if %errorlevel% neq 0 (
        echo [ERROR] Python 下载失败，请手动安装 https://www.python.org
        pause
        exit /b 1
    )
    mkdir python 2>nul
    tar -xf python-embed.zip -C python
    del python-embed.zip

    :: Enable pip
    PowerShell -Command "(Get-Content python\python312._pth) -replace '#import site', 'import site' | Set-Content python\python312._pth"

    :: Install pip
    PowerShell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py'"
    python\python.exe get-pip.py --no-warn-script-location
    del get-pip.py

    set "HAS_BUNDLED=1"
    echo [✓] 内置 Python 安装完成
)

:: ── Poppler setup ──
if exist "poppler\Library\bin" (
    echo [✓] 检测到内置 Poppler
) else (
    echo.
    echo [INFO] 正在下载 Poppler（PDF 转图片依赖）...
    PowerShell -Command "try { Invoke-WebRequest -Uri 'https://github.com/oschwartz10612/poppler-windows/releases/download/v24.08.0-0/Release-24.08.0-0.zip' -OutFile 'poppler.zip' } catch { exit 1 }"
    if %errorlevel% neq 0 (
        echo [WARN] Poppler 下载失败，PDF 扫描件识别不可用
    ) else (
        mkdir poppler 2>nul
        tar -xf poppler.zip -C poppler
        del poppler.zip
        for /d %%d in (poppler\*) do (
            move "%%d\*" poppler\ >nul 2>&1
            rmdir /s /q "%%d" 2>nul
            goto :poppler_done
        )
        :poppler_done
        echo [✓] Poppler 安装完成
    )
)

:: ── Install Python dependencies ──
echo.
echo [1/3] 安装 Node.js 依赖...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install 失败
    pause
    exit /b 1
)
echo [✓] Node 依赖安装完成

echo.
echo [2/3] 安装 Python 依赖（PaddleOCR + pdf2image + textract + olefile）...
if "%HAS_BUNDLED%"=="1" (
    set "PYCMD=%CD%\python\python.exe"
) else (
    set "PYCMD=python"
)
"%PYCMD%" -m pip install --no-warn-script-location paddlepaddle paddleocr pdf2image textract olefile
if %errorlevel% neq 0 (
    echo [WARN] PaddleOCR 安装可能失败，图片识别功能不可用
    echo       可手动执行: "%PYCMD%" -m pip install paddlepaddle paddleocr
)
echo [✓] Python 依赖安装完成

echo.
echo [3/3] 编译 TypeScript...
call npx tsc
if %errorlevel% neq 0 (
    echo [ERROR] TypeScript 编译失败
    pause
    exit /b 1
)
echo [✓] 编译完成

echo.
echo ========================================
echo   安装完成！双击 start.bat 启动系统
echo ========================================
pause