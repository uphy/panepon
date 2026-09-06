/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// worktree を並べて開いてもポートがぶつからないよう、環境変数で変えられるようにする（既定は 5173 / 4173）
const DEV_PORT = Number(process.env.DEV_PORT) || 5173;
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT) || 4173;

export default defineConfig({
  base: "./",
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  plugins: [
    // ホーム画面に追加してオフラインでも開けるようにする。Service Worker はビルド成果物を丸ごと precache する
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "vibrate-test.html"],
      manifest: {
        name: "Swaprise",
        short_name: "Swaprise",
        description: "Swap & match action puzzle",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#14141c",
        theme_color: "#14141c",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
