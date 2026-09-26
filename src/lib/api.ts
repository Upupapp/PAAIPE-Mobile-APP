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
  role?: string;
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
