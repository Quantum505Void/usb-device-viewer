@echo off
REM Windows 打包脚本

echo 🚀 HID设备查看器 - Windows 打包脚本
echo ==========================================

REM 检查虚拟环境
if not exist ".venv" (
    echo ❌ 错误: 虚拟环境不存在
    echo 请先运行: uv venv
    echo 然后安装依赖: uv pip install -e .
    pause
    exit /b 1
)

echo ✅ 找到虚拟环境
echo.

REM 检查 uv
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 找不到 uv
    echo 请先安装 uv
    pause
    exit /b 1
)

REM 检查 Python 版本
uv run python --version

REM 检查PyInstaller是否安装
uv run python -c "import PyInstaller" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ 错误: 找不到 PyInstaller 模块
    echo 正在安装 PyInstaller...
    uv pip install pyinstaller
    if %errorlevel% neq 0 (
        echo ❌ 安装失败
        pause
        exit /b 1
    )
)

echo.
echo 📦 开始打包...
echo.

REM 运行打包脚本
uv run python build.py

echo.
echo ✅ 完成！
pause
