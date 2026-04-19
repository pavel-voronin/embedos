export function quoteShell(value: unknown): string {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

export function dirname(path: string): string {
  if (path === "/") {
    return "/";
  }

  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash <= 0) {
    return "/";
  }

  return normalized.slice(0, lastSlash);
}

export function basename(path: string): string {
  if (path === "/") {
    return "/";
  }

  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = normalized.lastIndexOf("/");

  return normalized.slice(lastSlash + 1);
}

export function ensureAbsoluteUrl(path: string): URL {
  return new URL(path, window.location.href);
}
