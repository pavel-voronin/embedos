import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const cdnDir = path.join(rootDir, "playground", "public", "playground", "cdn");
const targetDir = path.join(cdnDir, "vendor");

await rm(cdnDir, { force: true, recursive: true });
await mkdir(path.join(targetDir, "runtime", "rootfs"), { recursive: true });
await mkdir(path.join(targetDir, "runtime", "assets"), { recursive: true });
await cp(
  path.join(
    rootDir,
    "packages",
    "debian-bullseye-busybox-runtime",
    "rootfs",
    "embedos-rootfs.ext2",
  ),
  path.join(targetDir, "runtime", "rootfs", "embedos-rootfs.ext2"),
);
await cp(
  path.join(rootDir, "playground", "assets", "fz1"),
  path.join(targetDir, "runtime", "assets", "fz1"),
);
await cp(
  path.join(rootDir, "node_modules", "vue", "dist", "vue.esm-browser.js"),
  path.join(targetDir, "vue-browser.js"),
);
