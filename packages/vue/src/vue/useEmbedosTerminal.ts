import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  toValue,
  watch,
} from "vue";
import { createEmbedosBrowserRuntime } from "../runtime/embedos-runtime.js";
import { defaultTerminalSettings } from "./defaultTerminalSettings.js";
import type { MaybeRefOrGetter, Ref, ShallowRef } from "vue";
import type {
  EmbedosDisposable,
  EmbedosConfigLike,
  EmbedosEvent,
  EmbedosRuntimeOptionsInput,
  EmbedosRuntimeState,
  EmbedosTerminalAdapter,
  EmbedosTerminalOptions,
  UseEmbedosOptions,
} from "../../../core/index.ts";
import type { EmbedosBrowserRuntime } from "../runtime/embedos-runtime.js";
import {
  mergeEmbedosOptions,
  isEmbedosConfig,
  resolveEmbedosRuntimeInput,
} from "../../../core/index.ts";

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function isValidStorageKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

interface XtermTerminal {
  _core?: {
    _renderService?: {
      dimensions?: {
        css?: {
          cell?: {
            height: number;
            width: number;
          };
        };
      };
    };
  };
  cols: number;
  element?: HTMLElement;
  options?: EmbedosTerminalOptions;
  rows: number;
  dispose(): void;
  onData(callback: (data: string) => void): EmbedosDisposable;
  onResize(callback: () => void): EmbedosDisposable;
  open(container: HTMLElement): void;
  resize(cols: number, rows: number): void;
  write(text: string): void;
}

interface XtermDependencies {
  Terminal: new (options?: EmbedosTerminalOptions) => XtermTerminal;
}

interface EmbedosTerminalSession {
  adapter: EmbedosTerminalAdapter;
  dispose(): void;
  fit(): void;
  updateOptions(nextOptions: EmbedosTerminalOptions): void;
}

interface TerminalLayoutMetrics {
  cellHeight: number;
  cellWidth: number;
  horizontalPadding: number;
  scrollbarWidth: number;
  verticalPadding: number;
}

function getTerminalBackground(options: EmbedosTerminalOptions): string | null {
  const theme = options.theme;
  if (!theme || typeof theme !== "object") {
    return null;
  }

  const background = "background" in theme ? theme.background : null;
  return typeof background === "string" && background.length > 0 ? background : null;
}

function normalizeTerminalOptions(options: EmbedosTerminalOptions): EmbedosTerminalOptions {
  const normalizedEntries = Object.entries(options).filter(([, value]) => value !== undefined);
  return Object.fromEntries(normalizedEntries) as EmbedosTerminalOptions;
}

function toXtermRuntimeOptions(options: EmbedosTerminalOptions): EmbedosTerminalOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => key !== "cols" && key !== "rows"),
  ) as EmbedosTerminalOptions;
}

async function loadTerminalDependencies(): Promise<XtermDependencies> {
  const [xterm] = await Promise.all([import("@xterm/xterm")]);

  return {
    Terminal: xterm.Terminal as unknown as XtermDependencies["Terminal"],
  };
}

