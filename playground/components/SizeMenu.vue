<template>
  <div ref="menuRef" class="size-menu">
    <PlaygroundCapsule class="size-menu__trigger" @click="toggleOpen">
      <IconSizeBadge aria-hidden="true" class="size-menu__trigger-icon" />
      <span class="size-menu__trigger-label">
        {{ currentCols }}<span class="size-menu__trigger-separator">x</span>{{ currentRows }}
      </span>
    </PlaygroundCapsule>
    <div v-if="isOpen" class="size-menu__panel">
      <header class="size-menu__header">
        <p class="size-menu__title">Settings</p>
        <button class="size-menu__reset-link" type="button" @click="resetDefaults">
          Reset defaults
        </button>
      </header>
      <section class="size-menu__section">
        <p class="size-menu__section-title">Viewport</p>
        <div class="size-menu__fields size-menu__fields--pair">
          <label class="size-menu__field">
            <span class="size-menu__field-label">Current</span>
            <output class="size-menu__readout">{{ currentCols }}x{{ currentRows }}</output>
          </label>
          <label class="size-menu__field">
            <span class="size-menu__field-label">Frame</span>
            <button
              class="size-menu__toggle-button"
              :class="{ 'size-menu__toggle-button--active': frameEnabled }"
              type="button"
              @click="toggleFrame"
            >
              <span class="size-menu__toggle-thumb"></span>
              <span class="size-menu__toggle-text">{{ frameEnabled ? "On" : "Off" }}</span>
            </button>
          </label>
        </div>
        <div class="size-menu__fields size-menu__fields--pair">
          <label class="size-menu__field">
            <span class="size-menu__field-label">Cols</span>
            <input
              :value="cols"
              class="size-menu__input"
              inputmode="numeric"
              min="2"
              placeholder="auto"
              step="1"
              type="number"
              @input="updateCols"
            />
          </label>
          <label class="size-menu__field">
            <span class="size-menu__field-label">Rows</span>
            <input
              :value="rows"
              class="size-menu__input"
              inputmode="numeric"
              min="1"
              placeholder="auto"
              step="1"
              type="number"
              @input="updateRows"
            />
          </label>
        </div>
        <div class="size-menu__presets">
          <button
            v-for="preset in presets"
            :key="preset.label"
            class="size-menu__preset"
            type="button"
            @click="applyPreset(preset.cols, preset.rows)"
          >
            {{ preset.label }}
          </button>
        </div>
      </section>

      <section class="size-menu__section">
        <p class="size-menu__section-title">Typography</p>
        <label class="size-menu__field">
          <span class="size-menu__field-label">Font family</span>
          <input
            :value="fontFamily"
            class="size-menu__input size-menu__input--wide"
            placeholder='"BlexMono Nerd Font Mono", "PT Mono", monospace'
            type="text"
            @input="updateFontFamily"
          />
        </label>
        <div class="size-menu__fields size-menu__fields--pair">
          <label class="size-menu__field">
            <span class="size-menu__field-label">Font size</span>
            <input
              :value="fontSize"
              class="size-menu__input"
              inputmode="decimal"
              min="8"
              step="0.5"
              type="number"
              @input="updateFontSize"
            />
          </label>
          <label class="size-menu__field">
            <span class="size-menu__field-label">Line height</span>
            <input
              :value="lineHeight"
              class="size-menu__input"
              inputmode="decimal"
              min="1"
              step="0.05"
              type="number"
              @input="updateLineHeight"
            />
          </label>
        </div>
      </section>

      <section class="size-menu__section">
        <p class="size-menu__section-title">Cursor</p>
        <div class="size-menu__fields size-menu__fields--pair">
          <label class="size-menu__field">
            <span class="size-menu__field-label">Blink</span>
            <button
              class="size-menu__toggle-button"
              :class="{ 'size-menu__toggle-button--active': cursorBlink }"
              type="button"
              @click="toggleCursorBlink"
            >
              <span class="size-menu__toggle-thumb"></span>
              <span class="size-menu__toggle-text">{{ cursorBlink ? "On" : "Off" }}</span>
            </button>
          </label>
          <label class="size-menu__field">
            <span class="size-menu__field-label">Style</span>
            <select :value="cursorStyle" class="size-menu__select" @change="updateCursorStyle">
              <option
                v-for="option in cursorStyleOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
        <label class="size-menu__field">
          <span class="size-menu__field-label">Width</span>
          <input
            :value="cursorWidth"
            class="size-menu__input"
            inputmode="decimal"
            min="1"
            step="1"
            type="number"
            @input="updateCursorWidth"
          />
        </label>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import IconSizeBadge from "~icons/streamline-ultimate-color/direction-button-2";
import { playgroundCursorStyleOptions } from "../shared.js";
import PlaygroundCapsule from "./PlaygroundCapsule.vue";

interface SizePreset {
  cols: string;
  label: string;
  rows: string;
}

const props = defineProps<{
  cols: string;
  currentCols: number;
  currentRows: number;
  cursorBlink: boolean;
  cursorStyle: "bar" | "block" | "underline";
  cursorWidth: number;
  frameEnabled: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  presets: SizePreset[];
  rows: string;
}>();

