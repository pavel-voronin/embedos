import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@embedos/debian-bullseye-busybox-recipe": fileURLToPath(
        new URL("./packages/debian-bullseye-busybox-recipe/src/recipe.ts", import.meta.url),
      ),
      "@embedos/debian-bullseye-busybox-runtime": fileURLToPath(
        new URL("./packages/debian-bullseye-busybox-runtime/src/index.ts", import.meta.url),
      ),
      "@embedos/vue": fileURLToPath(new URL("./packages/vue/src/lib.ts", import.meta.url)),
    },
  },
  build: {
    cssCodeSplit: true,
    emptyOutDir: true,
    lib: {
      entry: "packages/vue/src/lib.ts",
      fileName: "embedos-vue",
      formats: ["es"],
    },
    outDir: "packages/vue/dist",
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
    target: "es2022",
  },
});
