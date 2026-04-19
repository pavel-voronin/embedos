<template>
  <PlaygroundDemo
    active="recipe"
    :config="playgroundConfig"
    :reset-overlay-on-start="playgroundResetOverlayOnStart"
    :storage-key="playgroundStorageKey"
    :size-presets="sizePresets"
    :terminal-component="EmbedosTerminal"
    variant="fixed"
  />
</template>

<script setup lang="ts">
import { EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRecipe } from "@embedos/debian-bullseye-busybox-recipe";
import PlaygroundDemo from "../components/PlaygroundDemo.vue";
import { createPlaygroundRecipe } from "../shared.js";

const sizePresets = [
  { cols: "", label: "auto", rows: "" },
  { cols: "80", label: "80x24", rows: "24" },
  { cols: "110", label: "110x30", rows: "30" },
];

const playgroundConfig = createPlaygroundRecipe(debianBullseyeBusyboxRecipe);
const playgroundResetOverlayOnStart = true;
const playgroundStorageKey = "embedos-playground-recipe";
</script>
