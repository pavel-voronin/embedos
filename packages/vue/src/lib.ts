import EmbedosTerminal from "./vue/EmbedosTerminal.vue";
import "./style.css";

export { defineRecipe, themes } from "../../core/index.ts";
export { EmbedosTerminal };
export { defaultTerminalSettings } from "./vue/defaultTerminalSettings.js";
export type {
  EmbedosConfig,
  EmbedosRecipe,
  EmbedosTerminalOptions,
  EmbedosTerminalTheme,
} from "../../core/index.ts";
