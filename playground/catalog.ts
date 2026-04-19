import bashEntry from "./catalog/bash?raw";
import fz1Entry from "./catalog/fz1?raw";
import catEntry from "./catalog/fs/cat?raw";
import chmodEntry from "./catalog/fs/chmod?raw";
import cpEntry from "./catalog/fs/cp?raw";
import lsEntry from "./catalog/fs/ls?raw";
import mkdirEntry from "./catalog/fs/mkdir?raw";
import pwdEntry from "./catalog/fs/pwd?raw";
import rmEntry from "./catalog/fs/rm?raw";
import clearEntry from "./catalog/system/clear?raw";
import envEntry from "./catalog/system/env?raw";
import ttyEntry from "./catalog/system/tty?raw";
import unameEntry from "./catalog/system/uname?raw";
import type { EmbedosConfigOverlayFile } from "../packages/core/index.ts";

const fz1BinaryUrl = new URL("./assets/fz1", import.meta.url).href;

const catalogEntries = [
  ["/root/.local/share/fz1/catalog/bash", bashEntry],
  ["/root/.local/share/fz1/catalog/fz1", fz1Entry],
  ["/root/.local/share/fz1/catalog/fs/cat", catEntry],
  ["/root/.local/share/fz1/catalog/fs/chmod", chmodEntry],
  ["/root/.local/share/fz1/catalog/fs/cp", cpEntry],
  ["/root/.local/share/fz1/catalog/fs/ls", lsEntry],
  ["/root/.local/share/fz1/catalog/fs/mkdir", mkdirEntry],
  ["/root/.local/share/fz1/catalog/fs/pwd", pwdEntry],
  ["/root/.local/share/fz1/catalog/fs/rm", rmEntry],
  ["/root/.local/share/fz1/catalog/system/clear", clearEntry],
  ["/root/.local/share/fz1/catalog/system/env", envEntry],
  ["/root/.local/share/fz1/catalog/system/tty", ttyEntry],
  ["/root/.local/share/fz1/catalog/system/uname", unameEntry],
];

export const catalogOverlayFiles: EmbedosConfigOverlayFile[] = catalogEntries.map(
  ([path, contents]) => ({
    path,
    contents,
  }),
);

export function createPlaygroundOverlayFiles(): EmbedosConfigOverlayFile[] {
  return [
    {
      executable: true,
      path: "/bin/fz1",
      source: {
        kind: "url",
        url: fz1BinaryUrl,
      },
    },
    ...catalogOverlayFiles,
  ];
}
