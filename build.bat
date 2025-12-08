@echo off
REM Windows 打包脚本

echo 🚀 USB设备查看器 - Windows 打包脚本
echo ==========================================

REM 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 找不到 Python
    echo 请先安装 Python 3.8 或更高版本
    pause
    exit /b 1
)

REM 检查PyInstaller是否安装
python -c "import PyInstaller" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 找不到 PyInstaller 模块
    echo 请运行: pip install pyinstaller
    pause
    exit /b 1
)

echo.
echo 📦 开始打包...
echo.

REM 运行打包脚本
python build.py

echo.
echo ✅ 完成！
pause
