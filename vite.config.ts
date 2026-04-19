import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { embedosVitePlugin } from "@embedos/vite";
import type { Plugin } from "vite";

const headers = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

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

function matchesEtag(requestValue: string | undefined, responseEtag: string): boolean {
  if (!requestValue) {
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

function opaqueVmAssetDevPlugin(): Plugin {
  let rootDir = "";
  const rawPrefixes = [
    {
      prefix: "/playground/assets/",
      root: "playground/assets",
    },
    {
      prefix: "/playground/cdn/vendor/runtime/assets/",
      root: "playground/public/playground/cdn/vendor/runtime/assets",
    },
  ];

  return {
    name: "embedos-opaque-vm-assets-dev",
    apply: "serve",
    configResolved(config) {
      rootDir = config.root;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = (req.url?.split("?")[0] ?? "").replace(/\/+/g, "/");
        const rawPrefix = rawPrefixes.find(({ prefix }) => requestPath.startsWith(prefix));
        if (!rawPrefix) {
          next();
          return;
        }

        const absolutePath = path.resolve(rootDir, requestPath.slice(1));
        const assetsRoot = `${path.resolve(rootDir, rawPrefix.root)}${path.sep}`;

        if (!absolutePath.startsWith(assetsRoot)) {
          next();
          return;
        }

        try {
          const fileStat = await stat(absolutePath);

          if (!fileStat.isFile()) {
            next();
            return;
          }

          const etag = `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;
          const lastModified = fileStat.mtime.toUTCString();

          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("ETag", etag);
          res.setHeader("Last-Modified", lastModified);

          const ifNoneMatch =
            typeof req.headers["if-none-match"] === "string"
              ? req.headers["if-none-match"]
              : undefined;
          const ifModifiedSince =
            typeof req.headers["if-modified-since"] === "string"
              ? req.headers["if-modified-since"]
              : undefined;
          if (req.method !== "HEAD" && req.method !== "GET") {
            next();
            return;
          }

          if (
            matchesEtag(ifNoneMatch, etag) ||
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

            createReadStream(absolutePath, range).pipe(res);
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Length", fileStat.size);

          if (req.method === "HEAD") {
            res.end();
            return;
          }

          createReadStream(absolutePath).pipe(res);
          return;
        } catch {
          next();
        }
      });
    },
  };
}

function playgroundRouteAliasPlugin(): Plugin {
  const routeAliases = new Map([
    ["/recipe", "/playground/recipe/"],
    ["/recipe/", "/playground/recipe/"],
    ["/image", "/playground/image/"],
    ["/image/", "/playground/image/"],
    ["/runtime", "/playground/runtime/"],
    ["/runtime/", "/playground/runtime/"],
    ["/dual", "/playground/dual/"],
    ["/dual/", "/playground/dual/"],
    ["/dual-lazy", "/playground/dual-lazy/"],
    ["/dual-lazy/", "/playground/dual-lazy/"],
    ["/broken-config", "/playground/broken-config/"],
    ["/broken-config/", "/playground/broken-config/"],
    ["/cdn", "/playground/cdn/"],
    ["/cdn/", "/playground/cdn/"],
    ["/cdn-plain", "/playground/cdn-plain/"],
    ["/cdn-plain/", "/playground/cdn-plain/"],
    ["/cdn-lazy", "/playground/cdn-lazy/"],
    ["/cdn-lazy/", "/playground/cdn-lazy/"],
  ]);

  return {
    name: "embedos-playground-route-alias",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const requestPath = req.url?.split("?")[0] ?? "";
        const aliasPath = routeAliases.get(requestPath);

        if (aliasPath) {
          const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
          req.url = `${aliasPath}${query}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  assetsInclude: ["**/*.bin"],
  publicDir: "playground/public",
  plugins: [
    playgroundRouteAliasPlugin(),
    vue(),
    tailwindcss(),
    Icons({ compiler: "vue3" }),
    opaqueVmAssetDevPlugin(),
    embedosVitePlugin(),
  ],
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
  server: { headers },
  preview: { headers },
  build: {
    outDir: "dist/playground",
    rollupOptions: {
      input: {
        cdn: path.resolve("playground/cdn/index.html"),
        cdnPlain: path.resolve("playground/cdn-plain/index.html"),
        cdnLazy: path.resolve("playground/cdn-lazy/index.html"),
        dual: path.resolve("playground/dual/index.html"),
        dualLazy: path.resolve("playground/dual-lazy/index.html"),
        brokenConfig: path.resolve("playground/broken-config/index.html"),
        image: path.resolve("playground/image/index.html"),
        index: path.resolve("playground/index.html"),
        recipe: path.resolve("playground/recipe/index.html"),
        runtime: path.resolve("playground/runtime/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("@leaningtech/cheerpx")) {
            return "cheerpx";
          }

          if (id.includes("@xterm/xterm")) {
            return "xterm";
          }

          return undefined;
        },
      },
    },
    target: "es2022",
  },
});