export async function createTerminalSession(
  container: HTMLElement,
  terminalOptions: EmbedosTerminalOptions = {},
): Promise<EmbedosTerminalSession> {
  const initialOptions = normalizeTerminalOptions(terminalOptions);
  const { Terminal } = await loadTerminalDependencies();
  const terminal = new Terminal(initialOptions);
  const resizeCallbacks = new Set<() => void>();
  const viewport = document.createElement("div");
  const surface = document.createElement("div");
  let currentOptions: EmbedosTerminalOptions = { ...initialOptions };

  const applyTerminalBackground = () => {
    const background = getTerminalBackground(currentOptions);
    const nextBackground = background ?? "transparent";
    container.style.backgroundColor = nextBackground;
    viewport.style.backgroundColor = nextBackground;
    surface.style.backgroundColor = nextBackground;
  };

  viewport.style.position = "absolute";
  viewport.style.inset = "0";
  viewport.style.overflow = "hidden";
  viewport.style.width = "100%";
  viewport.style.height = "100%";
  viewport.className = "embedos-terminal-viewport";
  surface.style.position = "absolute";
  surface.style.left = "0";
  surface.style.top = "0";
  surface.className = "embedos-terminal-surface";

  container.style.position ||= "relative";
  viewport.append(surface);
  container.append(viewport);

  terminal.open(surface);

  const getFixedCols = () =>
    Number.isFinite(currentOptions.cols)
      ? Math.max(2, Math.floor(currentOptions.cols as number))
      : null;
  const getFixedRows = () =>
    Number.isFinite(currentOptions.rows)
      ? Math.max(1, Math.floor(currentOptions.rows as number))
      : null;
  const hasFixedAxis = () => getFixedCols() !== null || getFixedRows() !== null;

  const applySurfaceMode = () => {
    if (hasFixedAxis()) {
      viewport.style.display = "grid";
      viewport.style.placeItems = "center";
      surface.style.position = "relative";
      surface.style.left = "auto";
      surface.style.top = "auto";
      surface.style.inset = "auto";
      surface.style.width = "fit-content";
      surface.style.height = "fit-content";
      return;
    }

    viewport.style.display = "block";
    viewport.style.placeItems = "";
    surface.style.position = "absolute";
    surface.style.left = "0";
    surface.style.top = "0";
    surface.style.width = "100%";
    surface.style.height = "100%";
  };

  applySurfaceMode();
  applyTerminalBackground();

  const notifyResize = () => {
    resizeCallbacks.forEach((callback) => callback());
  };

  const getLayoutMetrics = (): TerminalLayoutMetrics | null => {
    try {
      const cell = terminal._core?._renderService?.dimensions?.css?.cell;
      if (!cell || cell.width === 0 || cell.height === 0) {
        return null;
      }

      const element = terminal.element;
      if (!element) {
        return null;
      }

      const style = window.getComputedStyle(element);
      const verticalPadding =
        Number.parseInt(style.getPropertyValue("padding-top"), 10) +
        Number.parseInt(style.getPropertyValue("padding-bottom"), 10);
      const horizontalPadding =
        Number.parseInt(style.getPropertyValue("padding-left"), 10) +
        Number.parseInt(style.getPropertyValue("padding-right"), 10);
      const scrollback =
        typeof terminal.options?.scrollback === "number" ? terminal.options.scrollback : undefined;
      const overviewRuler = terminal.options?.overviewRuler as { width?: number } | undefined;
      const scrollbarWidth = scrollback === 0 ? 0 : Math.max(0, overviewRuler?.width ?? 14);

      return {
        cellHeight: cell.height,
        cellWidth: cell.width,
        horizontalPadding,
        scrollbarWidth,
        verticalPadding,
      };
    } catch {
      return null;
    }
  };

  const proposeDimensions = (): { cols: number; rows: number } | null => {
    const metrics = getLayoutMetrics();
    if (!metrics) {
      return null;
    }

    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;
    const fixedCols = getFixedCols();
    const fixedRows = getFixedRows();

    if (fixedCols !== null && fixedRows !== null) {
      return {
        cols: fixedCols,
        rows: fixedRows,
      };
    }

    if (fixedCols !== null) {
      const rows = Math.max(
        1,
        Math.floor((availableHeight - metrics.verticalPadding) / metrics.cellHeight),
      );

      return {
        cols: fixedCols,
        rows,
      };
    }

    if (fixedRows !== null) {
      const cols = Math.max(
        2,
        Math.floor(
          Math.max(0, availableWidth - metrics.horizontalPadding - metrics.scrollbarWidth) /
            metrics.cellWidth,
        ),
      );

      return {
        cols,
        rows: fixedRows,
      };
    }

    return {
      cols: Math.max(
        2,
        Math.floor(
          Math.max(0, availableWidth - metrics.horizontalPadding - metrics.scrollbarWidth) /
            metrics.cellWidth,
        ),
      ),
      rows: Math.max(
        1,
        Math.floor(Math.max(0, availableHeight - metrics.verticalPadding) / metrics.cellHeight),
      ),
    };
  };

  const fit = () => {
    const proposed = proposeDimensions();
    if (!proposed) {
      return;
    }

    const nextCols = getFixedCols() ?? proposed.cols;
    const nextRows = getFixedRows() ?? proposed.rows;
    if (terminal.cols !== nextCols || terminal.rows !== nextRows) {
      terminal.resize(nextCols, nextRows);
      notifyResize();
    }
  };

  fit();

  const resizeObserver = new ResizeObserver(() => {
    fit();
  });
  resizeObserver.observe(viewport);
  requestAnimationFrame(() => {
    fit();
    requestAnimationFrame(() => {
      fit();
    });
  });

  return {
    adapter: {
      get cols() {
        return terminal.cols;
      },
      get rows() {
        return terminal.rows;
      },
      onData(callback) {
        return terminal.onData(callback);
      },
      onResize(callback) {
        resizeCallbacks.add(callback);

        return {
          dispose() {
            resizeCallbacks.delete(callback);
          },
        };
      },
      write(text) {
        terminal.write(text);
      },
    },
    dispose() {
      resizeObserver.disconnect();
      terminal.dispose();
      viewport.remove();
      resizeCallbacks.clear();
    },
    fit,
    updateOptions(nextOptions) {
      currentOptions = normalizeTerminalOptions(nextOptions);
      // cols/rows stay owned by fit(); xterm only gets live runtime options here.
      terminal.options = toXtermRuntimeOptions(currentOptions);
      applySurfaceMode();
      applyTerminalBackground();
      fit();
      requestAnimationFrame(() => {
        fit();
      });
    },
  };
}

