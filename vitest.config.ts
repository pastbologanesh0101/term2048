import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts (which is the browser build, rooted at
// web/) so the test runner stays anchored at the repo root.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
