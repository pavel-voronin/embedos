import { createBootstrapPlan } from "./bootstrap-plan.js";
import type {
  EmbedosDisposable,
  EmbedosEvent,
  EmbedosRuntimeOptions,
  EmbedosRuntimeOptionsInput,
  EmbedosRuntimeState,
  EmbedosTerminalAdapter,
} from "../../../core/index.ts";
import { resolveEmbedosRuntimeOptions } from "../../../core/index.ts";

interface EmbedosCheerpXInstance {
  delete(): void;
  run(
    command: string,
    args: string[],
    options: { cwd: string; env: string[]; gid: number; uid: number },
  ): Promise<unknown>;
  setCustomConsole(
    writer: (buffer: Uint8Array<ArrayBufferLike>, vt: number) => void,
    cols: number,
    rows: number,
  ): (keyCode: number) => void;
}

interface EmbedosCheerpXModule {
  HttpBytesDevice: {
    create(url: string): Promise<unknown>;
  };
  IDBDevice: {
    create(storageKey: string): Promise<{ reset(): Promise<void> }>;
  };
  Linux: {
    create(options: {
      mounts: Array<{ dev: unknown; path: string; type: string }>;
    }): Promise<EmbedosCheerpXInstance>;
  };
  OverlayDevice: {
    create(rootfsDevice: unknown, idbDevice: unknown): Promise<unknown>;
  };
  WebDevice: {
    create(url: string): Promise<unknown>;
  };
}

interface RuntimeDependencies {
  CheerpX: EmbedosCheerpXModule;
}

interface EmbedosRuntimeEventMap {
  event: EmbedosEvent;
}

interface EmbedosEmitter {
  emit<Event extends keyof EmbedosRuntimeEventMap>(
    event: Event,
    payload: EmbedosRuntimeEventMap[Event],
  ): void;
  on<Event extends keyof EmbedosRuntimeEventMap>(
    event: Event,
    callback: (payload: EmbedosRuntimeEventMap[Event]) => void,
  ): () => void;
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function assertCheerpXEnvironment() {
  if (typeof window === "undefined") {
    throw new Error("CheerpX runtime can only start in a browser");
  }

  if (!("SharedArrayBuffer" in window)) {
    throw new Error(
      "CheerpX requires SharedArrayBuffer, but it is not available in this browser context",
    );
  }

  if (!window.crossOriginIsolated) {
    const { hostname, href, protocol } = window.location;
    const transportHint =
      protocol === "https:" || isLocalhost(hostname)
        ? "Ensure COOP/COEP headers are preserved by the dev server and any proxy in front of it"
        : "Use https:// or open the app on localhost, then keep COOP/COEP enabled";

    throw new Error(
      `CheerpX requires a cross-origin isolated page. Current URL: ${href}. ${transportHint}`,
    );
  }
}

function normalizeStartupError(cause: unknown): Error {
  if (cause instanceof Error) {
    if (
      cause.message.includes("Failed to fetch dynamically imported module") ||
      cause.message.includes("error loading dynamically imported module")
    ) {
      return new Error(
        `Failed to load CheerpX runtime from the Leaning Technologies CDN: ${cause.message}`,
      );
    }

    return cause;
  }

  return new Error(String(cause));
}

function createEmitter(): EmbedosEmitter {
  const listeners = new Map<
    keyof EmbedosRuntimeEventMap,
    Set<(payload: EmbedosRuntimeEventMap[keyof EmbedosRuntimeEventMap]) => void>
  >();

  return {
    emit(event, payload) {
      const callbacks = listeners.get(event);
      if (!callbacks) {
        return;
      }

      callbacks.forEach((callback) => callback(payload));
    },
    on(event, callback) {
      const callbacks =
        listeners.get(event) ??
        new Set<(payload: EmbedosRuntimeEventMap[keyof EmbedosRuntimeEventMap]) => void>();
      callbacks.add(
        callback as (payload: EmbedosRuntimeEventMap[keyof EmbedosRuntimeEventMap]) => void,
      );
      listeners.set(event, callbacks);

      return () => {
        callbacks.delete(
          callback as (payload: EmbedosRuntimeEventMap[keyof EmbedosRuntimeEventMap]) => void,
        );
        if (callbacks.size === 0) {
          listeners.delete(event);
        }
      };
    },
  };
}

async function loadRuntimeDependencies(): Promise<RuntimeDependencies> {
  const [CheerpX] = await Promise.all([
    import("@leaningtech/cheerpx") as unknown as Promise<EmbedosCheerpXModule>,
  ]);

  return {
    CheerpX,
  };
}

export class EmbedosBrowserRuntime {
  options: EmbedosRuntimeOptions;
  events: EmbedosEmitter;
  state: EmbedosRuntimeState;
  error: Error | null;
  terminal: EmbedosTerminalAdapter | null;
  cx: EmbedosCheerpXInstance | null;
  sendKey: ((keyCode: number) => void) | null;
  cleanupTerminalData: EmbedosDisposable | null;
  cleanupTerminalResize: EmbedosDisposable | null;
  startPromise: Promise<void> | null;
  consoleWriter: ((buffer: Uint8Array<ArrayBufferLike>, vt: number) => void) | null;

