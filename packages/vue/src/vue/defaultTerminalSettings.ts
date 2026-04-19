import { themes } from "../../../core/index.ts";
import type { EmbedosTerminalOptions } from "../../../core/index.ts";

export const defaultTerminalSettings: Readonly<EmbedosTerminalOptions> = {
  convertEol: true,
  cursorBlink: true,
  cursorStyle: "bar",
  cursorWidth: 2,
  fontFamily: '"BlexMono Nerd Font Mono", "PT Mono", monospace',
  fontSize: 15,
  lineHeight: 1.25,
  theme: themes.monokai,
};
