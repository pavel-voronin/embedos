import type { EmbedosTerminalTheme } from "../types.ts";

interface EmbedosBaseTerminalTheme {
  background: string;
  black: string;
  blue: string;
  brightBlack: string;
  brightBlue: string;
  brightCyan: string;
  brightGreen: string;
  brightMagenta: string;
  brightRed: string;
  brightWhite: string;
  brightYellow: string;
  cursor: string;
  cursorAccent: string;
  cyan: string;
  foreground: string;
  green: string;
  magenta: string;
  red: string;
  white: string;
  yellow: string;
}

export function createTerminalTheme(theme: EmbedosBaseTerminalTheme): EmbedosTerminalTheme {
  return { ...theme };
}
