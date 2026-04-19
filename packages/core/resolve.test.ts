import { beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveEmbedosRuntimeInput", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("preserves runtime overrides for unresolved recipes when a built runtime is available", async () => {
    vi.doMock("./runtime-registry.ts", () => ({
      getResolvedRuntimeForConfig: (id: string) =>
        id === "recipe"
          ? {
              env: ["HOME=/base"],
              id: "recipe",
              kind: "embedos-runtime",
              overlayFiles: [],
              process: {
                cwd: "/base",
                gid: 0,
                uid: 0,
              },
              rootfsUrl: "https://example.com/rootfs.ext2",
              run: [],
              shell: ["/bin/sh", "-lc"],
            }
          : null,
    }));

    const { defineRecipe } = await import("./index.js");
    const { resolveEmbedosRuntimeInput } = await import("./resolve.js");

    const recipe = defineRecipe(() => ({
      id: "recipe",
      env: ["HOME=/root"],
      overlayFiles: [
        [
          {
            contents: "echo ok",
            path: "/root/test.sh",
          },
        ],
      ],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      source: {
        context: ".",
        file: "./Dockerfile",
        kind: "dockerfile",
      },
      run: ["echo ok"],
      shell: ["/bin/bash", "-lc"],
    }));

    expect(resolveEmbedosRuntimeInput(recipe)).toEqual({
      env: ["HOME=/root"],
      overlayFiles: [
        [
          {
            contents: "echo ok",
            executable: undefined,
            mode: undefined,
            path: "/root/test.sh",
          },
        ],
      ],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      rootfsUrl: "https://example.com/rootfs.ext2",
      run: ["echo ok"],
      shell: ["/bin/bash", "-lc"],
    });
  });
});
