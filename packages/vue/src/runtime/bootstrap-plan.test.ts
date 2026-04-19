import { beforeEach, describe, expect, it } from "vitest";
import { createBootstrapPlan } from "./bootstrap-plan.js";

describe("createBootstrapPlan", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "https://example.com/demo/",
        },
      },
    });
  });

  it("renders inline files, web mounts, and run commands unchanged", () => {
    const plan = createBootstrapPlan(
      [
        [
          {
            contents: "echo ready",
            executable: true,
            path: "/root/init.sh",
          },
          {
            path: "/root/catalog",
            source: "/catalog/",
            type: "directory",
          },
        ],
        [
          {
            mode: "0644",
            path: "/root/banner.txt",
            source: "/assets/banner.txt",
          },
        ],
      ],
      ["printf 'script'", "printf 'command'\n\nprintf 'banner'", "exec /bin/bash -i"],
    );

    expect(plan.mounts).toEqual([
      {
        copyFrom: "/tmp/embedos-mount-0-1",
        mountPath: "/tmp/embedos-mount-0-1",
        mountUrl: "https://example.com/catalog/",
        type: "directory",
      },
      {
        copyFrom: "/tmp/embedos-mount-1-0/banner.txt",
        mountPath: "/tmp/embedos-mount-1-0",
        mountUrl: "https://example.com/assets",
        type: "file",
      },
    ]);

    expect(plan.script).toContain("cat <<'__EMBEDOS_INLINE_FILE__' > '/root/init.sh'");
    expect(plan.script).toContain("cp -R '/tmp/embedos-mount-0-1/.' '/root/catalog'");
    expect(plan.script).toContain("chmod '0644' '/root/banner.txt'");
    expect(plan.script).toContain("printf 'script'");
    expect(plan.script).toContain("printf 'command'");
    expect(plan.script).toContain("printf 'banner'");
    expect(plan.script).toContain("exec /bin/bash -i");
  });

  it("applies later overlay layers after earlier ones", () => {
    const plan = createBootstrapPlan(
      [
        [
          {
            contents: "base",
            path: "/root/layer.txt",
          },
        ],
        [
          {
            contents: "top",
            path: "/root/layer.txt",
          },
        ],
      ],
      ["exec /bin/bash -i"],
    );

    const firstWriteIndex = plan.script.indexOf("base");
    const secondWriteIndex = plan.script.indexOf("top");

    expect(firstWriteIndex).toBeGreaterThanOrEqual(0);
    expect(secondWriteIndex).toBeGreaterThan(firstWriteIndex);
  });
});
