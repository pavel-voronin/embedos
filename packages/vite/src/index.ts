import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import {
  createAssetReadStream,
  createRuntimeRegistryModuleSource,
  buildConfigFromPackage,
  buildConfigFromInlineRecipeSource,
  createStaticAssetHeaders,
  resolvePackageRoot,
  readAssetBuffer,
} from "../../core/builder.ts";
import type { Plugin, ResolvedConfig } from "vite";

async function discoverWorkspaceConfigPackages(rootDir: string): Promise<string[]> {
  const discovered = new Set<string>();

  try {
    const rootPackageJson = JSON.parse(
      await readFile(path.join(rootDir, "package.json"), "utf8"),
    ) as {
      embedosConfig?: { configFile?: string };
      name?: string;
    };

    if (rootPackageJson.embedosConfig?.configFile && rootPackageJson.name) {
      discovered.add(rootPackageJson.name);
    }
  } catch {
    // Ignore missing or malformed root manifests.
  }

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
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
          embedosConfig?: { configFile?: string };
          name?: string;
        };

        if (packageJson.embedosConfig?.configFile && packageJson.name) {
          discovered.add(packageJson.name);
        }
      } catch {
        // Ignore non-package directories and malformed package manifests.
      }
    }
  } catch {
    // Ignore missing workspace package roots.
  }

  return [...discovered];
}

async function discoverDependencyConfigPackages(rootDir: string): Promise<string[]> {
  const packageJsonPath = path.join(rootDir, "package.json");
  const discovered = new Set<string>();

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const packageNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
    ];

    await Promise.all(
      packageNames.map(async (packageName) => {
        try {
          const packageRoot = await resolvePackageRoot(rootDir, packageName);
          const packageJson = JSON.parse(
            await readFile(path.join(packageRoot, "package.json"), "utf8"),
          ) as {
            embedosConfig?: { configFile?: string };
            name?: string;
          };

          if (packageJson.embedosConfig?.configFile && packageJson.name) {
            discovered.add(packageJson.name);
          }
        } catch {
          // Ignore regular dependencies and packages that cannot be resolved by this project.
        }
      }),
    );
  } catch {
    // Ignore projects without package manifests.
  }

  return [...discovered];
}

async function discoverInlineRecipeFiles(rootDir: string): Promise<string[]> {
  const discovered: string[] = [];
  const sourceRoot = path.join(rootDir, "src");

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }

        await walk(path.join(directory, entry.name));
        continue;
      }

      if (!/\.(vue|ts|tsx|js|jsx|mjs|mts)$/.test(entry.name)) {
        continue;
      }

      const filePath = path.join(directory, entry.name);
      const contents = await readFile(filePath, "utf8");
      if (contents.includes("defineRecipe(")) {
        discovered.push(filePath);
      }
    }
  }

  await walk(sourceRoot);
  return discovered;
}

function parseSingleRangeHeader(
  rangeHeader: string,
  size: number,
): { end: number; start: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;

  if (!rawStart) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    };
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function normalizeWeakEtag(value: string): string {
  return value.trim();
}

function matchesEtag(requestValue: string | undefined, responseEtag: string | undefined): boolean {
  if (!requestValue || !responseEtag) {
    return false;
  }

  const candidates = requestValue.split(",").map((entry) => normalizeWeakEtag(entry));
  return candidates.includes("*") || candidates.includes(responseEtag);
}

function isNotModifiedSince(requestValue: string | undefined, modifiedAtMs: number): boolean {
  if (!requestValue) {
    return false;
  }

  const parsed = Date.parse(requestValue);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  return Math.trunc(modifiedAtMs / 1000) <= Math.trunc(parsed / 1000);
}

