import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  // 排除 electrobun build 产物目录，防止 dev --watch 模式无限循环重建
  watch: {
    ignored: ["**/build/**", "**/dist/**"],
  },
});
