# USB设备查看器 - PySide6版本

跨平台USB设备信息查看工具，使用 PySide6 (Qt for Python) 构建的现代化桌面应用。

## ✨ 特性

- 🖥️ **跨平台支持**: 完美运行在 Linux、Windows、macOS
- 🎨 **现代化界面**: 基于 Qt6 的原生桌面体验
- 🔍 **实时搜索**: 快速过滤设备列表
- 📋 **一键复制**: 轻松复制设备信息到剪贴板
- 💾 **导出功能**: 支持导出完整的设备列表
- 🔄 **自动刷新**: 实时监控USB设备变化
- 📊 **详细信息**: 显示设备ID、厂商、产品名称等详细信息
- 🌐 **多语言就绪**: 界面采用中文设计

## 📦 安装依赖

使用 pip 安装：

```bash
pip install PySide6 pyusb
```

或使用 uv（推荐）：

```bash
uv pip install PySide6 pyusb
```

从项目文件安装所有依赖：

```bash
uv sync
```

## 🚀 运行

### 直接运行

```bash
# Linux/macOS
python3 usb_viewer_pyside.py

# Windows
python usb_viewer_pyside.py
```

### 使用便捷脚本

```bash
# Linux/macOS
./run_pyside.sh

# Windows
run_pyside.bat
```

### 使用 uv 运行（推荐）

```bash
uv run python3 usb_viewer_pyside.py
```

## 📦 打包为可执行文件

项目包含构建脚本，可将应用打包为独立可执行文件：

```bash
# Linux/macOS
./build.sh

# Windows
build.bat

# 或使用 Python 脚本
python build.py
```

打包后的文件位于 `dist/` 目录。

## 🛠️ 技术栈

- **Python** 3.10+
- **PySide6** 6.6.0+ - Qt6 的官方 Python 绑定
- **PyUSB** 1.2.1+ - USB 设备访问库
- **PyInstaller** - 用于打包可执行文件

## 💡 为什么选择 PySide6？

1. **原生性能**: Qt 提供真正的原生桌面体验
2. **成熟稳定**: Qt 是业界领先的 GUI 框架
3. **丰富组件**: 提供完整的桌面应用组件库
4. **跨平台一致**: 在所有平台上保持一致的外观和行为
5. **专业级应用**: 适合构建专业的桌面应用程序

## 📋 系统要求

- **Python**: 3.10 或更高版本
- **Linux**: `lsusb` 命令（通常已预装）
- **Windows**: PowerShell 支持
- **macOS**: `system_profiler` 命令（系统自带）

## 📝 项目结构

```
usb-device-viewer/
├── usb_viewer_pyside.py   # 主程序文件
├── pyproject.toml          # 项目配置和依赖
├── usb_viewer.spec         # PyInstaller 打包配置
├── build.py                # 构建脚本
├── build.sh / build.bat    # 平台特定构建脚本
├── run_pyside.sh / .bat    # 平台特定运行脚本
└── README.md               # 本文件
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
