<template>
  <div ref="menuRef" class="theme-menu">
    <PlaygroundCapsule class="theme-menu__trigger" @click="toggleOpen">
      <IconThemeBadge aria-hidden="true" class="theme-menu__trigger-icon" />
      <span class="theme-menu__trigger-label">{{ currentThemeLabel }}</span>
    </PlaygroundCapsule>
    <div v-if="isOpen" class="theme-menu__panel">
      <ul class="theme-menu__list">
        <li v-for="theme in options" :key="theme.value" class="theme-menu__item">
          <button
            class="theme-menu__option"
            :class="{ 'theme-menu__option--active': theme.theme === modelValue }"
            type="button"
            @click="selectTheme(theme.theme)"
          >
            <span class="theme-menu__preview" :style="getThemePreviewStyle(theme.theme)">
              <span>{{ theme.label }}</span>
              <span class="theme-menu__check-slot" aria-hidden="true">
                <IconThemeCheck v-if="theme.theme === modelValue" class="theme-menu__check" />
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import IconThemeBadge from "~icons/streamline-ultimate-color/color-bucket-brush";
import IconThemeCheck from "~icons/streamline-ultimate-color/check";
import { playgroundThemeOptions, playgroundThemes } from "../shared.js";
import type { EmbedosTerminalTheme } from "../../packages/core/index.ts";
import PlaygroundCapsule from "./PlaygroundCapsule.vue";

const props = defineProps<{
  modelValue: EmbedosTerminalTheme;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: EmbedosTerminalTheme];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const options = playgroundThemeOptions.map((option) => ({
  ...option,
  theme: playgroundThemes[option.value],
}));

const currentThemeLabel = computed(
  () => options.find((theme) => theme.theme === props.modelValue)?.label ?? "Custom",
);

function getThemePreviewStyle(theme: EmbedosTerminalTheme) {
  const palette = theme;
  return {
    backgroundColor: palette.background,
    borderColor: palette.blue ?? palette.foreground,
    color: palette.foreground,
  };
}

function toggleOpen(): void {
  isOpen.value = !isOpen.value;
}

function selectTheme(theme: EmbedosTerminalTheme): void {
  emit("update:modelValue", theme);
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

.theme-menu {
  @apply relative flex-none self-center;
}

.theme-menu__trigger {
  @apply gap-1 px-2;
}

.theme-menu__trigger-icon {
  @apply h-4 w-4 shrink-0;
}

.theme-menu__trigger-label {
  @apply leading-none;
}

.theme-menu__panel {
  @apply absolute top-[calc(100%+8px)] right-0 z-10 min-w-[220px] border border-ui-border-strong bg-ui-panel p-2.5 shadow-[0_18px_40px_rgb(2_6_23_/_0.5)];
}

.theme-menu__list {
  @apply m-0 grid list-none gap-1.5 p-0;
}

.theme-menu__option {
  @apply block w-full cursor-pointer bg-transparent p-0 text-left;
}

.theme-menu__option--active {
  @apply bg-transparent;
}

.theme-menu__preview {
  @apply flex w-full items-center justify-between rounded border px-2 py-2 font-mono text-[12px] leading-none normal-case tracking-normal;
}

.theme-menu__check {
  @apply h-4 w-4 shrink-0;
}

.theme-menu__check-slot {
  @apply ml-3 inline-flex h-4 w-4 shrink-0 items-center justify-center;
}
</style>
