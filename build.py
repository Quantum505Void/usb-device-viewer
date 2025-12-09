#!/usr/bin/env python3
"""
USB Device Viewer - 通用 Nuitka 构建脚本
支持 Windows、Linux、macOS 跨平台编译
"""

import os
import sys
import platform
import subprocess
import shutil
from pathlib import Path


class Colors:
    """终端颜色"""

    if platform.system() == "Windows":
        # Windows 可能不支持 ANSI 颜色，使用空字符串
        HEADER = ""
        BLUE = ""
        GREEN = ""
        YELLOW = ""
        RED = ""
        ENDC = ""
        BOLD = ""
    else:
        HEADER = "\033[95m"
        BLUE = "\033[94m"
        GREEN = "\033[92m"
        YELLOW = "\033[93m"
        RED = "\033[91m"
        ENDC = "\033[0m"
        BOLD = "\033[1m"


def print_header(text):
    """打印标题"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text:^60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")


def print_info(text):
    """打印信息"""
    print(f"{Colors.BLUE}ℹ {text}{Colors.ENDC}")


def print_success(text):
    """打印成功消息"""
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")


def print_warning(text):
    """打印警告"""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.ENDC}")


def print_error(text):
    """打印错误"""
    print(f"{Colors.RED}✗ {text}{Colors.ENDC}")


def check_python_version():
    """检查 Python 版本"""
    if sys.version_info < (3, 10):
        print_error(f"需要 Python 3.10 或更高版本，当前版本: {sys.version}")
        sys.exit(1)
    print_success(f"Python 版本: {sys.version.split()[0]}")


def check_command(cmd):
    """检查命令是否存在"""
    return shutil.which(cmd) is not None


def install_package(package):
    """安装 Python 包"""
    print_info(f"正在安装 {package}...")

    # 尝试使用 uv pip（优先）
    if check_command("uv"):
        try:
            subprocess.run(
                ["uv", "pip", "install", package],
                check=True,
                capture_output=True,
                text=True,
            )
            print_success(f"{package} 安装成功")
            return True
        except subprocess.CalledProcessError as e:
            print_error(f"{package} 安装失败: {e.stderr if e.stderr else e}")
            return False

    # 回退到 pip
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            check=True,
            capture_output=True,
            text=True,
        )
        print_success(f"{package} 安装成功")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"{package} 安装失败: {e.stderr if e.stderr else e}")
        return False


def check_dependencies():
    """检查并安装依赖"""
    print_info("检查依赖...")

    # 检查 Nuitka
    try:
        result = subprocess.run(
            [sys.executable, "-m", "nuitka", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            # 提取版本号
            version_line = (
                result.stdout.strip().split("\n")[0] if result.stdout else "unknown"
            )
            print_success(f"Nuitka 已安装: {version_line}")
        else:
            raise FileNotFoundError()
    except (FileNotFoundError, subprocess.CalledProcessError):
        print_warning("Nuitka 未安装")
        if not install_package("nuitka>=2.0"):
            sys.exit(1)
        if not install_package("ordered-set>=4.1.0"):
            sys.exit(1)

    # 检查项目依赖
    try:
        import PySide6

        print_success("PySide6 已安装")
    except ImportError:
        print_warning("PySide6 未安装")
        if not install_package("PySide6>=6.6.0"):
            sys.exit(1)

    try:
        import hid

        print_success("hidapi 已安装")
    except ImportError:
        print_warning("hidapi 未安装")
        if not install_package("hidapi>=0.14.0"):
            print_warning("注意: hidapi 包导入名为 'hid'，但安装名为 'hidapi'")
            sys.exit(1)


def get_cpu_count():
    """获取 CPU 核心数"""
    try:
        return os.cpu_count() or 4
    except:
        return 4


def get_platform_info():
    """获取平台信息"""
    system = platform.system()
    machine = platform.machine()
    return {
        "system": system,
        "machine": machine,
        "is_windows": system == "Windows",
        "is_linux": system == "Linux",
        "is_macos": system == "Darwin",
    }


def clean_build():
    """清理构建文件"""
    print_info("清理旧的构建文件...")

    dirs_to_clean = [Path("dist"), Path("build")]
    for pattern in ["*.dist", "*.build", "*.onefile-build"]:
        dirs_to_clean.extend(list(Path(".").glob(pattern)))

    # 递归清理 __pycache__
    for pycache in Path(".").rglob("__pycache__"):
        dirs_to_clean.append(pycache)

    cleaned_count = 0
    for dir_path in dirs_to_clean:
        if dir_path.exists():
            try:
                if dir_path.is_dir():
                    shutil.rmtree(dir_path)
                    cleaned_count += 1
            except Exception as e:
                print_warning(f"无法删除 {dir_path}: {e}")

    if cleaned_count > 0:
        print_success(f"已清理 {cleaned_count} 个目录")
    else:
        print_info("无需清理")


def build_nuitka_command(platform_info):
    """构建 Nuitka 编译命令 - 基于 pyproject.toml 配置"""

    cmd = [
        sys.executable,
        "-m",
        "nuitka",
        # ============ 基本模式 ============
        "--onefile",
        "--standalone",
        "--output-dir=dist",
        "--remove-output",  # 编译后删除 .build 目录
        # ============ 依赖处理 ============
        "--enable-plugin=pyside6",
        "--include-module=hid",
        # ============ 性能优化 ============
        "--lto=auto",
        f"--jobs={get_cpu_count()}",
        "--assume-yes-for-downloads",
        # ============ 减少体积 ============
        "--nofollow-import-to=*.tests",
        "--nofollow-import-to=*test*",
        "--nofollow-import-to=PySide6.scripts",
        # ============ 反膨胀 ============
        "--noinclude-pytest-mode=error",
        "--noinclude-setuptools-mode=error",
        "--noinclude-unittest-mode=nofollow",
        # ============ 版本信息 ============
        "--product-name=USB Device Viewer",
        "--product-version=3.0.0",
        "--file-version=3.0.0",
        "--company-name=WAASSTT",
        "--file-description=查看和管理USB HID设备的跨平台工具",
    ]

    # 平台特定配置
    if platform_info["is_windows"]:
        cmd.append("--windows-console-mode=disable")
        icon_path = find_icon(["icon.ico", "src/usbviewer/icon.ico"])
        if icon_path:
            cmd.append(f"--windows-icon-from-ico={icon_path}")

    elif platform_info["is_macos"]:
        cmd.extend(
            [
                "--macos-create-app-bundle",
                "--macos-app-name=USB Device Viewer",
                "--macos-app-mode=gui",
            ]
        )
        icon_path = find_icon(["icon.icns", "src/usbviewer/icon.icns"])
        if icon_path:
            cmd.append(f"--macos-app-icon={icon_path}")

    elif platform_info["is_linux"]:
        icon_path = find_icon(["icon.png", "src/usbviewer/icon.png"])
        if icon_path:
            cmd.append(f"--linux-icon={icon_path}")
            print_success(f"找到图标: {icon_path}")

    # 主程序入口
    cmd.append("src/usbviewer")

    return cmd


def find_icon(paths):
    """查找图标文件"""
    for path in paths:
        if Path(path).exists():
            return path
    print_warning(f"未找到图标文件 (搜索: {', '.join(paths)})")
    return None


def show_command(cmd):
    """显示将要执行的命令"""
    print_info("将要执行的命令:")
    print(f"{Colors.YELLOW}", end="")
    for i, arg in enumerate(cmd):
        if i == 0:
            print(arg, end=" ")
        elif arg.startswith("--"):
            print(f"\n  {arg}", end="")
        else:
            print(f" {arg}", end="")
    print(f"{Colors.ENDC}\n")


def compile_project(platform_info):
    """编译项目"""
    print_header("开始 Nuitka 编译")

    # 构建命令
    cmd = build_nuitka_command(platform_info)

    # 显示命令
    show_command(cmd)

    # 执行编译
    print_info("正在编译，请耐心等待...")
    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print_error(f"编译失败，返回码: {e.returncode}")
        return False
    except KeyboardInterrupt:
        print_warning("\n编译被用户中断")
        return False


def show_output_info(platform_info):
    """显示输出信息"""
    print_header("构建完成")

    dist_dir = Path("dist")
    if not dist_dir.exists():
        print_error("未找到 dist 目录")
        return

    print_success("输出目录: dist/")

    # 计算总大小
    try:
        total_size = sum(f.stat().st_size for f in dist_dir.rglob("*") if f.is_file())
        total_size_mb = total_size / (1024 * 1024)
        print_info(f"总大小: {total_size_mb:.2f} MB")
    except Exception:
        pass

    print()

    # 列出输出文件 - onefile 模式
    if platform_info["is_windows"]:
        print_info("可执行文件:")
        # 在 onefile 模式下，查找 dist/ 下的 .exe 文件
        exe_files = list(dist_dir.glob("*.exe"))
        if exe_files:
            for exe in exe_files:
                size = exe.stat().st_size / (1024 * 1024)
                print(f"  📦 {exe} ({size:.2f} MB)")
            print()
            print_info("运行程序:")
            print(f"  {Colors.GREEN}{exe_files[0]}{Colors.ENDC}")
        else:
            print_warning("未找到可执行文件")

    elif platform_info["is_macos"]:
        # 在 onefile 模式下，查找 dist/ 下的 .app 包或可执行文件
        apps = list(dist_dir.glob("*.app"))
        if apps:
            print_info("应用程序包:")
            for app in apps:
                try:
                    size = sum(f.stat().st_size for f in app.rglob("*") if f.is_file())
                    size_mb = size / (1024 * 1024)
                    print(f"  🍎 {app} ({size_mb:.2f} MB)")
                except Exception:
                    print(f"  🍎 {app}")
            print()
            print_info("运行程序:")
            print(f"  {Colors.GREEN}open {apps[0]}{Colors.ENDC}")
        else:
            print_warning("未找到 .app 包")

    elif platform_info["is_linux"]:
        print_info("可执行文件:")
        # 在 onefile 模式下，查找 dist/ 下的可执行文件（.bin 或无扩展名）
        exe_files = [
            f
            for f in dist_dir.glob("*")
            if f.is_file() and os.access(f, os.X_OK) and not f.name.endswith(".so")
        ]
        if exe_files:
            for exe in exe_files:
                size = exe.stat().st_size / (1024 * 1024)
                print(f"  🐧 {exe} ({size:.2f} MB)")
            print()
            print_info("运行程序:")
            print(f"  {Colors.GREEN}./{exe_files[0]}{Colors.ENDC}")
        else:
            print_warning("未找到可执行文件")

    print()


def main():
    """主函数"""
    try:
        print_header("USB Device Viewer - Nuitka 构建工具")

        # 检查 Python 版本
        check_python_version()

        # 获取平台信息
        platform_info = get_platform_info()
        print_info(f"操作系统: {platform_info['system']} ({platform_info['machine']})")
        print_info(f"CPU 核心数: {get_cpu_count()}")
        print()

        # 检查依赖
        check_dependencies()
        print()

        # 清理构建
        clean_build()
        print()

        # 编译项目
        if compile_project(platform_info):
            print()
            show_output_info(platform_info)
            print()
            print_success("构建成功！")
            return 0
        else:
            print()
            print_error("构建失败！")
            return 1

    except KeyboardInterrupt:
        print()
        print_warning("操作被用户取消")
        return 130
    except Exception as e:
        print()
        print_error(f"发生错误: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
