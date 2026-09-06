/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  plugins: [
    // ホーム画面に追加してオフラインでも開けるようにする。Service Worker はビルド成果物を丸ごと precache する
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "vibrate-test.html"],
      manifest: {
        name: "Panepon clone",
        short_name: "Panepon",
        description: "Panel de Pon style action puzzle",
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
