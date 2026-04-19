import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbedosTerminalOptions } from "../../../core/types.ts";
import { createTerminalSession } from "./useEmbedosTerminal.ts";

const xtermMock = vi.hoisted(() => {
  class MockTerminal {
    static instances: MockTerminal[] = [];
    static lastOptionsSet: EmbedosTerminalOptions | null = null;

    _core = {
      _renderService: {
        dimensions: {
          css: {
            cell: {
              height: 20,
              width: 10,
            },
          },
        },
      },
    };

    cols = 80;
    element?: HTMLElement;
    rows = 24;

    private _options: EmbedosTerminalOptions;

    constructor(options: EmbedosTerminalOptions = {}) {
      this._options = { ...options };
      MockTerminal.instances.push(this);
    }

    get options(): EmbedosTerminalOptions {
      return this._options;
    }

    set options(nextOptions: EmbedosTerminalOptions) {
      MockTerminal.lastOptionsSet = nextOptions;
      this._options = { ...this._options, ...nextOptions };
    }

    dispose(): void {}
    onData() {
      return { dispose(): void {} };
    }
    onResize() {
      return { dispose(): void {} };
    }
    open(container: HTMLElement): void {
      this.element = container;
    }
    resize(cols: number, rows: number): void {
      this.cols = cols;
      this.rows = rows;
    }
    write(): void {}
  }

  return { MockTerminal };
});

vi.mock("@xterm/xterm", () => ({
  Terminal: xtermMock.MockTerminal,
}));

class MockResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

function createFakeElement(width = 800, height = 600): HTMLElement {
  const element = {
    append(child: unknown): void {
      void child;
    },
    clientHeight: height,
    clientWidth: width,
    className: "",
    remove(): void {},
    style: {},
  } as Partial<HTMLElement>;

  return element as HTMLElement;
}

beforeEach(() => {
  xtermMock.MockTerminal.instances = [];
  xtermMock.MockTerminal.lastOptionsSet = null;
  vi.stubGlobal("document", {
    createElement: () => createFakeElement(),
  });
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("window", {
    getComputedStyle: () => ({
      getPropertyValue: () => "0px",
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createEmbedosTerminalSession", () => {
  it("applies live xterm options without forwarding cols or rows", async () => {
    const container = createFakeElement() as HTMLElement;

    const session = await createTerminalSession(container, {
      cols: 120,
      fontSize: 15,
      lineHeight: 1.25,
      rows: 40,
      theme: {
        background: "#111111",
      },
    });

    session.updateOptions({
      cols: 80,
      fontSize: 21,
      lineHeight: 1.5,
      rows: 24,
      theme: {
        background: "#222222",
      },
    });

    expect(xtermMock.MockTerminal.lastOptionsSet).toEqual({
      fontSize: 21,
      lineHeight: 1.5,
      theme: {
        background: "#222222",
      },
    });
    expect(xtermMock.MockTerminal.lastOptionsSet).not.toHaveProperty("cols");
    expect(xtermMock.MockTerminal.lastOptionsSet).not.toHaveProperty("rows");

    session.dispose();
  });
});
