#!/bin/bash
# USB Device Viewer - Nuitka 构建脚本 (Linux/macOS)
# 此脚本调用通用的 build.py 进行编译

set -e

# 检查 Python3 是否可用
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3"
    echo "请先安装 Python 3.10 或更高版本"
    exit 1
fi

# 检查 build.py 是否存在
if [ ! -f "build.py" ]; then
    echo "❌ 错误: 未找到 build.py"
    echo "请确保在项目根目录运行此脚本"
    exit 1
fi

# 调用通用构建脚本
echo "🚀 调用通用构建脚本..."
echo ""
python3 build.py

# 退出时使用 build.py 的返回码
exit $?
