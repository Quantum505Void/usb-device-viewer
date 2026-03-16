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
      // node-hid 是 native addon，不能 bundle，运行时动态加载
      external: ["node-hid"],
    },
    // useAsar + asarUnpack 是官方推荐的 native module 处理方式
    // asarUnpack 默认已包含 *.node / *.dll，这里显式声明
    useAsar: true,
    asarUnpack: ["*.node", "**/*.node", "*.dll", "**/*.dll"],
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "tray-icon.svg": "views/mainview/tray-icon.svg",
      "icon.png": "views/mainview/icon.png",
      // 将 node-hid 整个模块复制到 Resources/app/node_modules
      "node_modules/node-hid": "app/node_modules/node-hid",
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
  scripts: {
    preBuild: "scripts/prebuild.ts",
  },
  runtime: {
    exitOnLastWindowClosed: false,
  },
} satisfies ElectrobunConfig;