const emit = defineEmits<{
  "update:cols": [value: string];
  "update:cursorBlink": [value: boolean];
  "update:cursorStyle": [value: "bar" | "block" | "underline"];
  "update:cursorWidth": [value: number];
  "update:frameEnabled": [value: boolean];
  "update:fontFamily": [value: string];
  "update:fontSize": [value: number];
  "update:lineHeight": [value: number];
  "update:rows": [value: string];
  reset: [];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const cursorStyleOptions = playgroundCursorStyleOptions;

function toggleOpen(): void {
  isOpen.value = !isOpen.value;
}

function updateCols(event: Event): void {
  emit("update:cols", (event.target as HTMLInputElement).value);
}

function updateRows(event: Event): void {
  emit("update:rows", (event.target as HTMLInputElement).value);
}

function updateFontFamily(event: Event): void {
  emit("update:fontFamily", (event.target as HTMLInputElement).value);
}

function updateFontSize(event: Event): void {
  emit("update:fontSize", readNumericInput(event, props.fontSize));
}

function updateLineHeight(event: Event): void {
  emit("update:lineHeight", readNumericInput(event, props.lineHeight));
}

function applyPreset(cols: string, rows: string): void {
  emit("update:cols", cols);
  emit("update:rows", rows);
}

function resetDefaults(): void {
  emit("reset");
}

function toggleFrame(): void {
  emit("update:frameEnabled", !props.frameEnabled);
}

function toggleCursorBlink(): void {
  emit("update:cursorBlink", !props.cursorBlink);
}

function updateCursorStyle(event: Event): void {
  emit(
    "update:cursorStyle",
    (event.target as HTMLSelectElement).value as "bar" | "block" | "underline",
  );
}

function updateCursorWidth(event: Event): void {
  emit("update:cursorWidth", readNumericInput(event, props.cursorWidth));
}

function readNumericInput(event: Event, fallbackValue: number): number {
  const parsed = Number((event.target as HTMLInputElement).value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) {
    isOpen.value = false;
    return;
  }

  if (menuRef.value && !menuRef.value.contains(target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<style scoped>
@reference "../tailwind-theme.css";

.size-menu {
  @apply relative flex-none self-center;
}

.size-menu__trigger {
  @apply gap-1 px-2;
}

.size-menu__trigger-icon {
  @apply h-4 w-4 shrink-0;
}

.size-menu__trigger-label {
  @apply leading-none;
}

.size-menu__trigger-separator {
  @apply text-[0.8em] lowercase;
}

.size-menu__panel {
  @apply absolute top-[calc(100%+8px)] right-0 z-10 grid min-w-[280px] gap-3 border border-ui-border-strong bg-ui-panel p-3 shadow-[0_18px_40px_rgb(2_6_23_/_0.5)];
}

.size-menu__header {
  @apply flex items-center justify-between gap-3;
}

.size-menu__title {
  @apply m-0 font-mono text-[10px] tracking-[0.16em] text-ui-text uppercase;
}

.size-menu__reset-link {
  @apply cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] leading-none tracking-[0.12em] text-ui-text-dim uppercase underline decoration-ui-border decoration-dotted underline-offset-4 transition-colors;
}

.size-menu__reset-link:hover {
  @apply text-ui-text decoration-ui-accent;
}

.size-menu__section {
  @apply grid gap-2;
}

.size-menu__section-title {
  @apply m-0 font-mono text-[10px] tracking-[0.16em] text-ui-text uppercase;
}

.size-menu__fields {
  @apply grid gap-2;
}

.size-menu__fields--pair {
  @apply grid-cols-2;
}

.size-menu__field {
  @apply inline-grid gap-1;
}

.size-menu__field-label {
  @apply font-mono text-[9px] tracking-[0.12em] text-ui-text-dim uppercase;
}

.size-menu__input {
  @apply w-[74px] min-w-[74px] rounded-[8px] border border-ui-border bg-ui-panel-strong px-[9px] py-[7px] font-mono text-[12px] leading-none text-ui-text outline-none;
}

.size-menu__input--wide {
  @apply w-full min-w-0;
}

.size-menu__input::placeholder {
  @apply text-ui-text-dim;
}

.size-menu__input:focus,
.size-menu__select:focus {
  @apply border-ui-accent outline outline-1 outline-ui-accent;
}

.size-menu__select {
  @apply w-full rounded-[8px] border border-ui-border bg-ui-panel-strong px-[9px] py-[7px] font-mono text-[12px] leading-none text-ui-text outline-none;
}

.size-menu__readout {
  @apply inline-flex h-8 items-center rounded-[8px] border border-ui-border bg-ui-panel-strong px-[9px] font-mono text-[12px] leading-none text-ui-text;
}

.size-menu__toggle-button {
  @apply inline-flex h-8 items-center gap-2 rounded-[8px] border border-ui-border bg-ui-panel-strong px-2 text-ui-text-dim transition-colors;
}

.size-menu__toggle-button--active {
  @apply border-ui-accent text-ui-text;
}

.size-menu__toggle-thumb {
  @apply h-3 w-3 rounded-full bg-ui-border;
}

.size-menu__toggle-button--active .size-menu__toggle-thumb {
  @apply bg-ui-accent;
}

.size-menu__toggle-text {
  @apply font-mono text-[12px] leading-none uppercase tracking-[0.08em];
}

.size-menu__presets {
  @apply flex flex-wrap gap-1.5;
}

.size-menu__preset {
  @apply cursor-pointer rounded-full border border-ui-border bg-ui-surface-strong px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] text-ui-text-muted uppercase transition-colors;
}

.size-menu__preset:hover {
  @apply border-ui-accent text-ui-text;
}
</style>
