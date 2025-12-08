# USB设备查看器 - Flet版本

这是使用Flet框架重写的USB设备查看器,具有现代化的跨平台界面。

## 特性

✨ **现代化UI**: 使用Flet创建美观的Material Design界面
🖥️ **跨平台**: 支持Linux、Windows、macOS
🔍 **实时搜索**: 快速过滤设备列表
📋 **一键复制**: 轻松复制设备信息
💾 **导出功能**: 导出完整的设备列表

## 安装依赖

```bash
pip install flet
```

或使用uv:

```bash
uv pip install flet
```

## 运行

```bash
# Linux/macOS
./run_flet.sh

# Windows
run_flet.bat

# 或直接运行
python3 usb_viewer_flet.py  # Linux/macOS
python usb_viewer_flet.py   # Windows

# 使用uv运行
uv run python3 usb_viewer_flet.py
```

## 相比tkinter版本的优势

1. **更现代的界面**: Material Design风格
2. **更好的响应性**: 自动适应不同分辨率
3. **跨平台一致性**: 在所有平台上保持一致的外观
4. **更容易维护**: 代码更简洁清晰
5. **支持热重载**: 开发时更方便调试

## 系统要求

- Python 3.7+
- Linux: `lsusb` 命令 (通常已预装)
- Windows: PowerShell
- macOS: `system_profiler` (系统自带)
