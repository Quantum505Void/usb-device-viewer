#!/bin/bash
# Linux/macOS 打包脚本

echo "🚀 HID设备查看器 - Linux/macOS 打包脚本"
echo "=========================================="

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "❌ 错误: 虚拟环境不存在"
    echo "请先运行: python3 -m venv .venv"
    echo "然后激活: source .venv/bin/activate"
    echo "安装依赖: pip install -e ."
    exit 1
fi

echo "✅ 找到虚拟环境"
echo ""

# 检查 uv
if ! command -v uv &> /dev/null; then
    echo "❌ 错误: 找不到 uv"
    echo "请先安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 检查Python版本
uv run python --version

# 检查是否安装了PyInstaller
if ! uv run python -c "import PyInstaller" &> /dev/null; then
    echo ""
    echo "❌ 错误: 找不到 PyInstaller 模块"
    echo "正在安装 PyInstaller..."
    uv pip install pyinstaller
    if [ $? -ne 0 ]; then
        echo "❌ 安装失败"
        exit 1
    fi
fi

echo ""
echo "📦 开始打包..."
echo ""

# 运行打包脚本
uv run python build.py

echo ""
echo "✅ 完成！"
