import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "USB Device Viewer",
    identifier: "com.waasstt.usb-device-viewer",
    version: "3.0.0",
    description: "跨平台USB HID设备查看工具",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "tray-icon.svg": "views/mainview/tray-icon.svg",
      "icon.png": "views/mainview/icon.png",
    },
    watchIgnore: ["dist/**"],
    platforms: {
      linux: {
        icon: "icon.png",
      },
    },
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
} satisfies ElectrobunConfig;
