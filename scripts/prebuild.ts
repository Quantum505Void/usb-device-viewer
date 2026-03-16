#!/usr/bin/env bun
// scripts/prebuild.ts
// 构建前 kill 旧的 app 进程，避免 EPERM rmdir on Windows

import { spawnSync } from "child_process";

const platform = process.platform;

if (platform === "win32") {
  // kill by exe name
  spawnSync("taskkill", ["/F", "/IM", "USBDeviceViewer*.exe"], { stdio: "ignore" });
  spawnSync("taskkill", ["/F", "/IM", "USBDeviceViewer-dev.exe"], { stdio: "ignore" });
} else if (platform === "darwin" || platform === "linux") {
  spawnSync("pkill", ["-f", "USBDeviceViewer"], { stdio: "ignore" });
}

console.log("[prebuild] old processes cleared");
