import { describe, expect, it } from "vitest";
import { debianBullseyeBusyboxRuntime } from "./index.js";

describe("prebuilt runtime package", () => {
  it("exports self-contained asset URLs", () => {
    expect(debianBullseyeBusyboxRuntime().source).toEqual({
      kind: "url",
      url: expect.stringContaining("embedos-rootfs.ext2"),
    });
    expect(debianBullseyeBusyboxRuntime().overlayFiles).toEqual([]);
  });
});
