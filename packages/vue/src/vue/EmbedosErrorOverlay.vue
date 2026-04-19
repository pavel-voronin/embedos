<template>
  <div class="embedos-error-overlay" :style="overlayStyle">
    <div class="embedos-error-overlay__content" role="alert">
      <span aria-hidden="true" class="embedos-error-overlay__mark">!</span>
      <p class="embedos-error-overlay__title">{{ titleText }}</p>
      <p class="embedos-error-overlay__message">{{ messageText }}</p>
      <button
        v-if="retryable"
        class="embedos-error-overlay__retry"
        type="button"
        @click="$emit('retry')"
      >
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { EmbedosTerminalTheme } from "../../../core/index.ts";

const props = defineProps<{
  message: string;
  retryable: boolean;
  theme: EmbedosTerminalTheme | null;
  title: string;
}>();

defineEmits<{
  retry: [];
}>();

const fallbackTheme = {
  background: "rgb(17 24 39)",
  foreground: "rgb(243 244 246)",
  red: "rgb(248 113 113)",
};

const resolvedTheme = computed(() => ({
  background: props.theme?.background ?? fallbackTheme.background,
  foreground: props.theme?.foreground ?? fallbackTheme.foreground,
  red: props.theme?.red ?? fallbackTheme.red,
}));
const titleText = computed(() => props.title);
const messageText = computed(() => props.message);
const overlayStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  backgroundColor: resolvedTheme.value.background,
  color: resolvedTheme.value.foreground,
  display: "flex",
  height: "100%",
  justifyContent: "center",
  pointerEvents: "auto",
  width: "100%",
}));
</script>

<style scoped>
.embedos-error-overlay__content {
  display: grid;
  gap: 0.75rem;
  justify-items: center;
  padding: 1.5rem;
  text-align: center;
}

.embedos-error-overlay__mark {
  color: v-bind("resolvedTheme.red");
  font-family: monospace;
  font-size: min(32vw, 18rem);
  line-height: 1;
}

.embedos-error-overlay__title,
.embedos-error-overlay__message,
.embedos-error-overlay__retry {
  font-family: monospace;
  margin: 0;
}

.embedos-error-overlay__title {
  font-size: clamp(1.15rem, 3vw, 1.75rem);
  line-height: 1.25;
}

.embedos-error-overlay__message {
  font-size: clamp(1rem, 2.6vw, 1.35rem);
  line-height: 1.4;
  max-width: min(76vw, 44rem);
}

.embedos-error-overlay__retry {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.75rem 1rem;
}
</style>
