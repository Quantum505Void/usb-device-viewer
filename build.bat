@echo off
REM USB Device Viewer - Nuitka 构建脚本 (Windows)
REM 此脚本调用通用的 build.py 进行编译
chcp 65001 >nul

REM 检查 Python 是否可用
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python
    echo 请先安装 Python 3.10 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

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
python build.py

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
