<template>
  <div class="embedos-terminal">
    <div ref="containerRef" class="embedos-terminal__viewport"></div>
    <div v-if="visibleOverlayStage" class="embedos-terminal__overlay">
      <slot
        v-if="visibleOverlayStage === 'invite'"
        name="invite"
        :launch="launch"
        :theme="overlayTheme"
      >
        <EmbedosInviteOverlay :theme="overlayTheme" @launch="launch" />
      </slot>
      <slot
        v-else-if="visibleOverlayStage === 'downloading'"
        name="download"
        :bytes-loaded="displayedDownloadBytes"
        :bytes-total="downloadTotalBytes"
        :message="downloadMessage"
        :percent="displayedDownloadPercent"
        :theme="overlayTheme"
      >
        <EmbedosDownloadOverlay
          :bytes-loaded="displayedDownloadBytes"
          :bytes-total="downloadTotalBytes"
          :message="downloadMessage"
          :percent="displayedDownloadPercent"
          :theme="overlayTheme"
        />
      </slot>
      <slot
        v-else-if="visibleOverlayStage === 'initializing'"
        name="initializing"
        :theme="overlayTheme"
      >
        <EmbedosInitializingOverlay :theme="overlayTheme" />
      </slot>
      <slot
        v-else
        name="error"
        :error="activeError"
        :error-message="activeErrorMessage"
        :launch="launch"
        :retryable="retryable"
        :theme="overlayTheme"
      >
        <EmbedosErrorOverlay
          :message="activeErrorMessage ?? 'Unknown error'"
          :retryable="retryable"
          :theme="overlayTheme"
          :title="errorTitle"
          @retry="launch"
        />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRefs, watch, watchEffect } from "vue";
import type { PropType } from "vue";
import { defaultTerminalSettings } from "./defaultTerminalSettings.js";
import EmbedosDownloadOverlay from "./EmbedosDownloadOverlay.vue";
import EmbedosErrorOverlay from "./EmbedosErrorOverlay.vue";
import EmbedosInitializingOverlay from "./EmbedosInitializingOverlay.vue";
import EmbedosInviteOverlay from "./EmbedosInviteOverlay.vue";
import { areCheerpXGlobalsReady, createEmbedosTerminalLaunchSlot } from "./embedos-launch-queue.js";
import {
  defaultAutoFetch,
  defaultResetOverlayOnStart,
  resolveTerminalResetOverlayOnStart,
} from "./terminal-defaults.js";
import {
  createEmbedosRuntimeStorageKey,
  useEmbedosLaunchPreload,
} from "./useEmbedosLaunchPreload.js";
import { useEmbedosTerminal } from "./useEmbedosTerminal.js";
import type {
  EmbedosConfigLike,
  EmbedosRuntimeOptionsInput,
  EmbedosTerminalOptions,
  EmbedosTerminalTheme,
} from "../../../core/index.ts";
import { resolveEmbedosRuntimeInput } from "../../../core/index.ts";

type EmbedosTerminalLifecycleStage =
  | "preparing"
  | "invite"
  | "downloading"
  | "initializing"
  | "ready"
  | "error";

let embedosTerminalInstanceNonce = 0;

const props = defineProps({
  autoFetch: {
    type: Boolean,
    default: defaultAutoFetch,
  },
  config: {
    type: [Object, Function] as PropType<EmbedosConfigLike>,
    required: true,
  },
  resetOverlayOnStart: {
    type: Boolean,
    default: defaultResetOverlayOnStart,
  },
  storageKey: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
  terminal: {
    type: Object as PropType<EmbedosTerminalOptions>,
    default: () => ({ ...defaultTerminalSettings }),
  },
});

const emit = defineEmits<{
  error: [error: Error];
  ready: [runtime: unknown];
  resize: [size: { cols: number; rows: number }];
}>();

const terminalInstanceNonce = ++embedosTerminalInstanceNonce;
const { autoFetch, resetOverlayOnStart, storageKey, terminal: terminalOptionsProp } = toRefs(props);
const lifecycleStage = ref<EmbedosTerminalLifecycleStage>("preparing");
const preloadError = ref<Error | null>(null);
const launchRequested = ref(false);
const config = computed(() => props.config);

const resolvedRuntimeInput = computed<EmbedosRuntimeOptionsInput | null>(() => {
  try {
    return resolveEmbedosRuntimeInput(config.value) as EmbedosRuntimeOptionsInput;
  } catch {
    return null;
  }
});

const resolvedStorageKey = computed(() => {
  const explicitStorageKey = storageKey?.value;
  if (typeof explicitStorageKey === "string" && explicitStorageKey.length > 0) {
    return explicitStorageKey;
  }

  const runtimeInput = resolvedRuntimeInput.value;
  if (!runtimeInput) {
    return undefined;
  }

  return createEmbedosRuntimeStorageKey(runtimeInput, terminalInstanceNonce);
});

