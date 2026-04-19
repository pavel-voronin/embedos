import { defineRecipe, themes } from "../packages/core/index.ts";
import { createPlaygroundOverlayFiles } from "./catalog.ts";
import type { EmbedosConfigOverlayFile, EmbedosRecipe } from "../packages/core/index.ts";

export const playgroundThemes = themes;

export const playgroundThemeOptions = [
  { label: "Monokai", value: "monokai" },
  { label: "Dracula", value: "dracula" },
  { label: "Nord", value: "nord" },
  { label: "Solarized", value: "solarizedDark" },
  { label: "Catppuccin", value: "catppuccin" },
] as const;

export type PlaygroundThemeKey = keyof typeof playgroundThemes;

export const playgroundNavItems = [
  { href: "/recipe/", key: "recipe", label: "Recipe" },
  { href: "/image/", key: "image", label: "Image" },
  { href: "/runtime/", key: "runtime", label: "Runtime" },
  { href: "/dual/", key: "dual", label: "Dual" },
  { href: "/cdn/", key: "cdn", label: "CDN" },
  { auxiliary: true, href: "/dual-lazy/", key: "dual-lazy", label: "Dual Lazy" },
  { auxiliary: true, href: "/broken-config/", key: "broken-config", label: "Broken Config" },
  { auxiliary: true, href: "/cdn-plain/", key: "cdn-plain", label: "CDN Plain" },
  { auxiliary: true, href: "/cdn-lazy/", key: "cdn-lazy", label: "CDN Lazy" },
] as const;

export interface PlaygroundPreferences {
  cols: string;
  cursorBlink: boolean;
  cursorStyle: "bar" | "block" | "underline";
  cursorWidth: number;
  frameEnabled: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  rows: string;
  theme: PlaygroundThemeKey;
}

const playgroundPreferencesStorageKey = "embedos-playground-preferences";

export const defaultPlaygroundPreferences: PlaygroundPreferences = {
  cols: "",
  cursorBlink: true,
  cursorStyle: "bar",
  cursorWidth: 2,
  frameEnabled: false,
  fontFamily: '"BlexMono Nerd Font Mono", "PT Mono", monospace',
  fontSize: 15,
  lineHeight: 1.25,
  rows: "",
  theme: "monokai",
};

export function readPlaygroundPreferences(): PlaygroundPreferences {
  if (typeof window === "undefined") {
    return { ...defaultPlaygroundPreferences };
  }

  try {
    const rawValue = window.localStorage.getItem(playgroundPreferencesStorageKey);
    if (!rawValue) {
      return { ...defaultPlaygroundPreferences };
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PlaygroundPreferences>;
    const theme =
      typeof parsedValue.theme === "string" && parsedValue.theme in playgroundThemes
        ? (parsedValue.theme as PlaygroundThemeKey)
        : defaultPlaygroundPreferences.theme;

    return {
      cols:
        typeof parsedValue.cols === "string" ? parsedValue.cols : defaultPlaygroundPreferences.cols,
      cursorBlink:
        typeof parsedValue.cursorBlink === "boolean"
          ? parsedValue.cursorBlink
          : defaultPlaygroundPreferences.cursorBlink,
      cursorStyle:
        parsedValue.cursorStyle === "bar" ||
        parsedValue.cursorStyle === "block" ||
        parsedValue.cursorStyle === "underline"
          ? parsedValue.cursorStyle
          : defaultPlaygroundPreferences.cursorStyle,
      cursorWidth:
        typeof parsedValue.cursorWidth === "number" && Number.isFinite(parsedValue.cursorWidth)
          ? parsedValue.cursorWidth
          : defaultPlaygroundPreferences.cursorWidth,
      frameEnabled:
        typeof parsedValue.frameEnabled === "boolean"
          ? parsedValue.frameEnabled
          : defaultPlaygroundPreferences.frameEnabled,
      fontFamily:
        typeof parsedValue.fontFamily === "string" && parsedValue.fontFamily.trim().length > 0
          ? parsedValue.fontFamily
          : defaultPlaygroundPreferences.fontFamily,
      fontSize:
        typeof parsedValue.fontSize === "number" && Number.isFinite(parsedValue.fontSize)
          ? parsedValue.fontSize
          : defaultPlaygroundPreferences.fontSize,
      lineHeight:
        typeof parsedValue.lineHeight === "number" && Number.isFinite(parsedValue.lineHeight)
          ? parsedValue.lineHeight
          : defaultPlaygroundPreferences.lineHeight,
      rows:
        typeof parsedValue.rows === "string" ? parsedValue.rows : defaultPlaygroundPreferences.rows,
      theme,
    };
  } catch {
    return { ...defaultPlaygroundPreferences };
  }
}

export function writePlaygroundPreferences(nextPreferences: PlaygroundPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(playgroundPreferencesStorageKey, JSON.stringify(nextPreferences));
}

export const playgroundCursorStyleOptions = [
  { label: "Bar", value: "bar" },
  { label: "Block", value: "block" },
  { label: "Underline", value: "underline" },
] as const;

export const playgroundRunCommands = [
  "printf '[embedos] Run fz1 with: fz1\\n'",
  "printf '[embedos] Or press Ctrl+X g to open fz1 and insert the selected command\\n\\n'",
  "fz1 integration bash > /etc/fz1.bash",
  "if ! grep -q 'source /etc/fz1.bash' /root/.bashrc; then",
  "  cat <<'EOF' >> /root/.bashrc",
  "source /etc/fz1.bash",
  "EOF",
  "fi",
  "printf '[embedos] Overlay catalog mounted at /root/.local/share/fz1/catalog\\n'",
  "exec /bin/bash --rcfile /root/.bashrc -i",
] as const;

export const playgroundObserverRunCommands = [
  "printf '[embedos] Run fz1 with: fz1\\n'",
  "printf '[embedos] Or press Ctrl+X g to open fz1 and insert the selected command\\n\\n'",
  "fz1 integration bash > /etc/fz1.bash",
  "printf '[embedos] Overlay catalog mounted at /root/.local/share/fz1/catalog\\n'",
  "exec /bin/bash --rcfile /etc/embedos-observer.bashrc -i",
] as const;

export function createPlaygroundRecipe(parent: EmbedosRecipe): EmbedosRecipe {
  return defineRecipe(parent, (base) => ({
    ...base,
    overlayFiles: [...base.overlayFiles, createPlaygroundOverlayFiles()],
    run: [...playgroundRunCommands],
  }));
}

export function createObserverPlaygroundRecipe(parent: EmbedosRecipe): EmbedosRecipe {
  return defineRecipe(createPlaygroundRecipe(parent), (base) => ({
    ...base,
    overlayFiles: [...base.overlayFiles, createObserverOverlayFiles()],
    run: [...playgroundObserverRunCommands],
  }));
}

function createObserverOverlayFiles(): EmbedosConfigOverlayFile[] {
  return [
    {
      contents: [
        "source /etc/fz1.bash",
        "export PS1='[observer] \\w # '",
        "printf '[embedos] observer shell ready\\n'",
      ].join("\n"),
      path: "/etc/embedos-observer.bashrc",
    },
  ];
}
