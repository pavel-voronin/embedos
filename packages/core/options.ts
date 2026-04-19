import type {
  EmbedosOverlayFile,
  EmbedosOverlayLayers,
  EmbedosProcessOptions,
  EmbedosRuntime,
  EmbedosRuntimeOptions,
  EmbedosRuntimeOptionsInput,
} from "./types.ts";

type EmbedosOverlayFileInput = Exclude<
  NonNullable<EmbedosRuntimeOptionsInput["overlayFiles"]>[number],
  Array<unknown>
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeObjects(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override ?? base;
  }

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      merged[key] = [...value];
      continue;
    }

    merged[key] = mergeObjects(base[key], value);
  }

  return merged;
}

function normalizeOverlayFile(file: EmbedosOverlayFileInput): EmbedosOverlayFile {
  if (!file || typeof file.path !== "string" || !file.path) {
    throw new Error("Each overlay file must include a target path");
  }

  if ("contents" in file && typeof file.contents === "string") {
    return {
      contents: file.contents,
      executable: Boolean(file.executable),
      mode: file.mode ?? null,
      path: file.path,
    };
  }

  if ("source" in file && typeof file.source === "string" && file.source) {
    return {
      executable: Boolean(file.executable),
      mode: file.mode ?? null,
      path: file.path,
      source: file.source,
      type: file.type === "directory" ? "directory" : "file",
    };
  }

  throw new Error(`Overlay "${file.path}" must define either contents or source`);
}

function normalizeOverlayLayers(
  overlayFiles: EmbedosRuntimeOptionsInput["overlayFiles"],
): EmbedosOverlayLayers | EmbedosRuntimeOptionsInput["overlayFiles"] {
  if (!Array.isArray(overlayFiles)) {
    return overlayFiles;
  }

  if (overlayFiles.length === 0) {
    return [];
  }

  const normalizeLayer = (
    layer: Array<EmbedosOverlayFileInput | null | undefined>,
  ): EmbedosOverlayFile[] =>
    layer
      .filter((file): file is EmbedosOverlayFileInput => file !== null && file !== undefined)
      .map((file) => normalizeOverlayFile(file));

  if (overlayFiles.some(Array.isArray)) {
    return overlayFiles.map((layer) =>
      Array.isArray(layer)
        ? normalizeLayer(layer as Array<EmbedosOverlayFileInput | null | undefined>)
        : normalizeLayer([layer as EmbedosOverlayFileInput | null | undefined]),
    );
  }

  return [normalizeLayer(overlayFiles as Array<EmbedosOverlayFileInput | null | undefined>)];
}

function normalizeRun(run: EmbedosRuntimeOptionsInput["run"]): EmbedosRuntimeOptionsInput["run"] {
  if (typeof run === "string") {
    return run.split(/\r?\n/);
  }

  if (Array.isArray(run)) {
    return run.flatMap((command) =>
      typeof command === "string" ? command.split(/\r?\n/) : [command],
    );
  }

  return run;
}

function normalizeProcess(
  process: EmbedosRuntimeOptionsInput["process"],
): EmbedosProcessOptions | EmbedosRuntimeOptionsInput["process"] {
  if (!isPlainObject(process)) {
    return process;
  }

  return { ...process };
}

function assertOption(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  assertOption(
    typeof value === "string" && value.length > 0,
    `Embedos option "${path}" must be a non-empty string`,
  );
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  assertOption(typeof value === "boolean", `Embedos option "${path}" must be a boolean`);
}

function assertNumber(value: unknown, path: string): asserts value is number {
  assertOption(
    typeof value === "number" && Number.isFinite(value),
    `Embedos option "${path}" must be a finite number`,
  );
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  assertOption(Array.isArray(value), `Embedos option "${path}" must be an array`);
  value.forEach((item, index) => {
    assertString(item, `${path}[${index}]`);
  });
}

function assertOverlayLayers(value: unknown): asserts value is EmbedosOverlayLayers {
  assertOption(Array.isArray(value), 'Embedos option "overlayFiles" must be an array');

  value.forEach((layer, layerIndex) => {
    assertOption(
      Array.isArray(layer),
      `Embedos option "overlayFiles[${layerIndex}]" must be an array`,
    );
  });
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  assertOption(isPlainObject(value), `Embedos option "${path}" must be an object`);
}

function validateResolvedEmbedosRuntimeOptions(
  options: EmbedosRuntimeOptionsInput,
): asserts options is EmbedosRuntimeOptions {
  assertStringArray(options.env, "env");
  assertOverlayLayers(options.overlayFiles);
  assertBoolean(options.resetOverlayOnStart, "resetOverlayOnStart");
  assertString(options.rootfsUrl, "rootfsUrl");
  assertString(options.storageKey, "storageKey");

  assertPlainObject(options.process, "process");
  assertString(options.process.cwd, "process.cwd");
  assertNumber(options.process.gid, "process.gid");
  assertNumber(options.process.uid, "process.uid");

  assertStringArray(options.run, "run");
  assertStringArray(options.shell, "shell");
}

export function mergeEmbedosOptions(
  ...layers: Array<EmbedosRuntimeOptionsInput | EmbedosRuntime | null | undefined>
): EmbedosRuntimeOptionsInput {
  const normalized = layers
    .filter(Boolean)
    .reduce<EmbedosRuntimeOptionsInput>(
      (accumulator, layer) => mergeObjects(accumulator, layer) as EmbedosRuntimeOptionsInput,
      {},
    );

  const merged: EmbedosRuntimeOptionsInput = { ...normalized };

  if (Object.hasOwn(normalized, "env")) {
    merged.env = Array.isArray(normalized.env) ? [...normalized.env] : normalized.env;
  }

  if (Object.hasOwn(normalized, "overlayFiles")) {
    merged.overlayFiles = normalizeOverlayLayers(normalized.overlayFiles);
  }

  if (Object.hasOwn(normalized, "process")) {
    merged.process = normalizeProcess(normalized.process);
  }

  if (Object.hasOwn(normalized, "run")) {
    merged.run = normalizeRun(normalized.run);
  }

  if (Object.hasOwn(normalized, "shell")) {
    merged.shell = Array.isArray(normalized.shell) ? [...normalized.shell] : normalized.shell;
  }

  return merged;
}

export function resolveEmbedosRuntimeOptions(
  ...layers: Array<EmbedosRuntimeOptionsInput | EmbedosRuntime | null | undefined>
): EmbedosRuntimeOptions {
  const options = mergeEmbedosOptions(...layers);
  validateResolvedEmbedosRuntimeOptions(options);
  return options;
}
