import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    // Phaser is a large single-vendor chunk; code-splitting it wouldn't help
    // load time in a one-page game, so we silence the warning instead of
    // manufacturing a manualChunks split with no real benefit.
    chunkSizeWarningLimit: 1600,
  },
  // `as any`: `vitest/config`'s `defineConfig` type-checks `plugins` against
  // vitest's own *nested* vite@5 dependency (node_modules/vitest/node_modules
  // /vite), while `vite-plugin-pwa`'s `Plugin` type comes from this project's
  // top-level vite@6 — two structurally-similar-but-distinct `Plugin` types
  // that TS won't unify, even though there's only one real Vite at runtime.
  // Harmless type-identity noise, not a real incompatibility.
  plugins: [
    // SLICE 9 Checkpoint 3: "Add to Home Screen" install support. `generateSW`
    // (the plugin's default strategy) auto-builds a cache-first service
    // worker over the actual build output — exactly "cache-first for the
    // built assets" from the spec, with no hand-written SW to keep in sync.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Beep Beep!",
        short_name: "Beep Beep!",
        description: "A vehicle-themed match-3 puzzle game.",
        // Matches THEME.sky.top (#8ecbe8) and index.html's own gradient top.
        theme_color: "#8ecbe8",
        background_color: "#8ecbe8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Every hashed build artifact, cached on first visit so the game
        // loads instantly (and works offline) on every visit after.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }) as any,
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
