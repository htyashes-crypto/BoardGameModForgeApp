import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  // Tauri 开发约定:不清屏(保留 Rust 报错)、固定端口(1470,避开 HtyBox 1420 / HtyWiki 1450)、忽略 src-tauri
  clearScreen: false,
  // 前端产物走 dist-web/:dist/ 专属 E 侧分发契约(dist/win-unpacked 由发版脚本组装,
  // 若与 vite 默认 outDir 同名会被 emptyOutDir 清空 —— 2026-07-19 实际踩坑,故隔离)
  build: {
    outDir: "dist-web",
  },
  server: {
    port: 1470,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1471 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
