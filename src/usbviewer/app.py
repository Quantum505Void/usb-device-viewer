"""应用入口点"""

import sys


def main():
    """应用主入口"""
    # 导入主应用模块
    from usbviewer.__main__ import main as app_main

    # 运行应用
    return app_main()


if __name__ == "__main__":
    sys.exit(main())
