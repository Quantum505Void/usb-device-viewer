#!/bin/bash
# 运行 PySide6 版本的 USB 设备查看器

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "❌ 错误: 虚拟环境不存在"
    echo "请先运行: python3 -m venv .venv"
    echo "然后安装依赖: source .venv/bin/activate && pip install PySide6 pyusb libusb-package"
    exit 1
fi

# 激活虚拟环境并运行
source .venv/bin/activate
python3 usb_viewer_pyside.py
