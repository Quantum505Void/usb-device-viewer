@echo off
REM USB Device Viewer - uv 运行脚本 (Windows)

echo ================================
echo USB Device Viewer - uv 运行
echo ================================

REM 检查 uv 是否安装
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] uv 未安装
    echo 请安装 uv: https://docs.astral.sh/uv/getting-started/installation/
    pause
    exit /b 1
)

REM 检查虚拟环境
if not exist ".venv" (
    echo [信息] 创建虚拟环境...
    uv venv
)

REM 安装依赖
echo [信息] 安装依赖...
uv sync

REM 运行应用
echo [信息] 启动应用...
uv run python -m usbviewer

pause
