import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResolvedConfig } from "vite";
import { embedosVitePlugin } from "./index.ts";

let fixtureRoot: string | null = null;

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(process.cwd(), ".tmp-embedos-vite-"));

  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture-root",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "App.vue"),
    `<template><div /></template>
<script lang="ts">
import { defineRecipe } from "@embedos/vue";

const inlineRecipe = defineRecipe(() => ({
  id: "inline-recipe",
  env: ["HOME=/root"],
  overlayFiles: [],
  process: { cwd: "/root", gid: 0, uid: 0 },
  source: {
    kind: "url",
    url: "https://example.com/rootfs.ext2",
  },
  run: [],
  shell: ["/bin/sh", "-lc"],
}));
</script>
`,
  );

  await mkdir(path.join(root, "packages", "recipe"), { recursive: true });
  await mkdir(path.join(root, "packages", "recipe", "src"), { recursive: true });
  await writeFile(
    path.join(root, "packages", "recipe", "package.json"),
    JSON.stringify(
      {
        name: "fixture-recipe",
        private: true,
        type: "module",
        embedosConfig: {
          configFile: "./src/recipe.ts",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(root, "packages", "recipe", "src", "recipe.ts"),
    `import { defineRecipe } from "@embedos/vue";

export const packageRecipe = defineRecipe(() => ({
  id: "package-recipe",
  env: ["HOME=/root"],
  overlayFiles: [],
  process: { cwd: "/root", gid: 0, uid: 0 },
  source: {
    kind: "url",
    url: "https://example.com/rootfs.ext2",
  },
  run: [],
  shell: ["/bin/sh", "-lc"],
}));
`,
  );

  fixtureRoot = root;
  return root;
}

afterEach(async () => {
  if (fixtureRoot) {
    await rm(fixtureRoot, { force: true, recursive: true });
    fixtureRoot = null;
  }
});

describe("embedosVitePlugin", () => {
  it("discovers inline recipes and recipe packages without an option switch", async () => {
    const root = await createFixtureRoot();
    const plugin = embedosVitePlugin();
    const resolvedConfig = {
      command: "build",
      root,
    } as ResolvedConfig;

    if (plugin.configResolved) {
      if (typeof plugin.configResolved === "function") {
        await plugin.configResolved.call({} as never, resolvedConfig);
      } else {
        await plugin.configResolved.handler.call({} as never, resolvedConfig);
      }
    }

    if (plugin.buildStart) {
      if (typeof plugin.buildStart === "function") {
        await plugin.buildStart.call({} as never, {} as never);
      } else {
        await plugin.buildStart.handler.call({} as never, {} as never);
      }
    }

    const buildRoot = path.join(root, ".embedos", "build");
    const entries = await readdir(buildRoot, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    expect(directories.some((entry) => entry.startsWith("inline-recipe-"))).toBe(true);
    expect(directories.some((entry) => entry.startsWith("package-recipe-"))).toBe(true);
  });
});
