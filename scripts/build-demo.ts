import { runCachedBuild } from "./build-cache.ts";

await runCachedBuild({
  taskName: "build:demo",
  manifestName: "build-demo.json",
  inputs: [
    "env.d.ts",
    "index.html",
    "package-lock.json",
    "package.json",
    "packages/core",
    "packages/debian-bullseye-busybox-image-recipe/package.json",
    "packages/debian-bullseye-busybox-image-recipe/src/recipe.ts",
    "packages/debian-bullseye-busybox-runtime/src",
    "packages/debian-bullseye-busybox-recipe/package.json",
    "packages/debian-bullseye-busybox-recipe/src/recipe.ts",
    "packages/vue/src",
    "packages/vite/package.json",
    "packages/vite/tsconfig.build.json",
    "packages/vite/src",
    "scripts/build-vite-types.ts",
    "playground",
    "playground/public",
    "tsconfig.json",
    "vite.config.ts",
    "vite.vite.config.ts",
  ],
  outputs: [
    "dist/playground/playground/index.html",
    "dist/playground/playground/cdn/index.html",
    "dist/playground/playground/cdn-plain/index.html",
    "dist/playground/playground/cdn-lazy/index.html",
    "packages/vite/dist/index.js",
    "packages/vite/dist/index.d.ts",
  ],
  commands: [
    { command: "npm", args: ["run", "build:vite"] },
    { command: "npx", args: ["vite", "build"] },
  ],
});

// cache-invalidation-check
