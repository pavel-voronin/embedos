<template>
  <nav class="playground-nav">
    <PlaygroundCapsule
      v-for="item in primaryItems"
      :key="item.href"
      :active="item.key === active"
      :href="item.href"
      tone="nav"
    >
      {{ item.label }}
    </PlaygroundCapsule>
    <details
      v-if="auxiliaryItems.length > 0"
      ref="dropdownRef"
      class="playground-nav__dropdown"
      :open="isDropdownOpen"
      @toggle="handleDropdownToggle"
    >
      <summary class="playground-nav__dropdown-trigger" :class="dropdownTriggerClassName">
        <span>More</span>
        <svg
          aria-hidden="true"
          class="playground-nav__dropdown-chevron"
          fill="none"
          viewBox="0 0 10 6"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>
      <div class="playground-nav__dropdown-menu">
        <PlaygroundCapsule
          v-for="item in auxiliaryItems"
          :key="item.href"
          :active="item.key === active"
          :href="item.href"
          tone="nav"
          @click="closeDropdown"
        >
          {{ item.label }}
        </PlaygroundCapsule>
      </div>
    </details>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PlaygroundCapsule from "./PlaygroundCapsule.vue";

interface PlaygroundNavItem {
  auxiliary?: boolean;
  href: string;
  key: string;
  label: string;
}

const props = defineProps<{
  active: string;
  items: readonly PlaygroundNavItem[];
}>();

const basePrimaryItems = computed(() => props.items.filter((item) => !item.auxiliary));
const baseAuxiliaryItems = computed(() => props.items.filter((item) => item.auxiliary));
const activeAuxiliaryItem = computed(
  () => baseAuxiliaryItems.value.find((item) => item.key === props.active) ?? null,
);
const displacedPrimaryItem = computed(() =>
  activeAuxiliaryItem.value ? basePrimaryItems.value.at(-1) : null,
);
const primaryItems = computed(() => {
  const activeAuxiliary = activeAuxiliaryItem.value;
  if (!activeAuxiliary) {
    return basePrimaryItems.value;
  }

  return [...basePrimaryItems.value.slice(0, -1), activeAuxiliary];
});
const auxiliaryItems = computed(() => {
  const activeAuxiliary = activeAuxiliaryItem.value;
  if (!activeAuxiliary) {
    return baseAuxiliaryItems.value;
  }

  return [
    ...(displacedPrimaryItem.value ? [displacedPrimaryItem.value] : []),
    ...baseAuxiliaryItems.value.filter((item) => item.key !== activeAuxiliary.key),
  ];
});
const isAuxiliaryActive = computed(() => activeAuxiliaryItem.value !== null);
const dropdownRef = ref<HTMLDetailsElement | null>(null);
const isDropdownOpen = ref(false);
const dropdownTriggerClassName = computed(() => ({
  "playground-nav__dropdown-trigger--active": isAuxiliaryActive.value,
}));

function closeDropdown(): void {
  isDropdownOpen.value = false;
}

function handleDropdownToggle(event: Event): void {
  isDropdownOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

function handleDocumentPointerDown(event: PointerEvent): void {
  const dropdown = dropdownRef.value;
  if (!dropdown || !isDropdownOpen.value || !(event.target instanceof Node)) {
    return;
  }

  if (!dropdown.contains(event.target)) {
    closeDropdown();
  }
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeyDown);
});
</script>

<style scoped>
@reference "../tailwind-theme.css";

.playground-nav {
  @apply flex flex-nowrap items-center self-center gap-1.5;
}

.playground-nav__dropdown {
  @apply relative;
}

.playground-nav__dropdown-trigger {
  @apply inline-flex h-6 translate-y-px cursor-pointer list-none items-center gap-1.5 rounded-full border border-ui-border bg-ui-surface px-2.5 py-0 font-mono text-[10px] leading-none tracking-[0.14em] text-ui-text-dim uppercase no-underline transition-colors;
}

.playground-nav__dropdown-trigger:hover,
.playground-nav__dropdown-trigger--active,
.playground-nav__dropdown[open] > .playground-nav__dropdown-trigger {
  @apply border-ui-border-strong bg-ui-surface-hover text-ui-text;
}

.playground-nav__dropdown-trigger::-webkit-details-marker {
  @apply hidden;
}

.playground-nav__dropdown-chevron {
  @apply h-1.5 w-2 transition-transform;
}

.playground-nav__dropdown[open] .playground-nav__dropdown-chevron {
  @apply rotate-180;
}

.playground-nav__dropdown-menu {
  @apply absolute top-8 right-0 z-20 grid min-w-max gap-1.5 rounded-[10px] border border-ui-border bg-ui-panel-strong/95 p-1.5 shadow-[0_18px_48px_rgb(0_0_0_/_0.32)] backdrop-blur-[12px];
}
</style>
