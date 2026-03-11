import {
  BrowserWindow,
  BrowserView,
  Utils,
  Tray,
} from "electrobun/bun";
import type { AppRPCType, HIDDevice } from "../shared/types";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, writeFileSync, rmSync } from "fs";

const { clipboardWriteText, showNotification, showItemInFolder, paths, quit } = Utils;

// ──────────────────────────────────────────────
// 吞掉 Electrobun 关窗时抛的 "Can't focus window" 异常
// 已知 Electrobun bug：关窗后残留 focus 调用
// ──────────────────────────────────────────────
process.prependListener("uncaughtException", (err: Error) => {
  const msg = err?.message ?? String(err);
  if (
    msg.includes("Can't focus window") ||
    msg.includes("Window no longer exists") ||
    msg.includes("Can't restore window") ||
    msg.includes("Can't minimize window")
  ) {
    return; // 安全忽略
  }
  console.error("[uncaughtException]", msg);
});

// ──────────────────────────────────────────────
// 单实例互斥锁
// ──────────────────────────────────────────────
const LOCK_FILE = join(tmpdir(), "usb-device-viewer.lock");

function acquireLock(): boolean {
  if (existsSync(LOCK_FILE)) {
    try {
      const pid = parseInt(Bun.file(LOCK_FILE).toString(), 10);
      if (!isNaN(pid) && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          console.warn(`已有实例运行 (PID ${pid})，退出`);
          return false;
        } catch { /* 进程不存在，清理残留锁 */ }
      }
    } catch { /* 读文件失败，忽略 */ }
  }
  writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock() {
  try { rmSync(LOCK_FILE); } catch { /* 忽略 */ }
}

if (!acquireLock()) process.exit(0);
process.on("exit", releaseLock);
process.on("SIGINT",  () => { releaseLock(); quit(); });
process.on("SIGTERM", () => { releaseLock(); quit(); });

// ──────────────────────────────────────────────
// HID 扫描逻辑
// ──────────────────────────────────────────────

let hidModule: typeof import("node-hid") | null = null;

async function loadHID() {
  if (!hidModule) {
    try { hidModule = await import("node-hid"); }
    catch { console.error("node-hid 加载失败，请运行 bun install"); }
  }
  return hidModule;
}

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",    0x045e: "Microsoft",  0x05ac: "Apple",
  0x04d9: "Holtek",      0x0483: "STMicro",     0x1532: "Razer",
  0x1b1c: "Corsair",     0x046a: "Cherry",      0x17ef: "Lenovo",
  0x0b05: "ASUS",        0x03f0: "HP",          0x04ca: "Lite-On",
  0x258a: "SinoWealth",  0x24ae: "Shenzhen",    0x0c45: "Microdia",
  0x1a2c: "China Resource", 0x0e8f: "GreenAsia",
};

function isBluetoothDevice(dev: Record<string, unknown>): boolean {
  if (dev.busType === 2) return true;
  const path = typeof dev.path === "string" ? dev.path.toLowerCase() : "";
  if (path.includes("bluetooth") || path.includes("bth")) return true;
  if (dev.interface === -1) {
    const usagePage = (dev.usagePage as number) ?? 0;
    if (usagePage === 0x01 || usagePage === 0x0c) {
      const product = ((dev.product as string) ?? "").toLowerCase();
      const mfr = ((dev.manufacturer as string) ?? "").toLowerCase();
      if (!["usb", "wired", "有线"].some((k) => product.includes(k) || mfr.includes(k)))
        return true;
    }
  }
  return false;
}

function resolveVendor(dev: Record<string, unknown>): string {
  const mfr = (dev.manufacturer as string)?.trim();
  if (mfr && mfr !== "Unknown" && mfr !== "") return mfr;
  return VENDOR_NAMES[dev.vendorId as number] ?? "未知厂商";
}

