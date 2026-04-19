<template>
  <div
    aria-label="Initializing"
    class="cdn-lazy-initializing-overlay"
    :style="overlayStyle"
    role="status"
  >
    <div class="cdn-lazy-initializing-overlay__indicator" :style="indicatorStyle">
      <IconCog aria-hidden="true" class="cdn-lazy-initializing-overlay__icon" :style="iconStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import IconCog from "~icons/streamline-ultimate-color/cog";
import type { EmbedosTerminalTheme } from "../../../packages/core/index.ts";

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
const rotation = ref(0);
const transitionDuration = ref(120);
const overlayStyle = computed(() => ({
  "--cdn-lazy-initializing-bg": resolvedTheme.value.background,
  "--cdn-lazy-initializing-fg": resolvedTheme.value.foreground,
}));
const indicatorStyle = computed(() => ({
  minHeight: "4rem",
  minWidth: "4rem",
}));
const iconStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`,
  transitionDuration: `${transitionDuration.value}ms`,
}));

let tickTimer: number | null = null;

function scheduleNextTick(): void {
  transitionDuration.value = randomBetween(70, 150);
  tickTimer = window.setTimeout(
    () => {
      rotation.value += 15;
      scheduleNextTick();
    },
    randomBetween(90, 220),
  );
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

onMounted(() => {
  scheduleNextTick();
});

onBeforeUnmount(() => {
  if (tickTimer !== null) {
    window.clearTimeout(tickTimer);
    tickTimer = null;
  }
});
</script>

<style scoped>
@reference "../../tailwind-theme.css";

.cdn-lazy-initializing-overlay {
  @apply flex h-full w-full items-center justify-center bg-[var(--cdn-lazy-initializing-bg)] text-[var(--cdn-lazy-initializing-fg)] pointer-events-none select-none;
}

.cdn-lazy-initializing-overlay__indicator {
  @apply flex items-center justify-center;
}

.cdn-lazy-initializing-overlay__icon {
  @apply h-[min(44vw,24rem)] w-[min(44vw,24rem)] text-[var(--cdn-lazy-initializing-fg)] transition-transform ease-linear will-change-transform;
}

.cdn-lazy-initializing-overlay__icon :deep(svg) {
  @apply block;
}
</style>
