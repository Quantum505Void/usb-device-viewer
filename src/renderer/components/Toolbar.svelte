<script lang="ts">
  type Props = {
    scanning: boolean;
    deviceCount: number;
    onRefresh: () => void;
    onExport: () => void;
    onCopy: () => void;
  };
  let { scanning, deviceCount, onRefresh, onExport, onCopy }: Props = $props();
</script>

<div class="toolbar">
  <button class="btn btn-primary" onclick={onRefresh} disabled={scanning} title="Ctrl+R">
    <span class:spin={scanning}>↺</span>
    刷新设备
  </button>
  <div class="divider"></div>
  <button class="btn" onclick={onCopy} title="Ctrl+C（选中设备后）">
    <span>⌘ C</span>
    复制信息
  </button>
  <button class="btn" onclick={onExport} title="Ctrl+E">
    <span>↓</span>
    导出数据
  </button>
  <div class="count-chip">
    {deviceCount} 个设备
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #2a2b35;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: #13141a;
    color: #9ca3af;
    transition: all 0.15s;
    font-family: inherit;
  }
  .btn:hover:not(:disabled) {
    background: #1a1b24;
    border-color: #3f4050;
    color: #e2e4e9;
  }
  .btn:active:not(:disabled) { background: #0d0e14; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-color: transparent;
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #4f52d3 0%, #7c4fd6 100%);
    color: #fff;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: #1e1f26;
    margin: 0 4px;
  }
  .count-chip {
    font-size: 12px;
    color: #6366f1;
    background: #1a1b2e;
    border: 1px solid #2e2f4a;
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
    margin-left: 4px;
  }
  .spin { display: inline-block; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
