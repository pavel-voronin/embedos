<template>
  <section class="dual-lazy-terminal-pane">
    <div class="dual-lazy-terminal-pane__surface">
      <TerminalFrame
        :background-color="backgroundColor"
        :frame-enabled="frameEnabled"
        variant="adaptive"
      >
        <EmbedosTerminal
          :auto-start="false"
          :config="config"
          :reset-overlay-on-start="true"
          :storage-key="storageKey"
          :terminal="terminal"
        >
          <template #invite="{ launch, theme }">
            <CdnLazyLaunchOverlay :theme="resolveLaunchTheme(theme)" @launch="launch" />
          </template>
          <template #initializing="{ theme }">
            <CdnLazyInitializingOverlay :theme="theme" />
          </template>
        </EmbedosTerminal>
      </TerminalFrame>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { EmbedosTerminal } from "@embedos/vue";
import type {
  EmbedosRecipe,
  EmbedosTerminalOptions,
  EmbedosTerminalTheme,
} from "../../../packages/core/index.ts";
import TerminalFrame from "../../components/TerminalFrame.vue";
import CdnLazyInitializingOverlay from "../../cdn-lazy/components/CdnLazyInitializingOverlay.vue";
import CdnLazyLaunchOverlay from "../../cdn-lazy/components/CdnLazyLaunchOverlay.vue";

const props = defineProps<{
  backgroundColor?: string;
  config: EmbedosRecipe;
  frameEnabled: boolean;
  storageKey: string;
  terminal: EmbedosTerminalOptions;
}>();

const fallbackTheme = computed<{ background: string; foreground: string }>(() => ({
  background: props.backgroundColor ?? "rgb(39 40 34)",
  foreground: "rgb(248 248 242)",
}));

function resolveLaunchTheme(theme: EmbedosTerminalTheme | null | undefined): {
  background: string;
  foreground: string;
} {
  return {
    background: theme?.background ?? fallbackTheme.value.background,
    foreground: theme?.foreground ?? fallbackTheme.value.foreground,
  };
}
</script>

<style scoped>
@reference "../../tailwind-theme.css";

.dual-lazy-terminal-pane {
  @apply h-full min-h-0 overflow-hidden;
}

.dual-lazy-terminal-pane__surface {
  @apply h-full min-h-0;
}

:deep(.embedos-terminal-surface) {
  @apply border-transparent;
}
</style>
