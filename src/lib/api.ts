import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const API_BASE = (import.meta.env["VITE_API_BASE"] as string) || "https://api.paaipe.org";
export const MEDIA_BASE =
  (import.meta.env["VITE_MEDIA_BASE"] as string) || "https://media.paaipe.org";
export type MembershipStatus = "guest" | "agent" | "suspended";
export type MeProfile = {
  uid: string;
  full_name: string;
  email: string;
  status: MembershipStatus;
  agentNumber: string | null;
  directoryVisible: boolean;
  updates: boolean;
  emailVerified: boolean;
  confirmation_seen: boolean;
  createdAt: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
};
/** Mirrors the backend self-write allow-list. Never send authority fields. */
export type ProfilePatch = {
  full_name?: string;
  updates?: boolean;
  directoryVisible?: boolean;
  confirmation_seen?: boolean;
};
export type SignupBody = {
  full_name: string;
  termsVersion: string;
  privacyVersion: string;
  updates?: boolean;
  directoryVisible?: boolean;
  source?: string;
};
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
export type LoadFailure = {
  kind: "auth" | "forbidden" | "unavailable" | "network" | "invalid" | "server";
  message: string;
};
export function describeFailure(error: unknown): LoadFailure {
  const status = error instanceof ApiRequestError ? error.status : 0;
  if (status === 401)
    return { kind: "auth", message: "Your session could not be verified. Sign in again or retry." };
  if (status === 403)
    return { kind: "forbidden", message: "This account does not have access to this information." };
  if (status === 404 || status === 503)
    return {
      kind: "unavailable",
      message: "This service is not available right now. Please try again later.",
    };
  if (status === 502)
    return {
      kind: "invalid",
      message: "The service returned an unexpected response. Please retry.",
    };
  if (status >= 400)
    return { kind: "server", message: "We could not load this information. Please retry." };
  return {
    kind: "network",
    message: "We could not reach PAAIPE. Check your connection and retry.",
  };
}
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiRequestError(0, `${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiRequestError(502, "Invalid object response");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export async function apiRequest<T = unknown>(opts: {
  method?: string;
  path: string;
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const timeout = opts.timeoutMs ?? 12000;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const response = await withTimeout(
    CapacitorHttp.request({
      url: `${API_BASE}${opts.path}`,
      method: opts.method || "GET",
      headers,
      data: opts.body,
      responseType: "json",
      connectTimeout: timeout,
      readTimeout: timeout,
    }),
    timeout,
    "API request",
  );
  let data: unknown = response.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new ApiRequestError(
        response.status >= 400 ? response.status : 502,
        "Invalid JSON response",
      );
    }
  }
  if (response.status < 200 || response.status >= 300)
    throw new ApiRequestError(response.status, `API request failed (${response.status})`);
  return data as T;
}
export function parseProfile(raw: unknown): MeProfile {
  const outer = record(raw);
  const value = record(outer["me"] ?? outer["profile"] ?? outer);
  const status = value["status"];
  if (
    !["guest", "agent", "suspended"].includes(String(status)) ||
    !text(value["uid"]) ||
    !(
      value["createdAt"] === null ||
      (typeof value["createdAt"] === "string" && value["createdAt"].length > 0)
    )
  )
    throw new ApiRequestError(502, "Invalid profile response");
  return {
    uid: text(value["uid"]),
    full_name: text(value["full_name"]),
    email: text(value["email"]),
    status: status as MembershipStatus,
    agentNumber: value["agentNumber"] == null ? null : String(value["agentNumber"]),
    directoryVisible: value["directoryVisible"] === true,
    updates: value["updates"] === true,
    emailVerified: value["emailVerified"] === true,
    confirmation_seen: value["confirmation_seen"] === true,
    createdAt: value["createdAt"] == null ? null : text(value["createdAt"]),
  };
}
export async function getMe(token: string): Promise<MeProfile> {
  return parseProfile(await apiRequest({ path: "/v1/me", token }));
}
export async function postMeSignup(token: string, body: SignupBody): Promise<MeProfile> {
  // Select fields rather than allowing a caller to pass role/uid/agentNumber.
  const payload = {
    full_name: body.full_name.trim(),
    termsVersion: body.termsVersion,
    privacyVersion: body.privacyVersion,
    updates: body.updates ?? false,
    directoryVisible: body.directoryVisible ?? false,
    source: "paaipe-mobile",
  };
  return parseProfile(
    await apiRequest({ method: "POST", path: "/v1/me/signup", token, body: payload }),
  );
}
export async function patchMeProfile(token: string, body: ProfilePatch): Promise<MeProfile> {
  const allowed: ProfilePatch = {};
  if (typeof body.full_name === "string") allowed.full_name = body.full_name.trim();
  if (typeof body.updates === "boolean") allowed.updates = body.updates;
  if (typeof body.directoryVisible === "boolean") allowed.directoryVisible = body.directoryVisible;
  if (typeof body.confirmation_seen === "boolean")
    allowed.confirmation_seen = body.confirmation_seen;
  if (!Object.keys(allowed).length) throw new ApiRequestError(400, "No permitted profile changes");
  return parseProfile(
    await apiRequest({ method: "PATCH", path: "/v1/me/profile", token, body: allowed }),
  );
}
export type ApiEvent = {
  id: string;
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  series?: string;
  topic?: string;
  description?: string;
  format?: string;
  coverUrl?: string;
  speakers?: ApiEventSpeaker[];
};
export type ApiEventSpeaker = {
  name?: string;
  title?: string;
  role?: string;
  photoUrl?: string;
};
export type ApiSession = {
  id: string;
  title?: string;
  description?: string;
  speaker?: string;
  speakerPhotoUrl?: string;
  source?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  storagePath?: string;
  posterUrl?: string;
  published?: boolean;
  displayOrder?: number;
  aspect?: string;
};
export type ApiMicro = ApiSession;
export type ApiPlaylist = {
  id: string;
  title?: string;
  description?: string;
  kind?: "sessions" | "micros";
  itemIds?: string[];
  status?: string;
  displayOrder?: number;
};
/**
 * The static site stores media as URLs relative to the marketing site
 * (e.g. "assets/img/x.jpg") or as storage paths served from the media host
 * (e.g. "micros/x.mp4"). Resolve both to absolute URLs the mobile app can load.
 */
const SITE_BASE = "https://paaipe.org";
export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${SITE_BASE}/${trimmed.replace(/^\/+/, "")}`;
}
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path || typeof path !== "string") return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${MEDIA_BASE}/${trimmed.replace(/^\/+/, "")}`;
}
export function parseList<T extends { id: string }>(raw: unknown, key: string): T[] {
  const list = Array.isArray(raw) ? raw : record(raw)[key];
  if (
    !Array.isArray(list) ||
    list.some((item) => !item || typeof item !== "object" || typeof item.id !== "string")
  )
    throw new ApiRequestError(502, `Invalid ${key} response`);
  return list as T[];
}
export async function getEvents(): Promise<ApiEvent[]> {
  const events = parseList<ApiEvent>(await apiRequest({ path: "/v1/events" }), "events");
  return events.map((event) => {
    const cover = resolveAssetUrl(event.coverUrl);
    const speakers = Array.isArray(event.speakers)
      ? event.speakers.map((speaker) => {
          const photo = resolveAssetUrl(speaker.photoUrl);
          return photo ? { ...speaker, photoUrl: photo } : speaker;
        })
      : undefined;
    return {
      ...event,
      ...(cover ? { coverUrl: cover } : {}),
      ...(speakers ? { speakers } : {}),
    };
  });
}
export async function getSessions(): Promise<ApiSession[]> {
  return parseList<ApiSession>(await apiRequest({ path: "/v1/sessions" }), "sessions")
    .filter((item) => item.published === true)
    .map(resolveSessionMedia)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
export async function getMicros(): Promise<ApiMicro[]> {
  return parseList<ApiMicro>(await apiRequest({ path: "/v1/micros" }), "micros")
    .filter((item) => item.published === true)
    .map(resolveSessionMedia)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
export async function getPlaylists(): Promise<ApiPlaylist[]> {
  return parseList<ApiPlaylist>(await apiRequest({ path: "/v1/playlists" }), "playlists")
    .filter((item) => item.status === "published")
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}
/** Resolve a session/micro's poster and (for uploads) its video source to absolute URLs. */
function resolveSessionMedia<T extends ApiSession>(item: T): T {
  const poster = resolveAssetUrl(item.posterUrl);
  const media = resolveMediaUrl(item.storagePath);
  const next: T = { ...item };
  if (poster) next.posterUrl = poster;
  if (media) next.storagePath = media;
  return next;
}
export type DirectoryMember = {
  uid: string;
  name: string;
  initials: string;
  agentNumber: string | null;
  /** Position or professional role (paaipe_agents.headline). */
  role?: string;
  /** Company / organization (paaipe_agents.organization). */
  company?: string;
  /** Short introduction (paaipe_agents.about). */
  about?: string;
  /** A link the member shares (paaipe_agents.link). */
  link?: string;
  photo?: string;
};
export type DirectoryPage = {
  members: DirectoryMember[];
  total: number;
  limit: number;
  offset: number;
};
export function parseDirectory(raw: unknown): DirectoryPage {
  const value = record(raw);
  const agents = value["agents"];
  if (
    !Array.isArray(agents) ||
    !Number.isInteger(value["total"]) ||
    !Number.isInteger(value["offset"]) ||
    !Number.isInteger(value["limit"])
  )
    throw new ApiRequestError(502, "Invalid directory response");
  const members = agents.map((item) => {
    const row = record(item);
    if (!text(row["uid"]) || row["status"] !== "agent" || row["directoryVisible"] !== true)
      throw new ApiRequestError(502, "Invalid directory member");
    const name = text(row["full_name"]) || "Member";
    return {
      uid: text(row["uid"]),
      name,
      initials: initialsFromName(name),
      agentNumber: row["agentNumber"] == null ? null : String(row["agentNumber"]),
    };
  });
  return {
    members,
    total: value["total"] as number,
    limit: value["limit"] as number,
    offset: value["offset"] as number,
  };
}
export async function getDirectory(token: string, offset = 0): Promise<DirectoryPage> {
  if (!token) throw new ApiRequestError(401, "Sign-in required");
  return parseDirectory(
    await apiRequest({
      path: `/v1/directory?limit=50&offset=${Math.max(0, Math.floor(offset))}`,
      token,
    }),
  );
}
export function initialsFromName(name: string, email = ""): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  if (parts.length > 1) return `${first[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  return (first || email.split("@")[0] || "?").slice(0, 2).toUpperCase();
}
export function isNativeApiTransport(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Read helper that treats a 404 as an honest "route not deployed / no row yet"
 * rather than an error. Any other non-2xx still throws. Mirrors the web
 * portal's probeDraftGet contract (200/401 = live, 404 = not wired).
 */
async function apiRequestAllow404<T = unknown>(opts: {
  method?: string;
  path: string;
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
}): Promise<{ status: number; data: T | null }> {
  try {
    const data = await apiRequest<T>(opts);
    return { status: 200, data };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404)
      return { status: 404, data: null };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Event feedback (window + questions + member response)
// ---------------------------------------------------------------------------
export type FeedbackWindowState = "locked" | "open" | "closed";
export type FeedbackWindow = {
  state: FeedbackWindowState;
  opensAt: string | null;
  closesAt: string | null;
  timezone: string;
};
export type FeedbackQuestionType = "1-5" | "yes-no" | "short";
export type FeedbackQuestion = {
  id: string;
  questionKey: string;
  prompt: string;
  type: FeedbackQuestionType;
  required: boolean;
  order: number;
};
export type FeedbackResponse = {
  registrationId: string;
  answers: Record<string, string | number>;
  submittedAt: string | null;
};
const FEEDBACK_WINDOW_STATES = new Set(["locked", "open", "closed"]);
const FEEDBACK_QUESTION_TYPES = new Set(["1-5", "yes-no", "short"]);
export function normalizeFeedbackWindow(raw: unknown): FeedbackWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const state = String(value["state"] ?? "").trim();
  if (!FEEDBACK_WINDOW_STATES.has(state)) return null;
  return {
    state: state as FeedbackWindowState,
    opensAt: value["opensAt"] == null ? null : String(value["opensAt"]),
    closesAt: value["closesAt"] == null ? null : String(value["closesAt"]),
    timezone: text(value["timezone"]) || "Asia/Manila",
  };
}
/** Public GET. Returns null when the route is not deployed (404). */
export async function getEventFeedbackWindow(eventId: string): Promise<FeedbackWindow | null> {
  const { status, data } = await apiRequestAllow404({
    path: `/v1/events/${encodeURIComponent(eventId)}/feedback/window`,
  });
  return status === 200 ? normalizeFeedbackWindow(data) : null;
}
/** Public GET. `{ questions: [] }` is an honest empty set, not a failure. */
export async function getEventFeedbackQuestions(eventId: string): Promise<FeedbackQuestion[]> {
  const { data } = await apiRequestAllow404<Record<string, unknown>>({
    path: `/v1/events/${encodeURIComponent(eventId)}/feedback/questions`,
  });
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.["questions"])
      ? (data["questions"] as unknown[])
      : [];
  return list
    .map((row, index): FeedbackQuestion | null => {
      if (!row || typeof row !== "object") return null;
      const value = row as Record<string, unknown>;
      const type = String(value["type"] ?? "").trim();
      const questionKey = String(value["questionKey"] ?? value["key"] ?? "").trim();
      const prompt = String(value["prompt"] ?? "").trim();
      if (!FEEDBACK_QUESTION_TYPES.has(type) || !questionKey || !prompt) return null;
      return {
        id: text(value["id"]) || questionKey,
        questionKey,
        prompt,
        type: type as FeedbackQuestionType,
        required: value["required"] !== false,
        order: Number.isFinite(Number(value["order"])) ? Number(value["order"]) : index,
      };
    })
    .filter((q): q is FeedbackQuestion => q !== null)
    .sort((a, b) => a.order - b.order);
}
/** Member GET of their own response. 404 means "no response yet", returned as null. */
export async function getMyEventFeedbackResponse(
  token: string,
  eventId: string,
  registrationId: string,
): Promise<FeedbackResponse | null> {
  const { status, data } = await apiRequestAllow404<Record<string, unknown>>({
    path: `/v1/events/${encodeURIComponent(eventId)}/feedback/responses/${encodeURIComponent(registrationId)}`,
    token,
  });
  if (status !== 200 || !data) return null;
  const row = (
    data["response"] && typeof data["response"] === "object" ? data["response"] : data
  ) as Record<string, unknown>;
  const answers =
    row["answers"] && typeof row["answers"] === "object" && !Array.isArray(row["answers"])
      ? (row["answers"] as Record<string, string | number>)
      : {};
  return {
    registrationId: text(row["registrationId"]) || registrationId,
    answers,
    submittedAt: row["submittedAt"] == null ? null : String(row["submittedAt"]),
  };
}
/**
 * Member create-once POST. 403 when the API says the window is closed/not open,
 * 409 when a response already exists. Both surface via ApiRequestError.status.
 */
export async function submitEventFeedbackResponse(
  token: string,
  eventId: string,
  input: { registrationId: string; answers: Record<string, string | number> },
): Promise<void> {
  const registrationId = String(input.registrationId || "").trim();
  if (!registrationId)
    throw new ApiRequestError(400, "A registration is required to send feedback.");
  await apiRequest({
    method: "POST",
    path: `/v1/events/${encodeURIComponent(eventId)}/feedback/responses`,
    token,
    body: { registrationId, answers: input.answers ?? {} },
  });
}

// ---------------------------------------------------------------------------
// Certificates (member library + per-event state + re-send email)
// ---------------------------------------------------------------------------
export type MeCertificate = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  year: string;
  series: string | null;
  pdfUrl: string;
  pngUrl: string;
  issuedAt: string | null;
  emailedAt: string | null;
};
function normalizeCertificateCard(raw: unknown): MeCertificate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const eventTitle = text(value["eventTitle"]).trim();
  const id = value["id"] == null ? "" : String(value["id"]);
  const pdfUrl = resolveMediaUrl(text(value["pdfUrl"])) || "";
  const pngUrl = resolveMediaUrl(text(value["pngUrl"])) || "";
  const eventDate =
    value["eventDate"] == null || value["eventDate"] === "" ? null : String(value["eventDate"]);
  const issuedAt =
    value["issuedAt"] == null || value["issuedAt"] === "" ? null : String(value["issuedAt"]);
  if (!eventTitle && !id && !eventDate && !issuedAt && !pdfUrl && !pngUrl) return null;
  const series =
    value["series"] == null || String(value["series"]).trim() === ""
      ? null
      : String(value["series"]).trim();
  return {
    id,
    eventId: value["eventId"] == null ? "" : String(value["eventId"]),
    eventTitle,
    eventDate,
    year: value["year"] == null ? "" : String(value["year"]),
    series,
    pdfUrl,
    pngUrl,
    issuedAt,
    emailedAt:
      value["emailedAt"] == null || value["emailedAt"] === "" ? null : String(value["emailedAt"]),
  };
}
/**
 * Member certificate library. `live` is false only when the route is not
 * deployed (404) — that is an honest empty state, not a list of zero.
 */
