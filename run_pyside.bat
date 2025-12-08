@echo off
REM 运行 PySide6 版本的 USB 设备查看器

REM 检查虚拟环境
if not exist ".venv" (
    echo ❌ 错误: 虚拟环境不存在
    echo 请先运行: uv venv
    echo 然后安装依赖: uv pip install PySide6 pyusb libusb-package
    pause
    exit /b 1
)

REM 激活虚拟环境并运行
call .venv\Scripts\activate.bat
python usb_viewer_pyside.py
pause
