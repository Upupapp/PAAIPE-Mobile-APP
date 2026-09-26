/**
 * Per-event registered counts.
 *
 * The numbers come from the `eventRegistrationCounts` Cloud Function, which
 * returns an aggregate map only — never a registrant row — so the app can show
 * real totals without leaking who registered. The endpoint is configured with
 * `VITE_PAAIPE_COUNTS_URL`; when it is not set (or a request fails) the caller
 * gets `null` and the UI shows no number rather than an invented one.
 */
export type EventCounts = {
  counts: Record<string, number>;
  total: number;
  generatedAt: string;
};

function readCountsUrl(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_PAAIPE_COUNTS_URL"];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function countsEndpointConfigured(): boolean {
  return readCountsUrl().length > 0;
}

function parseCounts(raw: unknown): EventCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const rawCounts = value["counts"];
  if (!rawCounts || typeof rawCounts !== "object") return null;
  const counts: Record<string, number> = {};
  for (const [id, n] of Object.entries(rawCounts as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) counts[id] = Math.floor(n);
  }
  const total = typeof value["total"] === "number" ? Math.floor(value["total"] as number) : 0;
  const generatedAt =
    typeof value["generatedAt"] === "string" ? (value["generatedAt"] as string) : "";
  return { counts, total, generatedAt };
}

export async function fetchEventCounts(timeoutMs = 8000): Promise<EventCounts | null> {
  const url = readCountsUrl();
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return parseCounts(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
