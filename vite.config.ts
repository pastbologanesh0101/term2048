import { defineConfig } from "vite";

// The browser build. It reuses src/game.ts and src/ai.ts verbatim (both are
// pure, no Node APIs) and adds a DOM renderer under web/.
export default defineConfig({
  root: "web",
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    // allow importing ../src from the web/ root during `vite dev`
    fs: { allow: [".."] },
  },
});
