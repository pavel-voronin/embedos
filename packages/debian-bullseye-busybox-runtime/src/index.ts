const EMBEDOS_RECIPE_BRAND = Symbol.for("embedos.recipe");

interface EmbedosOverlayInlineFile {
  contents: string;
  executable?: boolean;
  mode?: string | null;
  path: string;
}

interface EmbedosAssetUrlReference {
  kind: "url";
  url: string;
}

interface EmbedosAssetBuildReference {
  kind: "asset";
  path: string;
}

type EmbedosAssetReference = EmbedosAssetBuildReference | EmbedosAssetUrlReference;

interface EmbedosOverlaySourceFile {
  executable?: boolean;
  mode?: string | null;
  path: string;
  source: EmbedosAssetReference;
  type?: "directory" | "file";
}

type EmbedosOverlayFile = EmbedosOverlayInlineFile | EmbedosOverlaySourceFile;
type EmbedosOverlayLayers<TOverlayFile = EmbedosOverlayFile> = TOverlayFile[][];

interface EmbedosProcessOptions {
  cwd: string;
  gid: number;
  uid: number;
}

interface EmbedosConfigDockerImageSource {
  image: string;
  imageSizeMb?: number;
  kind: "docker-image";
  packerImage?: string;
  platform?: string;
}

interface EmbedosConfigDockerfileSource {
  context?: string;
  file: string;
  imageSizeMb?: number;
  kind: "dockerfile";
  packerImage?: string;
  platform?: string;
  target?: string;
}

type EmbedosConfigSource =
  | EmbedosAssetReference
  | EmbedosConfigDockerImageSource
  | EmbedosConfigDockerfileSource;

interface EmbedosConfig {
  env: string[];
  id: string;
  overlayFiles: EmbedosOverlayLayers;
  process: EmbedosProcessOptions;
  run: string[];
  shell: string[];
  source: EmbedosConfigSource;
}

interface EmbedosRecipe {
  (): EmbedosConfig;
  readonly config: EmbedosConfig;
}

function cloneOverlayFile(
  file: EmbedosOverlayInlineFile | EmbedosOverlaySourceFile,
): EmbedosOverlayFile {
  if ("contents" in file) {
    return {
      contents: file.contents,
      executable: file.executable,
      mode: file.mode,
      path: file.path,
    } as typeof file;
  }

  return {
    executable: file.executable,
    mode: file.mode,
    path: file.path,
    source: { ...file.source },
    type: file.type,
  } as typeof file;
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

function defineRecipe(factory: () => EmbedosConfig): EmbedosRecipe {
  const config = cloneConfig(factory());
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

export const debianBullseyeBusyboxRuntime = defineRecipe(() => ({
  id: "debian-bullseye-busybox",
  env: [
    "HOME=/root",
    "USER=root",
    "SHELL=/bin/bash",
    "TERM=xterm-256color",
    "PATH=/bin:/usr/bin",
    "XDG_DATA_HOME=/root/.local/share",
  ],
  overlayFiles: [],
  process: {
    cwd: "/root",
    gid: 0,
    uid: 0,
  },
  source: {
    kind: "url",
    url: new URL("../rootfs/embedos-rootfs.ext2", import.meta.url).href,
  },
  run: [],
  shell: ["/bin/sh", "-lc"],
}));
