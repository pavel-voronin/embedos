import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), Icons({ compiler: "vue3" })],
  resolve: {
    alias: {
      "@embedos/debian-bullseye-busybox-recipe": fileURLToPath(
        new URL("./packages/debian-bullseye-busybox-recipe/src/recipe.ts", import.meta.url),
      ),
      "@embedos/debian-bullseye-busybox-image-recipe": fileURLToPath(
        new URL("./packages/debian-bullseye-busybox-image-recipe/src/recipe.ts", import.meta.url),
      ),
      "@embedos/debian-bullseye-busybox-runtime": fileURLToPath(
        new URL("./packages/debian-bullseye-busybox-runtime/src/index.ts", import.meta.url),
      ),
      "@embedos/vue": fileURLToPath(new URL("./packages/vue/src/lib.ts", import.meta.url)),
      "@embedos/vue/style.css": fileURLToPath(
        new URL("./packages/vue/src/style.css", import.meta.url),
      ),
    },
  },
  test: {
    include: ["packages/**/*.test.ts"],
    watch: false,
  },
});
