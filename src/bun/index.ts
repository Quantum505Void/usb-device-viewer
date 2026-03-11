import { BrowserWindow, BrowserView, Tray, Utils, Screen } from "electrobun/bun";
import type { AppRPCType, HIDDevice } from "../shared/types";
import { join } from "path";
import net from "net";

// ─── Electrobun 原生 API ──────────────────────────────────────────────────────
const { clipboardWriteText, showNotification, showItemInFolder, paths, quit } = Utils;

// ─── 单实例互斥 + 激活已有窗口 ───────────────────────────────────────────────
const SINGLE_INSTANCE_PORT = 47291;

async function setupSingleInstance(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createConnection(SINGLE_INSTANCE_PORT, "127.0.0.1");

    probe.once("connect", () => {
      probe.write("focus\n");
      probe.end();
      probe.once("close", () => resolve(false));
    });

    probe.once("error", () => {
      probe.destroy();
      const server = net.createServer((socket) => {
        socket.on("data", (data) => {
          if (data.toString().includes("focus")) showWindow();
        });
        socket.on("error", () => {});
      });
      server.listen(SINGLE_INSTANCE_PORT, "127.0.0.1", () => resolve(true));
      server.on("error", () => resolve(true));
    });
  });
}

if (!await setupSingleInstance()) {
  process.exit(0);
}

// ─── HID 扫描 ─────────────────────────────────────────────────────────────────
let hidModule: typeof import("node-hid") | null = null;
async function loadHID() {
  if (!hidModule) {
    try { hidModule = await import("node-hid"); }
    catch { console.error("node-hid 加载失败"); }
  }
  return hidModule;
}

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",   0x045e: "Microsoft",  0x05ac: "Apple",
  0x04d9: "Holtek",     0x0483: "STMicro",     0x1532: "Razer",
  0x1b1c: "Corsair",    0x046a: "Cherry",      0x17ef: "Lenovo",
  0x0b05: "ASUS",       0x03f0: "HP",          0x04ca: "Lite-On",
  0x258a: "SinoWealth", 0x24ae: "Shenzhen",    0x0c45: "Microdia",
  0x1a2c: "China Resource", 0x0e8f: "GreenAsia",
};

function isBT(dev: Record<string, unknown>): boolean {
  if (dev.busType === 2) return true;
  const p = typeof dev.path === "string" ? dev.path.toLowerCase() : "";
  if (p.includes("bluetooth") || p.includes("bth")) return true;
  if (dev.interface === -1) {
    const up = (dev.usagePage as number) ?? 0;
    if (up === 0x01 || up === 0x0c) {
      const s = `${dev.product ?? ""}${dev.manufacturer ?? ""}`.toLowerCase();
      if (!["usb", "wired", "有线"].some(k => s.includes(k))) return true;
    }
  }
  return false;
}

function vendor(dev: Record<string, unknown>): string {
  const m = (dev.manufacturer as string)?.trim();
  return (m && m !== "Unknown") ? m : (VENDOR_NAMES[dev.vendorId as number] ?? "未知厂商");
}

function buildRawInfo(dev: Record<string, unknown>): string {
  const busNames: Record<number, string> = { 0:"Unknown",1:"USB",2:"Bluetooth",3:"I2C",4:"SPI",5:"Virtual" };
  const bt = dev.busType as number | undefined;
  return [
    `供应商ID (VID): ${((dev.vendorId as number) ?? 0).toString(16).padStart(4,"0").toUpperCase()}`,
    `产品ID (PID): ${((dev.productId as number) ?? 0).toString(16).padStart(4,"0").toUpperCase()}`,
    `制造商: ${vendor(dev)}`,
    `产品名称: ${dev.product ?? "未知"}`,
    `序列号: ${dev.serialNumber ?? "N/A"}`,
    bt !== undefined ? `总线类型: ${busNames[bt] ?? `Unknown(${bt})`}` : null,
    `连接方式: ${isBT(dev) ? "蓝牙HID设备" : "USB有线连接"}`,
    `设备路径: ${dev.path ?? "N/A"}`,
    (dev.interface as number) >= 0 ? `USB接口号: ${dev.interface}` : `USB接口号: N/A`,
    `HID使用页: 0x${((dev.usagePage as number) ?? 0).toString(16).padStart(4,"0").toUpperCase()}`,
    `HID使用ID: 0x${((dev.usage as number) ?? 0).toString(16).padStart(4,"0").toUpperCase()}`,
    `设备版本: 0x${((dev.release as number) ?? 0).toString(16).padStart(4,"0").toUpperCase()}`,
  ].filter(Boolean).join("\n");
}

