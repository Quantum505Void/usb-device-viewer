<script lang="ts">
  import { onMount } from "svelte";
  import { electroview, onDeviceChanged } from "./main";
  import type { HIDDevice } from "../shared/types";
  import DeviceList from "./components/DeviceList.svelte";
  import Toolbar from "./components/Toolbar.svelte";
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

  type ToastItem = { id: number; msg: string; type: "success" | "warning" | "info" | "error" };
  let toasts = $state<ToastItem[]>([]);
  let toastId = 0;

  // ── 计算属性 ──
  let filteredDevices = $derived(
    query.trim()
      ? allDevices.filter((d) => {
          const q = query.toLowerCase();
          return (
            d.vid.toLowerCase().includes(q) ||
            d.pid.toLowerCase().includes(q) ||
            d.vendor.toLowerCase().includes(q) ||
            d.product.toLowerCase().includes(q) ||
            d.serial.toLowerCase().includes(q)
          );
        })
      : allDevices
  );

  // ── Toast ──
  function toast(msg: string, type: ToastItem["type"] = "info") {
    const id = ++toastId;
    toasts = [...toasts, { id, msg, type }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 3500);
  }

  // ── 扫描 ──
  async function refresh() {
    scanning = true;
    statusText = "扫描中...";
    try {
      const devices = await electroview.rpc.request.scanDevices({});
      allDevices = devices;
      newDeviceIds = new Set();
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
    onDeviceChanged(async ({ added, removed, addedIds }) => {
      const devices = await electroview.rpc.request.scanDevices({});
      allDevices = devices;
      newDeviceIds = new Set(addedIds);
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
      statusText = `已导出到 ${res.path}`;
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

  onMount(() => {
    refresh();
    setupMonitor();
  });
</script>

<div class="app">
  <!-- Toast -->
  <Toast {toasts} />

  <!-- 标题栏 -->
  <header class="titlebar">
    <div class="titlebar-inner">
      <div class="logo">
        <span class="logo-icon">🔌</span>
        <span class="logo-text">USB Device Viewer</span>
        <span class="logo-badge">v3.0</span>
      </div>
      <Toolbar
        {scanning}
        deviceCount={allDevices.length}
        onRefresh={refresh}
        onExport={exportAll}
        onCopy={() => {
          if (selectedDevice) copyDevice(selectedDevice);
          else toast("请先选中一个设备", "warning");
        }}
      />
    </div>
  </header>

  <!-- 主内容 -->
  <main class="main">
    <!-- 搜索栏 -->
    <SearchBar bind:query count={filteredDevices.length} total={allDevices.length} />

    <!-- 设备列表 -->
    <DeviceList
      devices={filteredDevices}
      {newDeviceIds}
      bind:selected={selectedDevice}
      onOpen={openModal}
    />
  </main>

  <!-- 状态栏 -->
  <footer class="statusbar">
    <div class="status-dot" class:scanning></div>
    <span class="status-text">{statusText}</span>
    {#if scanning}
      <div class="progress-track"><div class="progress-bar"></div></div>
    {/if}
    <span class="status-right">🔍 自动监控中</span>
  </footer>

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
    flex-direction: column;
    background: #0d0d12;
  }

  /* ── 标题栏 ── */
  .titlebar {
    border-bottom: 1px solid #1e1f26;
    background: #0d0d12;
    flex-shrink: 0;
  }
  .titlebar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    gap: 16px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .logo-icon { font-size: 18px; }
  .logo-text {
    font-size: 15px;
    font-weight: 600;
    color: #e2e4e9;
    letter-spacing: -0.01em;
  }
  .logo-badge {
    font-size: 11px;
    background: #1e1f26;
    color: #6b7280;
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid #2a2b35;
  }

  /* ── 主内容 ── */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  /* ── 状态栏 ── */
  .statusbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border-top: 1px solid #1e1f26;
    background: #0d0d12;
    flex-shrink: 0;
    font-size: 12px;
    color: #6b7280;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .status-dot.scanning { background: #f59e0b; animation: pulse 1s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .status-text { color: #9ca3af; flex: 1; }
  .status-right { color: #4b5563; }

  .progress-track {
    width: 120px;
    height: 3px;
    background: #1e1f26;
    border-radius: 99px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .progress-bar {
    height: 100%;
    width: 40%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 99px;
    animation: slide 1.4s infinite ease-in-out;
  }
  @keyframes slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
</style>
