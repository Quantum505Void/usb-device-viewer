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
    views: {
      mainview: {
        entrypoint: "src/renderer/app.ts",
      },
    },
    copy: {
      "src/renderer/index.html": "views/mainview/index.html",
      "src/renderer/style.css": "views/mainview/style.css",
    },
  },
} satisfies ElectrobunConfig;
