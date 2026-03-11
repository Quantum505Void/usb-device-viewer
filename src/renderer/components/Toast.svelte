<script lang="ts">
  type ToastItem = { id: number; msg: string; type: "success" | "warning" | "info" | "error" };
  type Props = { toasts: ToastItem[] };
  let { toasts }: Props = $props();

  const icons = { success: "✓", warning: "⚠", info: "ℹ", error: "✕" };
  const colors = {
    success: "border-green-500/40 bg-green-950/60",
    warning: "border-yellow-500/40 bg-yellow-950/60",
    error:   "border-red-500/40 bg-red-950/60",
    info:    "border-indigo-500/40 bg-indigo-950/60",
  };
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
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #2a2b35;
    background: #13141a;
    color: #e2e4e9;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: toast-in 0.2s ease;
    backdrop-filter: blur(8px);
    pointer-events: auto;
  }
  .toast-success { border-color: rgba(34, 197, 94, 0.4); background: rgba(5, 46, 22, 0.85); }
  .toast-warning { border-color: rgba(234, 179, 8, 0.4); background: rgba(66, 32, 6, 0.85); }
  .toast-error   { border-color: rgba(239, 68, 68, 0.4); background: rgba(69, 10, 10, 0.85); }
  .toast-info    { border-color: rgba(99, 102, 241, 0.4); background: rgba(30, 27, 75, 0.85); }

  .toast-icon { font-size: 14px; font-weight: 700; }
  .toast-success .toast-icon { color: #22c55e; }
  .toast-warning .toast-icon { color: #eab308; }
  .toast-error   .toast-icon { color: #ef4444; }
  .toast-info    .toast-icon { color: #818cf8; }

  .toast-msg { color: #d1d5db; }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
