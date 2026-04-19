<template>
  <section class="dual-terminal-pane">
    <div class="dual-terminal-pane__surface">
      <TerminalFrame
        :background-color="backgroundColor"
        :frame-enabled="frameEnabled"
        variant="adaptive"
      >
        <EmbedosTerminal
          :auto-fetch="true"
          :config="config"
          :reset-overlay-on-start="true"
          :storage-key="storageKey"
          :terminal="terminal"
        />
      </TerminalFrame>
    </div>
  </section>
</template>

<script setup lang="ts">
import { EmbedosTerminal } from "@embedos/vue";
import type { EmbedosRecipe, EmbedosTerminalOptions } from "../../../packages/core/index.ts";
import TerminalFrame from "../../components/TerminalFrame.vue";

defineProps<{
  backgroundColor?: string;
  config: EmbedosRecipe;
  frameEnabled: boolean;
  storageKey: string;
  terminal: EmbedosTerminalOptions;
}>();
</script>

<style scoped>
@reference "../../tailwind-theme.css";

.dual-terminal-pane {
  @apply h-full min-h-0 overflow-hidden;
}

.dual-terminal-pane__surface {
  @apply h-full min-h-0;
}

:deep(.embedos-terminal-surface) {
  @apply border-transparent;
}
</style>
