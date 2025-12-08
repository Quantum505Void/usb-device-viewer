#!/usr/bin/env python3
"""
USB设备查看器打包脚本
支持打包成Windows和Linux可执行文件
使用 PyInstaller 打包 PySide6 版本
"""

import subprocess
import sys
import platform
import os


def build_app():
    """使用 PyInstaller 打包应用"""

    system = platform.system().lower()

    if system == "windows" or system.startswith("win"):
        print("🔨 正在为 Windows 打包...")
        output_name = "usb_viewer.exe"
    elif system == "linux":
        print("🔨 正在为 Linux 打包...")
        output_name = "usb_viewer"
    elif system == "darwin":
        print("🔨 正在为 macOS 打包...")
        output_name = "usb_viewer"
    else:
        print(f"❌ 不支持的系统: {system}")
        sys.exit(1)

    # PyInstaller 打包命令
    cmd = [
        "pyinstaller",
        "--name=usb_viewer",
        "--onefile",  # 打包成单个可执行文件
        "--windowed",  # Windows下不显示控制台
        "--clean",  # 清理临时文件
        "usb_viewer_pyside.py",
    ]

    print(f"\n📦 执行命令: {' '.join(cmd)}\n")

    try:
        # 执行打包命令
        result = subprocess.run(cmd, check=True)

        if result.returncode == 0:
            print("\n✅ 打包成功！")
            print(f"\n📂 输出目录: dist/")
            print(f"   可执行文件: {output_name}")
        else:
            print("\n❌ 打包失败")
            sys.exit(1)

    except subprocess.CalledProcessError as e:
        print(f"\n❌ 打包过程出错: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("\n❌ 错误: 找不到 'pyinstaller' 命令")
        print("请确保已安装 PyInstaller: pip install pyinstaller")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 未知错误: {e}")
        sys.exit(1)


def main():
    print("=" * 60)
    print("🚀 USB设备查看器 - 自动打包工具")
    print("=" * 60)

    # 检查Python版本
    if sys.version_info < (3, 10):
        print("❌ 需要 Python 3.10 或更高版本")
        sys.exit(1)

    print(f"\n🐍 Python 版本: {sys.version}")
    print(f"💻 操作系统: {platform.system()} {platform.release()}")

    build_app()


if __name__ == "__main__":
    main()
