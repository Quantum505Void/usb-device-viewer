# HID设备查看器 - PySide6版本

跨平台HID设备信息查看工具，使用 PySide6 (Qt for Python) 构建的现代化桌面应用。

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

```bash
# 使用 uv（推荐）
uv pip install -e .

# 或手动安装
pip install PySide6 hidapi
```

### 💡 关于 HIDAPI 库

HIDAPI 提供跨平台的 HID 设备访问：

- ✅ **Windows**: 无需额外驱动，直接使用系统 HID API
- ✅ **Linux**: 使用 hidraw 内核接口
- ✅ **macOS**: 使用 IOHidManager API
- ✅ **无需 root 权限**（大多数情况下）
- ✅ **直接读取设备字符串**（厂商、产品名称、序列号）
- ⚠️ **注意**: 系统正在使用的键盘/鼠标可能无法访问

## 🚀 运行

### 方法一：使用启动脚本（推荐）

**Windows**:

```cmd
run_pyside.bat
```

**Linux/macOS**:

```bash
./run_pyside.sh
```

脚本会自动检查虚拟环境，如不存在会给出提示。

### 方法二：直接运行

```bash
# 使用 uv（推荐）
uv run python usb_viewer_pyside.py

# 或使用 python
python usb_viewer_pyside.py
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
- **hidapi** 0.14.0+ - 基于 HIDAPI 的跨平台 HID 设备访问库
- **PyInstaller** - 用于打包可执行文件

## 💡 为什么选择 PySide6？

1. **原生性能**: Qt 提供真正的原生桌面体验
2. **成熟稳定**: Qt 是业界领先的 GUI 框架
3. **丰富组件**: 提供完整的桌面应用组件库
4. **跨平台一致**: 在所有平台上保持一致的外观和行为
5. **专业级应用**: 适合构建专业的桌面应用程序

## 📋 系统要求

- **Python**: 3.10 或更高版本
- **Windows**: 系统自带 HID 支持，无需额外配置
- **Linux**: hidraw 内核模块（通常已包含），可能需要 udev 规则
- **macOS**: 系统自带 HID 支持，无需额外配置

## 📝 项目结构

```text
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
