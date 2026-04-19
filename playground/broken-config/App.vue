<template>
  <PlaygroundShell :background-color="selectedTheme.background">
    <PlaygroundWindow :background-color="selectedTheme.background" variant="adaptive">
      <template #nav>
        <PlaygroundNav active="broken-config" :items="playgroundNavItems" />
      </template>
      <TerminalFrame
        :background-color="selectedTheme.background"
        :frame-enabled="true"
        variant="adaptive"
      >
        <EmbedosTerminal
          :auto-fetch="false"
          :config="brokenConfig"
          :reset-overlay-on-start="true"
          :terminal="terminalOptions"
        />
      </TerminalFrame>
    </PlaygroundWindow>
  </PlaygroundShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { EmbedosTerminal, defaultTerminalSettings } from "@embedos/vue";
import { themes } from "../../packages/core/index.ts";
import PlaygroundNav from "../components/PlaygroundNav.vue";
import PlaygroundShell from "../components/PlaygroundShell.vue";
import PlaygroundWindow from "../components/PlaygroundWindow.vue";
import TerminalFrame from "../components/TerminalFrame.vue";
import { playgroundNavItems } from "../shared.js";

const selectedTheme = themes.monokai;
const brokenConfig = {
  id: "broken-config",
} as never;
const terminalOptions = computed(() => ({
  ...defaultTerminalSettings,
  theme: selectedTheme,
}));
</script>