function deviceId(d: HIDDevice) { return `${d.vid}:${d.pid}:${d.serial}`; }

async function scanDevices(): Promise<HIDDevice[]> {
  const hid = await loadHID();
  if (!hid) return [];
  const seen = new Set<string>();
  const result: HIDDevice[] = [];
  for (const dev of hid.devices() as Record<string, unknown>[]) {
    const vid = ((dev.vendorId as number) ?? 0).toString(16).padStart(4,"0").toUpperCase();
    const pid = ((dev.productId as number) ?? 0).toString(16).padStart(4,"0").toUpperCase();
    if (vid === "0000" && pid === "0000") continue;
    const serial = (dev.serialNumber as string)?.trim() || "N/A";
    const key = `${vid}:${pid}:${serial}:${dev.path}:${dev.interface}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      vid, pid,
      vendor: vendor(dev),
      product: ((dev.product as string)?.trim()) || `HID ${vid}:${pid}`,
      serial, isBluetooth: isBT(dev),
      rawInfo: buildRawInfo(dev),
    });
  }
  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });
  return result;
}

// ─── 状态 ─────────────────────────────────────────────────────────────────────
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastDeviceIds = new Set<string>();
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// 窗口上次的位置/大小（重建时恢复）
let savedFrame = { x: -1, y: -1, width: 1280, height: 860 };

// ─── RPC ──────────────────────────────────────────────────────────────────────
const rpc = BrowserView.defineRPC<AppRPCType>({
  maxRequestTime: 10000,
  handlers: {
    requests: {
      scanDevices: async () => {
        const devices = await scanDevices();
        lastDeviceIds = new Set(devices.map(deviceId));
        return devices;
      },
      exportDevices: async ({ devices }) => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const outPath = join(paths.documents, `usb_devices_${ts}.txt`);
        const header = `USB 设备列表\n导出时间: ${now.toLocaleString("zh-CN")}\n系统: ${process.platform}\n设备总数: ${devices.length}\n${"=".repeat(80)}\n\n`;
        const body = devices.map((d, i) => `设备 #${i+1}\n${d.rawInfo}\n${"-".repeat(80)}\n`).join("\n");
        await Bun.write(outPath, header + body);
        showItemInFolder(outPath);
        return { success: true, path: outPath };
      },
      copyToClipboard: async ({ text }) => {
        try { clipboardWriteText(text); return { success: true }; }
        catch (e) { console.error("clipboard error:", e); return { success: false }; }
      },
      // 窗口 X 按钮 / 自定义关闭按钮 → minimize 到托盘
      minimizeToTray: async () => {
        hideWindow();
        return { success: true };
      },
    },
    messages: {},
  },
});

// ─── 窗口管理 ─────────────────────────────────────────────────────────────────

/**
 * 创建窗口。
 * 若 savedFrame.x == -1（首次），居中显示；
 * 否则恢复上次位置。
 * Linux 上 titleBarStyle:"hidden" 无效，原生 X 按钮仍存在。
 * close 事件触发时窗口已销毁，无法拦截。
 * 策略：close 后重建，放到屏幕外（不可见），等托盘"显示"时移回来。
 */
function createWindow() {
  const offscreen = savedFrame.x === -1;

  win = new BrowserWindow({
    title: "USB 设备查看器",
    url: "views://mainview/index.html",
    titleBarStyle: "hidden",  // macOS: 无原生控件；Linux: 无效但无害
    frame: {
      // 首次：让 Electrobun 居中（x:0 y:0 → 默认）
      // 重建时：放到屏幕外，等 showWindow 移回来
      x: offscreen ? 0 : -32000,
      y: offscreen ? 0 : -32000,
      width: savedFrame.width,
      height: savedFrame.height,
      minWidth: 1000,
      minHeight: 600,
    },
    rpc,
  });

  win.on("close", () => {
    if (isQuitting) return;
    // 保存关窗前的位置
    try { savedFrame = win!.getFrame(); } catch { /* 忽略 */ }
    win = null;
    // 重建并藏到屏幕外，不要 minimize（避免闪烁）
    setTimeout(() => {
      if (!isQuitting) createWindow();
    }, 100);
  });
}

