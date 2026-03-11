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

  // ESC 关闭
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

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

  // 高亮值（HID usage page / hex 等）
  function isHex(val: string) { return /^0x[0-9A-Fa-f]+/.test(val); }
  function isPath(val: string) { return val.startsWith("/") || val.includes("\\") || val.includes("::"); }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={handleOverlay} role="dialog" aria-modal="true" tabindex="-1">
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
      <button class="close-btn" onclick={onClose} title="关闭 (ESC)">✕</button>
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
      <div class="conn-chip" class:bt={device.isBluetooth}>
        {device.isBluetooth ? "🔵 蓝牙HID" : "🔌 USB"}
      </div>
    </div>

    <!-- 详情表格 -->
    <div class="detail-section">
      <div class="section-header">
        <span class="section-title">完整信息</span>
        <span class="section-count">{rows.length} 项</span>
      </div>
      <div class="detail-table">
        {#each rows as row}
          <div class="detail-row">
            <div class="detail-key">{row.key}</div>
            <div class="detail-val" class:hex={isHex(row.val)} class:path={isPath(row.val)} title={isPath(row.val) ? row.val : undefined}>{row.val}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="modal-footer">
      <span class="footer-hint">按 ESC 关闭</span>
      <div class="footer-actions">
        <button class="btn btn-primary" onclick={onCopy}>
          <span>⌘</span> 复制信息
        </button>
        <button class="btn" onclick={onClose}>关闭</button>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fade-in 0.12s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    background: #0f1017;
    border: 1px solid #2a2b35;
    border-radius: 16px;
    width: 600px;
    max-width: 94vw;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.08);
    animation: slide-up 0.14s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* 头部 */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #1a1b24;
    background: linear-gradient(180deg, #13141d 0%, #0f1017 100%);
  }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .header-icon { font-size: 30px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
  .header-title { font-size: 16px; font-weight: 700; color: #e2e4e9; letter-spacing: -0.01em; }
  .header-vendor { font-size: 12px; color: #6b7280; margin-top: 3px; }
  .close-btn {
    background: #1a1b24;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    color: #6b7280;
    font-size: 13px;
    cursor: pointer;
    padding: 7px 11px;
    transition: all 0.12s;
    line-height: 1;
  }
  .close-btn:hover { background: rgba(224,108,117,0.12); color: #e06c75; border-color: rgba(224,108,117,0.4); }

  /* ID 行 */
  .id-row {
    display: flex;
    align-items: stretch;
    gap: 10px;
    padding: 14px 24px;
    border-bottom: 1px solid #1a1b24;
    flex-wrap: wrap;
  }
  .id-card {
    background: #13141a;
    border: 1px solid #1e1f28;
    border-radius: 10px;
    padding: 8px 14px;
    min-width: 80px;
  }
  .id-card.flex-1 { flex: 1; }
  .id-label {
    font-size: 10px; color: #6b7280; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px;
  }
  .id-value {
    font-size: 16px; font-weight: 700; color: #a5b4fc;
    font-family: 'Consolas', 'JetBrains Mono', monospace;
  }
  .id-value.serial { font-size: 12px; color: #6b7280; word-break: break-all; font-weight: 400; }
  .conn-chip {
    display: flex; align-items: center;
    font-size: 12px; font-weight: 600; color: #60a5fa;
    background: rgba(59,130,246,0.08);
    border: 1px solid rgba(59,130,246,0.2);
    padding: 8px 14px; border-radius: 10px;
    white-space: nowrap;
    align-self: center;
  }
  .conn-chip:not(.bt) {
    color: #34d399;
    background: rgba(52,211,153,0.08);
    border-color: rgba(52,211,153,0.2);
  }

  /* 详情 */
  .detail-section {
    flex: 1; overflow-y: auto; padding: 14px 24px;
  }
  .detail-section::-webkit-scrollbar { width: 4px; }
  .detail-section::-webkit-scrollbar-thumb { background: #2a2b35; border-radius: 2px; }

  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
  }
  .section-title {
    font-size: 11px; font-weight: 700; color: #4b5563;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .section-count {
    font-size: 11px; color: #374151;
    background: #13141a; border: 1px solid #1e1f26;
    padding: 2px 8px; border-radius: 20px;
  }

  .detail-table { display: flex; flex-direction: column; gap: 1px; }
  .detail-row {
    display: flex; gap: 12px;
    padding: 7px 10px; border-radius: 7px; font-size: 13px;
    transition: background 0.08s;
  }
  .detail-row:hover { background: #13141a; }
  .detail-key { color: #6b7280; width: 170px; flex-shrink: 0; font-weight: 500; }
  .detail-val {
    color: #d1d5db;
    font-family: 'Consolas', 'JetBrains Mono', monospace;
    word-break: break-all; flex: 1;
  }
  .detail-val.hex { color: #a5b4fc; }
  .detail-val.path { color: #9ca3af; font-size: 12px; }

  /* 底部 */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 24px;
    border-top: 1px solid #1a1b24;
  }
  .footer-hint { font-size: 12px; color: #374151; }
  .footer-actions { display: flex; gap: 10px; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid #2a2b35; border-radius: 8px;
    padding: 8px 18px; font-size: 13px; font-weight: 500;
    cursor: pointer; background: #13141a; color: #9ca3af;
    transition: all 0.12s; font-family: inherit;
  }
  .btn:hover { background: #1a1b24; border-color: #3f4050; color: #e2e4e9; }
  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-color: transparent; color: #fff;
  }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-primary span { font-family: -apple-system, sans-serif; }
</style>
