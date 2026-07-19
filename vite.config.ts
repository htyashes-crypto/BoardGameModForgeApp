import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  // Tauri 开发约定:不清屏(保留 Rust 报错)、固定端口(1470,避开 HtyBox 1420 / HtyWiki 1450)、忽略 src-tauri
  clearScreen: false,
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
