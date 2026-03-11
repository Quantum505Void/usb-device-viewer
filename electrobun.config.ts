import type { ElectrobunConfig } from "electrobun";
import { SveltePlugin } from "bun-plugin-svelte";

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
        entrypoint: "src/renderer/main.ts",
        plugins: [SveltePlugin({ development: false })],
      },
    },
    copy: {
      "src/renderer/index.html": "views/mainview/index.html",
    },
  },
} satisfies ElectrobunConfig;
