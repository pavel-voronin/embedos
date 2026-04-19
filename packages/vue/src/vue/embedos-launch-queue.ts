let embedosTerminalLaunchQueue: Promise<void> = Promise.resolve();

export function createEmbedosTerminalLaunchSlot(): { barrier: Promise<void>; release: () => void } {
  const barrier = embedosTerminalLaunchQueue;
  let isReleased = false;
  let resolveNextBarrier!: () => void;
  embedosTerminalLaunchQueue = new Promise<void>((resolve) => {
    resolveNextBarrier = resolve;
  });

  return {
    barrier,
    release() {
      if (isReleased) {
        return;
      }

      isReleased = true;
      resolveNextBarrier();
    },
  };
}

export function areCheerpXGlobalsReady(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const globalWindow = window as typeof window & {
    CheerpJIndexedDBFolder?: unknown;
    cheerpOSListFilesMain?: unknown;
    cheerpOSStatMain?: unknown;
  };

  return (
    typeof globalWindow.CheerpJIndexedDBFolder === "function" &&
    typeof globalWindow.cheerpOSListFilesMain === "function" &&
    typeof globalWindow.cheerpOSStatMain === "function"
  );
}
