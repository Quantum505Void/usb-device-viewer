<script lang="ts">
  import type { HIDDevice } from "../../shared/types";

  type Props = {
    devices: HIDDevice[];
    newDeviceIds: Set<string>;
    selected: HIDDevice | null;
    onOpen: (dev: HIDDevice) => void;
  };
  let { devices, newDeviceIds, selected = $bindable(), onOpen }: Props = $props();

  function getId(d: HIDDevice) { return `${d.vid}:${d.pid}:${d.serial}`; }
</script>

<div class="list-wrap">
  {#if devices.length === 0}
    <div class="empty">
      <div class="empty-icon">🔌</div>
      <div class="empty-title">未找到 HID 设备</div>
      <div class="empty-sub">请连接设备后点击刷新</div>
    </div>
  {:else}
    <div class="list">
      {#each devices as dev (getId(dev))}
        {@const id = getId(dev)}
        {@const isNew = newDeviceIds.has(id)}
        {@const isSelected = selected && getId(selected) === id}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="item"
          class:selected={isSelected}
          class:new-device={isNew}
          onclick={() => { selected = dev; }}
          ondblclick={() => onOpen(dev)}
          role="option"
          aria-selected={!!isSelected}
        >
          <div class="item-left">
            <div class="item-icon">{dev.isBluetooth ? "🔵" : "🔌"}</div>
            <div class="item-info">
              <div class="item-name">
                {dev.product}
                {#if isNew}<span class="new-badge">NEW</span>{/if}
                {#if dev.isBluetooth}<span class="bt-badge">BT</span>{/if}
              </div>
              <div class="item-vendor">{dev.vendor}</div>
            </div>
          </div>
          <div class="item-right">
            <div class="id-chip">VID <span>{dev.vid}</span></div>
            <div class="id-chip">PID <span>{dev.pid}</span></div>
            {#if dev.serial && dev.serial !== "N/A"}
              <div class="serial-chip">{dev.serial.slice(0, 12)}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .list-wrap {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
  }
  .list::-webkit-scrollbar { width: 4px; }
  .list::-webkit-scrollbar-track { background: transparent; }
  .list::-webkit-scrollbar-thumb { background: #1e1f26; border-radius: 2px; }

  /* ── 空状态 ── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 8px;
    color: #4b5563;
  }
  .empty-icon { font-size: 40px; opacity: 0.5; }
  .empty-title { font-size: 15px; font-weight: 600; color: #6b7280; }
  .empty-sub { font-size: 13px; }

  /* ── 列表项 ── */
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 10px;
    margin-bottom: 3px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.12s;
    user-select: none;
  }
  .item:hover {
    background: #13141a;
    border-color: #1e1f26;
  }
  .item.selected {
    background: #13141a;
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
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

  .item-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .item-icon { font-size: 20px; flex-shrink: 0; }
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
  .item.new-device .item-vendor { color: #4ade80; }

  .new-badge {
    font-size: 10px;
    font-weight: 700;
    background: #22c55e;
    color: #0a1a0f;
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .bt-badge {
    font-size: 10px;
    font-weight: 700;
    background: #3b82f6;
    color: #fff;
    padding: 1px 6px;
    border-radius: 4px;
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
</style>