  constructor(inputOptions: EmbedosRuntimeOptionsInput = {}) {
    this.options = resolveEmbedosRuntimeOptions(inputOptions);
    this.events = createEmitter();
    this.state = "idle";
    this.error = null;
    this.terminal = null;
    this.cx = null;
    this.sendKey = null;
    this.cleanupTerminalData = null;
    this.cleanupTerminalResize = null;
    this.startPromise = null;
    this.consoleWriter = null;
  }

  on<Event extends keyof EmbedosRuntimeEventMap>(
    event: Event,
    callback: (payload: EmbedosRuntimeEventMap[Event]) => void,
  ): () => void {
    return this.events.on(event, callback);
  }

  setOptions(nextOptions: EmbedosRuntimeOptionsInput): void {
    this.options = resolveEmbedosRuntimeOptions(this.options, nextOptions);
  }

  emitPhase(phase: Extract<EmbedosEvent, { type: "phase" }>["phase"], shell?: string[]): void {
    this.events.emit("event", { type: "phase", phase, shell });
  }

  emitError(cause: Error): void {
    this.error = cause;
    this.state = "error";
    this.events.emit("event", { type: "error", error: cause });
  }

  bindTerminal(terminal: EmbedosTerminalAdapter): void {
    this.cleanupTerminalData?.dispose?.();
    this.cleanupTerminalData = terminal.onData((data) => {
      for (let index = 0; index < data.length; index += 1) {
        this.sendKey?.(data.charCodeAt(index));
      }
    });

    this.cleanupTerminalResize?.dispose?.();
    this.cleanupTerminalResize = terminal.onResize(() => {
      this.syncConsoleSize();
    });
  }

  attachTerminal(terminal: EmbedosTerminalAdapter): void {
    this.terminal = terminal;

    if (!this.cx || !this.consoleWriter) {
      return;
    }

    this.syncConsoleSize();
    this.bindTerminal(terminal);
  }

  syncConsoleSize(): void {
    if (!this.cx || !this.terminal || !this.consoleWriter) {
      return;
    }

    this.sendKey = this.cx.setCustomConsole(
      this.consoleWriter,
      this.terminal.cols,
      this.terminal.rows,
    );
  }

  async start(
    terminal: EmbedosTerminalAdapter,
    overrideOptions: EmbedosRuntimeOptionsInput = {},
  ): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.terminal = terminal;
    this.setOptions(overrideOptions);
    this.state = "starting";
    this.error = null;
    this.startPromise = this.#startInternal();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async #startInternal(): Promise<void> {
    try {
      assertCheerpXEnvironment();

      const { CheerpX } = await loadRuntimeDependencies();
      const decoder = new TextDecoder();
      const { env, overlayFiles, process, resetOverlayOnStart, rootfsUrl, run, shell, storageKey } =
        this.options;
      const terminal = this.terminal;

      if (!terminal) {
        throw new Error("Embedos runtime requires a terminal adapter before start");
      }

      this.emitPhase("initializing");
      this.emitPhase("loading-rootfs");

      const rootfsDevice = await CheerpX.HttpBytesDevice.create(rootfsUrl);
      const idbDevice = await CheerpX.IDBDevice.create(storageKey);
      if (resetOverlayOnStart) {
        await idbDevice.reset();
      }

      const overlayDevice = await CheerpX.OverlayDevice.create(rootfsDevice, idbDevice);
      const bootstrapPlan = createBootstrapPlan(overlayFiles, run);
      const mounts = [{ type: "ext2", path: "/", dev: overlayDevice }];

      for (const mount of bootstrapPlan.mounts) {
        mounts.push({
          dev: await CheerpX.WebDevice.create(mount.mountUrl),
          path: mount.mountPath,
          type: "dir",
        });
      }

      this.cx = await CheerpX.Linux.create({ mounts });
      this.consoleWriter = (buffer) => {
        const text = decoder.decode(buffer, { stream: true });
        this.terminal?.write(text);
      };

      this.syncConsoleSize();
      this.bindTerminal(terminal);

      this.emitPhase("starting-shell", shell);
      this.state = "ready";
      this.events.emit("event", { type: "ready" });

      const [command, ...args] = shell;
      const result = await this.cx.run(command, [...args, bootstrapPlan.script], {
        cwd: process.cwd,
        env,
        gid: process.gid,
        uid: process.uid,
      });

      this.state = "stopped";
      this.events.emit("event", { type: "exit", result });
    } catch (cause) {
      const normalizedCause = normalizeStartupError(cause);
      this.emitError(normalizedCause);
      throw normalizedCause;
    }
  }

  async stop(): Promise<void> {
    this.cleanupTerminalData?.dispose?.();
    this.cleanupTerminalData = null;
    this.cleanupTerminalResize?.dispose?.();
    this.cleanupTerminalResize = null;
    this.cx?.delete?.();
    this.cx = null;
    this.terminal = null;
    this.sendKey = null;
    this.consoleWriter = null;
    this.state = "stopped";
  }
}

export function createEmbedosBrowserRuntime(
  options: EmbedosRuntimeOptionsInput,
): EmbedosBrowserRuntime {
  return new EmbedosBrowserRuntime(options);
}
