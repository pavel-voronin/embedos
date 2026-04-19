<template>
  <div class="playground-window" :class="windowClassName" :style="windowStyle">
    <header class="playground-window__topbar">
      <div class="playground-window__traffic" aria-hidden="true">
        <span class="playground-window__traffic-dot playground-window__traffic-dot--close"></span>
        <span
          class="playground-window__traffic-dot playground-window__traffic-dot--minimize"
        ></span>
        <span
          class="playground-window__traffic-dot playground-window__traffic-dot--maximize"
        ></span>
      </div>
      <div class="playground-window__nav">
        <slot name="nav" />
      </div>
      <div class="playground-window__controls">
        <slot name="controls" />
      </div>
    </header>
    <div class="playground-window__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  backgroundColor?: string;
  variant: "adaptive" | "fixed";
}>();

const windowClassName = computed(() => `playground-window--${props.variant}`);
const windowStyle = computed(() =>
  props.backgroundColor
    ? {
        backgroundColor: props.backgroundColor,
        backgroundImage: "none",
      }
    : undefined,
);
</script>

<style scoped>
@reference "../tailwind-theme.css";

.playground-window {
  @apply grid h-[min(90vh,900px)] max-h-full w-[min(90vw,1400px)] max-w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[4px] border border-ui-border/80 shadow-[0_22px_60px_rgb(2_6_23_/_0.42),inset_0_1px_0_rgb(255_255_255_/_0.06)] backdrop-blur-[16px];
}

.playground-window--adaptive {
  @apply bg-ui-window-adaptive;
}

.playground-window--fixed {
  @apply bg-ui-window-fixed;
}

.playground-window__topbar {
  @apply relative flex h-10 flex-nowrap items-center justify-between gap-2.5 border-b border-ui-border-soft/90 bg-ui-topbar px-2.5 py-0;
}

.playground-window__traffic {
  @apply flex gap-2;
}

.playground-window__traffic-dot {
  @apply h-2.5 w-2.5 rounded-full;
}

.playground-window__traffic-dot--close {
  @apply bg-ui-dot-close;
}

.playground-window__traffic-dot--minimize {
  @apply bg-ui-dot-minimize;
}

.playground-window__traffic-dot--maximize {
  @apply bg-ui-dot-maximize;
}

.playground-window__nav {
  @apply flex flex-none items-center self-center;
}

.playground-window__controls {
  @apply ml-auto flex flex-none items-center self-center gap-1.5;
}

.playground-window__body {
  @apply grid min-h-0 grid-rows-[minmax(0,1fr)] p-0;
}
</style>
