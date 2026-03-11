<script lang="ts">
  import { onMount } from "svelte";
  import { electroview, onDeviceChanged } from "./main";
  import type { HIDDevice } from "../shared/types";
  import DeviceList from "./components/DeviceList.svelte";
  import SearchBar from "./components/SearchBar.svelte";
  import Modal from "./components/Modal.svelte";
  import Toast from "./components/Toast.svelte";

  // ── 状态 ──
  let allDevices = $state<HIDDevice[]>([]);
  let query = $state("");
  let selectedDevice = $state<HIDDevice | null>(null);
  let modalOpen = $state(false);
  let scanning = $state(false);
  let statusText = $state("就绪");
  let newDeviceIds = $state<Set<string>>(new Set());
  let lastScanTime = $state<Date | null>(null);
  let activeFilter = $state<"all" | "usb" | "bt">("all");

  // ── Sidebar resize ──
  let sidebarWidth = $state(220);
  const SIDEBAR_MIN = 160;
  const SIDEBAR_MAX = 360;
  let isResizing = $state(false);

  function startResize(e: MouseEvent) {
    isResizing = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      sidebarWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX));
    };
    const onUp = () => {
      isResizing = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── 设备在线时长 ──
  let deviceOnlineTime = $state<Map<string, number>>(new Map());
  let nowMs = $state(Date.now());
  setInterval(() => { nowMs = Date.now(); }, 1000);

  function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m${s % 60 > 0 ? ` ${s % 60}s` : ""}`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  type ToastItem = { id: number; msg: string; type: "success" | "warning" | "info" | "error" };
  let toasts = $state<ToastItem[]>([]);
  let toastId = 0;

  // ── 计算属性 ──
  let usbDevices = $derived(allDevices.filter(d => !d.isBluetooth));
  let btDevices  = $derived(allDevices.filter(d => d.isBluetooth));

  let filteredByCategory = $derived(
    activeFilter === "usb" ? usbDevices :
    activeFilter === "bt"  ? btDevices  : allDevices
  );

  let filteredDevices = $derived(
    query.trim()
      ? filteredByCategory.filter((d) => {
          const q = query.toLowerCase();
          return (
            d.vid.toLowerCase().includes(q) ||
            d.pid.toLowerCase().includes(q) ||
            d.vendor.toLowerCase().includes(q) ||
            d.product.toLowerCase().includes(q) ||
            d.serial.toLowerCase().includes(q)
          );
        })
      : filteredByCategory
  );

  let lastScanStr = $derived(
    lastScanTime
      ? lastScanTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : null
  );

  // ── Toast ──
  function toast(msg: string, type: ToastItem["type"] = "info") {
    const id = ++toastId;
    toasts = [...toasts, { id, msg, type }];
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  }

  // ── 扫描 ──
  async function refresh() {
    scanning = true;
    statusText = "扫描中...";
    try {
      const devices = await electroview.rpc.request.scanDevices({});
      allDevices = devices;
      newDeviceIds = new Set();
      lastScanTime = new Date();
      // 初始化在线时长
      const now = Date.now();
      devices.forEach(d => {
        const key = `${d.vid}:${d.pid}:${d.serial}`;
        if (!deviceOnlineTime.has(key)) deviceOnlineTime.set(key, now);
      });
      deviceOnlineTime = new Map(deviceOnlineTime);
      statusText = `已找到 ${devices.length} 个设备`;
    } catch (e) {
      statusText = `扫描失败: ${e}`;
      toast(`扫描失败: ${e}`, "error");
    } finally {
      scanning = false;
    }
  }

  // ── 监控变化 ──
  function setupMonitor() {
    onDeviceChanged(async ({ added, removed, addedIds, removedIds }) => {
      const devices = await electroview.rpc.request.scanDevices({});
      allDevices = devices;
      lastScanTime = new Date();
      newDeviceIds = new Set(addedIds);
      const now = Date.now();
      addedIds.forEach(id => { deviceOnlineTime.set(id, now); });
      // 精确清理已断开设备（用 removedIds，不依赖全量 scan）
      removedIds.forEach(id => deviceOnlineTime.delete(id));
      deviceOnlineTime = new Map(deviceOnlineTime);
      const parts = [];
      if (added > 0) parts.push(`+${added} 新设备`);
      if (removed > 0) parts.push(`-${removed} 已移除`);
      const msg = parts.join("，");
      statusText = msg;
      toast(msg, added > 0 ? "success" : "warning");
      setTimeout(() => { newDeviceIds = new Set(); }, 5000);
    });
  }

  // ── 复制 ──
  async function copyDevice(dev: HIDDevice) {
    const res = await electroview.rpc.request.copyToClipboard({ text: dev.rawInfo });
    if (res.success) toast("已复制到剪贴板", "success");
    else toast("复制失败", "error");
  }

  // ── 导出 ──
  async function exportAll() {
    if (!allDevices.length) { toast("没有设备可导出", "warning"); return; }
    const res = await electroview.rpc.request.exportDevices({ devices: allDevices });
    if (res.success) {
      statusText = `已导出 → ${res.path}`;
      toast(`已导出 → ${res.path}`, "success");
    } else {
      toast("导出失败", "error");
    }
  }

  // ── 详情弹窗 ──
  function openModal(dev: HIDDevice) {
    selectedDevice = dev;
    modalOpen = true;
  }

  onMount(async () => {
    refresh();
    setupMonitor();
    // 通知 bun 端 webview 已就绪，触发热插拔监控启动
    await electroview.rpc.request.webviewReady({});
  });
</script>

<!-- 全局快捷键 -->
<svelte:window onkeydown={(e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); refresh(); }
    if (e.key === "e" || e.key === "E") { e.preventDefault(); exportAll(); }
    if ((e.key === "f" || e.key === "F") && !e.shiftKey) {
      e.preventDefault();
      document.querySelector<HTMLInputElement>(".searchbar input")?.focus();
    }
  }
}} />

<div class="app">
  <Toast {toasts} />

  <!-- ── 侧边栏 ── -->
  <aside class="sidebar" style="width:{sidebarWidth}px">
    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-mark">
        <svg viewBox="0 0 28 28" fill="none">
          <rect x="11" y="2" width="6" height="10" rx="3" fill="url(#g1)"/>
          <rect x="7" y="12" width="14" height="11" rx="4" fill="url(#g2)"/>
          <rect x="12" y="23" width="4" height="5" rx="2" fill="#3f4050"/>
          <rect x="8"  y="16" width="3.5" height="2.5" rx="1.25" fill="#6366f1" opacity=".7"/>
          <rect x="16.5" y="16" width="3.5" height="2.5" rx="1.25" fill="#8b5cf6" opacity=".7"/>
          <defs>
            <linearGradient id="g1" x1="14" y1="2" x2="14" y2="12" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366f1"/>
              <stop offset="1" stop-color="#8b5cf6"/>
            </linearGradient>
            <linearGradient id="g2" x1="14" y1="12" x2="14" y2="23" gradientUnits="userSpaceOnUse">
              <stop stop-color="#4f46e5"/>
              <stop offset="1" stop-color="#7c3aed"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="logo-text-wrap">
        <span class="logo-main">USB<em>View</em></span>
        <span class="logo-ver">v3.0</span>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="sidebar-nav">
      <div class="nav-section-title">设备分类</div>
      <button
        class="nav-item"
        class:active={activeFilter === "all"}
        onclick={() => activeFilter = "all"}
      >
        <span class="nav-icon">⊞</span>
        <span class="nav-label">全部设备</span>
        <span class="nav-count">{allDevices.length}</span>
      </button>
      <button
        class="nav-item"
        class:active={activeFilter === "usb"}
        onclick={() => activeFilter = "usb"}
      >
        <span class="nav-icon nav-icon-usb">🔌</span>
        <span class="nav-label">USB HID</span>
        <span class="nav-count">{usbDevices.length}</span>
      </button>
      <button
        class="nav-item"
        class:active={activeFilter === "bt"}
        onclick={() => activeFilter = "bt"}
      >
        <span class="nav-icon">🔵</span>
        <span class="nav-label">蓝牙 HID</span>
        <span class="nav-count">{btDevices.length}</span>
      </button>
    </nav>

    <!-- 操作区 -->
    <div class="sidebar-actions">
      <button class="action-btn action-primary" onclick={refresh} disabled={scanning}>
        <span class:spin={scanning}>↺</span>
        {scanning ? "扫描中..." : "刷新设备"}
        {#if !scanning}<kbd>R</kbd>{/if}
      </button>
      <div class="action-row">
        <button class="action-btn action-half" onclick={() => {
          if (selectedDevice) copyDevice(selectedDevice);
          else toast("请先选中设备", "warning");
        }}>
          <span>⌘C</span> 复制
        </button>
        <button class="action-btn action-half" onclick={exportAll}>
          <span>↓</span> 导出 <kbd>E</kbd>
        </button>
      </div>
    </div>

    <!-- 状态 -->
    <div class="sidebar-status">
      <div class="status-row">
        <div class="monitor-dot" class:scanning></div>
        <span>{scanning ? "扫描中" : "监控中"}</span>
      </div>
      {#if lastScanStr}
        <div class="last-scan">上次扫描 {lastScanStr}</div>
      {/if}
    </div>
  </aside>

  <!-- ── Resize handle ── -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="resize-handle"
    class:active={isResizing}
    onmousedown={startResize}
  ></div>

  <!-- ── 主内容 ── -->
  <div class="main-wrap">
    <!-- 顶部搜索栏 -->
    <div class="topbar">
      <SearchBar bind:query count={filteredDevices.length} total={filteredByCategory.length} />
      <div class="topbar-right">
        <span class="status-chip" class:scanning>
          {#if scanning}
            <span class="spin-sm">◌</span> 扫描中
          {:else}
            <span class="dot-green">●</span> {statusText}
          {/if}
        </span>
      </div>
    </div>

    <!-- 设备列表 -->
    <main class="main">
      <DeviceList
        devices={filteredDevices}
        {query}
        {newDeviceIds}
        {nowMs}
        {deviceOnlineTime}
        {fmtDuration}
        bind:selected={selectedDevice}
        onOpen={openModal}
        onCopy={(dev) => copyDevice(dev)}
      />
    </main>
  </div>

  <!-- 详情弹窗 -->
  {#if modalOpen && selectedDevice}
    <Modal
      device={selectedDevice}
      onClose={() => { modalOpen = false; }}
      onCopy={() => copyDevice(selectedDevice!)}
    />
  {/if}
</div>

<style>
  @import "tailwindcss";

  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body) {
    height: 100%;
    background: #0d0d12;
    color: #e2e4e9;
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    font-size: 14px;
    overflow: hidden;
  }

  .app {
    height: 100vh;
    display: flex;
    background: #0d0d12;
  }

  /* ══ SIDEBAR ══ */
  .sidebar {
    flex-shrink: 0;
    background: #0a0a10;
    border-right: none;
    display: flex;
    flex-direction: column;
    padding: 0 0 12px;
    gap: 0;
    min-width: 160px;
    max-width: 360px;
    transition: none;
  }

  /* Resize handle */
  .resize-handle {
    width: 4px;
    background: #1a1b24;
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
    position: relative;
  }
  .resize-handle::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 40px;
    border-radius: 2px;
    background: #2a2b36;
    transition: background 0.15s;
  }
  .resize-handle:hover,
  .resize-handle.active {
    background: #22233a;
  }
  .resize-handle:hover::after,
  .resize-handle.active::after {
    background: #6366f1;
  }

  /* Logo */
  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid #14151e;
  }
  .logo-mark {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    filter: drop-shadow(0 2px 8px rgba(99,102,241,0.4));
  }
  .logo-mark svg { width: 100%; height: 100%; }
  .logo-text-wrap { display: flex; flex-direction: column; gap: 1px; }
  .logo-main {
    font-size: 15px;
    font-weight: 700;
    color: #e2e4e9;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .logo-main em {
    font-style: normal;
    background: linear-gradient(90deg, #6366f1, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .logo-ver {
    font-size: 10px;
    color: #374151;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  /* Nav */
  .sidebar-nav {
    flex: 1;
    padding: 14px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nav-section-title {
    font-size: 10px;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 8px 8px;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    border: none;
    background: none;
    color: #6b7280;
    font-size: 13px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.1s, color 0.1s;
    font-family: inherit;
  }
  .nav-item:hover { background: #13141c; color: #9ca3af; }
  .nav-item.active { background: #13141c; color: #e2e4e9; }
  .nav-item.active .nav-icon { filter: none; }
  .nav-icon { font-size: 14px; flex-shrink: 0; opacity: 0.7; }
  .nav-item.active .nav-icon { opacity: 1; }
  .nav-label { flex: 1; font-weight: 500; }
  .nav-count {
    font-size: 11px;
    font-weight: 600;
    background: #1a1b26;
    color: #4b5563;
    padding: 1px 7px;
    border-radius: 20px;
    min-width: 22px;
    text-align: center;
    transition: background 0.1s, color 0.1s;
  }
  .nav-item.active .nav-count { background: #22244a; color: #818cf8; }

  /* Actions */
  .sidebar-actions {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid #14151e;
    padding-top: 12px;
    margin-top: 4px;
  }
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    background: #13141a;
    color: #9ca3af;
    transition: all 0.12s;
    font-family: inherit;
    width: 100%;
  }
  .action-btn:hover:not(:disabled) { background: #1a1b26; color: #e2e4e9; border-color: #3f4050; }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .action-primary {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border-color: transparent;
    color: #fff;
    font-size: 13px;
    padding: 9px 12px;
  }
  .action-primary:hover:not(:disabled) { filter: brightness(1.12); border-color: transparent; color: #fff; }
  .action-primary kbd { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); }
  .action-row { display: flex; gap: 6px; }
  .action-half { flex: 1; font-size: 12px; padding: 7px 4px; }

  kbd {
    display: inline-block;
    font-size: 10px;
    font-family: 'Consolas', monospace;
    background: rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px;
    padding: 0 4px;
    color: rgba(255,255,255,0.4);
    line-height: 16px;
    margin-left: 2px;
  }
  .action-btn:not(.action-primary) kbd {
    background: rgba(0,0,0,0.15);
    border-color: #2a2b35;
    color: #374151;
  }

  /* Status */
  .sidebar-status {
    padding: 10px 16px 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: #4b5563;
  }
  .monitor-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }
  .monitor-dot.scanning { background: #f59e0b; animation: pulse 1s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .last-scan { font-size: 10px; color: #2d2e3a; padding-left: 13px; }

  /* ══ MAIN ══ */
  .main-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px 0;
    flex-shrink: 0;
  }
  .topbar :global(.searchbar) {
    flex: 1;
    padding: 0;
    border-bottom: none;
  }
  .topbar-right { flex-shrink: 0; }
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #4b5563;
    background: #13141a;
    border: 1px solid #1e1f28;
    padding: 5px 12px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .status-chip.scanning { color: #f59e0b; border-color: rgba(245,158,11,0.2); }
  .dot-green { color: #22c55e; font-size: 8px; }
  .spin-sm { display: inline-block; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .main {
    flex: 1;
    overflow: hidden;
    min-height: 0;
    padding-top: 6px;
  }

  /* 消除 spin 与 class:spin 冲突 */
  :global(.spin) { animation: spin 0.8s linear infinite !important; }
</style>
