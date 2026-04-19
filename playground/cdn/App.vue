<template>
  <PlaygroundDemo
    active="cdn"
    :config="debianBullseyeBusyboxRuntime"
    :reset-overlay-on-start="playgroundResetOverlayOnStart"
    :storage-key="playgroundStorageKey"
    :size-presets="sizePresets"
    :terminal-component="EmbedosTerminal"
    variant="adaptive"
  />
</template>

<script setup lang="ts">
import { EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "./runtime.ts";
import PlaygroundDemo from "../components/PlaygroundDemo.vue";

const sizePresets = [
  { cols: "", label: "auto", rows: "" },
  { cols: "80", label: "80x24", rows: "24" },
  { cols: "120", label: "120x32", rows: "32" },
];

const playgroundResetOverlayOnStart = true;
const playgroundStorageKey = "embedos-playground-cdn-runtime";
</script>
