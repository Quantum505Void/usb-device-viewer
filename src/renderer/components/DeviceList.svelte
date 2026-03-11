<script lang="ts">
  import type { HIDDevice } from "../../shared/types";

  type Props = {
    devices: HIDDevice[];
    newDeviceIds: Set<string>;
    query: string;          // 新增：用于高亮
    selected: HIDDevice | null;
    onOpen: (dev: HIDDevice) => void;
    onCopy: (dev: HIDDevice) => void;
  };
  let { devices, newDeviceIds, query = "", selected = $bindable(), onOpen, onCopy }: Props = $props();

  function getId(d: HIDDevice) { return `${d.vid}:${d.pid}:${d.serial}`; }

  // ── 分组（支持折叠）──
  let collapsedGroups = $state<Set<string>>(new Set());
  function toggleGroup(label: string) {
    collapsedGroups = new Set(
      collapsedGroups.has(label)
        ? [...collapsedGroups].filter(l => l !== label)
        : [...collapsedGroups, label]
    );
  }

  let groups = $derived(
    (() => {
      const usb = devices.filter(d => !d.isBluetooth);
      const bt  = devices.filter(d => d.isBluetooth);
      return [
        ...(usb.length ? [{ key: "usb", label: `USB 设备 (${usb.length})`, items: usb }] : []),
        ...(bt.length  ? [{ key: "bt",  label: `蓝牙 HID (${bt.length})`,  items: bt  }] : []),
      ];
    })()
  );

  // ── 搜索高亮 ──
  function highlight(text: string): string {
    if (!query.trim()) return escapeHtml(text);
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escapeHtml(text).replace(
      new RegExp(q, "gi"),
      m => `<mark>${m}</mark>`
    );
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ── 右键菜单 ──
  type CtxMenu = { x: number; y: number; dev: HIDDevice } | null;
  let ctxMenu = $state<CtxMenu>(null);

  function openCtx(e: MouseEvent, dev: HIDDevice) {
    e.preventDefault();
    selected = dev;
    ctxMenu = { x: e.clientX, y: e.clientY, dev };
  }
  function closeCtx() { ctxMenu = null; }
</script>

<!-- 关闭右键菜单：点击空白处 -->
<svelte:window onclick={closeCtx} onkeydown={(e) => { if (e.key === "Escape") closeCtx(); }} />

<div class="list-wrap">
  {#if devices.length === 0}
    <div class="empty">
      <div class="empty-usb">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="4" width="8" height="20" rx="4" fill="#2a2b35"/>
          <rect x="20" y="24" width="24" height="20" rx="6" fill="#1e1f26" stroke="#2a2b35" stroke-width="2"/>
          <rect x="29" y="44" width="6" height="16" rx="3" fill="#2a2b35"/>
          <rect x="22" y="32" width="5" height="3" rx="1.5" fill="#3f4050"/>
          <rect x="37" y="32" width="5" height="3" rx="1.5" fill="#3f4050"/>
        </svg>
      </div>
      {#if query.trim()}
        <div class="empty-title">无匹配结果</div>
        <div class="empty-sub">没有设备匹配 "<em>{query}</em>"</div>
      {:else}
        <div class="empty-title">未发现 HID 设备</div>
        <div class="empty-sub">连接设备后按 <kbd>Ctrl+R</kbd> 刷新</div>
      {/if}
    </div>
  {:else}
    <div class="list">
      {#each groups as group (group.key)}
        {@const collapsed = collapsedGroups.has(group.label)}
        <button class="group-label" onclick={() => toggleGroup(group.label)}>
          <span class="group-chevron" class:collapsed>{collapsed ? "▶" : "▼"}</span>
          {group.label}
        </button>

        {#if !collapsed}
          {#each group.items as dev, i (getId(dev))}
            {@const id = getId(dev)}
            {@const isNew = newDeviceIds.has(id)}
            {@const isSelected = selected && getId(selected) === id}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="item"
              class:selected={isSelected}
              class:new-device={isNew}
              style="--delay:{i * 20}ms"
              onclick={() => { selected = dev; }}
              ondblclick={() => onOpen(dev)}
              oncontextmenu={(e) => openCtx(e, dev)}
              role="option"
              aria-selected={!!isSelected}
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === "Enter") onOpen(dev);
                if (e.key === "c" && (e.ctrlKey || e.metaKey)) onCopy(dev);
              }}
            >
              <div class="item-left">
                <div class="item-icon">{dev.isBluetooth ? "🔵" : "🔌"}</div>
                <div class="item-info">
                  <div class="item-name">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html highlight(dev.product)}
                    {#if isNew}<span class="new-badge">NEW</span>{/if}
                    {#if dev.isBluetooth}<span class="bt-badge">BT</span>{/if}
                  </div>
                  <div class="item-vendor">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html highlight(dev.vendor)}
                  </div>
                </div>
              </div>
              <div class="item-right">
                <div class="id-chip">VID <span>{@html highlight(dev.vid)}</span></div>
                <div class="id-chip">PID <span>{@html highlight(dev.pid)}</span></div>
                {#if dev.serial && dev.serial !== "N/A"}
                  <div class="serial-chip">{dev.serial.slice(0, 14)}</div>
                {/if}
                <div class="detail-hint">双击详情 →</div>
              </div>
            </div>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- 右键菜单 -->
{#if ctxMenu}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ctx-menu"
    style="left:{ctxMenu.x}px; top:{ctxMenu.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button class="ctx-item" onclick={() => { onOpen(ctxMenu!.dev); closeCtx(); }}>
      <span>🔍</span> 查看详情
    </button>
    <button class="ctx-item" onclick={() => { onCopy(ctxMenu!.dev); closeCtx(); }}>
      <span>📋</span> 复制信息
    </button>
    <div class="ctx-divider"></div>
    <div class="ctx-info">{ctxMenu.dev.vid}:{ctxMenu.dev.pid}</div>
  </div>
{/if}

<style>
  .list-wrap {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px 16px;
  }
  .list::-webkit-scrollbar { width: 4px; }
  .list::-webkit-scrollbar-track { background: transparent; }
  .list::-webkit-scrollbar-thumb { background: #2a2b35; border-radius: 2px; }
  .list::-webkit-scrollbar-thumb:hover { background: #3f4050; }

  /* ── 分组 ── */
  .group-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 14px 4px 6px;
    background: none;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: color 0.12s;
  }
  .group-label:hover { color: #6b7280; }
  .group-chevron {
    font-size: 9px;
    transition: transform 0.15s;
  }
  .group-chevron.collapsed { transform: none; }

  /* ── 空状态 ── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 10px;
    color: #4b5563;
    padding-bottom: 60px;
  }
  .empty-usb { width: 64px; height: 64px; opacity: 0.35; }
  .empty-usb svg { width: 100%; height: 100%; }
  .empty-title { font-size: 15px; font-weight: 600; color: #6b7280; }
  .empty-sub { font-size: 12px; color: #4b5563; }
  .empty-sub em { color: #6366f1; font-style: normal; }
  kbd {
    display: inline-block;
    font-size: 11px;
    font-family: 'Consolas', monospace;
    background: #1e1f26;
    border: 1px solid #2a2b35;
    border-radius: 4px;
    padding: 1px 6px;
    color: #9ca3af;
  }

  /* ── 列表项 ── */
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 10px;
    margin-bottom: 2px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.1s, border-color 0.1s;
    user-select: none;
    outline: none;
    /* 进场动画 */
    animation: slideIn 0.18s ease both;
    animation-delay: var(--delay, 0ms);
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .item:hover {
    background: #111218;
    border-color: #1e1f26;
  }
  .item:focus-visible {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
  }
  .item.selected {
    background: #13141a;
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.12);
  }
  .item.new-device {
    background: #0c1a0f;
    border-color: #22c55e;
    animation: flash 0.5s ease;
  }
  @keyframes flash {
    0% { background: #1a3a20; }
    100% { background: #0c1a0f; }
  }

  .item-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
  .item-icon { font-size: 18px; flex-shrink: 0; }
  .item-info { min-width: 0; }
  .item-name {
    font-size: 13px;
    font-weight: 600;
    color: #e2e4e9;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item.selected .item-name { color: #a5b4fc; }
  .item.new-device .item-name { color: #86efac; }
  .item-vendor { font-size: 12px; color: #4b5563; margin-top: 2px; }
  .item.selected .item-vendor { color: #6366f1; }

  :global(mark) {
    background: rgba(99,102,241,0.3);
    color: #a5b4fc;
    border-radius: 2px;
    padding: 0 1px;
  }

  .new-badge {
    font-size: 10px; font-weight: 700;
    background: #22c55e; color: #0a1a0f;
    padding: 1px 6px; border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .bt-badge {
    font-size: 10px; font-weight: 700;
    background: #3b82f6; color: #fff;
    padding: 1px 6px; border-radius: 4px;
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: 12px;
  }
  .id-chip {
    font-size: 11px;
    color: #6b7280;
    background: #1a1b24;
    border: 1px solid #2a2b35;
    padding: 2px 8px;
    border-radius: 6px;
    font-family: 'Consolas', 'Monaco', monospace;
  }
  .id-chip span { color: #a5b4fc; font-weight: 600; }
  .item.selected .id-chip { border-color: #3f4169; }

  .serial-chip {
    font-size: 11px;
    color: #4b5563;
    font-family: 'Consolas', 'Monaco', monospace;
  }
  .detail-hint {
    font-size: 11px;
    color: #2a2b35;
    transition: color 0.12s;
  }
  .item:hover .detail-hint,
  .item.selected .detail-hint { color: #4b5563; }

  /* ── 右键菜单 ── */
  .ctx-menu {
    position: fixed;
    z-index: 1000;
    background: #16171f;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    animation: ctxIn 0.1s ease;
  }
  @keyframes ctxIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 12px;
    border-radius: 5px;
    border: none;
    background: none;
    color: #c9cbd4;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .ctx-item:hover { background: #1e1f28; color: #e2e4e9; }
  .ctx-divider { height: 1px; background: #1e1f26; margin: 4px 0; }
  .ctx-info {
    font-size: 11px;
    color: #3f4050;
    padding: 4px 12px;
    font-family: monospace;
  }
</style>
