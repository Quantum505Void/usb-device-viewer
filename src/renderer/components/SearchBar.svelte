<script lang="ts">
  type Props = {
    query: string;
    count: number;
    total: number;
  };
  let { query = $bindable(), count, total }: Props = $props();
</script>

<div class="searchbar">
  <div class="search-wrap">
    <span class="search-icon">⌕</span>
    <input
      type="text"
      bind:value={query}
      placeholder="搜索设备... VID · PID · 厂商 · 产品 · 序列号"
      class="search-input"
    />
    {#if query}
      <button class="clear-btn" onclick={() => (query = "")}>✕</button>
    {/if}
  </div>
  {#if query}
    <div class="filter-hint">
      {count} / {total} 个匹配
    </div>
  {/if}
</div>

<style>
  .searchbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid #1a1b24;
    flex-shrink: 0;
  }
  .search-wrap {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    color: #4b5563;
    font-size: 16px;
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    height: 38px;
    background: #13141a;
    border: 1px solid #1e1f26;
    border-radius: 10px;
    padding: 0 36px 0 36px;
    color: #e2e4e9;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .search-input::placeholder { color: #4b5563; }
  .search-input:focus {
    border-color: #6366f1;
    background: #15161e;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  .clear-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #4b5563;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
  }
  .clear-btn:hover { color: #9ca3af; background: #1e1f26; }
  .filter-hint {
    white-space: nowrap;
    font-size: 12px;
    color: #6366f1;
    background: #1a1b2e;
    border: 1px solid #2e2f4a;
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
  }
</style>
