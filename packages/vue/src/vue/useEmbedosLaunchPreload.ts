import { computed, onBeforeUnmount, ref, toValue } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";
import type { EmbedosRuntimeOptionsInput } from "../../../core/index.ts";
import { cacheEmbedosAsset } from "../runtime/asset-response-cache.js";

type LaunchInlineOverlayFile = {
  contents?: string;
  executable?: boolean;
  mode?: string | null;
  path?: string;
};

type LaunchSourceOverlayFile = {
  executable?: boolean;
  mode?: string | null;
  path?: string;
  source?: string;
  type?: "directory" | "file";
};

type LaunchOverlayFile = LaunchInlineOverlayFile | LaunchSourceOverlayFile;

type LaunchRuntimeLike = EmbedosRuntimeOptionsInput & {
  overlayFiles?: Array<Array<LaunchOverlayFile> | LaunchOverlayFile>;
  rootfsUrl?: string;
};

interface DownloadTarget {
  label: string;
  url: string;
}

interface DownloadedAsset {
  bytes: Uint8Array;
  contentLength: number;
  contentType: string;
  url: string;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16);
}

export function getEmbedosLaunchRuntimeIdentity(runtime: LaunchRuntimeLike): string {
  const urls = [runtime.rootfsUrl ?? ""];

  for (const layer of runtime.overlayFiles ?? []) {
    const files = Array.isArray(layer) ? layer : [layer];

    for (const file of files) {
      if (file && typeof file === "object" && "source" in file && typeof file.source === "string") {
        urls.push(file.source);
      }
    }
  }

  return urls.filter((url) => url.length > 0).join("\u0000");
}

export function createEmbedosRuntimeStorageKey(runtime: LaunchRuntimeLike, nonce: number): string {
  return `embedos-runtime:${hashString(getEmbedosLaunchRuntimeIdentity(runtime))}:${nonce}`;
}

function collectTargets(runtime: LaunchRuntimeLike): DownloadTarget[] {
  const targets: DownloadTarget[] = [];
  const seenUrls = new Set<string>();

  if (isNonEmptyString(runtime.rootfsUrl)) {
    seenUrls.add(runtime.rootfsUrl);
    targets.push({
      label: "rootfs.ext2",
      url: runtime.rootfsUrl,
    });
  }

  for (const layer of runtime.overlayFiles ?? []) {
    const files = Array.isArray(layer) ? layer : [layer];

    for (const file of files) {
      if (!file || typeof file !== "object" || !("source" in file) || "contents" in file) {
        continue;
      }

      if (file.type === "directory") {
        continue;
      }

      if (!isNonEmptyString(file.source) || seenUrls.has(file.source)) {
        continue;
      }

      seenUrls.add(file.source);
      targets.push({
        label: file.path ?? file.source,
        url: file.source,
      });
    }
  }

  return targets;
}

async function readContentLength(url: string, signal: AbortSignal): Promise<number> {
  const response = await fetch(url, {
    cache: "default",
    method: "HEAD",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to inspect "${url}" (${response.status} ${response.statusText})`);
  }

  const rawLength = response.headers.get("content-length");
  if (!rawLength) {
    throw new Error(`Asset "${url}" does not expose Content-Length`);
  }

  const length = Number.parseInt(rawLength, 10);
  if (!Number.isFinite(length) || length < 0) {
    throw new Error(`Asset "${url}" returned an invalid Content-Length`);
  }

  return length;
}

async function downloadAsset(
  url: string,
  expectedBytes: number,
  signal: AbortSignal,
  onBytes: (loadedBytes: number) => void,
): Promise<DownloadedAsset> {
  const response = await fetch(url, {
    cache: "default",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to download "${url}" (${response.status} ${response.statusText})`);
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();

    onBytes(buffer.byteLength);
    return {
      bytes: new Uint8Array(buffer),
      contentLength: buffer.byteLength,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      url,
    };
  }

  let buffer = new Uint8Array(Math.max(expectedBytes, 1024));
  const reader = response.body.getReader();
  let loadedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const nextLoadedBytes = loadedBytes + value.byteLength;
      if (nextLoadedBytes > buffer.byteLength) {
        const nextBuffer = new Uint8Array(Math.max(nextLoadedBytes, buffer.byteLength * 2));
        nextBuffer.set(buffer);
        buffer = nextBuffer;
      }

      buffer.set(value, loadedBytes);
      loadedBytes = nextLoadedBytes;
      onBytes(value.byteLength);
    }
  } finally {
    reader.releaseLock();
  }

  return {
    bytes: buffer.slice(0, loadedBytes),
    contentLength: loadedBytes,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    url,
  };
}