const terminalSession = useEmbedosTerminal(
  config,
  computed(() => ({
    resetOverlayOnStart: resolveTerminalResetOverlayOnStart(resetOverlayOnStart.value),
    storageKey: resolvedStorageKey.value,
    terminal: terminalOptionsProp.value,
  })),
);
const { cols, containerRef, error, rows, runtime: runtimeInstance, start, state } = terminalSession;
const launchPreload = useEmbedosLaunchPreload(computed(() => resolvedRuntimeInput.value ?? null));
const selectedTheme = computed(() => terminalOptionsProp.value.theme ?? null);
const overlayTheme = computed<EmbedosTerminalTheme | null>(() => {
  const theme = selectedTheme.value;
  if (!theme || typeof theme !== "object") {
    return null;
  }

  const background =
    "background" in theme && typeof theme.background === "string" ? theme.background : null;
  const foreground =
    "foreground" in theme && typeof theme.foreground === "string" ? theme.foreground : null;
  const red = "red" in theme && typeof theme.red === "string" ? theme.red : null;

  if (!background || !foreground || !red) {
    return null;
  }

  return { background, foreground, red };
});
const downloadMessage = computed(() => launchPreload.message.value);
const actualDownloadPercent = computed(() => launchPreload.percent.value);
const downloadTotalBytes = computed(() => launchPreload.bytesTotal.value);
const downloadLoadedBytes = computed(() => launchPreload.bytesLoaded.value);
const activeError = computed(() => preloadError.value ?? error.value);
const activeErrorMessage = computed(() => activeError.value?.message ?? null);
const retryable = computed(() => resolvedRuntimeInput.value !== null);
const isAutoFetchEnabled = computed(() => autoFetch.value === true);
const errorTitle = computed(() =>
  error.value
    ? "Embedos configuration error"
    : launchRequested.value
      ? "Embedos launch failed"
      : "Embedos error",
);
const downloadOverlayVisible = ref(false);
const downloadOverlayEligible = ref(false);
const displayedDownloadPercent = ref(0);
const downloadFallbackStage = ref<"invite" | null>(null);
const initializingOverlayVisible = ref(false);
const initializingOverlayEligible = ref(false);
const initializingFallbackStage = ref<"invite" | "downloading" | null>(null);
const visibleOverlayStage = computed<"invite" | "downloading" | "initializing" | "error" | null>(
  () => {
    if (lifecycleStage.value === "error") {
      return "error";
    }

    if (lifecycleStage.value === "invite") {
      return "invite";
    }

    if (lifecycleStage.value === "downloading") {
      return downloadOverlayVisible.value ? "downloading" : downloadFallbackStage.value;
    }

    if (lifecycleStage.value === "initializing") {
      return initializingOverlayVisible.value ? "initializing" : initializingFallbackStage.value;
    }

    return null;
  },
);
const displayedDownloadBytes = computed(() => {
  if (downloadTotalBytes.value <= 0) {
    return 0;
  }

  return Math.round((displayedDownloadPercent.value / 100) * downloadTotalBytes.value);
});

let downloadRevealTimer: ReturnType<typeof setTimeout> | null = null;
let downloadAnimationFrame: number | null = null;
let downloadAnimationTimestamp = 0;
let initializingRevealTimer: ReturnType<typeof setTimeout> | null = null;
let launchGlobalsPollTimer: ReturnType<typeof setTimeout> | null = null;
let releaseLaunchSlot: (() => void) | null = null;
let launchSequence = 0;
const launchReleaseDelayMs = 2000;

watchEffect(() => {
  if (!terminalSession.error.value) {
    return;
  }

  settleLaunchSlot();
  stopInitializationOverlay();
  lifecycleStage.value = "error";
  emit("error", terminalSession.error.value);
});

watchEffect(() => {
  if (terminalSession.state.value !== "ready") {
    return;
  }

  settleLaunchSlot();
  stopInitializationOverlay();
  lifecycleStage.value = "ready";
  emit("ready", runtimeInstance.value);
});

watch([cols, rows], ([nextCols, nextRows]) => {
  if (nextCols === null || nextRows === null) {
    return;
  }

  emit("resize", { cols: nextCols, rows: nextRows });
});

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

let crossOriginIsolationWaitPromise: Promise<void> | null = null;

