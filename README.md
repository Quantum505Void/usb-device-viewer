# USB Device Viewer

跨平台 USB HID 设备查看工具，使用 **Electrobun + Bun** 构建。

## 技术栈

- **Framework**: [Electrobun](https://blackboard.sh/electrobun/docs/) — 基于系统原生 WebView 的极轻量桌面框架
- **Runtime/Bundler**: [Bun](https://bun.sh)
- **HID**: [node-hid](https://github.com/node-hid/node-hid)
- **UI**: 原生 HTML/CSS/JS，One Dark Pro 配色

## 功能

- 🔌 扫描所有 USB HID 设备（VID/PID/厂商/产品/序列号）
- 🔵 蓝牙 HID 设备自动识别
- 🔍 实时搜索过滤
- 📋 双击设备查看详情
- 📋 复制设备信息到剪贴板
- 💾 导出设备列表到 txt 文件
- 🔄 自动监控设备变化（2秒轮询）
- 🟢 新接入设备高亮显示

## 快速开始

```bash
bun install
bun start       # 开发模式
bun run build   # 打包构建
```

## 项目结构

```
usb-device-viewer/
├── electrobun.config.ts   # Electrobun 构建配置
├── package.json
├── src/
│   ├── bun/
│   │   └── index.ts       # 主进程（HID扫描/RPC/窗口创建）
│   ├── renderer/
│   │   ├── app.ts         # 渲染进程（UI逻辑）
│   │   ├── index.html     # 页面模板
│   │   └── style.css      # One Dark Pro 样式
│   └── shared/
│       └── types.ts       # 共享类型（RPC schema）
```

## 系统要求

- macOS / Windows / Linux
- Bun ≥ 1.0
