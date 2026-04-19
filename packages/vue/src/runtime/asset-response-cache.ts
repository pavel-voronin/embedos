interface CachedAsset {
  bytes: Uint8Array;
  contentLength: number;
  contentType: string;
  url: string;
}

type CachedResponse = {
  body: Uint8Array | null;
  headers: Headers;
  status: number;
  statusText: string;
};

type CachedXhrState = {
  aborted: boolean;
  async: boolean;
  error: Error | null;
  headers: Map<string, string>;
  intercepted: boolean;
  method: string;
  readyState: number;
  response: ArrayBuffer | Blob | string | null;
  responseHeaders: Headers;
  responseText: string;
  responseType: XMLHttpRequestResponseType;
  responseURL: string;
  sent: boolean;
  status: number;
  statusText: string;
  url: string;
  withCredentials: boolean;
};

const cachedAssets = new Map<string, CachedAsset>();

let interceptorsInstalled = false;
let nativeFetch: typeof window.fetch | null = null;
let nativeXMLHttpRequest: (new () => XMLHttpRequest) | null = null;

function normalizeUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isInterceptableMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function parseRange(
  rangeHeader: string | null,
  totalLength: number,
): { end: number; start: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const [rawStart, rawEnd] = rangeHeader.slice("bytes=".length).split("-", 2);

  if (rawStart === "" && rawEnd === "") {
    return null;
  }

  if (rawStart === "") {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(totalLength - suffixLength, 0);
    return {
      start,
      end: totalLength - 1,
    };
  }

  const start = Number.parseInt(rawStart, 10);
  const parsedEnd = rawEnd === "" ? totalLength - 1 : Number.parseInt(rawEnd, 10);

  if (!Number.isFinite(start) || !Number.isFinite(parsedEnd) || start < 0 || parsedEnd < start) {
    return null;
  }

  return {
    start,
    end: Math.min(parsedEnd, totalLength - 1),
  };
}

function sliceAsset(
  asset: CachedAsset,
  method: string,
  rangeHeader: string | null,
): CachedResponse {
  const headers = new Headers();
  headers.set("accept-ranges", "bytes");
  headers.set("content-type", asset.contentType);
  headers.set("date", "Thu, 01 Jan 1970 00:00:00 GMT");
  headers.set("etag", `"embedos-${asset.contentLength}"`);
  headers.set("last-modified", "Thu, 01 Jan 1970 00:00:00 GMT");

  const range = parseRange(rangeHeader, asset.contentLength);
  if (range) {
    const body = method === "HEAD" ? null : asset.bytes.slice(range.start, range.end + 1);
    headers.set("content-length", String(range.end - range.start + 1));
    headers.set("content-range", `bytes ${range.start}-${range.end}/${asset.contentLength}`);
    return {
      body,
      headers,
      status: 206,
      statusText: "Partial Content",
    };
  }

  headers.set("content-length", String(asset.contentLength));
  return {
    body: method === "HEAD" ? null : asset.bytes,
    headers,
    status: 200,
    statusText: "OK",
  };
}

function toHeaders(input: HeadersInit | undefined): Headers {
  return new Headers(input ?? undefined);
}

function readRequestDetails(
  input: Parameters<typeof window.fetch>[0],
  init?: RequestInit,
): { headers: Headers; method: string; url: string } {
  if (input instanceof Request) {
    return {
      headers: toHeaders(init?.headers ?? input.headers),
      method: (init?.method ?? input.method ?? "GET").toUpperCase(),
      url: normalizeUrl(input.url),
    };
  }

  return {
    headers: toHeaders(init?.headers),
    method: (init?.method ?? "GET").toUpperCase(),
    url: normalizeUrl(String(input)),
  };
}

function createBlobFromBytes(asset: CachedAsset, bytes: Uint8Array): Blob {
  return new Blob([toArrayBuffer(bytes)], { type: asset.contentType });
}

