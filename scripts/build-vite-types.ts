import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const packageDir = path.join(rootDir, "packages", "vite");
const distDir = path.join(packageDir, "dist");
const emittedTypesFile = path.join(distDir, "index.api.d.ts");
const publishedTypesFile = path.join(distDir, "index.d.ts");

execFileSync("tsc", ["-p", path.join(packageDir, "tsconfig.build.json")], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

await mkdir(distDir, { recursive: true });
await rm(publishedTypesFile, { force: true });
await rename(emittedTypesFile, publishedTypesFile);