async function waitForCrossOriginIsolation(timeoutMs = 15000): Promise<void> {
  if (typeof window === "undefined" || window.crossOriginIsolated) {
    return;
  }

  if (crossOriginIsolationWaitPromise) {
    return crossOriginIsolationWaitPromise;
  }

  crossOriginIsolationWaitPromise = new Promise<void>((resolve) => {
    if (!("serviceWorker" in navigator)) {
      resolve();
      return;
    }

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      window.removeEventListener("visibilitychange", syncIsolationState);
      navigator.serviceWorker.removeEventListener("controllerchange", syncIsolationState);
      crossOriginIsolationWaitPromise = null;
    };

    const syncIsolationState = () => {
      if (window.crossOriginIsolated) {
        cleanup();
        resolve();
      }
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const poll = window.setInterval(syncIsolationState, 100);

    window.addEventListener("visibilitychange", syncIsolationState);
    navigator.serviceWorker.addEventListener("controllerchange", syncIsolationState);
    syncIsolationState();
  });

  return crossOriginIsolationWaitPromise;
}

function resetLaunchError(): void {
  preloadError.value = null;
}

function clearLaunchGlobalsPoll(): void {
  if (launchGlobalsPollTimer !== null) {
    clearTimeout(launchGlobalsPollTimer);
    launchGlobalsPollTimer = null;
  }
}

function settleLaunchSlot(attempt = 0): void {
  if (areCheerpXGlobalsReady() || attempt >= 120) {
    clearLaunchGlobalsPoll();
    // CheerpX can report "ready" before the shell bootstrap path is fully stable for a second instance.
    launchGlobalsPollTimer = setTimeout(() => {
      launchGlobalsPollTimer = null;
      releaseLaunchSlot?.();
      releaseLaunchSlot = null;
    }, launchReleaseDelayMs);
    return;
  }

  clearLaunchGlobalsPoll();
  launchGlobalsPollTimer = setTimeout(() => {
    launchGlobalsPollTimer = null;
    settleLaunchSlot(attempt + 1);
  }, 100);
}

function stopInitializationOverlay(): void {
  if (initializingRevealTimer !== null) {
    clearTimeout(initializingRevealTimer);
    initializingRevealTimer = null;
  }

  initializingOverlayEligible.value = false;
  initializingOverlayVisible.value = false;
  initializingFallbackStage.value = null;
}

function tryRevealInitializationOverlay(): void {
  if (
    !initializingOverlayEligible.value ||
    initializingOverlayVisible.value ||
    lifecycleStage.value !== "initializing"
  ) {
    return;
  }

  initializingOverlayVisible.value = true;
}

function startInitializationOverlay(previousStage: "invite" | "downloading" | null): void {
  stopInitializationOverlay();
  initializingFallbackStage.value = previousStage;
  initializingRevealTimer = setTimeout(() => {
    initializingRevealTimer = null;

    if (lifecycleStage.value !== "initializing") {
      return;
    }

    initializingOverlayEligible.value = true;
    tryRevealInitializationOverlay();
  }, 300);
}

function stopDownloadOverlayAnimation(): void {
  if (downloadRevealTimer !== null) {
    clearTimeout(downloadRevealTimer);
    downloadRevealTimer = null;
  }

  if (downloadAnimationFrame !== null) {
    window.cancelAnimationFrame(downloadAnimationFrame);
    downloadAnimationFrame = null;
  }

  downloadAnimationTimestamp = 0;
}

function stepDownloadOverlay(timestamp: number): void {
  if (!downloadOverlayVisible.value || lifecycleStage.value !== "downloading") {
    downloadAnimationFrame = null;
    downloadAnimationTimestamp = 0;
    return;
  }

  const deltaTime =
    downloadAnimationTimestamp === 0 ? 16 : Math.min(timestamp - downloadAnimationTimestamp, 64);
  downloadAnimationTimestamp = timestamp;
  const nextTarget = actualDownloadPercent.value;

  if (displayedDownloadPercent.value < nextTarget) {
    const easingStep =
      Math.max((nextTarget - displayedDownloadPercent.value) * 0.18, 0.35) * (deltaTime / 16);
    displayedDownloadPercent.value = Math.min(
      nextTarget,
      displayedDownloadPercent.value + easingStep,
    );
  }

  downloadAnimationFrame = window.requestAnimationFrame(stepDownloadOverlay);
}

function tryRevealDownloadOverlay(): void {
  if (
    !downloadOverlayEligible.value ||
    downloadOverlayVisible.value ||
    lifecycleStage.value !== "downloading"
  ) {
    return;
  }

  if (downloadTotalBytes.value <= 0 && actualDownloadPercent.value <= 0) {
    return;
  }

  downloadOverlayVisible.value = true;
  downloadAnimationTimestamp = 0;
  downloadAnimationFrame = window.requestAnimationFrame(stepDownloadOverlay);
}

