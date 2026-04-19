import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_ROOT = path.join(process.cwd(), ".cache", "build");
const DEFAULT_IGNORED_SEGMENTS = new Set([".cache", ".git", "coverage", "dist", "node_modules"]);

type BuildCommand = {
  args: string[];
  command: string;
};

type BuildCacheOptions = {
  commands: BuildCommand[];
  ignoredSegments?: string[];
  inputs: string[];
  manifestName: string;
  outputs: string[];
  taskName: string;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(
  targetPath: string,
  files: string[],
  rootDir: string,
  ignoredSegments: Set<string>,
): Promise<void> {
  const fileStat = await stat(targetPath);

  if (fileStat.isFile()) {
    files.push(targetPath);
    return;
  }

  if (!fileStat.isDirectory()) {
    return;
  }

  const entries = await readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(targetPath, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    const segments = relativePath.split(path.sep);

    if (segments.some((segment) => ignoredSegments.has(segment))) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFiles(absolutePath, files, rootDir, ignoredSegments);
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
}

async function resolveInputFiles(
  rootDir: string,
  inputs: string[],
  ignoredSegments: Set<string>,
): Promise<string[]> {
  const files: string[] = [];

  for (const input of inputs) {
    const absolutePath = path.resolve(rootDir, input);
    if (!(await pathExists(absolutePath))) {
      continue;
    }

    await collectFiles(absolutePath, files, rootDir, ignoredSegments);
  }

  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

async function computeFingerprint(
  rootDir: string,
  inputs: string[],
  ignoredSegments: Set<string>,
): Promise<{ files: string[]; hash: string }> {
  const hash = createHash("sha256");
  const files = await resolveInputFiles(rootDir, inputs, ignoredSegments);

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath);
    const contents = await readFile(filePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }

  return {
    files,
    hash: hash.digest("hex"),
  };
}

async function loadManifest(manifestPath: string): Promise<{ hash?: string } | null> {
  if (!(await pathExists(manifestPath))) {
    return null;
  }

  try {
    return JSON.parse(await readFile(manifestPath, "utf8")) as { hash?: string };
  } catch {
    return null;
  }
}

async function outputsExist(rootDir: string, outputs: string[]): Promise<boolean> {
  for (const output of outputs) {
    if (!(await pathExists(path.resolve(rootDir, output)))) {
      return false;
    }
  }

  return true;
}

async function runCommand(command: string, args: string[], rootDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated with signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }

      resolve();
    });
  });
}

export async function runCachedBuild({
  commands,
  ignoredSegments = [],
  inputs,
  manifestName,
  outputs,
  taskName,
}: BuildCacheOptions): Promise<void> {
  const rootDir = process.cwd();
  const ignored = new Set([...DEFAULT_IGNORED_SEGMENTS, ...ignoredSegments]);
  const manifestPath = path.join(CACHE_ROOT, manifestName);
  const [{ hash, files }, manifest, hasOutputs] = await Promise.all([
    computeFingerprint(rootDir, inputs, ignored),
    loadManifest(manifestPath),
    outputsExist(rootDir, outputs),
  ]);

  if (manifest?.hash === hash && hasOutputs) {
    console.log(`[cache] ${taskName}: unchanged, skipping build`);
    return;
  }

  console.log(`[cache] ${taskName}: changes detected, running build`);

  for (const command of commands) {
    await runCommand(command.command, command.args, rootDir);
  }

  await mkdir(CACHE_ROOT, { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        files: files.map((filePath) => path.relative(rootDir, filePath)),
        hash,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
