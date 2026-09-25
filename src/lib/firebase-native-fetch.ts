/**
 * Capacitor WKWebView fetch() to identitytoolkit / securetoken can hang
 * (QUIC/Happy-Eyeballs) with no rejection — Firebase Auth then never resolves.
 * Route those hosts through CapacitorHttp (native URLSession) on iOS/Android.
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const AUTH_HOST_RE =
  /^(https:\/\/)?(identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)\b/i;

let installed = false;

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
    return out;
  }
  return { ...headers };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installFirebaseNativeFetchBridge(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    if (!AUTH_HOST_RE.test(url)) {
      return originalFetch(input, init);
    }

    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = {
      ...headersToRecord(input instanceof Request ? input.headers : undefined),
      ...headersToRecord(init?.headers),
    };

    let data: unknown = undefined;
    const rawBody = init?.body ?? (input instanceof Request ? undefined : undefined);
    let bodyText: string | undefined;
    if (typeof init?.body === "string") {
      bodyText = init.body;
    } else if (init?.body instanceof ArrayBuffer) {
      bodyText = new TextDecoder().decode(init.body);
    } else if (init?.body instanceof Uint8Array) {
      bodyText = new TextDecoder().decode(init.body);
    } else if (input instanceof Request && method !== "GET" && method !== "HEAD") {
      try {
        bodyText = await input.clone().text();
      } catch {
        /* ignore */
      }
    }

    if (bodyText != null && bodyText !== "") {
      try {
        data = JSON.parse(bodyText);
      } catch {
        data = bodyText;
      }
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const timeoutMs = 20_000;
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data,
      responseType: "json",
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });

    const status = response.status || 0;
    const payload =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data ?? {});

    const responseHeaders = new Headers();
    const rh = response.headers || {};
    for (const [k, v] of Object.entries(rh)) {
      if (typeof v === "string") responseHeaders.set(k, v);
    }
    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "application/json");
    }

    return new Response(payload, { status, headers: responseHeaders });
  };

  installed = true;
  console.info("[firebase] native CapacitorHttp fetch bridge installed for Auth hosts");
}
