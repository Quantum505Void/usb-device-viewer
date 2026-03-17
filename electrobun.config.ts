import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "USB Device Viewer",
    identifier: "com.waasstt.usb-device-viewer",
    version: "3.0.7",
    description: "跨平台USB HID设备查看工具",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      // node-hid 预编译 .node 文件不能被 bundle，作为外部依赖
      external: ["node-hid"],
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "tray-icon.svg": "views/mainview/tray-icon.svg",
      "icon.png": "views/mainview/icon.png",
      // 打包 node-hid prebuilds（所有平台）
      "node_modules/node-hid/prebuilds": "prebuilds/node-hid",
      // package.json（node-hid require 解析需要）
      "node_modules/node-hid/package.json": "prebuilds/node-hid-pkg.json",
    },
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
