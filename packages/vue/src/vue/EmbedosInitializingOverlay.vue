<template>
  <div
    aria-label="Initializing"
    class="embedos-initializing-overlay"
    :style="overlayStyle"
    role="status"
  >
    <div class="embedos-initializing-overlay__indicator" :style="indicatorStyle">
      <svg
        aria-hidden="true"
        class="embedos-initializing-overlay__dots"
        :style="dotsStyle"
        viewBox="0 0 120 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="6" :fill="resolvedTheme.foreground">
          <animate
            attributeName="opacity"
            begin="0s"
            dur="0.9s"
            repeatCount="indefinite"
            values="0.25;1;0.25"
          />
        </circle>
        <circle cx="60" cy="12" r="6" :fill="resolvedTheme.foreground">
          <animate
            attributeName="opacity"
            begin="0.15s"
            dur="0.9s"
            repeatCount="indefinite"
            values="0.25;1;0.25"
          />
        </circle>
        <circle cx="108" cy="12" r="6" :fill="resolvedTheme.foreground">
          <animate
            attributeName="opacity"
            begin="0.3s"
            dur="0.9s"
            repeatCount="indefinite"
            values="0.25;1;0.25"
          />
        </circle>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { EmbedosTerminalTheme } from "../../../core/index.ts";

const props = defineProps<{
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
const indicatorStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: "1.5rem",
  minWidth: "7.5rem",
}));
const dotsStyle = computed<CSSProperties>(() => ({
  display: "block",
  height: "1.5rem",
  opacity: "0.9",
  overflow: "visible",
  width: "7.5rem",
}));
</script>