function centerWindow(width: number, height: number) {
  try {
    const p = Screen.getPrimaryDisplay();
    const cx = Math.floor((p.workArea.width - width) / 2) + p.workArea.x;
    const cy = Math.floor((p.workArea.height - height) / 2) + p.workArea.y;
    win?.setPosition(cx, cy);
  } catch { win?.setPosition(100, 100); }
}

function showWindow() {
  if (!win) {
    createWindow();
    setTimeout(() => {
      if (!win) return;
      try {
        const f = win.getFrame();
        if (f.x < -1000) centerWindow(f.width, f.height);
        win.unminimize();
        win.focus();
      } catch { /* 忽略 */ }
    }, 200);
    return;
  }

  try {
    const f = win.getFrame();
    if (f.x < -1000) centerWindow(f.width, f.height);
    win.unminimize();
    win.focus();
  } catch { /* 忽略 */ }
}

function hideWindow() {
  if (!win) return;
  try {
    // 保存当前位置
    savedFrame = { ...savedFrame, ...win.getFrame() };
    // 移到屏幕外（不销毁，不minimize，不闪烁）
    win.setPosition(-32000, -32000);
  } catch { /* 忽略 */ }
}

// ─── 热插拔监控 ───────────────────────────────────────────────────────────────
function startMonitor() {
  if (monitorInterval) return;
  monitorInterval = setInterval(async () => {
    try {
      const devices = await scanDevices();
      const currentIds = new Set(devices.map(deviceId));
      const added   = [...currentIds].filter(id => !lastDeviceIds.has(id));
      const removed = [...lastDeviceIds].filter(id => !currentIds.has(id));
      if (added.length === 0 && removed.length === 0) return;
      lastDeviceIds = currentIds;

      if (added.length > 0) {
        const d = devices.find(x => added.includes(deviceId(x)));
        showNotification({
          title: "USB 设备已连接",
          body: d ? `${d.vendor} ${d.product}` : `${added.length} 个新设备`,
          silent: true,
        });
      }
      if (removed.length > 0) {
        showNotification({ title: "USB 设备已断开", body: `${removed.length} 个设备已移除`, silent: true });
      }

      win?.webview.rpc.send.devicesUpdated({ added: added.length, removed: removed.length, addedIds: added });
    } catch (e) { console.error("Monitor error:", e); }
  }, 2000);
}

// ─── 退出 ─────────────────────────────────────────────────────────────────────
function quitApp() {
  if (isQuitting) return;
  isQuitting = true;
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  tray?.remove();
  quit();
}

process.on("SIGINT",  () => quitApp());
process.on("SIGTERM", () => quitApp());

// ─── 托盘 ─────────────────────────────────────────────────────────────────────
try {
  tray = new Tray({ image: "views://mainview/tray-icon.svg", width: 22, height: 22 });
  tray.setMenu([
    { label: "USB 设备查看器 v3.0", enabled: false },
    { type: "separator" },
    { label: "显示窗口", action: "show" },
    { label: "隐藏窗口", action: "hide" },
    { type: "separator" },
    { label: "退出", action: "quit" },
  ]);
  tray.on("tray-clicked", (event: any) => {
    const action = event?.data?.action ?? event?.action ?? "";
    if      (action === "quit") quitApp();
    else if (action === "show") showWindow();
    else if (action === "hide") hideWindow();
    else {
      // 点击图标本身：切换显示/隐藏
      try {
        const f = win?.getFrame();
        const isHidden = !win || (f && f.x < -1000) || win.isMinimized();
        if (isHidden) showWindow();
        else hideWindow();
      } catch { showWindow(); }
    }
  });
} catch (e) {
  console.warn("托盘初始化失败:", e);
}

// ─── 启动 ─────────────────────────────────────────────────────────────────────
createWindow();
setTimeout(startMonitor, 1500);
