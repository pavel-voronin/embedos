import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    ssr: "packages/vite/src/index.ts",
    outDir: "packages/vite/dist",
    target: "node18",
  },
});
