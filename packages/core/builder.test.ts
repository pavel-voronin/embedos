import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntimeRegistryModuleSource, loadConfigFromPackage } from "./builder.js";

describe("loadConfigFromPackage", () => {
  it("loads config metadata from the build package", async () => {
    const loaded = await loadConfigFromPackage(
      path.resolve(process.cwd()),
      "@embedos/debian-bullseye-busybox-recipe",
    );

    expect(loaded.config.id).toBe("debian-bullseye-busybox");
    expect(loaded.config.source).toEqual({
      context: ".",
      file: "./Dockerfile",
      imageSizeMb: 16,
      kind: "dockerfile",
      platform: "linux/386",
    });
    expect(loaded.config.overlayFiles).toEqual([]);
  });

  it("loads config metadata from the docker-image package", async () => {
    const loaded = await loadConfigFromPackage(
      path.resolve(process.cwd()),
      "@embedos/debian-bullseye-busybox-image-recipe",
    );

    expect(loaded.config.id).toBe("debian-bullseye-busybox-compact-image");
    expect(loaded.config.source).toEqual({
      image: "embedos-debian-bullseye-busybox:compact",
      imageSizeMb: 16,
      kind: "docker-image",
      platform: "linux/386",
    });
    expect(loaded.config.overlayFiles).toEqual([]);
  });
});

describe("createRuntimeRegistryModuleSource", () => {
  it("renders config assets into runtime module source", async () => {
    const loaded = await loadConfigFromPackage(
      path.resolve(process.cwd()),
      "@embedos/debian-bullseye-busybox-recipe",
    );

    const source = createRuntimeRegistryModuleSource(
      [
        {
          ...loaded,
          assets: [
            {
              absolutePath: "/tmp/rootfs.ext2",
              relativePath: "embedos-rootfs.ext2",
            },
          ],
          outputDir: "/tmp/runtime",
        },
      ],
      (_config, relativePath) =>
        JSON.stringify(`/_embedos/debian-bullseye-busybox/${relativePath}`),
    );

    expect(source).toContain("getResolvedRuntimeForConfig");
    expect(source).toContain('"/_embedos/debian-bullseye-busybox/embedos-rootfs.ext2"');
  });
});
