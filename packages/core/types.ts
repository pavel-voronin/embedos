export type EmbedosRuntimeState = "idle" | "starting" | "ready" | "stopped" | "error";

export interface EmbedosOverlayInlineFile {
  contents: string;
  executable?: boolean;
  mode?: string | null;
  path: string;
}

export interface EmbedosOverlaySourceFile {
  executable?: boolean;
  mode?: string | null;
  path: string;
  source: string;
  type?: "directory" | "file";
}

export type EmbedosOverlayFile = EmbedosOverlayInlineFile | EmbedosOverlaySourceFile;
export type EmbedosOverlayLayer<TOverlayFile = EmbedosOverlayFile> = TOverlayFile[];
export type EmbedosOverlayLayers<TOverlayFile = EmbedosOverlayFile> =
  EmbedosOverlayLayer<TOverlayFile>[];

// Mirrors the xterm.js ITheme contract so terminal themes can be passed through unchanged.
export interface EmbedosTerminalTheme {
  background?: string;
  black?: string;
  blue?: string;
  brightBlack?: string;
  brightBlue?: string;
  brightCyan?: string;
  brightGreen?: string;
  brightMagenta?: string;
  brightRed?: string;
  brightWhite?: string;
  brightYellow?: string;
  cursor?: string;
  cursorAccent?: string;
  cyan?: string;
  extendedAnsi?: string[];
  foreground?: string;
  green?: string;
  magenta?: string;
  overviewRulerBorder?: string;
  red?: string;
  scrollbarSliderActiveBackground?: string;
  scrollbarSliderBackground?: string;
  scrollbarSliderHoverBackground?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  selectionInactiveBackground?: string;
  white?: string;
  yellow?: string;
}

export type EmbedosCompleteTerminalTheme = Required<EmbedosTerminalTheme>;

export interface EmbedosTerminalOptions extends Record<string, unknown> {
  cols?: number;
  rows?: number;
  theme?: EmbedosTerminalTheme | null;
}

export interface EmbedosDisposable {
  dispose(): void;
}

export interface EmbedosTerminalAdapter {
  readonly cols: number;
  readonly rows: number;
  onData(callback: (data: string) => void): EmbedosDisposable;
  onResize(callback: () => void): EmbedosDisposable;
  write(text: string): void;
}

export type EmbedosEvent =
  | { type: "phase"; phase: "initializing" | "loading-rootfs" | "starting-shell"; shell?: string[] }
  | { type: "error"; error: Error }
  | { type: "ready" }
  | { type: "exit"; result: unknown };

export interface EmbedosProcessOptions {
  cwd: string;
  gid: number;
  uid: number;
}

export interface EmbedosRuntimeOptions {
  env: string[];
  overlayFiles: EmbedosOverlayLayers;
  process: EmbedosProcessOptions;
  resetOverlayOnStart: boolean;
  rootfsUrl: string;
  run: string[];
  shell: string[];
  storageKey: string;
}

export type DeepPartial<T> =
  T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export interface EmbedosRunOptionsInput {
  run?: string | string[];
}

export interface EmbedosRuntimeOptionsInput
  extends
    Omit<DeepPartial<EmbedosRuntimeOptions>, "overlayFiles" | "run" | "shell">,
    EmbedosRunOptionsInput {
  overlayFiles?: Array<DeepPartial<EmbedosOverlayFile> | Array<DeepPartial<EmbedosOverlayFile>>>;
  shell?: string[];
}

export interface EmbedosRuntime extends EmbedosRuntimeOptions {
  id: string;
  kind: "embedos-runtime";
}

export interface EmbedosAssetUrlReference {
  kind: "url";
  url: string;
}

export interface EmbedosAssetBuildReference {
  kind: "asset";
  path: string;
}

export type EmbedosAssetReference = EmbedosAssetBuildReference | EmbedosAssetUrlReference;

export interface EmbedosConfigOverlaySourceFile {
  executable?: boolean;
  mode?: string | null;
  path: string;
  source: EmbedosAssetReference;
  type?: "directory" | "file";
}

export type EmbedosConfigOverlayFile = EmbedosOverlayInlineFile | EmbedosConfigOverlaySourceFile;

export interface EmbedosConfigDockerImageSource {
  image: string;
  imageSizeMb?: number;
  kind: "docker-image";
  packerImage?: string;
  platform?: string;
}

export interface EmbedosConfigDockerfileSource {
  context?: string;
  file: string;
  imageSizeMb?: number;
  kind: "dockerfile";
  packerImage?: string;
  platform?: string;
  target?: string;
}

export type EmbedosConfigSource =
  | EmbedosAssetReference
  | EmbedosConfigDockerImageSource
  | EmbedosConfigDockerfileSource;

export interface EmbedosConfig extends Omit<
  EmbedosRuntimeOptions,
  "overlayFiles" | "rootfsUrl" | "storageKey" | "resetOverlayOnStart"
> {
  id: string;
  overlayFiles: EmbedosOverlayLayers<EmbedosConfigOverlayFile>;
  source: EmbedosConfigSource;
}

export interface EmbedosRecipe {
  (): EmbedosConfig;
  readonly config: EmbedosConfig;
}

export type EmbedosConfigLike = EmbedosConfig | EmbedosRecipe | EmbedosRuntimeOptionsInput;

export interface EmbedosPluginOptions extends EmbedosRuntimeOptionsInput {
  componentName?: string;
}

export interface UseEmbedosOptions {
  autoStart?: boolean;
  logging?: "console" | "silent";
  resetOverlayOnStart?: boolean;
  storageKey?: string;
  terminal?: EmbedosTerminalOptions;
}

export interface EmbedosConfigPackageMetadata {
  configFile: string;
}

export interface EmbedosConfigPackageJson {
  embedosConfig?: EmbedosConfigPackageMetadata;
  name?: string;
}

export interface ResolvedEmbedosConfigBuild {
  outputDir: string;
  packageName: string;
  packageRoot: string;
  config: EmbedosConfig;
}
