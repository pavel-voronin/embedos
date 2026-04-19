<template>
  <div class="embedos-download-overlay" :style="overlayStyle">
    <div class="embedos-download-overlay__panel" :style="panelStyle">
      <div class="embedos-download-overlay__progress" :style="progressStyle">
        <div class="embedos-download-overlay__track" :style="trackStyle">
          <div class="embedos-download-overlay__fill" :style="fillStyle"></div>
        </div>
      </div>
      <div class="embedos-download-overlay__summary" :style="summaryStyle">
        <p class="embedos-download-overlay__bytes" :style="bytesStyle">{{ bytesText }}</p>
        <p class="embedos-download-overlay__percent" :style="percentStyle">{{ percentText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { EmbedosTerminalTheme } from "../../../core/index.ts";

const props = defineProps<{
  bytesLoaded: number;
  bytesTotal: number;
  message: string | null;
  percent: number;
  theme: EmbedosTerminalTheme | null;
}>();

const fallbackTheme = {
  background: "rgb(17 24 39)",
  foreground: "rgb(243 244 246)",
};

const resolvedTheme = computed(() => ({
  background: props.theme?.background ?? fallbackTheme.background,
  foreground: props.theme?.foreground ?? fallbackTheme.foreground,
}));
function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KiB", "MiB", "GiB"];
  let unitIndex = 0;
  let size = value;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

const roundedPercent = computed(() => Math.max(0, Math.min(100, Math.round(props.percent))));
const percentText = computed(() => `${roundedPercent.value}%`);
const bytesText = computed(
  () => `${formatBytes(props.bytesLoaded)} / ${formatBytes(props.bytesTotal)}`,
);
const overlayStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  backgroundColor: resolvedTheme.value.background,
  color: resolvedTheme.value.foreground,
  display: "flex",
  height: "100%",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
  width: "100%",
}));
const panelStyle = computed<CSSProperties>(() => ({
  backdropFilter: "blur(10px)",
  backgroundColor: "color-mix(in srgb, transparent 22%, black)",
  borderRadius: "1.5rem",
  display: "grid",
  gap: "1.25rem",
  maxWidth: "min(34rem, calc(100vw - 3rem))",
  padding: "1.5rem",
  width: "min(34rem, calc(100vw - 3rem))",
}));
const progressStyle = computed<CSSProperties>(() => ({
  display: "flex",
}));
const trackStyle = computed<CSSProperties>(() => ({
  backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)",
  borderRadius: "9999px",
  height: "0.625rem",
  overflow: "hidden",
  width: "100%",
}));
const fillStyle = computed<CSSProperties>(() => ({
  backgroundColor: resolvedTheme.value.foreground,
  borderRadius: "9999px",
  height: "100%",
  transition: "width 120ms linear",
  width: `${roundedPercent.value}%`,
}));
const summaryStyle = computed<CSSProperties>(() => ({
  alignItems: "baseline",
  display: "flex",
  gap: "1rem",
  justifyContent: "space-between",
}));
const bytesStyle = computed<CSSProperties>(() => ({
  fontFamily: "monospace",
  fontSize: "clamp(0.9rem, 1.7vw, 1rem)",
  lineHeight: "1.35",
  margin: "0",
  opacity: "0.92",
}));
const percentStyle = computed<CSSProperties>(() => ({
  fontFamily: "monospace",
  fontSize: "clamp(1.5rem, 3vw, 2rem)",
  fontWeight: "700",
  lineHeight: "1",
  margin: "0",
  minWidth: "4ch",
  textAlign: "right",
  whiteSpace: "nowrap",
}));
</script>