export async function getMyCertificates(
  token: string,
): Promise<{ live: boolean; items: MeCertificate[] }> {
  const { status, data } = await apiRequestAllow404<Record<string, unknown>>({
    path: "/v1/me/certificates",
    token,
  });
  if (status === 404) return { live: false, items: [] };
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.["certificates"])
      ? (data["certificates"] as unknown[])
      : [];
  return {
    live: true,
    items: list.map(normalizeCertificateCard).filter((c): c is MeCertificate => c !== null),
  };
}
export type EventCertificateState =
  | "not_registered"
  | "awaiting_feedback_open"
  | "feedback_open"
  | "issuing"
  | "issued"
  | "closed_no_cert";
export type EventCertificate = {
  state: EventCertificateState;
  registered: boolean;
  feedbackSubmitted: boolean;
  feedbackWindow: FeedbackWindow | null;
  certificate: {
    id: string;
    issuedAt: string | null;
    pdfUrl: string;
    pngUrl: string;
    emailedAt: string | null;
  } | null;
};
const EVENT_CERT_STATES = new Set([
  "not_registered",
  "awaiting_feedback_open",
  "feedback_open",
  "issued",
  "issuing",
  "closed_no_cert",
]);
export function normalizeEventCertificate(raw: unknown): EventCertificate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const rawCert =
    value["certificate"] &&
    typeof value["certificate"] === "object" &&
    !Array.isArray(value["certificate"])
      ? (value["certificate"] as Record<string, unknown>)
      : null;
  let state = String(value["state"] ?? "").trim();
  if (state === "ready" || !state) state = rawCert ? "issued" : "issuing";
  if (state === "issued" && !rawCert) state = "issuing";
  if (!EVENT_CERT_STATES.has(state)) return null;
  return {
    state: state as EventCertificateState,
    registered: value["registered"] === true,
    feedbackSubmitted: value["feedbackSubmitted"] === true,
    feedbackWindow:
      value["feedbackWindow"] && typeof value["feedbackWindow"] === "object"
        ? normalizeFeedbackWindow(value["feedbackWindow"])
        : null,
    certificate: rawCert
      ? {
          id: text(rawCert["id"]),
          issuedAt: rawCert["issuedAt"] == null ? null : String(rawCert["issuedAt"]),
          pdfUrl: resolveMediaUrl(text(rawCert["pdfUrl"])) || "",
          pngUrl: resolveMediaUrl(text(rawCert["pngUrl"])) || "",
          emailedAt: rawCert["emailedAt"] == null ? null : String(rawCert["emailedAt"]),
        }
      : null,
  };
}
/** Per-event certificate state. Returns null when the route is not deployed. */
export async function getMyEventCertificate(
  token: string,
  eventId: string,
): Promise<EventCertificate | null> {
  const { status, data } = await apiRequestAllow404({
    path: `/v1/me/events/${encodeURIComponent(eventId)}/certificate`,
    token,
  });
  return status === 200 ? normalizeEventCertificate(data) : null;
}
/**
 * Re-send the certificate email. 200 → { emailedAt }. 404 (none) and 409
 * (not issued yet) surface via ApiRequestError.status; nothing is assumed sent.
 */
