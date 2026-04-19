<template>
  <PlaygroundDemo
    active="runtime"
    :config="playgroundConfig"
    :reset-overlay-on-start="playgroundResetOverlayOnStart"
    :storage-key="playgroundStorageKey"
    :size-presets="sizePresets"
    :terminal-component="EmbedosTerminal"
    variant="adaptive"
  />
</template>

<script setup lang="ts">
import { EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "@embedos/debian-bullseye-busybox-runtime";
import PlaygroundDemo from "../components/PlaygroundDemo.vue";
import { createPlaygroundRecipe } from "../shared.js";

const sizePresets = [
  { cols: "", label: "auto", rows: "" },
  { cols: "80", label: "80x24", rows: "24" },
  { cols: "120", label: "120x32", rows: "32" },
];

const playgroundConfig = createPlaygroundRecipe(debianBullseyeBusyboxRuntime);
const playgroundResetOverlayOnStart = true;
const playgroundStorageKey = "embedos-playground-runtime";
</script>
