import { Electroview } from "electrobun/view";
import type { AppRPCType, HIDDevice } from "../shared/types";

// ── RPC 初始化 ──
const rpc = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      devicesUpdated: ({ added, removed, addedIds }) => {
        handleDeviceChange(added, removed, addedIds);
      },
    },
  },
});
const electroview = new Electroview({ rpc });

// ── 状态 ──
let allDevices: HIDDevice[] = [];
let filteredDevices: HIDDevice[] = [];
let selectedIndex = -1;
let highlightIds: Set<string> = new Set();

// ── DOM ──
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const deviceList = document.getElementById("device-list") as HTMLDivElement;
const deviceCount = document.getElementById("device-count") as HTMLDivElement;
const statusLabel = document.getElementById("status-label") as HTMLSpanElement;
const progressWrap = document.getElementById("progress-wrap") as HTMLDivElement;
const sysInfo = document.getElementById("sys-info") as HTMLSpanElement;
const modalOverlay = document.getElementById("modal-overlay") as HTMLDivElement;
const modalClose = document.getElementById("modal-close") as HTMLButtonElement;
const modalCloseBtn = document.getElementById("modal-close-btn") as HTMLButtonElement;
const modalCopy = document.getElementById("modal-copy") as HTMLButtonElement;

// ── Toast ──
function showToast(msg: string, type: "info" | "success" | "warning" | "error" = "info") {
  const icons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };
  const container = document.getElementById("toast-container")!;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("fadeout");
    setTimeout(() => el.remove(), 350);
  }, 3000);
}

// ── 进度 ──
function setScanning(scanning: boolean) {
  progressWrap.style.display = scanning ? "block" : "none";
  statusLabel.textContent = scanning ? "⏳ 扫描中..." : statusLabel.textContent;
}

// ── 设备ID ──
function getDeviceId(d: HIDDevice) {
  return `${d.vid}:${d.pid}:${d.serial}`;
}

