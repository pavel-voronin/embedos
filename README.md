# Embedos

Embedos is a platform for embedding Linux userland into HTML using the CheerpX engine.

## Packages

- `@embedos/vue` - terminal component, `defineRecipe`, theme helpers.
- `@embedos/vite` - Vite build plugin.
- `@embedos/debian-bullseye-busybox-runtime` - ready runtime with a shipped BusyBox rootfs.
- `@embedos/debian-bullseye-busybox-recipe` - recipe input for building that runtime from a Dockerfile.
- `@embedos/debian-bullseye-busybox-image-recipe` - recipe input for building that runtime from a prebuilt image.

## Install

```bash
npm i @embedos/vue @embedos/vite @embedos/debian-bullseye-busybox-runtime
```

## Use

```vue
<script setup lang="ts">
import { defineRecipe, EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "@embedos/debian-bullseye-busybox-runtime";

const recipe = defineRecipe(debianBullseyeBusyboxRuntime, (base) => ({
  ...base,
  id: "my-recipe",
  run: ["printf 'hello world\\n'; exec /bin/sh -i"],
}));
</script>

<template>
  <EmbedosTerminal :config="recipe" />
</template>
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { embedosVitePlugin } from "@embedos/vite";

export default defineConfig({
  plugins: [vue(), embedosVitePlugin()],
});
```

## GitHub Pages

Use the upstream [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) file as a static asset.

`index.html`:

```html
<script>
  window.coi = { quiet: true };
</script>
<script src="%BASE_URL%coi-serviceworker.js"></script>
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { embedosVitePlugin } from "@embedos/vite";

export default defineConfig({
  base: "/<repo-name>/",
  plugins: [vue(), embedosVitePlugin()],
});
```

Render `EmbedosTerminal` only after `window.crossOriginIsolated` is true.

## CDN / prebuilt runtime

Use a resolved runtime package directly and skip the Vite plugin.

```bash
npm i @embedos/vue @embedos/debian-bullseye-busybox-runtime
```

```vue
<script setup lang="ts">
import { EmbedosTerminal } from "@embedos/vue";
import { debianBullseyeBusyboxRuntime } from "@embedos/debian-bullseye-busybox-runtime";
</script>

<template>
  <EmbedosTerminal :config="debianBullseyeBusyboxRuntime" />
</template>
```

Use only runtime configs whose `source.kind` is already `url`.
