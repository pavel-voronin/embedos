<template>
  <div class="terminal-frame" :class="terminalFrameClassName" :style="terminalFrameStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  backgroundColor?: string;
  frameEnabled?: boolean;
  variant: "adaptive" | "fixed";
}>();

const terminalFrameClassName = computed(() => [
  `terminal-frame--${props.variant}`,
  props.frameEnabled === false ? "terminal-frame--frameless" : "terminal-frame--framed",
]);
const terminalFrameStyle = computed(() =>
  props.backgroundColor
    ? {
        backgroundColor: props.backgroundColor,
        backgroundImage: "none",
        "--playground-terminal-bg": props.backgroundColor,
      }
    : undefined,
);
</script>

<style scoped>
@reference "../tailwind-theme.css";

.terminal-frame {
  @apply relative h-full w-full overflow-hidden rounded-none border-0 shadow-none;
}

.terminal-frame--adaptive {
  @apply bg-ui-frame-adaptive bg-ui-frame-adaptive;
}

.terminal-frame--fixed {
  @apply bg-ui-frame-fixed bg-ui-frame-fixed;
}

:deep(.embedos-terminal),
:deep(.embedos-terminal__viewport) {
  @apply h-full w-full overflow-hidden bg-[var(--playground-terminal-bg)];
}

:deep(.embedos-terminal-surface) {
  @apply box-border border border-white/80;
}

.terminal-frame--frameless :deep(.embedos-terminal-surface) {
  @apply border-transparent;
}

:deep(.xterm) {
  @apply box-border h-full w-full bg-[var(--playground-terminal-bg)] p-1.5;
}

:deep(.xterm-viewport),
:deep(.xterm-scroll-area) {
  @apply bg-[var(--playground-terminal-bg)];
}
</style>
