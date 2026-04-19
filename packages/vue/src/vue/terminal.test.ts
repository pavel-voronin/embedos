import { describe, expect, it } from "vitest";
import { themes } from "../../../core/index.js";
import { defaultTerminalSettings } from "./defaultTerminalSettings.js";
import { resolveTerminalResetOverlayOnStart } from "./terminal-defaults.js";
import {
  createEmbedosRuntimeStorageKey,
  getEmbedosLaunchRuntimeIdentity,
} from "./useEmbedosLaunchPreload.js";
import type { EmbedosRuntimeOptionsInput } from "../../../core/types.ts";

function createRuntime(overrides: EmbedosRuntimeOptionsInput = {}): EmbedosRuntimeOptionsInput {
  return {
    env: ["HOME=/root"],
    overlayFiles: [
      [
        {
          executable: true,
          path: "/bin/tool",
          source: "/assets/tool",
        },
      ],
    ],
    process: {
      cwd: "/root",
      gid: 0,
      uid: 0,
    },
    rootfsUrl: "/rootfs/base.ext2",
    run: ["exec /bin/sh -i"],
    shell: ["/bin/sh", "-lc"],
    ...overrides,
  };
}

describe("terminal defaults", () => {
  it("defaults resetOverlayOnStart to true", () => {
    expect(resolveTerminalResetOverlayOnStart(undefined)).toBe(true);
    expect(resolveTerminalResetOverlayOnStart(false)).toBe(false);
  });

  it("uses Monokai as the default terminal theme", () => {
    expect(defaultTerminalSettings.theme).toBe(themes.monokai);
  });
});

describe("createEmbedosRuntimeStorageKey", () => {
  it("creates distinct keys for identical runtimes with different nonces", () => {
    const runtime = createRuntime();

    expect(createEmbedosRuntimeStorageKey(runtime, 1)).not.toBe(
      createEmbedosRuntimeStorageKey(runtime, 2),
    );
  });

  it("creates stable keys for the same runtime and nonce", () => {
    const runtime = createRuntime();

    expect(createEmbedosRuntimeStorageKey(runtime, 1)).toBe(
      createEmbedosRuntimeStorageKey(runtime, 1),
    );
  });

  it("includes rootfs and source overlays in the runtime identity", () => {
    const base = createRuntime();
    const changedRootfs = createRuntime({ rootfsUrl: "/rootfs/next.ext2" });
    const changedOverlay = createRuntime({
      overlayFiles: [
        [
          {
            executable: true,
            path: "/bin/tool",
            source: "/assets/next-tool",
          },
        ],
      ],
    });

    expect(getEmbedosLaunchRuntimeIdentity(base)).not.toBe(
      getEmbedosLaunchRuntimeIdentity(changedRootfs),
    );
    expect(getEmbedosLaunchRuntimeIdentity(base)).not.toBe(
      getEmbedosLaunchRuntimeIdentity(changedOverlay),
    );
    expect(createEmbedosRuntimeStorageKey(base, 1)).not.toBe(
      createEmbedosRuntimeStorageKey(changedRootfs, 1),
    );
    expect(createEmbedosRuntimeStorageKey(base, 1)).not.toBe(
      createEmbedosRuntimeStorageKey(changedOverlay, 1),
    );
  });
});
