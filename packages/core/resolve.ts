import { getResolvedRuntimeForConfig } from "./runtime-registry.ts";
import type {
  EmbedosAssetReference,
  EmbedosConfig,
  EmbedosConfigLike,
  EmbedosConfigSource,
  EmbedosOverlayLayers,
  EmbedosRuntime,
  EmbedosRuntimeOptionsInput,
} from "./types.ts";

const EMBEDOS_RECIPE_BRAND = Symbol.for("embedos.recipe");

export class EmbedosUnresolvedRecipeError extends Error {
  readonly recipeId: string;

  constructor(recipeId: string) {
    super(
      `Embedos recipe "${recipeId}" cannot run directly in the browser. Build the host app with the Embedos bundler plugin so the recipe is compiled into an Embedos runtime. CDN-loaded recipes are not supported; use a managed bundler environment or ship a prebuilt runtime instead.`,
    );
    this.name = "EmbedosUnresolvedRecipeError";
    this.recipeId = recipeId;
  }
}

export function isEmbedosConfig(value: unknown): value is EmbedosConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<EmbedosConfig>;
  return typeof candidate.id === "string" && Array.isArray(candidate.env) && "source" in candidate;
}

export function isEmbedosUnresolvedRecipeError(
  value: unknown,
): value is EmbedosUnresolvedRecipeError {
  return value instanceof EmbedosUnresolvedRecipeError;
}

function isResolvedAssetReference(
  reference: EmbedosAssetReference,
): reference is { kind: "url"; url: string } {
  return reference.kind === "url";
}

function toResolvedAssetReference(
  reference: EmbedosAssetReference,
  label: string,
): { kind: "url"; url: string } {
  if (!isResolvedAssetReference(reference)) {
    throw new Error(`${label} must be resolved before browser runtime conversion`);
  }

  return reference;
}

function hasResolvedOverlayLayers(overlayFiles: EmbedosConfig["overlayFiles"]): boolean {
  return overlayFiles.every((layer) =>
    layer.every((file) => ("contents" in file ? true : isResolvedAssetReference(file.source))),
  );
}

function isResolvedConfigSource(
  source: EmbedosConfigSource,
): source is { kind: "url"; url: string } {
  return source.kind === "url";
}

function toResolvedConfigSource(
  source: EmbedosConfigSource,
  label: string,
): { kind: "url"; url: string } {
  if (!isResolvedConfigSource(source)) {
    throw new Error(`${label} must be resolved before browser runtime conversion`);
  }

  return source;
}

function isResolvedEmbedosConfig(config: EmbedosConfig): boolean {
  return isResolvedConfigSource(config.source) && hasResolvedOverlayLayers(config.overlayFiles);
}

function toRuntimeOptionsInput(config: EmbedosConfig): EmbedosRuntimeOptionsInput {
  const rootfs = toResolvedConfigSource(config.source, `Embedos config "${config.id}" source`);

  return {
    env: [...config.env],
    overlayFiles: config.overlayFiles.map((layer) =>
      layer.map((file) =>
        "contents" in file
          ? {
              contents: file.contents,
              executable: file.executable,
              mode: file.mode,
              path: file.path,
            }
          : {
              executable: file.executable,
              mode: file.mode,
              path: file.path,
              source: toResolvedAssetReference(file.source, `Overlay "${file.path}" source`).url,
              type: file.type,
            },
      ),
    ) as EmbedosOverlayLayers,
    process: { ...config.process },
    rootfsUrl: rootfs.url,
    run: [...config.run],
    shell: [...config.shell],
  };
}

function toRuntimeOptionsInputWithRootfsUrl(
  config: EmbedosConfig,
  rootfsUrl: string,
): EmbedosRuntimeOptionsInput {
  return toRuntimeOptionsInput({
    ...config,
    source: {
      kind: "url",
      url: rootfsUrl,
    },
  });
}

function resolveConfigLike(value: EmbedosConfigLike): EmbedosConfig | EmbedosRuntimeOptionsInput {
  if (typeof value === "function") {
    if (!Object.getOwnPropertySymbols(value).includes(EMBEDOS_RECIPE_BRAND)) {
      throw new Error("Embedos recipe functions must be created with defineRecipe()");
    }

    return value();
  }

  return value;
}

export function resolveEmbedosRuntimeInput(
  runtime: EmbedosConfigLike | null | undefined,
): EmbedosRuntime | EmbedosRuntimeOptionsInput {
  if (!runtime) {
    return {};
  }

  const resolvedRuntime = resolveConfigLike(runtime);

  if (isEmbedosConfig(resolvedRuntime)) {
    if (isResolvedEmbedosConfig(resolvedRuntime)) {
      return toRuntimeOptionsInput(resolvedRuntime);
    }

    const loadedRuntime = getResolvedRuntimeForConfig(resolvedRuntime.id);

    if (!loadedRuntime) {
      throw new EmbedosUnresolvedRecipeError(resolvedRuntime.id);
    }

    if (hasResolvedOverlayLayers(resolvedRuntime.overlayFiles)) {
      return toRuntimeOptionsInputWithRootfsUrl(resolvedRuntime, loadedRuntime.rootfsUrl);
    }

    return loadedRuntime;
  }

  return resolvedRuntime;
}
