import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile } from "node:fs/promises";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";
import type {
  EmbedosAssetBuildReference,
  EmbedosConfig,
  EmbedosConfigDockerfileSource,
  EmbedosConfigDockerImageSource,
  EmbedosConfigOverlayFile,
  EmbedosConfigSource,
  EmbedosConfigPackageJson,
  ResolvedEmbedosConfigBuild,
} from "./types.ts";

const execFileAsync = promisify(execFile);
const DEFAULT_ROOTFS_ASSET_PATH = "embedos-rootfs.ext2";
const DEFAULT_PACKER_IMAGE = "debian:bullseye";
const EMBEDOS_RECIPE_BRAND = Symbol.for("embedos.recipe");

interface ResolvedEmbedosConfigAsset {
  absolutePath: string;
  relativePath: string;
}

interface ResolvedEmbedosConfigRuntimeArtifacts extends ResolvedEmbedosConfigBuild {
  assets: ResolvedEmbedosConfigAsset[];
}

function sanitizeRuntimeId(id: string): string {
  return id.replace(/[^a-z0-9-]/gi, "-");
}

function hashKey(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

async function importConfigModule(configPath: string): Promise<unknown> {
  if (configPath.endsWith(".vue")) {
    const source = await readFile(configPath, "utf8");
    const { descriptor } = parse(source, { filename: configPath });

    if (!descriptor.script) {
      throw new Error(`Vue config "${configPath}" must declare a normal <script> export`);
    }

    const transpiledScript = ts.transpileModule(descriptor.script.content, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: configPath,
    }).outputText;

    const tempConfigPath = path.join(
      path.dirname(configPath),
      `.embedos-config-${hashKey(configPath)}.mjs`,
    );

    await writeFile(tempConfigPath, transpiledScript, "utf8");
    return import(pathToFileURL(tempConfigPath).href);
  }

  const moduleUrl = pathToFileURL(configPath).href;
  return import(moduleUrl);
}

function isBrandedRecipe(value: unknown): boolean {
  return (
    typeof value === "function" &&
    Object.getOwnPropertySymbols(value).includes(EMBEDOS_RECIPE_BRAND)
  );
}

function collectRecipeVariableNames(sourceText: string, fileName: string): string[] {
  const scriptKind = fileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : fileName.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
    scriptKind,
  );
  const names = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = node.initializer;
      if (
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === "defineRecipe"
      ) {
        names.add(node.name.text);
      }
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);
  return [...names];
}

async function importInlineRecipeModule(
  sourceFilePath: string,
  sourceText: string,
  buildRootDir: string,
): Promise<Record<string, unknown>> {
  let transpiledSource = sourceText;

  if (path.extname(sourceFilePath) === ".vue") {
    const { descriptor } = parse(sourceText, { filename: sourceFilePath });
    if (!descriptor.script) {
      throw new Error(`Vue recipe source "${sourceFilePath}" must use a normal <script> block`);
    }

    transpiledSource = descriptor.script.content;
  }

  const transpiledModule = ts.transpileModule(transpiledSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceFilePath,
  }).outputText;

  const recipeNames = collectRecipeVariableNames(transpiledModule, sourceFilePath);
  if (recipeNames.length === 0) {
    return {};
  }

  const exportBlock = `${transpiledModule}\n${recipeNames.map((name) => `export { ${name} };`).join("\n")}\n`;
  const tempModuleDir = path.join(buildRootDir, ".inline-cache");
  await mkdir(tempModuleDir, { recursive: true });

  const tempModulePath = path.join(
    tempModuleDir,
    `${sanitizeRuntimeId(path.basename(sourceFilePath))}-${hashKey(sourceFilePath)}.mjs`,
  );
  await writeFile(tempModulePath, exportBlock, "utf8");
  return (await import(pathToFileURL(tempModulePath).href)) as Record<string, unknown>;
}

