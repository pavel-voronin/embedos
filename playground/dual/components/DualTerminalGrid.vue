<template>
  <div class="dual-terminal-grid">
    <div class="dual-terminal-grid__pane">
      <slot name="left" />
    </div>
    <div class="dual-terminal-grid__splitter" aria-hidden="true"></div>
    <div class="dual-terminal-grid__pane">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
@reference "../../tailwind-theme.css";

.dual-terminal-grid {
  @apply grid h-full min-h-0 grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-0 p-0;
}

.dual-terminal-grid__pane {
  @apply min-h-0;
}

.dual-terminal-grid__splitter {
  @apply block bg-ui-border;
}
</style>
