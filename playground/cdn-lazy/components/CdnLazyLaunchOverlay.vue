<template>
  <button
    class="cdn-lazy-launch-overlay"
    aria-label="Download and launch"
    :style="overlayStyle"
    type="button"
    @click="$emit('launch')"
  >
    <span class="cdn-lazy-launch-overlay__marker">
      <IconPlay aria-hidden="true" class="cdn-lazy-launch-overlay__play" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import IconPlay from "~icons/streamline-ultimate-color/button-play-1";

const props = defineProps<{
  theme: {
    background: string;
    foreground: string;
  };
}>();

defineEmits<{
  launch: [];
}>();

const overlayStyle = computed(() => ({
  "--cdn-lazy-overlay-bg": props.theme.background,
  "--cdn-lazy-overlay-fg": props.theme.foreground,
}));
</script>

<style scoped>
@reference "../../tailwind-theme.css";

.cdn-lazy-launch-overlay {
  @apply flex h-full w-full items-center justify-center bg-[var(--cdn-lazy-overlay-bg)] text-[var(--cdn-lazy-overlay-fg)] pointer-events-auto;
}

.cdn-lazy-launch-overlay__marker {
  @apply relative flex items-center justify-center;
}

.cdn-lazy-launch-overlay__play {
  @apply h-[min(44vw,24rem)] w-[min(44vw,24rem)] text-[var(--cdn-lazy-overlay-fg)];
}

.cdn-lazy-launch-overlay__marker :deep(svg) {
  @apply block;
}
</style>