export function useEmbedosLaunchPreload(
  runtimeSource: MaybeRefOrGetter<LaunchRuntimeLike | null | undefined>,
): {
  bytesLoaded: Ref<number>;
  bytesTotal: Ref<number>;
  error: Ref<Error | null>;
  inFlight: Ref<boolean>;
  message: Ref<string>;
  percent: Ref<number>;
  prepare: () => Promise<EmbedosRuntimeOptionsInput>;
  reset: () => void;
  status: Ref<"idle" | "loading" | "ready" | "error">;
} {
  const bytesLoaded = ref(0);
  const bytesTotal = ref(0);
  const error = ref<Error | null>(null);
  const inFlight = ref(false);
  const message = ref("Download image");
  const percent = computed(() => {
    if (bytesTotal.value <= 0) {
      return status.value === "ready" ? 100 : 0;
    }

    return Math.max(0, Math.min(100, Math.round((bytesLoaded.value / bytesTotal.value) * 100)));
  });
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");

  let activePromise: Promise<EmbedosRuntimeOptionsInput> | null = null;
  let abortController: AbortController | null = null;

  function reset(): void {
    abortController?.abort();
    abortController = null;
    activePromise = null;
    bytesLoaded.value = 0;
    bytesTotal.value = 0;
    error.value = null;
    inFlight.value = false;
    message.value = "Download image";
    status.value = "idle";
  }

  async function prepare(): Promise<EmbedosRuntimeOptionsInput> {
    if (activePromise) {
      return activePromise;
    }

    const nextRuntime = toValue(runtimeSource);
    if (!nextRuntime) {
      throw new Error("Embedos runtime configuration is missing");
    }

    const targets = collectTargets(nextRuntime);
    const nextAbortController = new AbortController();
    abortController = nextAbortController;
    inFlight.value = true;
    error.value = null;
    status.value = "loading";
    message.value = "Inspecting assets";

    activePromise = (async () => {
      try {
        const inspections = await Promise.all(
          targets.map(async (target) => ({
            size: await readContentLength(target.url, nextAbortController.signal),
            target,
          })),
        );
        const totalBytes = inspections.reduce((sum, { size }) => sum + size, 0);
        bytesTotal.value = totalBytes;
        bytesLoaded.value = 0;

        for (const { size, target } of inspections) {
          message.value = `Downloading ${target.label}`;

          const asset = await downloadAsset(
            target.url,
            size,
            nextAbortController.signal,
            (deltaBytes) => {
              bytesLoaded.value += deltaBytes;
              bytesTotal.value = totalBytes;
            },
          );
          cacheEmbedosAsset(asset);
        }

        status.value = "ready";
        message.value = "Assets ready";
        return nextRuntime;
      } catch (cause) {
        const normalizedCause = toError(cause);
        error.value = normalizedCause;
        status.value = "error";
        message.value = normalizedCause.message;
        throw normalizedCause;
      } finally {
        inFlight.value = false;
        activePromise = null;
        abortController = null;
      }
    })();

    return activePromise;
  }

  onBeforeUnmount(() => {
    abortController?.abort();
  });

  return {
    bytesLoaded,
    bytesTotal,
    error,
    inFlight,
    message,
    percent,
    prepare,
    reset,
    status,
  };
}