export function embedosVitePlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;
  let buildRootDir = "";
  let ensureBuiltConfigsPromise: Promise<void> | null = null;
  const runtimeRegistryModuleIds = new Set<string>();
  const discoveredConfigPackages = new Set<string>();
  const builtConfigs = new Map<string, Awaited<ReturnType<typeof buildConfigFromPackage>>>();
  const sourceAssetPublicPathByAbsolutePath = new Map<string, string>();
  const sourceAssetAbsolutePathByPublicPath = new Map<string, string>();
  const sourceAssetDirectoryEntryByPublicPath = new Map<string, string>();
  const buildAssetReferenceByAbsolutePath = new Map<string, string>();

  function hashKey(value: string): string {
    return createHash("sha1").update(value).digest("hex").slice(0, 10);
  }

  function stripQuery(id: string): string {
    const queryIndex = id.indexOf("?");
    return queryIndex === -1 ? id : id.slice(0, queryIndex);
  }

  function normalizeModulePath(id: string): string {
    return path.resolve(stripQuery(id));
  }

  function isRuntimeRegistryModule(id: string): boolean {
    const modulePath = normalizeModulePath(id);
    return (
      runtimeRegistryModuleIds.has(modulePath) ||
      modulePath.endsWith(
        `${path.sep}packages${path.sep}core${path.sep}src${path.sep}runtime-registry.ts`,
      ) ||
      modulePath.endsWith(
        `${path.sep}node_modules${path.sep}@embedos${path.sep}core${path.sep}src${path.sep}runtime-registry.ts`,
      )
    );
  }

  function getSourceAssetPublicPath(absolutePath: string): string {
    const existing = sourceAssetPublicPathByAbsolutePath.get(absolutePath);
    if (existing) {
      return existing;
    }

    const publicPath = `/_embedos/source-assets/${hashKey(absolutePath)}/${path.basename(absolutePath)}`;
    sourceAssetPublicPathByAbsolutePath.set(absolutePath, publicPath);
    sourceAssetAbsolutePathByPublicPath.set(publicPath, absolutePath);
    sourceAssetDirectoryEntryByPublicPath.set(
      path.posix.dirname(publicPath),
      path.posix.basename(publicPath),
    );
    return publicPath;
  }

  async function transformEmbedosAssetUrls(
    source: string,
    id: string,
    pluginContext?: {
      emitFile(file: { name?: string; source: Uint8Array; type: "asset" }): string;
    },
  ): Promise<string | null> {
    if (!source.includes("embedosAssetUrl(")) {
      return null;
    }

    const fileId = stripQuery(id);
    const directory = path.dirname(fileId);
    const pattern = /embedosAssetUrl\(\s*(["'])([^"']+)\1\s*,\s*import\.meta\.url\s*\)/g;
    let hasReplacements = false;
    let transformedSource = "";
    let lastIndex = 0;

    for (const match of source.matchAll(pattern)) {
      const [fullMatch, , relativePath] = match;
      const matchIndex = match.index ?? 0;
      const absolutePath = path.resolve(directory, relativePath);
      let replacement = JSON.stringify(getSourceAssetPublicPath(absolutePath));

      if (resolvedConfig?.command === "build" && pluginContext) {
        let referenceId = buildAssetReferenceByAbsolutePath.get(absolutePath);
        if (!referenceId) {
          referenceId = pluginContext.emitFile({
            name: path.basename(absolutePath),
            source: await readAssetBuffer(absolutePath),
            type: "asset",
          });
          buildAssetReferenceByAbsolutePath.set(absolutePath, referenceId);
        }

        replacement = `import.meta.ROLLUP_FILE_URL_${referenceId}`;
      }

      transformedSource += source.slice(lastIndex, matchIndex);
      transformedSource += replacement;
      lastIndex = matchIndex + fullMatch.length;
      hasReplacements = true;
    }

    if (!hasReplacements) {
      return null;
    }

    transformedSource += source.slice(lastIndex);
    return transformedSource;
  }

  async function discoverConfigPackages(rootDir: string): Promise<void> {
    const packageNames = [
      ...(await discoverWorkspaceConfigPackages(rootDir)),
      ...(await discoverDependencyConfigPackages(rootDir)),
    ];
    for (const packageName of packageNames) {
      discoveredConfigPackages.add(packageName);
    }
  }

  async function ensureBuiltConfigs(): Promise<void> {
    if (ensureBuiltConfigsPromise) {
      return ensureBuiltConfigsPromise;
    }

    const activeConfig = resolvedConfig;

    if (!activeConfig) {
      return;
    }

    ensureBuiltConfigsPromise = (async () => {
      await discoverConfigPackages(activeConfig.root);
      await mkdir(buildRootDir, { recursive: true });

      const inlineRecipeFiles = await discoverInlineRecipeFiles(activeConfig.root);
      await Promise.all(
        inlineRecipeFiles.map(async (filePath) => {
          const inlineBuiltConfigs = await buildConfigFromInlineRecipeSource(
            activeConfig.root,
            filePath,
            buildRootDir,
          );

          for (const builtConfig of inlineBuiltConfigs) {
            builtConfigs.set(`${filePath}:${builtConfig.config.id}`, builtConfig);
          }
        }),
      );

      await Promise.all(
        [...discoveredConfigPackages].map(async (packageName) => {
          const existingBuild = builtConfigs.get(packageName);
          if (existingBuild) {
            try {
              const outputDirStat = await stat(existingBuild.outputDir);
              if (outputDirStat.isDirectory()) {
                return;
              }
            } catch {
              builtConfigs.delete(packageName);
            }
          }

          if (builtConfigs.has(packageName)) {
            return;
          }

          const builtConfig = await buildConfigFromPackage(
            activeConfig.root,
            packageName,
            buildRootDir,
          );
          builtConfigs.set(packageName, builtConfig);
        }),
      );
    })();

    try {
      await ensureBuiltConfigsPromise;
    } finally {
      ensureBuiltConfigsPromise = null;
    }
  }

  async function createBuildRegistrySource(pluginContext: {
    emitFile(file: { fileName?: string; name?: string; source: Uint8Array; type: "asset" }): string;
  }): Promise<string> {
    const assetReferenceByConfig = new Map<string, Map<string, string>>();

    for (const config of builtConfigs.values()) {
      const assetReferences = new Map<string, string>();

      for (const asset of config.assets) {
        const referenceId = pluginContext.emitFile({
          fileName: `embedos/${config.config.id}/${asset.relativePath}`,
          name: path.basename(asset.relativePath),
          source: await readAssetBuffer(asset.absolutePath),
          type: "asset",
        });

        assetReferences.set(asset.relativePath, referenceId);
      }

      assetReferenceByConfig.set(config.config.id, assetReferences);
    }

    return createRuntimeRegistryModuleSource([...builtConfigs.values()], (config, relativePath) => {
      const configAssets = assetReferenceByConfig.get(config.config.id);
      const referenceId = configAssets?.get(relativePath);

      if (!referenceId) {
        throw new Error(
          `Embedos config "${config.config.id}" did not produce required asset "${relativePath}"`,
        );
      }

      return `import.meta.ROLLUP_FILE_URL_${referenceId}`;
    });
  }

  async function createServeRegistrySource(): Promise<string> {
    await ensureBuiltConfigs();

    return createRuntimeRegistryModuleSource([...builtConfigs.values()], (config, relativePath) => {
      return JSON.stringify(`/_embedos/${config.config.id}/${relativePath}`);
    });
  }

  return {
    name: "embedos-vite-plugin",
    async buildStart() {
      await ensureBuiltConfigs();
    },
    configResolved(config) {
      resolvedConfig = config;
      buildRootDir = path.join(config.root, ".embedos", config.command);
      runtimeRegistryModuleIds.add(path.resolve(config.root, "packages/core/runtime-registry.ts"));
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        await ensureBuiltConfigs();

        const rawRequestUrl = req.url?.split("?")[0] ?? "";
        const sourceAssetsBase = "/_embedos/source-assets/";
        const requestUrl = rawRequestUrl.startsWith(sourceAssetsBase)
          ? `${sourceAssetsBase}${rawRequestUrl
              .slice(sourceAssetsBase.length)
              .replace(/\/+/g, "/")
              .replace(/\/$/, "")}`
          : rawRequestUrl;

        const sourceAssetDirectory = requestUrl.endsWith("/index.list")
          ? requestUrl.slice(0, -"/index.list".length)
          : null;
        const sourceAssetDirectoryEntry = sourceAssetDirectory
          ? sourceAssetDirectoryEntryByPublicPath.get(sourceAssetDirectory)
          : null;

        if (sourceAssetDirectory && sourceAssetDirectoryEntry) {
          const body = `${sourceAssetDirectoryEntry}\n`;
          res.statusCode = 200;
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Content-Length", Buffer.byteLength(body));
          res.setHeader("Content-Type", "text/plain; charset=utf-8");

          if (req.method === "HEAD") {
            res.end();
            return;
          }

          res.end(body);
          return;
        }

        const sourceAssetPath = sourceAssetAbsolutePathByPublicPath.get(requestUrl);
        if (sourceAssetPath) {
          try {
            const fileStat = await stat(sourceAssetPath);
            const headers = await createStaticAssetHeaders(sourceAssetPath);
            for (const [headerName, headerValue] of Object.entries(headers)) {
              res.setHeader(headerName, headerValue);
            }

            res.setHeader("Content-Type", "application/octet-stream");

            const ifNoneMatch =
              typeof req.headers["if-none-match"] === "string"
                ? req.headers["if-none-match"]
                : undefined;
            const ifModifiedSince =
              typeof req.headers["if-modified-since"] === "string"
                ? req.headers["if-modified-since"]
                : undefined;
            if (
              matchesEtag(ifNoneMatch, headers.ETag) ||
              isNotModifiedSince(ifModifiedSince, fileStat.mtimeMs)
            ) {
              res.statusCode = 304;
              res.end();
              return;
            }

            const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : null;
            const range = rangeHeader ? parseSingleRangeHeader(rangeHeader, fileStat.size) : null;

            if (rangeHeader && !range) {
              res.statusCode = 416;
              res.setHeader("Content-Range", `bytes */${fileStat.size}`);
              res.end();
              return;
            }

            if (range) {
              res.statusCode = 206;
              res.setHeader("Content-Length", range.end - range.start + 1);
              res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);

              if (req.method === "HEAD") {
                res.end();
                return;
              }

              createAssetReadStream(sourceAssetPath, range.start, range.end).pipe(res);
              return;
            }

            res.setHeader("Content-Length", fileStat.size);
            if (req.method === "HEAD") {
              res.end();
              return;
            }

            createAssetReadStream(sourceAssetPath).pipe(res);
            return;
          } catch {
            next();
            return;
          }
        }

        if (requestUrl.startsWith(sourceAssetsBase)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        for (const builtConfig of builtConfigs.values()) {
          const mountBase = `/_embedos/${builtConfig.config.id}/`;

          if (!requestUrl.startsWith(mountBase)) {
            continue;
          }

          const relativePath = requestUrl.slice(mountBase.length);
          const assetPath = path.join(builtConfig.outputDir, relativePath);

          try {
            const fileStat = await stat(assetPath);
            if (fileStat.isDirectory()) {
              break;
            }

            const headers = await createStaticAssetHeaders(assetPath);
            for (const [headerName, headerValue] of Object.entries(headers)) {
              res.setHeader(headerName, headerValue);
            }

            res.setHeader("Content-Type", "application/octet-stream");

            const ifNoneMatch =
              typeof req.headers["if-none-match"] === "string"
                ? req.headers["if-none-match"]
                : undefined;
            const ifModifiedSince =
              typeof req.headers["if-modified-since"] === "string"
                ? req.headers["if-modified-since"]
                : undefined;
            if (
              matchesEtag(ifNoneMatch, headers.ETag) ||
              isNotModifiedSince(ifModifiedSince, fileStat.mtimeMs)
            ) {
              res.statusCode = 304;
              res.end();
              return;
            }

            const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : null;
            const range = rangeHeader ? parseSingleRangeHeader(rangeHeader, fileStat.size) : null;

            if (rangeHeader && !range) {
              res.statusCode = 416;
              res.setHeader("Content-Range", `bytes */${fileStat.size}`);
              res.end();
              return;
            }

            if (range) {
              res.statusCode = 206;
              res.setHeader("Content-Length", range.end - range.start + 1);
              res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);

              if (req.method === "HEAD") {
                res.end();
                return;
              }

              createReadStream(assetPath, range).pipe(res);
              return;
            }

            res.setHeader("Content-Length", fileStat.size);
            if (req.method === "HEAD") {
              res.end();
              return;
            }

            createReadStream(assetPath).pipe(res);
            return;
          } catch {
            break;
          }
        }

        next();
      });
    },
    async load(id) {
      if (!isRuntimeRegistryModule(id)) {
        return null;
      }

      if (resolvedConfig?.command === "build") {
        return createBuildRegistrySource(this);
      }

      return createServeRegistrySource();
    },
    async transform(source, id) {
      if (isRuntimeRegistryModule(id)) {
        return {
          code:
            resolvedConfig?.command === "build"
              ? await createBuildRegistrySource(this)
              : await createServeRegistrySource(),
          map: null,
        };
      }

      const transformedSource = await transformEmbedosAssetUrls(source, id, this);
      if (!transformedSource) {
        return null;
      }

      return {
        code: transformedSource,
        map: null,
      };
    },
  };
}
