@echo off
REM HID Device Viewer - 构建脚本 (Windows)
REM 此脚本调用通用的 build.py 进行编译
chcp 65001 >nul

REM 检查虚拟环境
if not exist ".venv\Scripts\python.exe" (
    echo [错误] 未找到虚拟环境
    echo 请先运行: uv venv
    echo 然后安装依赖: uv pip install -e .
    pause
    exit /b 1
)

echo [信息] 找到虚拟环境
set PYTHON_EXE=.venv\Scripts\python.exe

REM 检查 Python 版本
%PYTHON_EXE% --version

REM 检查 build.py 是否存在
if not exist "build.py" (
    echo [错误] 未找到 build.py
    echo 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 调用通用构建脚本
echo [信息] 调用通用构建脚本...
echo.
%PYTHON_EXE% build.py

REM 保存返回码
set BUILD_EXIT_CODE=%errorlevel%

echo.
if %BUILD_EXIT_CODE% equ 0 (
    echo [成功] 构建完成！
) else (
    echo [错误] 构建失败！
)

pause
exit /b %BUILD_EXIT_CODE%
