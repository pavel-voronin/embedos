import type { EmbedosConfig, EmbedosConfigOverlayFile } from "./types.ts";

type EmbedosRecipeFactory = (base: EmbedosConfig) => EmbedosConfig;

const EMBEDOS_RECIPE_BRAND = Symbol.for("embedos.recipe");

interface EmbedosRecipe {
  (): EmbedosConfig;
  readonly config: EmbedosConfig;
  readonly [EMBEDOS_RECIPE_BRAND]?: true;
}

function cloneOverlayFile(file: EmbedosConfigOverlayFile): EmbedosConfigOverlayFile {
  if ("contents" in file) {
    return {
      contents: file.contents,
      executable: file.executable,
      mode: file.mode,
      path: file.path,
    };
  }

  return {
    executable: file.executable,
    mode: file.mode,
    path: file.path,
    source: { ...file.source },
    type: file.type,
  };
}

function cloneConfig(config: EmbedosConfig): EmbedosConfig {
  return {
    ...config,
    env: [...config.env],
    overlayFiles: config.overlayFiles.map((layer) => layer.map((file) => cloneOverlayFile(file))),
    process: { ...config.process },
    run: [...config.run],
    shell: [...config.shell],
    source: typeof config.source === "object" ? { ...config.source } : config.source,
  };
}

export function defineRecipe(factory: EmbedosRecipeFactory): EmbedosRecipe;
export function defineRecipe(parent: EmbedosRecipe, factory: EmbedosRecipeFactory): EmbedosRecipe;
export function defineRecipe(
  parentOrFactory: EmbedosRecipe | EmbedosRecipeFactory,
  maybeFactory?: EmbedosRecipeFactory,
): EmbedosRecipe {
  const parentRecipe =
    typeof maybeFactory === "function" ? (parentOrFactory as EmbedosRecipe) : null;
  const factory = maybeFactory ?? (parentOrFactory as EmbedosRecipeFactory);
  const base = parentRecipe ? cloneConfig(parentRecipe()) : ({} as EmbedosConfig);
  const config = cloneConfig(factory(base));

  const recipe = (() => cloneConfig(config)) as EmbedosRecipe;
  Object.defineProperty(recipe, "config", {
    enumerable: true,
    value: cloneConfig(config),
    writable: false,
  });
  Object.defineProperty(recipe, EMBEDOS_RECIPE_BRAND, {
    enumerable: false,
    value: true,
    writable: false,
  });
  Object.defineProperty(recipe.config, EMBEDOS_RECIPE_BRAND, {
    enumerable: false,
    value: true,
    writable: false,
  });

  return recipe;
}
