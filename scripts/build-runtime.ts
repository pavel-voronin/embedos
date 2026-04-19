import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const runtimeDir = path.join(rootDir, "packages", "debian-bullseye-busybox-runtime");
const recipeDir = path.join(rootDir, "packages", "debian-bullseye-busybox-recipe");
const buildRootDir = path.join(rootDir, ".cache", "build-runtime");
const imageTag = `embedos-${Date.now().toString(36)}-runtime:temp`;
const outputRootfs = path.join(runtimeDir, "rootfs", "embedos-rootfs.ext2");

type RunOptions = {
  cwd?: string;
};

function run(command: string, args: string[], options: RunOptions = {}): void {
  execFileSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: process.env,
    stdio: "inherit",
  });
}

await rm(buildRootDir, { force: true, recursive: true });
await mkdir(buildRootDir, { recursive: true });
await mkdir(path.dirname(outputRootfs), { recursive: true });

run("docker", ["build", "--platform", "linux/386", "-f", "Dockerfile", "-t", imageTag, "."], {
  cwd: recipeDir,
});

const containerId = execFileSync("docker", ["create", "--platform", "linux/386", imageTag, "sh"], {
  cwd: rootDir,
  env: process.env,
  encoding: "utf8",
}).trim();

const exportTarPath = path.join(buildRootDir, "rootfs.tar");

try {
  run("docker", ["export", "-o", exportTarPath, containerId]);
} finally {
  try {
    run("docker", ["rm", "-f", containerId]);
  } catch {
    // Ignore cleanup failures.
  }
}

const packScript = `
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null
apt-get install -y e2fsprogs tar >/dev/null
work=/tmp/embedos-pack
rootfs=$work/rootfs
rm -rf "$work"
mkdir -p "$rootfs"
tar -xf /out/rootfs.tar -C "$rootfs"
rm -f "$rootfs/.dockerenv" "$rootfs/etc/hostname" "$rootfs/etc/hosts" "$rootfs/etc/mtab" "$rootfs/etc/resolv.conf"
rm -rf "$rootfs/dev/pts" "$rootfs/dev/shm" "$rootfs/sys"
mkdir -p "$rootfs/dev"
rm -f "$rootfs/dev/console" "$rootfs/dev/tty"
mknod "$rootfs/dev/console" c 5 1
mknod "$rootfs/dev/tty" c 5 0
truncate -s "16M" /out/embedos-rootfs.ext2
mke2fs -q -t ext2 -b 4096 -d "$rootfs" -F /out/embedos-rootfs.ext2 "16M"
rm -f /out/rootfs.tar
`;

run("docker", [
  "run",
  "--rm",
  "-v",
  `${buildRootDir}:/out`,
  "debian:bullseye",
  "sh",
  "-lc",
  packScript,
]);

await cp(path.join(buildRootDir, "embedos-rootfs.ext2"), outputRootfs);

run("npx", ["tsc", "-p", path.join(runtimeDir, "tsconfig.build.json")]);

try {
  run("docker", ["rmi", "-f", imageTag]);
} catch {
  // Ignore cleanup failures.
}
