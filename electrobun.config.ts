import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "USB Device Viewer",
    identifier: "com.waasstt.usb-device-viewer",
    version: "3.1.0",
    description: "跨平台USB HID设备查看工具",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      // node-hid 是 .node 原生 addon，不能被 bundle，标记为 external
      // electrobun build 会自动将 node_modules 中的 .node 文件打包进 Resources
      external: ["node-hid"],
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "tray-icon.svg": "views/mainview/tray-icon.svg",
      "icon.png": "views/mainview/icon.png",
      // Linux: udev 规则，供用户手动安装（解决 /dev/hidraw* 无权限问题）
      "99-usb-hid.rules": "99-usb-hid.rules",
    },
    // 确保 .node 文件不被 ASAR 打包（需要以文件形式存在才能被 require）
    asarUnpack: ["*.node", "*.dll", "*.dylib", "*.so", "*.so.*"],
    watchIgnore: ["dist/**"],
    platforms: {
      mac: {
        icons: "icon.iconset",
      },
      win: {
        icon: "icon.ico",
      },
      linux: {
        icon: "icon.png",
      },
    },
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
} satisfies ElectrobunConfig;