function canonicalHeaderName(name: string): string {
  switch (name.toLowerCase()) {
    case "accept-ranges":
      return "Accept-Ranges";
    case "content-length":
      return "Content-Length";
    case "content-range":
      return "Content-Range";
    case "content-type":
      return "Content-Type";
    case "date":
      return "Date";
    case "etag":
      return "ETag";
    case "last-modified":
      return "Last-Modified";
    default:
      return name;
  }
}

function dispatchXhrEvent(
  xhr: CachedXMLHttpRequest,
  type: keyof XMLHttpRequestEventMap,
  options: { lengthComputable?: boolean; loaded?: number; total?: number } = {},
): void {
  const event =
    type === "progress" || type === "load" || type === "loadend"
      ? new ProgressEvent(type, {
          lengthComputable: options.lengthComputable ?? false,
          loaded: options.loaded ?? 0,
          total: options.total ?? 0,
        })
      : new Event(type);

  xhr.dispatchEvent(event);
  const handler = xhr[`on${type}` as keyof CachedXMLHttpRequest];
  if (typeof handler === "function") {
    (handler as (this: XMLHttpRequest, event: Event) => unknown).call(
      xhr as unknown as XMLHttpRequest,
      event,
    );
  }
}

function syncXhrReadyState(xhr: CachedXMLHttpRequest, readyState: number): void {
  xhr.$state.readyState = readyState;
  dispatchXhrEvent(xhr, "readystatechange");
}

function installFetchInterceptor(): void {
  if (nativeFetch) {
    return;
  }

  nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = readRequestDetails(input, init);
    const asset = cachedAssets.get(request.url);

    if (!asset || !isInterceptableMethod(request.method)) {
      return nativeFetch!(input, init);
    }

    const cachedResponse = sliceAsset(asset, request.method, request.headers.get("range"));
    return new Response(cachedResponse.body ? toArrayBuffer(cachedResponse.body) : null, {
      headers: cachedResponse.headers,
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
    });
  };
}

class CachedXMLHttpRequest extends EventTarget {
  static readonly DONE = 4;
  static readonly HEADERS_RECEIVED = 2;
  static readonly LOADING = 3;
  static readonly OPENED = 1;
  static readonly UNSENT = 0;

  onabort: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onerror: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onload: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onloadend: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onprogress: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onreadystatechange: ((this: XMLHttpRequest, ev: Event) => unknown) | null = null;

  readonly $native: XMLHttpRequest | null;
  readonly $state: CachedXhrState = {
    aborted: false,
    async: true,
    error: null,
    headers: new Map(),
    intercepted: false,
    method: "GET",
    readyState: CachedXMLHttpRequest.UNSENT,
    response: null,
    responseHeaders: new Headers(),
    responseText: "",
    responseType: "",
    responseURL: "",
    sent: false,
    status: 0,
    statusText: "",
    url: "",
    withCredentials: false,
  };

  constructor() {
    super();
    this.$native = nativeXMLHttpRequest ? new nativeXMLHttpRequest() : null;

    if (this.$native) {
      this.$native.addEventListener("readystatechange", () => {
        if (this.$state.intercepted) {
          return;
        }

        dispatchXhrEvent(this, "readystatechange");
      });
      this.$native.addEventListener("progress", (event: ProgressEvent<EventTarget>) => {
        if (!this.$state.intercepted) {
          dispatchXhrEvent(this, "progress", {
            lengthComputable: event.lengthComputable,
            loaded: event.loaded,
            total: event.total,
          });
        }
      });
      this.$native.addEventListener("load", (event: ProgressEvent<EventTarget>) => {
        if (!this.$state.intercepted) {
          dispatchXhrEvent(this, "load", {
            lengthComputable: event.lengthComputable,
            loaded: event.loaded,
            total: event.total,
          });
        }
      });
      this.$native.addEventListener("error", () => {
        if (!this.$state.intercepted) {
          dispatchXhrEvent(this, "error");
        }
      });
      this.$native.addEventListener("abort", () => {
        if (!this.$state.intercepted) {
          dispatchXhrEvent(this, "abort");
        }
      });
      this.$native.addEventListener("loadend", (event: ProgressEvent<EventTarget>) => {
        if (!this.$state.intercepted) {
          dispatchXhrEvent(this, "loadend", {
            lengthComputable: event.lengthComputable,
            loaded: event.loaded,
            total: event.total,
          });
        }
      });
    }
  }