function buildRawInfo(dev: Record<string, unknown>): string {
  const busNames: Record<number, string> = {
    0: "Unknown", 1: "USB", 2: "Bluetooth", 3: "I2C", 4: "SPI", 5: "Virtual",
  };
  const busType = dev.busType as number | undefined;
  const isBT = isBluetoothDevice(dev);
  return [
    `供应商ID (VID): ${String(dev.vendorId ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `产品ID (PID): ${String(dev.productId ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `制造商: ${resolveVendor(dev)}`,
    `产品名称: ${dev.product ?? "未知"}`,
    `序列号: ${dev.serialNumber ?? "N/A"}`,
    busType !== undefined
      ? `总线类型: ${busNames[busType] ?? `Unknown(${busType})`}`
      : null,
    `连接方式: ${isBT ? "蓝牙HID设备" : "USB有线连接"}`,
    `设备路径: ${dev.path ?? "N/A"}`,
    (dev.interface as number) >= 0 ? `USB接口号: ${dev.interface}` : `USB接口号: N/A`,
    `HID使用页 (Usage Page): 0x${((dev.usagePage as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `HID使用ID (Usage): 0x${((dev.usage as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `设备版本 (Release): 0x${((dev.release as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
  ].filter(Boolean).join("\n");
}

async function scanDevices(): Promise<HIDDevice[]> {
  const hid = await loadHID();
  if (!hid) return [];

  const seen = new Set<string>();
  const result: HIDDevice[] = [];

  for (const dev of hid.devices() as Record<string, unknown>[]) {
    const vid = ((dev.vendorId as number) ?? 0).toString(16).padStart(4, "0").toUpperCase();
    const pid = ((dev.productId as number) ?? 0).toString(16).padStart(4, "0").toUpperCase();
    if (vid === "0000" && pid === "0000") continue;

    const serial = (dev.serialNumber as string)?.trim() || "N/A";
    const path = (dev.path as string) ?? "";
    const iface = (dev.interface as number) ?? -1;
    const key = `${vid}:${pid}:${serial}:${path}:${iface}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      vid, pid,
      vendor: resolveVendor(dev),
      product: ((dev.product as string)?.trim()) || `HID ${vid}:${pid}`,
      serial,
      isBluetooth: isBluetoothDevice(dev),
      rawInfo: buildRawInfo(dev),
    });
  }

  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

// ──────────────────────────────────────────────
// 热插拔监控
// ──────────────────────────────────────────────

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastDeviceIds = new Set<string>();
let win: BrowserWindow | null = null;

function getDeviceId(d: HIDDevice) {
  return `${d.vid}:${d.pid}:${d.serial}`;
}

function startMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(async () => {
    try {
      const devices = await scanDevices();
      const currentIds = new Set(devices.map(getDeviceId));
      const added = [...currentIds].filter((id) => !lastDeviceIds.has(id));
      const removed = [...lastDeviceIds].filter((id) => !currentIds.has(id));
      if (added.length > 0 || removed.length > 0) {
        lastDeviceIds = currentIds;

        // 原生桌面通知（Electrobun utils API）
        if (added.length > 0) {
          const newDev = devices.find(d => added.includes(getDeviceId(d)));
          showNotification({
            title: "USB 设备已连接",
            body: newDev ? `${newDev.vendor} ${newDev.product}` : `${added.length} 个新设备`,
            silent: true,
          });
        }
        if (removed.length > 0) {
          showNotification({
            title: "USB 设备已断开",
            body: `${removed.length} 个设备已移除`,
            silent: true,
          });
        }

        win?.webview.rpc.send.devicesUpdated({
          added: added.length,
          removed: removed.length,
          addedIds: added,
        });
      }
    } catch (e) {
      console.error("Monitor error:", e);
    }
  }, 2000);
}

// ──────────────────────────────────────────────
// RPC
// ──────────────────────────────────────────────

const rpc = BrowserView.defineRPC<AppRPCType>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      scanDevices: async () => {
        const devices = await scanDevices();
        lastDeviceIds = new Set(devices.map(getDeviceId));
        return devices;
      },

      exportDevices: async ({ devices }) => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `usb_devices_${ts}.txt`;
        // 用 Electrobun paths API 获取 Documents 目录（跨平台）
        const outPath = join(paths.documents, filename);

        const header =
          `USB 设备列表\n导出时间: ${now.toLocaleString("zh-CN")}\n` +
          `系统: ${process.platform}\n设备总数: ${devices.length}\n${"=".repeat(80)}\n\n`;
        const body = devices
          .map((d, i) => `设备 #${i + 1}\n${d.rawInfo}\n${"-".repeat(80)}\n`)
          .join("\n");

        await Bun.write(outPath, header + body);

        // 导出后在文件管理器里高亮该文件（Electrobun utils API）
        showItemInFolder(outPath);

        return { success: true, path: outPath };
      },

      // 用 Electrobun 内置 clipboard API（跨平台，无需 xclip/xsel/pbcopy）
      copyToClipboard: async ({ text }) => {
        try {
          clipboardWriteText(text);
          return { success: true };
        } catch (e) {
          console.error("clipboard error:", e);
          return { success: false };
        }
      },

      minimizeToTray: async () => {
        hideWindow();
        return { success: true };
      },
    },
    messages: {},
  },
});

// ──────────────────────────────────────────────
// 窗口管理
// ──────────────────────────────────────────────

let windowVisible = true;

function createWindow() {
  win = new BrowserWindow({
    title: "USB 设备查看器",
    url: "views://mainview/index.html",
    frame: {
      width: 1280,
      height: 860,
      minWidth: 1000,
      minHeight: 600,
    },
    rpc,
  });

  win.on("close", () => {
    windowVisible = false;
    // 关窗后重建备用，100ms 后立刻 minimize（后台驻留）
    setTimeout(() => {
      createWindow();
      setTimeout(() => win?.minimize(), 300);
    }, 100);
  });
}

createWindow();

// ──────────────────────────────────────────────
// 系统托盘
// ──────────────────────────────────────────────

function showWindow() {
  if (!win) return;
  try { win.unminimize(); windowVisible = true; }
  catch (e) { console.warn("[tray] show failed:", e); }
}

function hideWindow() {
  if (!win) return;
  try { win.minimize(); windowVisible = false; }
  catch (e) { console.warn("[tray] hide failed:", e); }
}

function quitApp() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  tray?.remove();
  releaseLock();
  quit(); // Electrobun 原生退出，正确清理 GTK/WebKit
}

let tray: Tray | null = null;

try {
  tray = new Tray({
    image: "views://mainview/tray-icon.svg",
    width: 22,
    height: 22,
  });

  tray.setMenu([
    { label: "USB 设备查看器 v3.0", enabled: false },
    { type: "separator" },
    { label: "显示窗口",  action: "show" },
    { label: "隐藏窗口",  action: "hide" },
    { type: "separator" },
    { label: "退出",      action: "quit" },
  ]);

  tray.on("tray-clicked", (event: any) => {
    const action = event?.data?.action ?? event?.action ?? "";
    if (action === "quit")       quitApp();
    else if (action === "show")  showWindow();
    else if (action === "hide")  hideWindow();
    else {
      // 直接点击托盘图标：切换
      if (windowVisible) hideWindow();
      else showWindow();
    }
  });
} catch (e) {
  console.warn("托盘初始化失败:", e);
}

setTimeout(startMonitor, 1500);
