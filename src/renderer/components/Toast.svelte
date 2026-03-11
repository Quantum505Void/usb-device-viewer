<script lang="ts">
  type ToastItem = { id: number; msg: string; type: "success" | "warning" | "info" | "error" };
  type Props = { toasts: ToastItem[] };
  let { toasts }: Props = $props();

  const icons = { success: "✓", warning: "⚠", info: "ℹ", error: "✕" };
</script>

<div class="toast-container">
  {#each toasts as t (t.id)}
    <div class="toast toast-{t.type}">
      <span class="toast-icon">{icons[t.type]}</span>
      <span class="toast-msg">{t.msg}</span>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 200;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid transparent;
    backdrop-filter: blur(8px);
    animation: toast-in 0.2s ease, toast-out 0.3s ease 3.2s forwards;
    white-space: nowrap;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .toast-success { background: #0c1f12; border-color: #22c55e; color: #86efac; }
  .toast-warning { background: #1f1500; border-color: #f59e0b; color: #fcd34d; }
  .toast-error   { background: #1f0a0a; border-color: #ef4444; color: #fca5a5; }
  .toast-info    { background: #0d111f; border-color: #6366f1; color: #a5b4fc; }

  .toast-icon { font-size: 14px; font-weight: 700; }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes toast-out {
    from { opacity: 1; }
    to   { opacity: 0; transform: translateY(4px); }
  }
</style>