  get readyState(): number {
    return this.$state.intercepted
      ? this.$state.readyState
      : (this.$native?.readyState ?? CachedXMLHttpRequest.UNSENT);
  }

  get response(): ArrayBuffer | Blob | Document | string | null {
    return this.$state.intercepted ? this.$state.response : (this.$native?.response ?? null);
  }

  get responseText(): string {
    return this.$state.intercepted ? this.$state.responseText : (this.$native?.responseText ?? "");
  }

  get responseType(): XMLHttpRequestResponseType {
    return this.$state.intercepted ? this.$state.responseType : (this.$native?.responseType ?? "");
  }

  set responseType(value: XMLHttpRequestResponseType) {
    this.$state.responseType = value;
    if (!this.$state.intercepted && this.$native) {
      this.$native.responseType = value;
    }
  }

  get responseURL(): string {
    return this.$state.intercepted ? this.$state.responseURL : (this.$native?.responseURL ?? "");
  }

  get status(): number {
    return this.$state.intercepted ? this.$state.status : (this.$native?.status ?? 0);
  }

  get statusText(): string {
    return this.$state.intercepted ? this.$state.statusText : (this.$native?.statusText ?? "");
  }

  get withCredentials(): boolean {
    return this.$state.intercepted
      ? this.$state.withCredentials
      : (this.$native?.withCredentials ?? false);
  }

  set withCredentials(value: boolean) {
    this.$state.withCredentials = value;
    if (!this.$state.intercepted && this.$native) {
      this.$native.withCredentials = value;
    }
  }

  abort(): void {
    if (!this.$state.intercepted) {
      this.$native?.abort();
      return;
    }

    if (this.$state.aborted || this.$state.readyState === CachedXMLHttpRequest.DONE) {
      return;
    }

    this.$state.aborted = true;
    this.$state.status = 0;
    this.$state.statusText = "";
    syncXhrReadyState(this, CachedXMLHttpRequest.DONE);
    dispatchXhrEvent(this, "abort");
    dispatchXhrEvent(this, "loadend");
  }

  getAllResponseHeaders(): string {
    if (!this.$state.intercepted) {
      return this.$native?.getAllResponseHeaders() ?? "";
    }

    const lines: string[] = [];
    this.$state.responseHeaders.forEach((value, key) => {
      lines.push(`${canonicalHeaderName(key)}: ${value}`);
    });
    return lines.join("\r\n");
  }

  getResponseHeader(name: string): string | null {
    if (!this.$state.intercepted) {
      return this.$native?.getResponseHeader(name) ?? null;
    }

    return this.$state.responseHeaders.get(name.toLowerCase()) ?? null;
  }

  open(
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ): void {
    const normalizedMethod = method.toUpperCase();
    const normalizedUrl = normalizeUrl(String(url));
    this.$state.aborted = false;
    this.$state.async = async;
    this.$state.error = null;
    this.$state.headers = new Map();
    this.$state.intercepted =
      cachedAssets.has(normalizedUrl) && isInterceptableMethod(normalizedMethod);
    this.$state.method = normalizedMethod;
    this.$state.readyState = CachedXMLHttpRequest.OPENED;
    this.$state.response = null;
    this.$state.responseHeaders = new Headers();
    this.$state.responseText = "";
    this.$state.responseURL = normalizedUrl;
    this.$state.sent = false;
    this.$state.status = 0;
    this.$state.statusText = "";
    this.$state.url = normalizedUrl;

    if (!this.$state.intercepted) {
      this.$native?.open(method, String(url), async, username ?? undefined, password ?? undefined);
    }

    dispatchXhrEvent(this, "readystatechange");
  }

