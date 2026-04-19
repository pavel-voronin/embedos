<template>
  <main class="cdn-plain" :style="pageStyle">
    <EmbedosTerminal
      class="cdn-plain__shell"
      :auto-fetch="false"
      :config="debianBullseyeBusyboxRuntime"
      :terminal="terminalOptions"
    />
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { themes } from "../../packages/core/index.ts";

// prettier-ignore
import { EmbedosTerminal, defaultTerminalSettings } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "../cdn/runtime.ts";

const selectedTheme = themes.monokai;

const terminalOptions = computed(() => ({
  ...defaultTerminalSettings,
  theme: selectedTheme,
}));

const pageStyle = computed(() => ({
  "--cdn-plain-background": selectedTheme.background,
}));
</script>

<style scoped>
@reference "../tailwind-theme.css";

.cdn-plain {
  @apply fixed inset-0 overflow-hidden bg-[var(--cdn-plain-background)];
}

.cdn-plain__shell {
  @apply h-full w-full;
}
</style>
