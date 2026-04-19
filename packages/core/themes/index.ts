import { catppuccinTheme } from "./catppuccin.ts";
import { draculaTheme } from "./dracula.ts";
import { monokaiTheme } from "./monokai.ts";
import { nordTheme } from "./nord.ts";
import { solarizedDarkTheme } from "./solarized-dark.ts";

export const embedosTerminalThemes = {
  monokai: monokaiTheme,
  dracula: draculaTheme,
  nord: nordTheme,
  solarizedDark: solarizedDarkTheme,
  catppuccin: catppuccinTheme,
} as const;
