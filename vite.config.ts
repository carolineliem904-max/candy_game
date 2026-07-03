import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // Phaser is a large single-vendor chunk; code-splitting it wouldn't help
    // load time in a one-page game, so we silence the warning instead of
    // manufacturing a manualChunks split with no real benefit.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