export async function buildConfigFromInlineRecipeSource(
  rootDir: string,
  sourceFilePath: string,
  buildRootDir: string,
): Promise<ResolvedEmbedosConfigRuntimeArtifacts[]> {
  const sourceText = await readFile(sourceFilePath, "utf8");
  const importedModule = await importInlineRecipeModule(sourceFilePath, sourceText, buildRootDir);
  const recipeValues = Object.values(importedModule).filter(isBrandedRecipe);
  const builtConfigs = await Promise.all(
    recipeValues.map(async (recipeValue) => {
      const config = (recipeValue as () => EmbedosConfig)();
      const outputDir = path.join(
        buildRootDir,
        `${sanitizeRuntimeId(config.id)}-${hashKey(`${sourceFilePath}:${config.id}`)}`,
      );

      await rm(outputDir, { force: true, recursive: true });
      await mkdir(outputDir, { recursive: true });

      const materializedConfig =
        (await materializeConfigSource(rootDir, config, outputDir)) ?? config;
      const assets = await collectAssets(outputDir);

      return {
        assets,
        config: materializedConfig,
        outputDir,
        packageName: sourceFilePath,
        packageRoot: rootDir,
      };
    }),
  );

  return builtConfigs;
}

function tryResolveFileUrlPath(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "file:") {
      return null;
    }

    return fileURLToPath(url);
  } catch {
    return null;
  }
}

function resolveConfigExport(configModule: unknown): EmbedosConfig {
  const exportedRecipe =
    configModule && typeof configModule === "object" && "default" in configModule
      ? (configModule as { default?: unknown }).default
      : configModule;

  if (typeof exportedRecipe === "function") {
    return (exportedRecipe as () => EmbedosConfig)();
  }

  if (configModule && typeof configModule === "object") {
    const namedRecipeExports = Object.values(configModule).filter(
      (value): value is () => EmbedosConfig => typeof value === "function",
    );

    if (namedRecipeExports.length === 1) {
      return namedRecipeExports[0]();
    }
  }

  throw new Error("Config modules must export exactly one recipe function");
}

async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, options);
  return String(stdout).trim();
}

async function findWorkspacePackageRoot(
  rootDir: string,
  packageName: string,
): Promise<string | null> {
  const packagesDir = path.join(rootDir, "packages");

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageRoot = path.join(packagesDir, entry.name);
      const packageJsonPath = path.join(packageRoot, "package.json");

      try {
        const packageJson = await readJsonFile<EmbedosConfigPackageJson>(packageJsonPath);
        if (packageJson.name === packageName) {
          return packageRoot;
        }
      } catch {
        // Ignore non-package directories.
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolvePackageRoot(rootDir: string, packageName: string): Promise<string> {
  const rootPackageJsonPath = path.join(rootDir, "package.json");

  try {
    const rootPackageJson = await readJsonFile<EmbedosConfigPackageJson>(rootPackageJsonPath);
    if (rootPackageJson.name === packageName && rootPackageJson.embedosConfig?.configFile) {
      return rootDir;
    }
  } catch {
    // Ignore missing or malformed root package manifests.
  }

  const require = createRequire(path.join(rootDir, "package.json"));

  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    const workspacePackageRoot = await findWorkspacePackageRoot(rootDir, packageName);

    if (workspacePackageRoot) {
      return workspacePackageRoot;
    }
  }

  throw new Error(`Unable to resolve package root for "${packageName}"`);
}

export async function loadConfigFromPackage(
  rootDir: string,
  packageName: string,
): Promise<ResolvedEmbedosConfigBuild> {
  const packageRoot = await resolvePackageRoot(rootDir, packageName);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = await readJsonFile<EmbedosConfigPackageJson>(packageJsonPath);

  if (!packageJson.embedosConfig?.configFile) {
    throw new Error(`Package "${packageName}" is not an Embedos config package`);
  }

  const configPath = path.join(packageRoot, packageJson.embedosConfig.configFile);
  let configModule: unknown;

  try {
    configModule = await importConfigModule(configPath);
  } catch (error) {
    const fallbackConfigPath = path.join(packageRoot, "src", `${path.parse(configPath).name}.ts`);

    if (fallbackConfigPath === configPath) {
      throw error;
    }

    configModule = await importConfigModule(fallbackConfigPath);
  }

  const config = resolveConfigExport(configModule);

  return {
    outputDir: "",
    packageName,
    packageRoot,
    config,
  };
}

export async function buildConfigFromPackage(
  rootDir: string,
  packageName: string,
  buildRootDir: string,
): Promise<ResolvedEmbedosConfigRuntimeArtifacts> {
  const resolvedConfig = await loadConfigFromPackage(rootDir, packageName);
  const outputDir = path.join(
    buildRootDir,
    `${sanitizeRuntimeId(resolvedConfig.config.id)}-${hashKey(packageName)}`,
  );

  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputDir, { recursive: true });

  const materializedConfig =
    (await materializeConfigSource(resolvedConfig.packageRoot, resolvedConfig.config, outputDir)) ??
    resolvedConfig.config;

  const assets = await collectAssets(outputDir);

  return {
    ...resolvedConfig,
    config: materializedConfig,
    assets,
    outputDir,
  };
}

