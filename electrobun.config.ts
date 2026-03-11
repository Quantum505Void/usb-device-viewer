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
      "renderer-dist": "views/mainview",
      "tray-icon.svg": "views/mainview/tray-icon.svg",
      "tray-icon.png": "views/mainview/tray-icon.png",
    },
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
} satisfies ElectrobunConfig;