  overrideMimeType(mime: string): void {
    if (!this.$state.intercepted) {
      this.$native?.overrideMimeType(mime);
    }
  }

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    if (!this.$state.intercepted) {
      this.$native?.send(body ?? undefined);
      return;
    }

    if (this.$state.sent) {
      throw new DOMException("The object is in an invalid state.", "InvalidStateError");
    }

    this.$state.sent = true;

    const run = () => {
      if (this.$state.aborted) {
        return;
      }

      const asset = cachedAssets.get(this.$state.url);
      if (!asset) {
        this.$state.error = new Error(`Cached asset missing for "${this.$state.url}"`);
        dispatchXhrEvent(this, "error");
        dispatchXhrEvent(this, "loadend");
        return;
      }

      const cachedResponse = sliceAsset(
        asset,
        this.$state.method,
        this.$state.headers.get("range") ?? null,
      );
      this.$state.status = cachedResponse.status;
      this.$state.statusText = cachedResponse.statusText;
      this.$state.responseHeaders = cachedResponse.headers;

      syncXhrReadyState(this, CachedXMLHttpRequest.HEADERS_RECEIVED);

      const bodyBytes = cachedResponse.body ?? new Uint8Array(0);
      const responseType = this.$state.responseType;
      const responseText = new TextDecoder().decode(bodyBytes);

      if (responseType === "arraybuffer") {
        this.$state.response = toArrayBuffer(bodyBytes);
      } else if (responseType === "blob") {
        this.$state.response = createBlobFromBytes(asset, bodyBytes);
      } else {
        this.$state.response = responseText;
      }

      this.$state.responseText = responseText;

      syncXhrReadyState(this, CachedXMLHttpRequest.LOADING);
      dispatchXhrEvent(this, "progress", {
        lengthComputable: true,
        loaded: bodyBytes.byteLength,
        total: Number.parseInt(
          cachedResponse.headers.get("content-length") ?? String(bodyBytes.byteLength),
          10,
        ),
      });

      syncXhrReadyState(this, CachedXMLHttpRequest.DONE);
      dispatchXhrEvent(this, "load", {
        lengthComputable: true,
        loaded: bodyBytes.byteLength,
        total: Number.parseInt(
          cachedResponse.headers.get("content-length") ?? String(bodyBytes.byteLength),
          10,
        ),
      });
      dispatchXhrEvent(this, "loadend", {
        lengthComputable: true,
        loaded: bodyBytes.byteLength,
        total: Number.parseInt(
          cachedResponse.headers.get("content-length") ?? String(bodyBytes.byteLength),
          10,
        ),
      });
    };

    if (this.$state.async) {
      window.setTimeout(run, 0);
      return;
    }

    run();
  }

  setRequestHeader(name: string, value: string): void {
    if (!this.$state.intercepted) {
      this.$native?.setRequestHeader(name, value);
      return;
    }

    this.$state.headers.set(name.toLowerCase(), value);
  }
}

function installXhrInterceptor(): void {
  if (nativeXMLHttpRequest) {
    return;
  }

  nativeXMLHttpRequest = window.XMLHttpRequest;
  window.XMLHttpRequest = CachedXMLHttpRequest as unknown as typeof XMLHttpRequest;
}

function ensureInterceptorsInstalled(): void {
  if (interceptorsInstalled) {
    return;
  }

  installFetchInterceptor();
  installXhrInterceptor();
  interceptorsInstalled = true;
}

export function cacheEmbedosAsset(asset: CachedAsset): void {
  cachedAssets.set(normalizeUrl(asset.url), {
    ...asset,
    url: normalizeUrl(asset.url),
  });
  ensureInterceptorsInstalled();
}