async function collectAssets(dir: string, prefix = ""): Promise<ResolvedEmbedosConfigAsset[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const assets: ResolvedEmbedosConfigAsset[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      assets.push(...(await collectAssets(absolutePath, relativePath)));
      continue;
    }

    assets.push({
      absolutePath,
      relativePath,
    });
  }

  return assets.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function toAssetLookupCode(
  config: EmbedosConfig,
  assetUrlExpressionFor: (relativePath: string) => string,
): string {
  const overlayFiles = config.overlayFiles
    .map(
      (layer) =>
        `[${layer.map((file) => renderOverlayFileCode(file, assetUrlExpressionFor)).join(",\n")}]`,
    )
    .join(",\n");

  return `{
  kind: "embedos-runtime",
  id: ${JSON.stringify(config.id)},
  env: ${JSON.stringify(config.env)},
  overlayFiles: [${overlayFiles}],
  process: ${JSON.stringify(config.process)},
  rootfsUrl: ${renderConfigSourceCode(config.source, assetUrlExpressionFor, `Embedos config "${config.id}" source`)},
  run: ${JSON.stringify(config.run)},
  shell: ${JSON.stringify(config.shell)}
}`;
}

function toBuildAssetReference(
  reference: EmbedosConfigSource,
  label: string,
): EmbedosAssetBuildReference {
  if (reference.kind !== "asset") {
    throw new Error(`${label} must use an asset reference during build`);
  }

  return reference;
}

function renderConfigSourceCode(
  source: EmbedosConfigSource,
  assetUrlExpressionFor: (relativePath: string) => string,
  label: string,
): string {
  if (source.kind === "url") {
    return JSON.stringify(source.url);
  }

  if (source.kind === "asset") {
    return assetUrlExpressionFor(source.path);
  }

  return assetUrlExpressionFor(getBuildOutputAssetPath(source, label));
}

function renderOverlayFileCode(
  file: EmbedosConfigOverlayFile,
  assetUrlExpressionFor: (relativePath: string) => string,
): string {
  if ("contents" in file) {
    return JSON.stringify({
      contents: file.contents,
      executable: Boolean(file.executable),
      mode: file.mode ?? null,
      path: file.path,
    });
  }

  const source = toBuildAssetReference(file.source, `Overlay "${file.path}" source`);

  return `{
    executable: ${JSON.stringify(Boolean(file.executable))},
    mode: ${JSON.stringify(file.mode ?? null)},
    path: ${JSON.stringify(file.path)},
    source: ${assetUrlExpressionFor(source.path)},
    type: ${JSON.stringify(file.type === "directory" ? "directory" : "file")}
  }`;
}

function getBuildOutputAssetPath(source: EmbedosConfigSource, label: string): string {
  if (source.kind === "docker-image" || source.kind === "dockerfile") {
    return DEFAULT_ROOTFS_ASSET_PATH;
  }

  if (source.kind === "asset") {
    return source.path;
  }

  throw new Error(`${label} must be buildable into an asset`);
}

