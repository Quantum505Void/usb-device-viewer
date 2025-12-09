#!/bin/bash
# USB Device Viewer - uv 运行脚本 (Linux/macOS)

set -e

echo "🚀 USB Device Viewer - uv 运行"
echo "======================================"

# 检查 uv 是否安装
if ! command -v uv &> /dev/null; then
    echo "❌ uv 未安装"
    echo "请安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "📦 创建虚拟环境..."
    uv venv
fi

# 安装依赖
echo "📥 安装依赖..."
uv sync

# 运行应用
echo "🔥 启动应用..."
uv run python -m usbviewer
