export const defaultAutoStart = false;
export const defaultResetOverlayOnStart = true;

export function resolveTerminalResetOverlayOnStart(value: boolean | undefined): boolean {
  return value ?? defaultResetOverlayOnStart;
}
