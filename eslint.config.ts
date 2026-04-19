import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".tmp-*/**",
      "node_modules/**",
      "packages/**/dist/**",
      "packages/vite/playground/cdn/vendor/**",
      "packages/debian-bullseye-busybox-runtime/dist/**",
      "public/rootfs/**",
      "playground/public/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
  },
  {
    files: ["**/*.vue"],
    extends: [...pluginVue.configs["flat/recommended"]],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        extraFileExtensions: [".vue"],
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  eslintConfigPrettier,
);
