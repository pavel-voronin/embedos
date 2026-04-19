<template>
  <PlaygroundShell :background-color="selectedTheme.background">
    <PlaygroundWindow :background-color="selectedTheme.background" variant="adaptive">
      <template #nav>
        <PlaygroundNav :active="active" :items="playgroundNavItems" />
      </template>
      <template #controls>
        <ThemeMenu v-model="theme" />
        <SizeMenu
          :cols="fixedCols"
          :current-cols="currentSize.cols"
          :current-rows="currentSize.rows"
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

      <TerminalFrame
        :background-color="terminalBackgroundColor"
        :frame-enabled="frameEnabled"
        variant="adaptive"
      >
        <component
          :is="EmbedosTerminal"
          :auto-fetch="false"
          :config="debianBullseyeBusyboxRuntime"
          :reset-overlay-on-start="true"
          :terminal="terminalOptions"
          @resize="handleResize"
        >
          <template #invite="{ launch }">
            <CdnLazyLaunchOverlay :theme="resolvedTheme" @launch="launch" />
          </template>
          <template #initializing="{ theme: initializingTheme }">
            <CdnLazyInitializingOverlay :theme="initializingTheme" />
          </template>
        </component>
      </TerminalFrame>
    </PlaygroundWindow>
  </PlaygroundShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PlaygroundNav from "../components/PlaygroundNav.vue";
import PlaygroundShell from "../components/PlaygroundShell.vue";
import PlaygroundWindow from "../components/PlaygroundWindow.vue";
import SizeMenu from "../components/SizeMenu.vue";
import TerminalFrame from "../components/TerminalFrame.vue";
import ThemeMenu from "../components/ThemeMenu.vue";
import { usePlaygroundPreferences } from "../composables/usePlaygroundPreferences.js";
import { playgroundNavItems } from "../shared.ts";
import CdnLazyInitializingOverlay from "./components/CdnLazyInitializingOverlay.vue";
import CdnLazyLaunchOverlay from "./components/CdnLazyLaunchOverlay.vue";
import { EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "../cdn/runtime.ts";
import { defaultTerminalSettings } from "@embedos/vue";

const sizePresets = [
  { cols: "", label: "auto", rows: "" },
  { cols: "80", label: "80x24", rows: "24" },
  { cols: "120", label: "120x32", rows: "32" },
];

const active = "cdn-lazy";

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
const currentSize = ref({ cols: 0, rows: 0 });

const terminalOptions = computed(() => ({
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
const selectedTheme = (defaultTerminalSettings.theme ?? {
  background: "#000000",
  foreground: "#ffffff",
}) as { background: string; foreground: string };
const resolvedTheme = computed(
  () => (theme.value ?? selectedTheme) as { background: string; foreground: string },
);
const terminalBackgroundColor = computed(() => theme.value?.background ?? selectedTheme.background);

function toFixedAxis(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function handleResize(size: { cols: number; rows: number }): void {
  currentSize.value = size;
}
</script>
