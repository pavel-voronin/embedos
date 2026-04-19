import { describe, expect, it } from "vitest";
import { defineRecipe } from "./index.js";
import { mergeEmbedosOptions, resolveEmbedosRuntimeOptions } from "./options.js";
import { EmbedosUnresolvedRecipeError, resolveEmbedosRuntimeInput } from "./resolve.js";
import type { EmbedosRuntimeOptionsInput } from "./types.js";

describe("mergeEmbedosOptions", () => {
  it("clones arrays and nested objects without changing the merged shape", () => {
    const baseEnv = ["HOME=/root"];
    const overrideEnv = ["HOME=/tmp"];

    const merged = mergeEmbedosOptions(
      {
        env: baseEnv,
        process: {},
        run: ["echo first"],
        shell: ["/bin/bash", "-lc"],
      },
      {
        env: overrideEnv,
        process: {},
        run: "echo ok",
      },
    );

    expect(merged).toEqual({
      env: ["HOME=/tmp"],
      process: {},
      run: ["echo ok"],
      shell: ["/bin/bash", "-lc"],
    });

    expect(merged.env).not.toBe(baseEnv);
    expect(merged.env).not.toBe(overrideEnv);
  });
});

describe("resolveEmbedosRuntimeOptions", () => {
  it("validates a complete runtime configuration", () => {
    const resolved = resolveEmbedosRuntimeOptions({
      env: ["HOME=/root"],
      overlayFiles: [
        {
          contents: "echo ok",
          path: "/root/test.sh",
        },
      ],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      resetOverlayOnStart: true,
      rootfsUrl: "/rootfs/embedos-rootfs.ext2",
      run: ["echo ok", "exec /bin/bash -i"],
      shell: ["/bin/bash", "-lc"],
      storageKey: "embedos-terminal-rootfs",
    });

    expect(resolved.shell).toEqual(["/bin/bash", "-lc"]);
    expect(resolved.overlayFiles).toEqual([
      [
        {
          contents: "echo ok",
          executable: false,
          mode: null,
          path: "/root/test.sh",
        },
      ],
    ]);
  });

  it("preserves explicit overlay layers", () => {
    const resolved = resolveEmbedosRuntimeOptions({
      env: ["HOME=/root"],
      overlayFiles: [
        [
          {
            contents: "echo base",
            path: "/root/base.sh",
          },
        ],
        [
          {
            executable: true,
            path: "/root/tool.sh",
            source: "/catalog/tool.sh",
          },
        ],
      ],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      resetOverlayOnStart: true,
      rootfsUrl: "/rootfs/embedos-rootfs.ext2",
      run: ["exec /bin/bash -i"],
      shell: ["/bin/bash", "-lc"],
      storageKey: "embedos-terminal-rootfs",
    });

    expect(resolved.overlayFiles[0][0]).toEqual({
      contents: "echo base",
      executable: false,
      mode: null,
      path: "/root/base.sh",
    });
    expect(resolved.overlayFiles[1][0]).toEqual({
      executable: true,
      mode: null,
      path: "/root/tool.sh",
      source: "/catalog/tool.sh",
      type: "file",
    });
  });

  it("wraps flat overlay files into a single layer", () => {
    const resolved = resolveEmbedosRuntimeOptions({
      env: ["HOME=/root"],
      overlayFiles: [
        {
          contents: "echo ok",
          path: "/root/test.sh",
        },
      ],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      resetOverlayOnStart: true,
      rootfsUrl: "/rootfs/embedos-rootfs.ext2",
      run: ["echo ok", "exec /bin/bash -i"],
      shell: ["/bin/bash", "-lc"],
      storageKey: "embedos-terminal-rootfs",
    });

    expect(resolved.overlayFiles[0][0]).toEqual({
      contents: "echo ok",
      executable: false,
      mode: null,
      path: "/root/test.sh",
    });
  });

  it("drops sparse overlay entries before runtime normalization", () => {
    const sparseOverlayFiles = [
      [
        {
          contents: "echo ok",
          path: "/root/test.sh",
        },
        undefined,
      ],
      undefined,
    ] as unknown as EmbedosRuntimeOptionsInput["overlayFiles"];

    const resolved = resolveEmbedosRuntimeOptions({
      env: ["HOME=/root"],
      overlayFiles: sparseOverlayFiles,
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      resetOverlayOnStart: true,
      rootfsUrl: "/rootfs/embedos-rootfs.ext2",
      run: ["exec /bin/bash -i"],
      shell: ["/bin/bash", "-lc"],
      storageKey: "embedos-terminal-rootfs",
    });

    expect(resolved.overlayFiles).toEqual([
      [
        {
          contents: "echo ok",
          executable: false,
          mode: null,
          path: "/root/test.sh",
        },
      ],
      [],
    ]);
  });

  it("throws when required fields are missing", () => {
    expect(() => resolveEmbedosRuntimeOptions({})).toThrow('Embedos option "env" must be an array');
  });
});

describe("resolveEmbedosRuntimeInput", () => {
  it("resolves prebuilt configs into runtime options", () => {
    const config = defineRecipe(() => ({
      id: "runtime",
      env: ["HOME=/root"],
      overlayFiles: [],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      source: {
        kind: "url",
        url: "https://example.com/rootfs.ext2",
      },
      run: [],
      shell: ["/bin/sh", "-lc"],
    }));

    expect(resolveEmbedosRuntimeInput(config)).toEqual({
      env: ["HOME=/root"],
      overlayFiles: [],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      rootfsUrl: "https://example.com/rootfs.ext2",
      run: [],
      shell: ["/bin/sh", "-lc"],
    });
  });

  it("composes recipe functions with higher-order transforms", () => {
    const baseRecipe = defineRecipe(() => ({
      id: "runtime",
      env: ["HOME=/root"],
      overlayFiles: [],
      process: {
        cwd: "/root",
        gid: 0,
        uid: 0,
      },
      source: {
        kind: "url",
        url: "https://example.com/rootfs.ext2",
      },
      run: ["echo base"],
      shell: ["/bin/sh", "-lc"],
    }));

    const extendedRecipe = defineRecipe(baseRecipe, (base) => ({
      ...base,
      env: [...base.env, "TERM=xterm-256color"],
      process: {
        ...base.process,
        cwd: "/workspace",
      },
      run: [...base.run, "echo extended"],
    }));

    expect(extendedRecipe()).toEqual({
      id: "runtime",
      env: ["HOME=/root", "TERM=xterm-256color"],
      overlayFiles: [],
      process: {
        cwd: "/workspace",
        gid: 0,
        uid: 0,
      },
      source: {
        kind: "url",
        url: "https://example.com/rootfs.ext2",
      },
      run: ["echo base", "echo extended"],
      shell: ["/bin/sh", "-lc"],
    });
  });

  it("throws when an unresolved config reaches the browser", () => {
    const config = defineRecipe(() => ({
      id: "recipe",
      env: ["HOME=/root"],
      overlayFiles: [],
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
      run: [],
      shell: ["/bin/sh", "-lc"],
    }));

    expect(() => resolveEmbedosRuntimeInput(config)).toThrow(EmbedosUnresolvedRecipeError);
    expect(() => resolveEmbedosRuntimeInput(config)).toThrow(
      'Embedos recipe "recipe" cannot run directly in the browser.',
    );
  });
});
