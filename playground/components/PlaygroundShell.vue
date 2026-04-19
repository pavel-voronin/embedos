<template>
  <div class="playground-shell" :style="shellStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  backgroundColor?: string;
}>();

const shellStyle = computed(() =>
  props.backgroundColor
    ? {
        backgroundColor: props.backgroundColor,
      }
    : undefined,
);
</script>

<style scoped>
@reference "../tailwind-theme.css";

.playground-shell {
  @apply fixed inset-0 grid place-items-center overflow-hidden bg-ui-shell bg-ui-shell-0 p-6;
}
</style>
