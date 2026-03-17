import { BrowserWindow, BrowserView, Tray, Utils, GlobalShortcut, Updater, Screen } from "electrobun/bun";
import type { AppRPCType, HIDDevice } from "../shared/types";
import { join } from "path";
import * as fs from "fs";
import net from "net";
import { enumerateDevices, closeLib } from "./hid-backend";

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

// ─── HID 扫描（via node-hid）────────────────────────────────────────────────

// 热插拔唯一 ID：Linux 用 path（hidrawX 级），其他平台用 VID:PID:serial
// 与 hid-backend dedup key 保持一致
function deviceId(d: HIDDevice) {
  if (process.platform === "linux" && d.path) return d.path;
  return `${d.vid}:${d.pid}:${d.serial}`;
}

async function scanDevices(): Promise<HIDDevice[]> {
  try {
    return enumerateDevices();
  } catch (e) {
    console.error("HID FFI 扫描失败:", e);
    return [];
  }
}

// ─── 状态 ─────────────────────────────────────────────────────────────────────
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastDeviceIds = new Set<string>();
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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
      webviewReady: async () => {
        console.log("[bun] webviewReady received, starting monitor");
        startMonitor();
        return { success: true };
      },
    },
    messages: {},
  },
});

// ─── 窗口管理 ─────────────────────────────────────────────────────────────────
const DEV_SERVER_URL = "http://localhost:5174";

// 启动时把 icon.png 复制到 Resources/appIcon.png（electrobun dev 模式不自动做这步）
try {
  const resourcesDir = join(process.cwd(), "../Resources");
  const appIconDest = join(resourcesDir, "appIcon.png");
  if (!fs.existsSync(appIconDest)) {
    const src = join(process.cwd(), "../Resources/app/views/mainview/icon.png");
    if (fs.existsSync(src)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
      fs.copyFileSync(src, appIconDest);
    }
  }
} catch { /* 忽略，不影响功能 */ }

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running, using views://");
    }
  }
  return "views://mainview/index.html";
}

async function createWindow() {
  const url = await getMainViewUrl();

  // Windows DPI 补偿：electrobun 传入的 frame 是逻辑像素，但 CEF 未设置 Per-Monitor DPI Aware
  // 导致系统将窗口按 scaleFactor 放大，需要除以 scaleFactor 还原到期望的视觉尺寸
  const scaleFactor = process.platform === "win32"
    ? (Screen.getPrimaryDisplay()?.scaleFactor ?? 1)
    : 1;
  const W = Math.round(1280 / scaleFactor);
  const H = Math.round(860 / scaleFactor);
  const minW = Math.round(1000 / scaleFactor);
  const minH = Math.round(600 / scaleFactor);

  win = new BrowserWindow({
    title: "USB 设备查看器",
    url,
    frame: { width: W, height: H, minWidth: minW, minHeight: minH },
    rpc,
  });

  win.on("close", () => {
    if (isQuitting) return;
    win = null;
  });
}

// 显示窗口（从最小化恢复）
function showWindow() {
  if (!win) { createWindow(); return; }
  try { win.unminimize(); win.focus(); } catch { /* 忽略 */ }
}

// 隐藏到任务栏（Linux 标准托盘行为）
function hideWindow() {
  if (!win) return;
  try { win.minimize(); } catch { /* 忽略 */ }
}

// ─── 热插拔监控 ───────────────────────────────────────────────────────────────
function startMonitor() {
  if (monitorInterval) return;
  console.log("[bun] monitor started");
  monitorInterval = setInterval(async () => {
    try {
      const devices = await scanDevices();
      const currentIds = new Set(devices.map(deviceId));
      const added   = [...currentIds].filter(id => !lastDeviceIds.has(id));
      const removed = [...lastDeviceIds].filter(id => !currentIds.has(id));
      if (added.length === 0 && removed.length === 0) return;
      console.log(`[bun] hotplug: +${added.length} -${removed.length}`, added, removed);
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

      win?.webview.rpc.send.devicesUpdated({ added: added.length, removed: removed.length, addedIds: added, removedIds: removed });
    } catch (e) { console.error("Monitor error:", e); }
  }, 2000);
}

// ─── 退出 ─────────────────────────────────────────────────────────────────────
function quitApp() {
  if (isQuitting) return;
  isQuitting = true;
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  tray?.remove();
  closeLib();
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
      const hidden = !win || win.isMinimized();
      if (hidden) showWindow();
      else hideWindow();
    }
  });
} catch (e) {
  console.warn("托盘初始化失败:", e);
}

// ─── 快捷键 ──────────────────────────────────────────────────────────────────
GlobalShortcut.register("F12", () => { win?.webview.toggleDevTools(); });

// ─── 启动 ─────────────────────────────────────────────────────────────────────
await createWindow();
