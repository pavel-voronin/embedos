<template>
  <button
    class="embedos-invite-overlay"
    :aria-label="ariaLabel"
    :style="overlayStyle"
    type="button"
    @click="$emit('launch')"
  >
    <span class="embedos-invite-overlay__marker">
      <svg
        aria-hidden="true"
        class="embedos-invite-overlay__play"
        fill="none"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="32" cy="32" fill="currentColor" fill-opacity="0.18" r="30" />
        <circle cx="32" cy="32" r="26" stroke="currentColor" stroke-width="4" />
        <path d="M26 20L46 32L26 44V20Z" fill="currentColor" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { EmbedosTerminalTheme } from "../../../core/index.ts";

const props = defineProps<{
  theme: EmbedosTerminalTheme | null;
}>();

defineEmits<{
  launch: [];
}>();

const fallbackTheme = {
  background: "rgb(17 24 39)",
  foreground: "rgb(243 244 246)",
};

const ariaLabel = "Download and launch";
const resolvedTheme = computed(() => ({
  background: props.theme?.background ?? fallbackTheme.background,
  foreground: props.theme?.foreground ?? fallbackTheme.foreground,
}));
const overlayStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  backgroundColor: resolvedTheme.value.background,
  border: "0",
  color: resolvedTheme.value.foreground,
  display: "flex",
  height: "100%",
  justifyContent: "center",
  margin: "0",
  padding: "0",
  pointerEvents: "auto",
  width: "100%",
}));
</script>

<style scoped>
.embedos-invite-overlay {
  cursor: pointer;
}

.embedos-invite-overlay__marker {
  align-items: center;
  display: flex;
  justify-content: center;
  position: relative;
}

.embedos-invite-overlay__play {
  height: min(44vw, 24rem);
  width: min(44vw, 24rem);
}
</style>
