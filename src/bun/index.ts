import { BrowserWindow, BrowserView, utils } from "electrobun/bun";
import type { AppRPCType, HIDDevice } from "../shared/types";
import { join } from "path";
import { homedir } from "os";

// ──────────────────────────────────────────────
// HID 扫描逻辑
// ──────────────────────────────────────────────

let hidModule: typeof import("node-hid") | null = null;

async function loadHID() {
  if (!hidModule) {
    try {
      hidModule = await import("node-hid");
    } catch {
      console.error("node-hid 加载失败，请运行 bun install");
    }
  }
  return hidModule;
}

function isBluetoothDevice(dev: Record<string, unknown>): boolean {
  // bus_type == 2 表示蓝牙 (hidapi 0.13.0+)
  if (dev.busType === 2) return true;

  const path = typeof dev.path === "string" ? dev.path.toLowerCase() : "";
  if (path.includes("bluetooth") || path.includes("bth")) return true;

  // interface_number == -1 通常表示非USB接口
  if (dev.interface === -1) {
    const usagePage = (dev.usagePage as number) ?? 0;
    if (usagePage === 0x01 || usagePage === 0x0c) {
      const product = ((dev.product as string) ?? "").toLowerCase();
      const mfr = ((dev.manufacturer as string) ?? "").toLowerCase();
      const usbKW = ["usb", "wired", "有线"];
      if (!usbKW.some((k) => product.includes(k) || mfr.includes(k))) {
        return true;
      }
    }
  }
  return false;
}

function buildRawInfo(dev: Record<string, unknown>): string {
  const busNames: Record<number, string> = {
    0: "Unknown",
    1: "USB",
    2: "Bluetooth",
    3: "I2C",
    4: "SPI",
    5: "Virtual",
  };
  const busType = dev.busType as number | undefined;
  const isBT = isBluetoothDevice(dev);
  const lines = [
    `供应商ID (VID): ${String(dev.vendorId ?? 0).padStart(4, "0").toUpperCase()}`,
    `产品ID (PID): ${String(dev.productId ?? 0).padStart(4, "0").toUpperCase()}`,
    `制造商: ${dev.manufacturer ?? "未知"}`,
    `产品名称: ${dev.product ?? "未知"}`,
    `序列号: ${dev.serialNumber ?? "N/A"}`,
    busType !== undefined
      ? `总线类型: ${busNames[busType] ?? `Unknown(0x${busType.toString(16).padStart(2, "0")})`}`
      : null,
    `连接方式: ${isBT ? "🔵 蓝牙HID设备" : "🔌 USB有线连接"}`,
    `设备路径: ${dev.path ?? "N/A"}`,
    (dev.interface as number) >= 0
      ? `USB接口号: ${dev.interface}`
      : `USB接口号: N/A (非USB或单接口)`,
    `HID使用页 (Usage Page): 0x${((dev.usagePage as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `HID使用ID (Usage): 0x${((dev.usage as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    `设备版本 (Release): 0x${((dev.release as number) ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
  ]
    .filter(Boolean)
    .join("\n");
  return lines;
}

async function scanDevices(): Promise<HIDDevice[]> {
  const hid = await loadHID();
  if (!hid) return [];

  const raw = hid.devices() as Record<string, unknown>[];
  const seen = new Set<string>();
  const result: HIDDevice[] = [];

  for (const dev of raw) {
    const vid = ((dev.vendorId as number) ?? 0)
      .toString(16)
      .padStart(4, "0")
      .toUpperCase();
    const pid = ((dev.productId as number) ?? 0)
      .toString(16)
      .padStart(4, "0")
      .toUpperCase();
    if (vid === "0000" && pid === "0000") continue;

    const serial = (dev.serialNumber as string) ?? "N/A";
    const key = `${vid}:${pid}:${serial}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      vid,
      pid,
      vendor: (dev.manufacturer as string) || "未知",
      product: (dev.product as string) || "未知",
      serial,
      isBluetooth: isBluetoothDevice(dev),
      rawInfo: buildRawInfo(dev),
    });
  }
  return result;
}

// ──────────────────────────────────────────────
// 监控线程
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
// RPC 定义
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
        const { format } = await import("date-fns").catch(() => ({
          format: null,
        }));
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        const filename = `usb_devices_${ts}.txt`;
        const outPath = join(homedir(), "Documents", filename);

        const { platform } = process;
        let header = `USB 设备列表\n导出时间: ${now.toLocaleString("zh-CN")}\n系统: ${platform}\n${"=".repeat(80)}\n\n`;
        const body = devices
          .map(
            (d, i) =>
              `设备 #${i + 1}\n${d.rawInfo}\n${"-".repeat(80)}\n`,
          )
          .join("\n");

        await Bun.write(outPath, header + body);
        return { success: true, path: outPath };
      },
      copyToClipboard: async ({ text }) => {
        // 使用 pbcopy / xclip / clip 跨平台复制
        const { platform } = process;
        try {
          if (platform === "darwin") {
            const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
            proc.stdin.write(text);
            proc.stdin.end();
            await proc.exited;
          } else if (platform === "win32") {
            const proc = Bun.spawn(["clip"], { stdin: "pipe" });
            proc.stdin.write(text);
            proc.stdin.end();
            await proc.exited;
          } else {
            // Linux: try xclip then xsel
            try {
              const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
                stdin: "pipe",
              });
              proc.stdin.write(text);
              proc.stdin.end();
              await proc.exited;
            } catch {
              const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
                stdin: "pipe",
              });
              proc.stdin.write(text);
              proc.stdin.end();
              await proc.exited;
            }
          }
          return { success: true };
        } catch (e) {
          console.error("clipboard error:", e);
          return { success: false };
        }
      },
    },
    messages: {},
  },
});

// ──────────────────────────────────────────────
// 创建窗口
// ──────────────────────────────────────────────

win = new BrowserWindow({
  title: "USB 设备查看器",
  url: "views://mainview/index.html",
  frame: {
    width: 1280,
    height: 860,
  },
  rpc,
});

win.on("close", () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
});

// 窗口就绪后启动监控
setTimeout(startMonitor, 2000);
