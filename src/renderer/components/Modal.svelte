<script lang="ts">
  import type { HIDDevice } from "../../shared/types";

  type Props = {
    device: HIDDevice;
    onClose: () => void;
    onCopy: () => void;
  };
  let { device, onClose, onCopy }: Props = $props();

  function handleOverlay(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // 解析 rawInfo 为键值对
  let rows = $derived(
    device.rawInfo
      .split("\n")
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return null;
        return { key: line.slice(0, idx).trim(), val: line.slice(idx + 1).trim() };
      })
      .filter(Boolean) as { key: string; val: string }[]
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleOverlay} role="dialog" aria-modal="true">
  <div class="modal">
    <!-- 头部 -->
    <div class="modal-header">
      <div class="header-left">
        <div class="header-icon">{device.isBluetooth ? "🔵" : "🔌"}</div>
        <div>
          <div class="header-title">{device.product}</div>
          <div class="header-vendor">{device.vendor}</div>
        </div>
      </div>
      <button class="close-btn" onclick={onClose}>✕</button>
    </div>

    <!-- ID 行 -->
    <div class="id-row">
      <div class="id-card">
        <div class="id-label">VID</div>
        <div class="id-value">{device.vid}</div>
      </div>
      <div class="id-card">
        <div class="id-label">PID</div>
        <div class="id-value">{device.pid}</div>
      </div>
      <div class="id-card flex-1">
        <div class="id-label">序列号</div>
        <div class="id-value serial">{device.serial}</div>
      </div>
      {#if device.isBluetooth}
        <div class="bt-chip">🔵 蓝牙HID</div>
      {/if}
    </div>

    <!-- 详情表格 -->
    <div class="detail-section">
      <div class="section-title">完整信息</div>
      <div class="detail-table">
        {#each rows as row}
          <div class="detail-row">
            <div class="detail-key">{row.key}</div>
            <div class="detail-val">{row.val}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="modal-footer">
      <button class="btn btn-primary" onclick={onCopy}>
        ⌘ C  复制信息
      </button>
      <button class="btn" onclick={onClose}>
        ✕  关闭
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fade-in 0.15s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    background: #0d0d12;
    border: 1px solid #2a2b35;
    border-radius: 16px;
    width: 580px;
    max-width: 92vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1);
    animation: slide-up 0.15s ease;
    overflow: hidden;
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── 头部 ── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 22px 16px;
    border-bottom: 1px solid #1a1b24;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-icon { font-size: 28px; }
  .header-title { font-size: 16px; font-weight: 700; color: #e2e4e9; }
  .header-vendor { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .close-btn {
    background: #1a1b24;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    color: #6b7280;
    font-size: 13px;
    cursor: pointer;
    padding: 6px 10px;
    transition: all 0.15s;
  }
  .close-btn:hover { background: #1e1f2e; color: #e06c75; border-color: #e06c75; }

  /* ── ID 行 ── */
  .id-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 22px;
    border-bottom: 1px solid #1a1b24;
    flex-wrap: wrap;
  }
  .id-card {
    background: #13141a;
    border: 1px solid #1e1f26;
    border-radius: 10px;
    padding: 8px 14px;
    min-width: 80px;
  }
  .id-card.flex-1 { flex: 1; }
  .id-label { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .id-value { font-size: 15px; font-weight: 700; color: #a5b4fc; font-family: 'Consolas', monospace; }
  .id-value.serial { font-size: 12px; color: #6b7280; word-break: break-all; }
  .bt-chip {
    font-size: 12px;
    font-weight: 600;
    color: #60a5fa;
    background: #0c1a2e;
    border: 1px solid #1e3a5f;
    padding: 6px 14px;
    border-radius: 20px;
  }

  /* ── 详情 ── */
  .detail-section {
    flex: 1;
    overflow-y: auto;
    padding: 14px 22px;
  }
  .detail-section::-webkit-scrollbar { width: 4px; }
  .detail-section::-webkit-scrollbar-thumb { background: #1e1f26; border-radius: 2px; }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 10px;
  }
  .detail-table { display: flex; flex-direction: column; gap: 2px; }
  .detail-row {
    display: flex;
    gap: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
  }
  .detail-row:nth-child(odd) { background: #0f1017; }
  .detail-key { color: #6b7280; width: 160px; flex-shrink: 0; font-weight: 500; }
  .detail-val { color: #d1d5db; font-family: 'Consolas', 'Monaco', monospace; word-break: break-all; }

  /* ── 底部 ── */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid #1a1b24;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: #13141a;
    color: #9ca3af;
    transition: all 0.15s;
    font-family: inherit;
  }
  .btn:hover { background: #1a1b24; border-color: #3f4050; color: #e2e4e9; }
  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-color: transparent;
    color: #fff;
  }
  .btn-primary:hover { background: linear-gradient(135deg, #4f52d3 0%, #7c4fd6 100%); }
</style>
