import { runCachedBuild } from "./build-cache.ts";

await runCachedBuild({
  taskName: "build:cdn",
  manifestName: "build-cdn.json",
  inputs: [
    "package-lock.json",
    "package.json",
    "packages/core",
    "packages/debian-bullseye-busybox-recipe",
    "packages/debian-bullseye-busybox-runtime/src",
    "packages/debian-bullseye-busybox-runtime/tsconfig.build.json",
    "packages/vue/src",
    "playground/assets",
    "scripts/build-runtime.ts",
    "scripts/sync-cdn-assets.ts",
    "vite.lib.config.ts",
  ],
  outputs: [
    "packages/debian-bullseye-busybox-runtime/dist/index.js",
    "packages/debian-bullseye-busybox-runtime/dist/index.d.ts",
    "packages/debian-bullseye-busybox-runtime/rootfs/embedos-rootfs.ext2",
    "packages/vue/dist/embedos-vue.js",
    "packages/vue/dist/lib.css",
    "playground/public/playground/cdn/vendor/runtime/rootfs/embedos-rootfs.ext2",
  ],
  commands: [
    { command: "npm", args: ["run", "build:runtime"] },
    { command: "npm", args: ["run", "build:lib"] },
    { command: "tsx", args: ["./scripts/sync-cdn-assets.ts"] },
  ],
});
