<template>
  <PlaygroundShell :background-color="selectedTheme.background">
    <PlaygroundWindow :background-color="selectedTheme.background" :variant="variant">
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
        :variant="variant"
      >
        <component
          :is="terminalComponent"
          :auto-start="true"
          :config="config"
          :reset-overlay-on-start="resetOverlayOnStart"
          :storage-key="storageKey"
          :terminal="terminalOptions"
          @resize="handleResize"
        />
      </TerminalFrame>
    </PlaygroundWindow>
  </PlaygroundShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PlaygroundNav from "./PlaygroundNav.vue";
import PlaygroundShell from "./PlaygroundShell.vue";
import PlaygroundWindow from "./PlaygroundWindow.vue";
import SizeMenu from "./SizeMenu.vue";
import TerminalFrame from "./TerminalFrame.vue";
import ThemeMenu from "./ThemeMenu.vue";
import { defaultTerminalSettings } from "@embedos/vue";
import { usePlaygroundPreferences } from "../composables/usePlaygroundPreferences.js";
import { playgroundNavItems } from "../shared.js";
import type { Component } from "vue";

interface SizePreset {
  cols: string;
  label: string;
  rows: string;
}

const props = defineProps<{
  active: string;
  config: unknown;
  resetOverlayOnStart?: boolean;
  storageKey?: string;
  sizePresets: SizePreset[];
  terminalComponent: Component;
  variant: "adaptive" | "fixed";
}>();

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
const selectedTheme = computed(() => theme.value);
const terminalBackgroundColor = computed(() => theme.value.background);

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
