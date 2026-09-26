/**
 * Local, privacy-safe telemetry for registration writes.
 *
 * This never leaves the device: it keeps running counters in localStorage so the
 * app (and anyone debugging a member's phone) can see how often writes succeed,
 * fail, get queued for later, or flush once the network returns — i.e. the
 * real-world offline rate. No personal data or event details are recorded, only
 * event kinds and timestamps.
 */
const TELEMETRY_KEY = "paaipe-registration-telemetry";

export type RegistrationTelemetryKind =
  | "write_success"
  | "write_failure"
  | "write_queued"
  | "queue_flush_settled"
  | "cancel_success"
  | "cancel_failure";

export type RegistrationTelemetry = {
  counts: Record<RegistrationTelemetryKind, number>;
  updatedAt: number | null;
};

const KINDS: RegistrationTelemetryKind[] = [
  "write_success",
  "write_failure",
  "write_queued",
  "queue_flush_settled",
  "cancel_success",
  "cancel_failure",
];

function emptyTelemetry(): RegistrationTelemetry {
  const counts = {} as Record<RegistrationTelemetryKind, number>;
  for (const kind of KINDS) counts[kind] = 0;
  return { counts, updatedAt: null };
}

export function readRegistrationTelemetry(): RegistrationTelemetry {
  if (typeof localStorage === "undefined") return emptyTelemetry();
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return emptyTelemetry();
    const parsed = JSON.parse(raw) as Partial<RegistrationTelemetry> | null;
    const base = emptyTelemetry();
    if (parsed && typeof parsed === "object") {
      const counts = (parsed.counts ?? {}) as Record<string, unknown>;
      for (const kind of KINDS) {
        const value = counts[kind];
        if (typeof value === "number" && Number.isFinite(value)) base.counts[kind] = value;
      }
      if (typeof parsed.updatedAt === "number") base.updatedAt = parsed.updatedAt;
    }
    return base;
  } catch {
    return emptyTelemetry();
  }
}

export function recordRegistrationEvent(kind: RegistrationTelemetryKind, amount = 1): void {
  if (typeof localStorage === "undefined") return;
  const current = readRegistrationTelemetry();
  current.counts[kind] = (current.counts[kind] ?? 0) + amount;
  current.updatedAt = Date.now();
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(current));
  } catch {
    /* storage full or unavailable — telemetry is best-effort */
  }
}

/**
 * Share of registration write attempts that did not land immediately (queued or
 * failed) out of all attempts, as a 0–1 rate. Returns null when nothing has been
 * attempted yet so callers can distinguish "no data" from "0% offline".
 */
export function offlineWriteRate(
  telemetry: RegistrationTelemetry = readRegistrationTelemetry(),
): number | null {
  const { write_success, write_failure, write_queued } = telemetry.counts;
  const attempts = write_success + write_failure + write_queued;
  if (attempts === 0) return null;
  return (write_failure + write_queued) / attempts;
}

const TELEMETRY_ID_KEY = "paaipe-telemetry-id";

function readTelemetryUrl(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_PAAIPE_TELEMETRY_URL"];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function telemetryEndpointConfigured(): boolean {
  return readTelemetryUrl().length > 0;
}

/**
 * A stable, random, anonymous id for this install. It carries no personal data —
 * it only lets the aggregate endpoint count distinct devices without identifying
 * anyone, so a handful of offline phones don't skew the fleet-wide rate.
 */
function deviceId(): string {
  if (typeof localStorage === "undefined") return "anon";
  try {
    let id = localStorage.getItem(TELEMETRY_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(TELEMETRY_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Best-effort push of the on-device counters to the aggregate endpoint so the
 * offline rate is visible fleet-wide, not just per-device. No personal data or
 * event details are sent — only the counters, the derived rate, and an anonymous
 * install id. A no-op (resolving false) when the endpoint is not configured.
 */
export async function postTelemetrySnapshot(timeoutMs = 8000): Promise<boolean> {
  const url = readTelemetryUrl();
  if (!url) return false;
  const telemetry = readRegistrationTelemetry();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: deviceId(),
        counts: telemetry.counts,
        offlineRate: offlineWriteRate(telemetry),
        updatedAt: telemetry.updatedAt,
        sentAt: Date.now(),
      }),
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