export async function emailMyEventCertificate(
  token: string,
  eventId: string,
): Promise<{ emailedAt: string | null }> {
  const data = await apiRequest<Record<string, unknown>>({
    method: "POST",
    path: `/v1/me/events/${encodeURIComponent(eventId)}/certificate/email`,
    token,
  });
  const cert = normalizeEventCertificate(data);
  if (cert?.certificate?.emailedAt) return { emailedAt: cert.certificate.emailedAt };
  if (data && typeof data === "object" && data["emailedAt"])
    return { emailedAt: String(data["emailedAt"]) };
  throw new ApiRequestError(502, "The API did not confirm the email. Nothing was assumed sent.");
}

// ---------------------------------------------------------------------------
// Organizations, event sponsors/partners, and partner applications
// ---------------------------------------------------------------------------
export type ApiOrganization = {
  id: string;
  name: string;
  website: string;
  logoUrl: string;
  type: string;
  status: string;
};
export type EventPartner = {
  id: string;
  eventId: string;
  organizationId: string;
  tier: string;
  status: string;
  displayOrder: number;
  note: string | null;
};
function normalizeOrganization(raw: unknown): ApiOrganization | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = value["id"] ?? value["organizationId"];
  if (id == null || id === "") return null;
  return {
    id: String(id),
    name: text(value["name"]),
    website: text(value["website"]),
    logoUrl: resolveAssetUrl(text(value["logoUrl"] ?? value["logo_url"])) || "",
    type: text(value["type"]),
    status: text(value["status"]),
  };
}
function normalizeEventPartner(raw: unknown, eventHint: string): EventPartner | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = value["id"] ?? value["partnerId"];
  if (id == null || id === "") return null;
  return {
    id: String(id),
    eventId: text(value["eventId"] ?? value["event_id"]) || eventHint,
    organizationId: text(value["organizationId"] ?? value["organization_id"]),
    tier: text(value["tier"]),
    status: text(value["status"]),
    displayOrder: Number.isFinite(Number(value["displayOrder"]))
      ? Number(value["displayOrder"])
      : Number(value["order"]) || 0,
    note: value["note"] == null ? null : String(value["note"]),
  };
}
/** Public GET /v1/organizations. */
export async function getOrganizations(): Promise<ApiOrganization[]> {
  const data = await apiRequest<Record<string, unknown>>({ path: "/v1/organizations" });
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.["organizations"])
      ? (data["organizations"] as unknown[])
      : [];
  return list
    .map(normalizeOrganization)
    .filter((o): o is ApiOrganization => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
/** Public GET of the sponsors confirmed for one event. */
export async function getEventPartners(eventId: string): Promise<EventPartner[]> {
  const { data } = await apiRequestAllow404<Record<string, unknown>>({
    path: `/v1/events/${encodeURIComponent(eventId)}/partners`,
  });
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.["partners"])
      ? (data["partners"] as unknown[])
      : [];
  return list
    .map((row) => normalizeEventPartner(row, eventId))
    .filter((p): p is EventPartner => p !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
/** Sponsors joined to their organization, ready for display on an event. */
export type EventSponsor = EventPartner & { organization: ApiOrganization | null };
export async function getEventSponsors(eventId: string): Promise<EventSponsor[]> {
  const [partners, organizations] = await Promise.all([
    getEventPartners(eventId),
    getOrganizations().catch(() => [] as ApiOrganization[]),
  ]);
  const byId = new Map(organizations.map((org) => [org.id, org]));
  return partners
    .filter((partner) => partner.status === "confirmed" || partner.status === "")
    .map((partner) => ({ ...partner, organization: byId.get(partner.organizationId) ?? null }));
}
/** Bearer GET of the organizations the member owns. */
export async function getMyOrganizations(token: string): Promise<ApiOrganization[]> {
  const data = await apiRequest<Record<string, unknown>>({ path: "/v1/me/organizations", token });
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.["organizations"])
      ? (data["organizations"] as unknown[])
      : [];
  return list
    .map(normalizeOrganization)
    .filter((o): o is ApiOrganization => o !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
function organizationWritePayload(fields: {
  name?: string;
  website?: string;
  logoUrl?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof fields.name === "string") out["name"] = fields.name.trim();
  if (typeof fields.website === "string") out["website"] = fields.website.trim();
  if (typeof fields.logoUrl === "string") out["logoUrl"] = fields.logoUrl.trim();
  return out;
}
/** Create an organization for the member. Returns the new id. */
export async function createMyOrganization(
  token: string,
  fields: { name: string; website?: string; logoUrl?: string },
): Promise<string> {
  if (!fields.name.trim()) throw new ApiRequestError(400, "An organization name is required.");
  const data = await apiRequest<Record<string, unknown>>({
    method: "POST",
    path: "/v1/me/organizations",
    token,
    body: organizationWritePayload(fields),
  });
  const row = normalizeOrganization(
    data && typeof data === "object" && data["organization"] ? data["organization"] : data,
  );
  const id = row?.id || (data && typeof data === "object" ? text(data["id"]) : "");
  if (!id) throw new ApiRequestError(502, "The API did not return an organization id.");
  return id;
}
/** Update one of the member's organizations. */
export async function updateMyOrganization(
  token: string,
  id: string,
  fields: { name?: string; website?: string; logoUrl?: string },
): Promise<void> {
  await apiRequest({
    method: "PATCH",
    path: `/v1/me/organizations/${encodeURIComponent(id)}`,
    token,
    body: organizationWritePayload(fields),
  });
}
export type PartnerApplicationInput = {
  eventId: string;
  companyName: string;
  eventTitle?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  message?: string;
  supportTypes?: string[];
  organizationId?: string;
};
/** Public POST of a Partner application. Returns the reference for the receipt. */
export async function submitPartnerApplication(
  input: PartnerApplicationInput,
): Promise<{ id: string; reference: string; organizationId: string }> {
  const eventId = String(input.eventId || "").trim();
  const companyName = String(input.companyName || "").trim();
  if (!eventId || !companyName)
    throw new ApiRequestError(400, "An event and a company name are required.");
  const body: Record<string, unknown> = { eventId, companyName };
  if (input.eventTitle) body["eventTitle"] = input.eventTitle;
  if (input.contactName) body["contactName"] = input.contactName;
  if (input.email) body["email"] = input.email;
  if (input.phone) body["phone"] = input.phone;
  if (input.website) body["website"] = input.website;
  if (input.message) body["message"] = input.message;
  if (Array.isArray(input.supportTypes)) body["supportTypes"] = input.supportTypes.slice(0, 5);
  if (input.organizationId) body["organizationId"] = input.organizationId;
  body["source"] = "paaipe-mobile";
  const data = await apiRequest<Record<string, unknown>>({
    method: "POST",
    path: "/v1/partner-applications",
    body,
  });
  const row =
    data && typeof data === "object" && data["application"]
      ? (data["application"] as Record<string, unknown>)
      : (data as Record<string, unknown>);
  const id = text(row?.["id"]);
  if (!id) throw new ApiRequestError(502, "The API did not return an application id.");
  return {
    id,
    reference: text(row["reference"]),
    organizationId: text(row["organizationId"]) || input.organizationId || "",
  };
}
