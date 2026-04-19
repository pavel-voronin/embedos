import { computed, ref, watch } from "vue";
import type { EmbedosTerminalTheme } from "../../packages/core/index.ts";
import {
  defaultPlaygroundPreferences,
  playgroundThemes,
  readPlaygroundPreferences,
  type PlaygroundThemeKey,
  writePlaygroundPreferences,
} from "../shared.js";

export function usePlaygroundPreferences() {
  const persistedPreferences = readPlaygroundPreferences();
  const fixedCols = ref<string>(persistedPreferences.cols);
  const cursorBlink = ref<boolean>(persistedPreferences.cursorBlink);
  const cursorStyle = ref<"bar" | "block" | "underline">(persistedPreferences.cursorStyle);
  const cursorWidth = ref<number>(persistedPreferences.cursorWidth);
  const frameEnabled = ref<boolean>(persistedPreferences.frameEnabled);
  const fontFamily = ref<string>(persistedPreferences.fontFamily);
  const fontSize = ref<number>(persistedPreferences.fontSize);
  const fixedRows = ref<string>(persistedPreferences.rows);
  const lineHeight = ref<number>(persistedPreferences.lineHeight);
  const themeKey = ref<PlaygroundThemeKey>(persistedPreferences.theme);
  const theme = computed<EmbedosTerminalTheme>({
    get: () => playgroundThemes[themeKey.value],
    set: (nextTheme) => {
      const matchingEntry = Object.entries(playgroundThemes).find(
        ([, value]) => value === nextTheme,
      );
      themeKey.value =
        (matchingEntry?.[0] as PlaygroundThemeKey | undefined) ??
        defaultPlaygroundPreferences.theme;
    },
  });

  watch(
    [
      themeKey,
      fixedCols,
      fixedRows,
      frameEnabled,
      fontFamily,
      fontSize,
      lineHeight,
      cursorBlink,
      cursorStyle,
      cursorWidth,
    ],
    ([
      nextTheme,
      nextCols,
      nextRows,
      nextFrameEnabled,
      nextFontFamily,
      nextFontSize,
      nextLineHeight,
      nextCursorBlink,
      nextCursorStyle,
      nextCursorWidth,
    ]) => {
      writePlaygroundPreferences({
        cols: nextCols,
        cursorBlink: nextCursorBlink,
        cursorStyle: nextCursorStyle,
        cursorWidth: nextCursorWidth,
        frameEnabled: nextFrameEnabled,
        fontFamily: nextFontFamily,
        fontSize: nextFontSize,
        lineHeight: nextLineHeight,
        rows: nextRows,
        theme: nextTheme,
      });
    },
  );

  function resetPreferences(): void {
    fixedCols.value = defaultPlaygroundPreferences.cols;
    cursorBlink.value = defaultPlaygroundPreferences.cursorBlink;
    cursorStyle.value = defaultPlaygroundPreferences.cursorStyle;
    cursorWidth.value = defaultPlaygroundPreferences.cursorWidth;
    frameEnabled.value = defaultPlaygroundPreferences.frameEnabled;
    fontFamily.value = defaultPlaygroundPreferences.fontFamily;
    fontSize.value = defaultPlaygroundPreferences.fontSize;
    fixedRows.value = defaultPlaygroundPreferences.rows;
    lineHeight.value = defaultPlaygroundPreferences.lineHeight;
    themeKey.value = defaultPlaygroundPreferences.theme;
  }

  return {
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
    themeKey,
  };
}