export function useEmbedosTerminal(
  runtimeOptions: MaybeRefOrGetter<EmbedosConfigLike | null | undefined>,
  composableOptions: MaybeRefOrGetter<UseEmbedosOptions | null | undefined> = {},
): {
  cols: Ref<number | null>;
  containerRef: Ref<HTMLElement | null>;
  error: Ref<Error | null>;
  fit: () => void;
  phase: Ref<Extract<EmbedosEvent, { type: "phase" }>["phase"] | null>;
  rows: Ref<number | null>;
  runtime: ShallowRef<EmbedosBrowserRuntime | null>;
  start: (overrideOptions?: EmbedosRuntimeOptionsInput) => Promise<void>;
  state: Ref<EmbedosRuntimeState>;
  stop: () => Promise<void>;
} {
  const cols = ref<number | null>(null);
  const containerRef = ref<HTMLElement | null>(null);
  const runtimeRef = shallowRef<EmbedosBrowserRuntime | null>(null);
  const terminalSessionRef = shallowRef<EmbedosTerminalSession | null>(null);
  const terminalResizeCleanupRef = shallowRef<EmbedosDisposable | null>(null);
  const phase = ref<Extract<EmbedosEvent, { type: "phase" }>["phase"] | null>(null);
  const rows = ref<number | null>(null);
  const state = ref<EmbedosRuntimeState>("idle");
  const error = ref<Error | null>(null);

  const runtimeInput = computed(() => toValue(runtimeOptions));
  const runtimeResolution = computed(() => {
    try {
      const source = runtimeInput.value;
      let recipeId: string | null = null;

      if (source === null || source === undefined) {
        return {
          error: null,
          recipeId,
          runtime: {} satisfies EmbedosRuntimeOptionsInput,
        };
      }

      if (typeof source === "function") {
        const config = source();

        if (isEmbedosConfig(config)) {
          recipeId = config.id;
        }

        return {
          error: null,
          recipeId,
          runtime: resolveEmbedosRuntimeInput(config),
        };
      }

      if (isEmbedosConfig(source)) {
        recipeId = source.id;
      }

      return {
        error: null,
        recipeId,
        runtime: resolveEmbedosRuntimeInput(source),
      };
    } catch (cause) {
      return {
        error: toError(cause),
        recipeId: null,
        runtime: {} satisfies EmbedosRuntimeOptionsInput,
      };
    }
  });
  const resolvedComposableOptions = computed<UseEmbedosOptions>(
    () => toValue(composableOptions) ?? {},
  );
  const resolvedRuntimeOptions = computed(() =>
    mergeEmbedosOptions(runtimeResolution.value.runtime),
  );
  const resolvedResetOverlayOnStart = computed(() => {
    const explicitValue = resolvedComposableOptions.value.resetOverlayOnStart;

    if (isValidBoolean(explicitValue)) {
      return explicitValue;
    }

    if (isValidBoolean(resolvedRuntimeOptions.value.resetOverlayOnStart)) {
      return resolvedRuntimeOptions.value.resetOverlayOnStart;
    }

    return true;
  });
  const resolvedStorageKey = computed(() => {
    const explicitStorageKey = resolvedComposableOptions.value.storageKey;

    if (isValidStorageKey(explicitStorageKey)) {
      return explicitStorageKey;
    }

    if (isValidStorageKey(resolvedRuntimeOptions.value.storageKey)) {
      return resolvedRuntimeOptions.value.storageKey;
    }

    if (runtimeResolution.value.recipeId) {
      return `embedos-${runtimeResolution.value.recipeId}`;
    }

    return "embedos-runtime";
  });
  const resolvedOptions = computed(() =>
    mergeEmbedosOptions(resolvedRuntimeOptions.value, {
      resetOverlayOnStart: resolvedResetOverlayOnStart.value,
      storageKey: resolvedStorageKey.value,
    }),
  );
  const terminalOptionsSignature = computed(() =>
    JSON.stringify(resolvedComposableOptions.value.terminal ?? defaultTerminalSettings),
  );

  function bindRuntime(runtime: EmbedosBrowserRuntime): void {
    runtime.on("event", (event) => {
      handleRuntimeEvent(event);
    });
  }

  function syncTerminalSize(): void {
    cols.value = terminalSessionRef.value?.adapter.cols ?? null;
    rows.value = terminalSessionRef.value?.adapter.rows ?? null;
  }

  function handleRuntimeEvent(event: EmbedosEvent): void {
    if (resolvedComposableOptions.value.logging !== "silent") {
      if (event.type === "error") {
        console.error(event.error);
      } else if (event.type === "phase") {
        if (event.phase === "initializing") {
          console.info("[embedos] Initializing runtime");
        } else if (event.phase === "loading-rootfs") {
          console.info("[embedos] Loading rootfs");
        } else if (event.phase === "starting-shell") {
          console.info(`[embedos] Starting ${event.shell?.join(" ") ?? "shell"}`);
        }
      }
    }

    if (event.type === "error") {
      phase.value = null;
      error.value = event.error;
      state.value = "error";
      return;
    }

    if (event.type === "phase") {
      phase.value = event.phase;
      return;
    }

    if (event.type === "ready") {
      phase.value = null;
      state.value = "ready";
      return;
    }

    if (event.type === "exit") {
      phase.value = null;
      state.value = "stopped";
    }
  }

  async function start(overrideOptions: EmbedosRuntimeOptionsInput = {}): Promise<void> {
    if (!containerRef.value) {
      return;
    }

    if (runtimeResolution.value.error) {
      error.value = runtimeResolution.value.error;
      state.value = "error";
      return;
    }

    if (!terminalSessionRef.value) {
      terminalSessionRef.value = await createTerminalSession(
        containerRef.value,
        resolvedComposableOptions.value.terminal ?? defaultTerminalSettings,
      );
      terminalResizeCleanupRef.value = terminalSessionRef.value.adapter.onResize(() => {
        syncTerminalSize();
      });
      syncTerminalSize();
    }

    if (!runtimeRef.value) {
      runtimeRef.value = markRaw(createEmbedosBrowserRuntime(resolvedOptions.value));
      bindRuntime(runtimeRef.value);
    }

    runtimeRef.value.setOptions(mergeEmbedosOptions(resolvedOptions.value, overrideOptions));
    state.value = "starting";
    error.value = null;
    phase.value = null;
    await runtimeRef.value.start(terminalSessionRef.value.adapter, {});
    syncTerminalSize();
  }

  async function stop(): Promise<void> {
    if (!runtimeRef.value) {
      return;
    }

    await runtimeRef.value.stop();
    runtimeRef.value = null;
    terminalResizeCleanupRef.value?.dispose();
    terminalResizeCleanupRef.value = null;
    terminalSessionRef.value?.dispose();
    terminalSessionRef.value = null;
    syncTerminalSize();
    phase.value = null;
    state.value = "stopped";
  }

  function fit(): void {
    terminalSessionRef.value?.fit();
  }

  watch(
    terminalOptionsSignature,
    () => {
      const nextTerminalOptions =
        resolvedComposableOptions.value.terminal ?? defaultTerminalSettings;
      terminalSessionRef.value?.updateOptions(nextTerminalOptions);
      syncTerminalSize();
    },
    { immediate: true },
  );

  onMounted(() => {
    if (resolvedComposableOptions.value.autoStart) {
      start();
    }
  });

  onBeforeUnmount(() => {
    stop();
  });

  watch(
    resolvedOptions,
    (nextOptions) => {
      runtimeRef.value?.setOptions(nextOptions);
    },
    { deep: true },
  );

  watch(
    runtimeResolution,
    (nextResolution) => {
      if (!nextResolution.error) {
        error.value = null;
        if (state.value === "error") {
          state.value = runtimeRef.value ? "ready" : "idle";
        }
        return;
      }

      error.value = nextResolution.error;
      state.value = "error";
    },
    { immediate: true },
  );

  return {
    cols,
    containerRef,
    error,
    fit,
    phase,
    rows,
    runtime: runtimeRef,
    start,
    state,
    stop,
  };
}
