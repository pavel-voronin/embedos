<template>
  <PlaygroundShell :background-color="selectedTheme.background">
    <PlaygroundWindow :background-color="selectedTheme.background" variant="adaptive">
      <template #nav>
        <PlaygroundNav active="dual-lazy" :items="playgroundNavItems" />
      </template>
      <template #controls>
        <ThemeMenu v-model="theme" />
        <SizeMenu
          :cols="fixedCols"
          :current-cols="combinedSize.cols"
          :current-rows="combinedSize.rows"
          :cursor-blink="cursorBlink"
          :cursor-style="cursorStyle"
          :cursor-width="cursorWidth"
          :frame-enabled="frameEnabled"
          :font-family="fontFamily"
          :font-size="fontSize"
          :line-height="lineHeight"
          :presets="sizePresets"
          :rows="fixedRows"
          @reset="resetPreferences"
          @update:cols="fixedCols = $event"
          @update:cursor-blink="cursorBlink = $event"
          @update:cursor-style="cursorStyle = $event"
          @update:cursor-width="cursorWidth = $event"
          @update:frame-enabled="frameEnabled = $event"
          @update:font-family="fontFamily = $event"
          @update:font-size="fontSize = $event"
          @update:line-height="lineHeight = $event"
          @update:rows="fixedRows = $event"
        />
      </template>

      <DualTerminalGrid>
        <template #left>
          <DualLazyTerminalPane
            :background-color="terminalBackgroundColor"
            :config="workspaceConfig"
            :frame-enabled="frameEnabled"
            storage-key="embedos-playground-dual-lazy-workspace"
            :terminal="terminalOptions"
          />
        </template>
        <template #right>
          <DualLazyTerminalPane
            :background-color="terminalBackgroundColor"
            :config="observerConfig"
            :frame-enabled="frameEnabled"
            storage-key="embedos-playground-dual-lazy-observer"
            :terminal="terminalOptions"
          />
        </template>
      </DualTerminalGrid>
    </PlaygroundWindow>
  </PlaygroundShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EmbedosTerminalOptions } from "../../packages/core/index.ts";
import { debianBullseyeBusyboxRuntime } from "@embedos/debian-bullseye-busybox-runtime";
import { defaultTerminalSettings } from "@embedos/vue";
import PlaygroundNav from "../components/PlaygroundNav.vue";
import PlaygroundShell from "../components/PlaygroundShell.vue";
import PlaygroundWindow from "../components/PlaygroundWindow.vue";
import SizeMenu from "../components/SizeMenu.vue";
import ThemeMenu from "../components/ThemeMenu.vue";
import { usePlaygroundPreferences } from "../composables/usePlaygroundPreferences.js";
import {
  createObserverPlaygroundRecipe,
  createPlaygroundRecipe,
  playgroundNavItems,
} from "../shared.js";
import DualTerminalGrid from "../dual/components/DualTerminalGrid.vue";
import DualLazyTerminalPane from "./components/DualLazyTerminalPane.vue";

const sizePresets = [
  { cols: "", label: "auto", rows: "" },
  { cols: "80", label: "80x24", rows: "24" },
  { cols: "120", label: "120x32", rows: "32" },
];

const workspaceConfig = createPlaygroundRecipe(debianBullseyeBusyboxRuntime);
const observerConfig = createObserverPlaygroundRecipe(debianBullseyeBusyboxRuntime);

const {
  cursorBlink,
  cursorStyle,
  cursorWidth,
  fixedCols,
  frameEnabled,
  fontFamily,
  fontSize,
  fixedRows,
  lineHeight,
  resetPreferences,
  theme,
} = usePlaygroundPreferences();

const terminalOptions = computed<EmbedosTerminalOptions>(() => ({
  ...defaultTerminalSettings,
  cols: toFixedAxis(fixedCols.value),
  cursorBlink: cursorBlink.value,
  cursorStyle: cursorStyle.value,
  cursorWidth: cursorWidth.value,
  fontFamily: fontFamily.value,
  fontSize: fontSize.value,
  lineHeight: lineHeight.value,
  rows: toFixedAxis(fixedRows.value),
  theme: theme.value,
}));
const selectedTheme = computed(() => theme.value);
const terminalBackgroundColor = computed(() => theme.value.background);
const combinedSize = computed(() => ({
  cols: toFixedAxis(fixedCols.value) ?? 0,
  rows: toFixedAxis(fixedRows.value) ?? 0,
}));

function toFixedAxis(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
</script>
