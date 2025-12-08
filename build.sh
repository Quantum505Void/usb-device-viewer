#!/bin/bash
# Linux/macOS 打包脚本

echo "🚀 USB设备查看器 - Linux/macOS 打包脚本"
echo "=========================================="

# 检查是否安装了PyInstaller
if ! python3 -c "import PyInstaller" &> /dev/null; then
    echo "❌ 错误: 找不到 PyInstaller 模块"
    echo "请运行: pip install pyinstaller"
    exit 1
fi

# 检查Python版本
python3 --version

echo ""
echo "📦 开始打包..."
echo ""

# 运行打包脚本
python3 build.py

echo ""
echo "✅ 完成！"
