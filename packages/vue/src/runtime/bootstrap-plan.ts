import { basename, dirname, ensureAbsoluteUrl, quoteShell } from "../../../core/index.ts";
import type {
  EmbedosOverlayInlineFile,
  EmbedosOverlayLayers,
  EmbedosOverlaySourceFile,
} from "../../../core/index.ts";

const INLINE_FILE_MARKER = "__EMBEDOS_INLINE_FILE__";

interface EmbedosBootstrapMount {
  copyFrom: string;
  mountPath: string;
  mountUrl: string;
  type: "directory" | "file";
}

function resolveWebSource(
  file: EmbedosOverlaySourceFile,
  index: number | string,
): EmbedosBootstrapMount {
  const sourceUrl = ensureAbsoluteUrl(file.source);

  if (file.type === "directory") {
    const directoryUrl = new URL(
      sourceUrl.href.endsWith("/") ? sourceUrl.href : `${sourceUrl.href}/`,
    );

    return {
      copyFrom: `/tmp/embedos-mount-${index}`,
      mountPath: `/tmp/embedos-mount-${index}`,
      mountUrl: directoryUrl.href,
      type: "directory",
    };
  }

  return {
    copyFrom: `/tmp/embedos-mount-${index}/${basename(sourceUrl.pathname)}`,
    mountPath: `/tmp/embedos-mount-${index}`,
    mountUrl: new URL("./", sourceUrl.href).href.replace(/\/$/, ""),
    type: "file",
  };
}

function renderInlineFile(file: EmbedosOverlayInlineFile): string {
  const lines = [
    `mkdir -p ${quoteShell(dirname(file.path))}`,
    `cat <<'${INLINE_FILE_MARKER}' > ${quoteShell(file.path)}`,
    file.contents,
    INLINE_FILE_MARKER,
  ];

  if (file.mode) {
    lines.push(`chmod ${quoteShell(file.mode)} ${quoteShell(file.path)}`);
  } else if (file.executable) {
    lines.push(`chmod +x ${quoteShell(file.path)}`);
  }

  return lines.join("\n");
}

function renderWebCopy(file: EmbedosOverlaySourceFile, source: EmbedosBootstrapMount): string {
  const lines = [`mkdir -p ${quoteShell(dirname(file.path))}`];

  if (source.type === "directory") {
    lines.push(`mkdir -p ${quoteShell(file.path)}`);
    lines.push(`cp -R ${quoteShell(`${source.copyFrom}/.`)} ${quoteShell(file.path)}`);
  } else {
    lines.push(`cp ${quoteShell(source.copyFrom)} ${quoteShell(file.path)}`);
  }

  if (file.mode) {
    lines.push(`chmod ${quoteShell(file.mode)} ${quoteShell(file.path)}`);
  } else if (file.executable) {
    lines.push(`chmod +x ${quoteShell(file.path)}`);
  }

  return lines.join("\n");
}

function normalizeStartupCommands(run: string[]): string[] {
  return run.map((command) => command.trimEnd()).filter(Boolean);
}

export function createBootstrapPlan(
  overlayFiles: EmbedosOverlayLayers<EmbedosOverlayInlineFile | EmbedosOverlaySourceFile>,
  run: string[],
): { mounts: EmbedosBootstrapMount[]; script: string } {
  const mounts: EmbedosBootstrapMount[] = [];
  const scriptChunks = ["set -e"];

  overlayFiles.forEach((layer, layerIndex) => {
    layer.forEach((file, fileIndex) => {
      if (!file) {
        return;
      }

      const mountIndex = `${layerIndex}-${fileIndex}`;

      if ("contents" in file) {
        scriptChunks.push(renderInlineFile(file));
        return;
      }

      const source = resolveWebSource(file, mountIndex);
      mounts.push(source);
      scriptChunks.push(renderWebCopy(file, source));
    });
  });

  scriptChunks.push(...normalizeStartupCommands(run));

  return {
    mounts,
    script: scriptChunks.filter(Boolean).join("\n\n"),
  };
}
