<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="playground-capsule"
    :class="[
      `playground-capsule--${tone}`,
      {
        'playground-capsule--active': active,
      },
    ]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean;
    href?: string;
    tone?: "control" | "info" | "nav";
  }>(),
  {
    active: false,
    href: undefined,
    tone: "control",
  },
);
</script>

<style scoped>
@reference "../tailwind-theme.css";

.playground-capsule {
  @apply inline-flex h-6 items-center rounded-full border border-ui-border bg-ui-surface px-2.5 py-0 font-mono text-[10px] leading-none tracking-[0.14em] text-ui-text uppercase no-underline transition-colors;
}

.playground-capsule--nav {
  @apply translate-y-px text-ui-text-dim;
}

.playground-capsule--info {
  @apply border-ui-border/55 bg-ui-panel-strong/70 text-ui-text-dim;
}

.playground-capsule--nav:hover,
.playground-capsule--active {
  @apply border-ui-border-strong bg-ui-surface-hover text-ui-text;
}
</style>