async function materializeConfigSource(
  packageRoot: string,
  config: EmbedosConfig,
  outputDir: string,
): Promise<EmbedosConfig | void> {
  const { source } = config;

  if (source.kind === "docker-image") {
    await buildRootfsFromDockerImage(source, outputDir);
    return;
  }

  if (source.kind === "dockerfile") {
    await buildRootfsFromDockerfile(packageRoot, source, outputDir);
    return;
  }

  if (source.kind === "asset") {
    const assetSourcePath = path.join(packageRoot, source.path);
    const outputPath = path.join(outputDir, source.path);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(assetSourcePath, outputPath);
    return {
      ...config,
      source: {
        kind: "asset",
        path: source.path,
      },
    };
  }

  if (source.kind === "url") {
    const localFilePath = tryResolveFileUrlPath(source.url);
    if (!localFilePath) {
      return;
    }

    const outputRelativePath = path.join("rootfs", path.basename(localFilePath));
    const outputPath = path.join(outputDir, outputRelativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(localFilePath, outputPath);

    return {
      ...config,
      source: {
        kind: "asset",
        path: outputRelativePath,
      },
    };
  }

  throw new Error(`Unsupported Embedos config source for "${config.id}"`);
}

async function buildRootfsFromDockerfile(
  packageRoot: string,
  source: EmbedosConfigDockerfileSource,
  outputDir: string,
): Promise<void> {
  const dockerfilePath = path.resolve(packageRoot, source.file);
  const contextPath = path.resolve(packageRoot, source.context ?? ".");
  const imageTag = `embedos-${hashKey(`${dockerfilePath}:${contextPath}`)}:temp`;
  const buildArgs = ["build", "--platform", source.platform ?? "linux/386"];

  if (source.target) {
    buildArgs.push("--target", source.target);
  }

  buildArgs.push("-f", dockerfilePath, "-t", imageTag, contextPath);
  await runCommand("docker", buildArgs, { cwd: packageRoot, env: process.env });

  await exportImageToExt2(imageTag, source.platform ?? "linux/386", outputDir, {
    imageSizeMb: source.imageSizeMb,
    packerImage: source.packerImage,
  });
}

async function buildRootfsFromDockerImage(
  source: EmbedosConfigDockerImageSource,
  outputDir: string,
): Promise<void> {
  await exportImageToExt2(source.image, source.platform ?? "linux/386", outputDir, {
    imageSizeMb: source.imageSizeMb,
    packerImage: source.packerImage,
  });
}

async function exportImageToExt2(
  image: string,
  platform: string,
  outputDir: string,
  options: { imageSizeMb?: number; packerImage?: string },
): Promise<void> {
  const exportTarPath = path.join(outputDir, "rootfs.tar");
  const containerId = await runCommand("docker", ["create", "--platform", platform, image, "sh"]);

  try {
    await runCommand("docker", ["export", "-o", exportTarPath, containerId]);
  } finally {
    await runCommand("docker", ["rm", "-f", containerId]).catch(() => "");
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
truncate -s "${options.imageSizeMb ?? 16}M" /out/${DEFAULT_ROOTFS_ASSET_PATH}
mke2fs -q -t ext2 -b 4096 -d "$rootfs" -F /out/${DEFAULT_ROOTFS_ASSET_PATH} "${options.imageSizeMb ?? 16}M"
rm -f /out/rootfs.tar
`;

  await runCommand(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${outputDir}:/out`,
      options.packerImage ?? DEFAULT_PACKER_IMAGE,
      "sh",
      "-lc",
      packScript,
    ],
    { env: process.env },
  );
}

export function createRuntimeRegistryModuleSource(
  configs: ResolvedEmbedosConfigRuntimeArtifacts[],
  assetUrlExpressionForConfig: (
    config: ResolvedEmbedosConfigRuntimeArtifacts,
    relativePath: string,
  ) => string,
): string {
  const registryEntries = configs
    .map(
      (config) =>
        `${JSON.stringify(config.config.id)}: ${toAssetLookupCode(config.config, (relativePath) =>
          assetUrlExpressionForConfig(config, relativePath),
        )}`,
    )
    .join(",\n");

  return `const runtimeRegistry = {
${registryEntries}
};

export function getResolvedRuntimeForConfig(id) {
  return runtimeRegistry[id] ?? null;
}
`;
}

export async function readAssetBuffer(assetPath: string): Promise<Buffer> {
  return Buffer.from(await readFile(assetPath));
}

export async function createStaticAssetHeaders(filePath: string): Promise<Record<string, string>> {
  const fileStat = await stat(filePath);
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`,
    "Last-Modified": fileStat.mtime.toUTCString(),
  };
}

export function createAssetReadStream(filePath: string, start?: number, end?: number) {
  return createReadStream(filePath, start === undefined ? undefined : { end, start });
}
