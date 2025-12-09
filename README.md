# USB Device Viewer

跨平台 USB HID 设备查看工具 - 使用 PySide6 构建的现代化桌面应用

## ✨ 特性

- 🖥️ **跨平台支持**: 完美运行在 Linux、Windows、macOS
- 🎨 **现代化界面**: 基于 Qt6 的原生桌面体验
- 🔍 **实时搜索**: 快速过滤设备列表
- 📋 **一键复制**: 轻松复制设备信息到剪贴板
- 💾 **导出功能**: 支持导出完整的设备列表
- 🔄 **自动刷新**: 实时监控USB设备变化
- 📊 **详细信息**: 显示设备ID、厂商、产品名称等详细信息
- 🌐 **多语言就绪**: 界面采用中文设计

## 🚀 快速开始

### 开发运行

**Linux / macOS:**

```bash
./run.sh             # 快速运行应用
```

**Windows:**

```cmd
run.bat              # 快速运行应用
```

### 打包单文件可执行程序（使用 Nuitka）

**通用构建脚本（推荐）:**

```bash
python3 build.py     # 跨平台通用构建脚本
# 或
./build.py          # Linux/macOS 直接执行
# 或
python build.py     # Windows
```

**平台特定脚本:**

**Linux / macOS:**

```bash
./build.sh          # 调用 build.py
```

**Windows:**

```cmd
build.bat           # 调用 build.py
```

构建产物：

- **Linux**: `dist/usbviewer.bin` (单文件可执行程序)
- **Windows**: `dist/usbviewer.exe` (单文件可执行程序)
- **macOS**: `dist/USB Device Viewer.app` (应用程序包)

## 🔧 构建特性

- ✅ **单文件模式**: 使用 `--onefile` 模式，生成单个可执行文件
- ✅ **自动依赖管理**: 自动检查和安装 Nuitka、PySide6、hidapi
- ✅ **跨平台支持**: Windows/Linux/macOS 统一构建脚本
- ✅ **性能优化**:
  - 多核并行编译（自动检测 CPU 核心数）
  - LTO 链接时优化（提升运行性能）
  - 反膨胀插件（减少最终文件体积）
- ✅ **智能清理**: 自动清理 `.build` 目录，保持输出目录整洁
- ✅ **友好界面**: 彩色输出、进度提示、错误诊断
- ✅ **自动下载**: 自动下载所需的编译工具链

## 📦 构建输出

构建完成后，在 `dist/` 目录下生成单文件可执行程序：

**Linux:**

```bash
dist/usbviewer.bin
```

**Windows:**

```cmd
dist\usbviewer.exe
```

**macOS:**

```bash
dist/USB Device Viewer.app
```

### 运行程序

**Linux:**

```bash
cd dist
./usbviewer.bin
```

**Windows:**

```cmd
cd dist
usbviewer.exe
```

**macOS:**

```bash
open dist/USB\ Device\ Viewer.app
```

### 💡 关于 HIDAPI 库

HIDAPI 提供跨平台的 HID 设备访问：

- ✅ **Windows**: 无需额外驱动，直接使用系统 HID API
- ✅ **Linux**: 使用 hidraw 内核接口
- ✅ **macOS**: 使用 IOHidManager API
- ✅ **无需 root 权限**（大多数情况下）
- ✅ **直接读取设备字符串**（厂商、产品名称、序列号）
- ⚠️ **注意**: 系统正在使用的键盘/鼠标可能无法访问

## 🔧 技术栈

- **Python**: 3.10+
- **GUI 框架**: PySide6 (Qt6 for Python)
- **HID 库**: hidapi
- **打包工具**: Nuitka (Python 编译器)
- **包管理**: pip / uv

## 🐧 Linux 系统依赖

```bash
# Debian/Ubuntu
sudo apt install libhidapi-dev libhidapi-hidraw0 libhidapi-libusb0

# Fedora/RHEL
sudo dnf install hidapi hidapi-devel

# Arch Linux
sudo pacman -S hidapi
```

## 📂 项目结构

```text
usb-device-viewer/
├── src/
│   └── usbviewer/               # 主应用代码
│       ├── __init__.py
│       ├── __main__.py          # 应用逻辑
│       ├── app.py               # Briefcase 入口点
│       └── icon.*               # 应用图标
├── pyproject.toml               # 项目配置
├── LICENSE                      # MIT 许可证
├── run.sh / run.bat             # 快速运行脚本 (Unix/Windows)
├── build.sh / build.bat         # 构建脚本 (Unix/Windows)
├── briefcase-build.sh           # Briefcase 构建脚本
└── README.md                    # 本文件
```

## 📜 可用脚本

### 开发和调试

- `./run.sh` / `run.bat` - 快速运行应用（开发模式）
- `python3 -m src.usbviewer` - 直接运行源码

### 构建打包

- `python3 build.py` - 通用构建脚本（推荐）
- `./build.sh` - Linux/macOS 构建封装
- `build.bat` - Windows 构建封装

## 🔗 相关链接

- [Nuitka 官方文档](https://nuitka.net/doc/user-manual.html)
- [PySide6 文档](https://doc.qt.io/qtforpython/)
- [HIDAPI 项目](https://github.com/libusb/hidapi)

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