// ── 渲染列表 ──
function renderList(highlight?: Set<string>) {
  deviceList.innerHTML = "";

  if (filteredDevices.length === 0) {
    deviceList.innerHTML = '<div class="list-placeholder">🔌 未找到HID设备<br><small>请连接HID设备后点击刷新</small></div>';
    deviceCount.textContent = "📊 设备数: 0";
    return;
  }

  let firstHighlight: HTMLElement | null = null;

  filteredDevices.forEach((dev, idx) => {
    const id = getDeviceId(dev);
    const isNew = highlight?.has(id);
    const item = document.createElement("div");
    item.className = "device-item" + (isNew ? " is-new" : "");
    if (idx === selectedIndex) item.classList.add("selected");

    const newBadge = isNew ? "🟢 [NEW]  " : "";
    const btBadge = dev.isBluetooth ? "🔵 [蓝牙]  " : "";
    const serial = dev.serial && dev.serial !== "N/A"
      ? `  •  S/N: ${dev.serial.slice(0, 16)}${dev.serial.length > 16 ? "..." : ""}`
      : "";

    item.innerHTML = `
      <div class="device-item-name">${newBadge}${btBadge}📱 ${escapeHtml(dev.product)}</div>
      <div class="device-item-vendor">🏢 ${escapeHtml(dev.vendor)}</div>
      <div class="device-item-ids">🆔 VID: ${dev.vid}  •  PID: ${dev.pid}${serial}</div>
    `;

    item.addEventListener("click", () => {
      selectedIndex = idx;
      renderList(highlight);
    });
    item.addEventListener("dblclick", () => {
      selectedIndex = idx;
      openModal(dev);
    });

    deviceList.appendChild(item);
    if (isNew && !firstHighlight) firstHighlight = item;
  });

  deviceCount.textContent = `📊 设备数: ${filteredDevices.length}`;

  if (firstHighlight) {
    (firstHighlight as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── 过滤 ──
function filterDevices() {
  const q = searchInput.value.toLowerCase();
  if (!q) {
    filteredDevices = [...allDevices];
  } else {
    filteredDevices = allDevices.filter((d) =>
      d.vid.toLowerCase().includes(q) ||
      d.pid.toLowerCase().includes(q) ||
      d.vendor.toLowerCase().includes(q) ||
      d.product.toLowerCase().includes(q) ||
      d.serial.toLowerCase().includes(q)
    );
  }
  selectedIndex = -1;
  renderList(highlightIds);
}

// ── 扫描 ──
async function refresh() {
  setScanning(true);
  try {
    const devices = await electroview.rpc.request.scanDevices({});
    allDevices = devices;
    filteredDevices = [...devices];
    highlightIds = new Set();
    selectedIndex = -1;
    renderList();
    statusLabel.textContent = `就绪 - 已找到 ${devices.length} 个设备`;
  } catch (e) {
    statusLabel.textContent = `❌ 扫描失败: ${e}`;
    deviceList.innerHTML = `<div class="list-placeholder" style="color:var(--red)">❌ 扫描失败: ${e}</div>`;
  } finally {
    setScanning(false);
  }
}

// ── 设备变化回调 ──
function handleDeviceChange(added: number, removed: number, addedIds: string[]) {
  highlightIds = new Set(addedIds);

  // 重新扫描获取最新列表
  electroview.rpc.request.scanDevices({}).then((devices) => {
    allDevices = devices;
    filterDevices();

    if (added > 0 && removed > 0) {
      const msg = `检测到 ${added} 个新设备，移除了 ${removed} 个设备`;
      statusLabel.textContent = `🔌 ${msg}`;
      showToast(msg, "info");
    } else if (added > 0) {
      const msg = `检测到 ${added} 个新设备`;
      statusLabel.textContent = `🔌 ${msg}`;
      showToast(msg, "success");
    } else if (removed > 0) {
      const msg = `移除了 ${removed} 个设备`;
      statusLabel.textContent = `🔌 ${msg}`;
      showToast(msg, "warning");
    }
  });
}

// ── Modal ──
let modalDevice: HIDDevice | null = null;

function openModal(dev: HIDDevice) {
  modalDevice = dev;
  const btBadge = dev.isBluetooth ? "🔵 [蓝牙HID]  " : "";
  (document.getElementById("modal-title") as HTMLElement).textContent =
    `${btBadge}📱 ${dev.product}`;
  (document.getElementById("modal-vendor") as HTMLElement).textContent =
    `🏢 ${dev.vendor}`;
  (document.getElementById("m-vid") as HTMLElement).textContent = dev.vid;
  (document.getElementById("m-pid") as HTMLElement).textContent = dev.pid;
  (document.getElementById("m-serial") as HTMLElement).textContent = dev.serial;
  (document.getElementById("m-raw") as HTMLElement).textContent = dev.rawInfo;
  modalOverlay.style.display = "flex";
}

function closeModal() {
  modalOverlay.style.display = "none";
  modalDevice = null;
}

modalClose.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
modalCopy.addEventListener("click", async () => {
  if (!modalDevice) return;
  await copyText(modalDevice.rawInfo);
});

// ── 复制 ──
async function copyText(text: string) {
  try {
    const res = await electroview.rpc.request.copyToClipboard({ text });
    if (res.success) {
      statusLabel.textContent = "✅ 已复制到剪贴板";
      showToast("已复制到剪贴板", "success");
    } else {
      showToast("复制失败", "error");
    }
  } catch (e) {
    showToast(`复制失败: ${e}`, "error");
  }
}

// ── 导出 ──
async function exportDevices() {
  if (allDevices.length === 0) {
    showToast("没有设备可导出", "warning");
    return;
  }
  try {
    const res = await electroview.rpc.request.exportDevices({ devices: allDevices });
    if (res.success) {
      statusLabel.textContent = `✅ 已导出到 ${res.path}`;
      showToast(`已导出到 ${res.path}`, "success");
    } else {
      showToast("导出失败", "error");
    }
  } catch (e) {
    showToast(`导出失败: ${e}`, "error");
  }
}

// ── 事件绑定 ──
document.getElementById("btn-refresh")!.addEventListener("click", refresh);
document.getElementById("btn-copy")!.addEventListener("click", async () => {
  if (selectedIndex < 0 || !filteredDevices[selectedIndex]) {
    showToast("请先选择一个设备", "warning");
    return;
  }
  await copyText(filteredDevices[selectedIndex].rawInfo);
});
document.getElementById("btn-export")!.addEventListener("click", exportDevices);
searchInput.addEventListener("input", filterDevices);

// ── 系统信息 ──
const platform = (window as unknown as { electrobun?: { platform?: string } })
  .electrobun?.platform ?? navigator.platform;
sysInfo.textContent = `💻 ${platform}`;

// ── 启动 ──
refresh();