function startDownloadOverlay(previousStage: EmbedosTerminalLifecycleStage): void {
  stopDownloadOverlayAnimation();
  downloadOverlayEligible.value = false;
  downloadFallbackStage.value = previousStage === "invite" ? "invite" : null;
  downloadOverlayVisible.value = false;
  displayedDownloadPercent.value = 0;
  downloadRevealTimer = setTimeout(() => {
    if (lifecycleStage.value !== "downloading") {
      return;
    }

    downloadRevealTimer = null;
    downloadOverlayEligible.value = true;
    tryRevealDownloadOverlay();
  }, 150);
}

function stopDownloadOverlay(): void {
  stopDownloadOverlayAnimation();
  downloadOverlayEligible.value = false;
  downloadFallbackStage.value = null;
  downloadOverlayVisible.value = false;
  displayedDownloadPercent.value = 0;
}

watch([downloadTotalBytes, actualDownloadPercent], () => {
  tryRevealDownloadOverlay();
});

function startInitialization(previousStage: "invite" | "downloading" | null = null): void {
  const fallbackStage =
    previousStage ??
    (visibleOverlayStage.value === "invite" || visibleOverlayStage.value === "downloading"
      ? visibleOverlayStage.value
      : null);
  const currentLaunchSequence = ++launchSequence;
  const launchSlot = createEmbedosTerminalLaunchSlot();

  launchRequested.value = true;
  lifecycleStage.value = "initializing";
  resetLaunchError();
  stopDownloadOverlay();
  startInitializationOverlay(fallbackStage);
  releaseLaunchSlot = launchSlot.release;

  void (async () => {
    await launchSlot.barrier;

    if (currentLaunchSequence !== launchSequence) {
      launchSlot.release();
      return;
    }

    try {
      await start();
    } catch (cause) {
      clearLaunchGlobalsPoll();
      launchSlot.release();
      if (state.value === "error") {
        return;
      }

      preloadError.value = toError(cause);
      lifecycleStage.value = "error";
    }
  })();
}

async function downloadAndInitialize(): Promise<void> {
  if (
    lifecycleStage.value === "downloading" ||
    lifecycleStage.value === "initializing" ||
    lifecycleStage.value === "ready"
  ) {
    return;
  }

  const previousStage = lifecycleStage.value;
  launchRequested.value = true;
  lifecycleStage.value = "downloading";
  startDownloadOverlay(previousStage);
  resetLaunchError();
  launchPreload.reset();

  try {
    await waitForCrossOriginIsolation();
    await launchPreload.prepare();
    startInitialization(
      visibleOverlayStage.value === "invite" || visibleOverlayStage.value === "downloading"
        ? visibleOverlayStage.value
        : null,
    );
  } catch (cause) {
    stopDownloadOverlay();
    preloadError.value = toError(cause);
    lifecycleStage.value = "error";
  }
}

async function resolveInitialLifecycle(): Promise<void> {
  lifecycleStage.value = "preparing";
  resetLaunchError();

  await waitForCrossOriginIsolation();
  const needsFetch = await launchPreload.readLaunchNetworkState();
  if (error.value) {
    lifecycleStage.value = "error";
    return;
  }

  if (!needsFetch) {
    if (isAutoFetchEnabled.value) {
      await downloadAndInitialize();
      return;
    }

    startInitialization();
    return;
  }

  if (isAutoFetchEnabled.value) {
    await downloadAndInitialize();
    return;
  }

  lifecycleStage.value = "invite";
}

async function launch(): Promise<void> {
  if (
    lifecycleStage.value === "downloading" ||
    lifecycleStage.value === "initializing" ||
    lifecycleStage.value === "ready"
  ) {
    return;
  }

  launchRequested.value = true;
  resetLaunchError();
  await waitForCrossOriginIsolation();
  if (lifecycleStage.value === "invite") {
    await downloadAndInitialize();
    return;
  }

  const needsFetch = await launchPreload.readLaunchNetworkState();

  if (needsFetch || isAutoFetchEnabled.value) {
    await downloadAndInitialize();
    return;
  }

  await downloadAndInitialize();
}

onMounted(async () => {
  launchRequested.value = isAutoFetchEnabled.value;
  await resolveInitialLifecycle();
});

onBeforeUnmount(() => {
  clearLaunchGlobalsPoll();
  releaseLaunchSlot?.();
  releaseLaunchSlot = null;
  stopDownloadOverlay();
  stopInitializationOverlay();
});
</script>

<style scoped>
.embedos-terminal {
  display: flex;
  height: 100%;
  position: relative;
  width: 100%;
}

.embedos-terminal__viewport {
  flex: 1 1 auto;
  min-height: 0;
}

.embedos-terminal__overlay {
  inset: 0;
  pointer-events: none;
  position: absolute;
}
</style>
