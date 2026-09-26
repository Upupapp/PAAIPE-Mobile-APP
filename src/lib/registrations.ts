/**
 * Event registration writes, matching the web portal's backend.
 *
 * Registrations are documents in the `paaipe_event_registrations` collection of
 * PAAIPE's own named Firestore database ("paaipe", asia-southeast1) — the same
 * store paaipe-firebase.js writes to. The firestore.rules `isWellFormedRegistration`
 * check requires event/full_name/email/consent(true)/createdAt(server time) and
 * caps the optional fields; this payload stays inside that contract. The new
 * document id is the registration id the rest of the app (and admin) keys on.
 *
 * The document id is minted on the client (doc(collection(...))) so a write can
 * be retried idempotently: the same id is reused, so a resend after a flaky
 * network can never create a second registration. A create on an id that already
 * committed is an UPDATE, which the rules deny for clients — the flusher reads
 * that permission-denied as "already saved" rather than a real failure.
 */
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp, isFirebaseConfigured, DOC_VERSIONS } from "./firebase";
import { recordRegistrationEvent } from "./telemetry";

const DATABASE_ID = readDatabaseId();
const REGISTRATIONS = "paaipe_event_registrations";
const QUEUE_KEY = "paaipe-registration-queue";
const WRITE_TIMEOUT_MS = 15000;

/**
 * PAAIPE's named Firestore database, "paaipe" by default. Overridable via
 * VITE_FIRESTORE_DATABASE_ID for environments that use a different database
 * (e.g. the Firestore emulator, which serves rules on its default database).
 */
function readDatabaseId(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_FIRESTORE_DATABASE_ID"];
  return typeof value === "string" && value.trim() ? value : "paaipe";
}

export type RegistrationInput = {
  eventId: string;
  event: string;
  full_name: string;
  email: string;
  speaker_question?: string;
  updates?: boolean;
};

/** A registration that failed to reach the backend and is waiting to resend. */
export type QueuedRegistration = RegistrationInput & {
  registrationId: string;
  queuedAt: number;
};

export function canSubmitRegistration(): boolean {
  return isFirebaseConfigured();
}

function db(): Firestore {
  return getFirestore(getFirebaseApp(), DATABASE_ID);
}

/** Normalize an email the same way the backend rule compares it (lower-cased). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A client-minted document id (also the registration id / ticket reference). */
export function newRegistrationId(): string {
  return doc(collection(db(), REGISTRATIONS)).id;
}

function buildPayload(input: RegistrationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    event: input.event.trim().slice(0, 120),
    full_name: input.full_name.trim().slice(0, 120),
    email: normalizeEmail(input.email).slice(0, 254),
    consent: true,
    eventId: input.eventId.slice(0, 120),
    source: "paaipe-mobile",
    source_site: "paaipe-mobile",
    privacyVersion: DOC_VERSIONS.privacy,
    createdAt: serverTimestamp(),
  };
  const note = input.speaker_question?.trim();
  if (note) payload["speaker_question"] = note.slice(0, 2000);
  if (typeof input.updates === "boolean") payload["updates"] = input.updates;
  return payload;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        const err = new Error("Registration write timed out");
        (err as { code?: string }).code = "unavailable";
        reject(err);
      }, ms),
    ),
  ]);
}

/**
 * Write a registration to the backend using a fixed document id so retries are
 * idempotent. Returns the registration id (== document id).
 */
export async function submitEventRegistration(
  input: RegistrationInput,
  registrationId: string,
): Promise<string> {
  const ref = doc(db(), REGISTRATIONS, registrationId);
  await withTimeout(setDoc(ref, buildPayload(input)), WRITE_TIMEOUT_MS);
  return ref.id;
}

/** A registration as stored in the backend, read back for the signed-in member. */
export type MyRegistration = {
  id: string;
  eventId: string;
  event: string;
  status: string;
  cancelled: boolean;
};

/**
 * Read the signed-in member's own registrations from the backend, filtered by
 * their (lower-cased) email so the query satisfies the ownsRegistration rule.
 * Requires a signed-in, email-verified member; returns [] otherwise or on error
 * so a launch-time reconcile never blocks the UI.
 */
export async function fetchMyRegistrations(email: string): Promise<MyRegistration[]> {
  if (!isFirebaseConfigured()) return [];
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  try {
    const snap = await withTimeout(
      getDocs(query(collection(db(), REGISTRATIONS), where("email", "==", normalized))),
      WRITE_TIMEOUT_MS,
    );
    return snap.docs.map((entry) => {
      const data = entry.data() as Record<string, unknown>;
      const status = typeof data["status"] === "string" ? (data["status"] as string) : "registered";
      return {
        id: entry.id,
        eventId: typeof data["eventId"] === "string" ? (data["eventId"] as string) : "",
        event: typeof data["event"] === "string" ? (data["event"] as string) : "PAAIPE event",
        status,
        cancelled: status === "cancelled",
      };
    });
  } catch {
    return [];
  }
}

/**
 * Cancel the member's own registration server-side. Rules forbid client deletes,
 * so this sets status:'cancelled' (+ cancelled_at) — the only mutation a verified
 * owner is allowed. Idempotent: re-cancelling an already-cancelled row is a no-op
 * write the rules still accept.
 */
export async function cancelMyRegistration(registrationId: string): Promise<void> {
  const ref = doc(db(), REGISTRATIONS, registrationId);
  await withTimeout(
    updateDoc(ref, { status: "cancelled", cancelled_at: serverTimestamp() }),
    WRITE_TIMEOUT_MS,
  );
}

/**
 * True when a failed write is worth retrying (network/timeouts), false when the
 * backend rejected the payload (permission/validation) and a retry is pointless.
 */
export function isRetriableRegistrationError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (!code) return true; // opaque network errors (e.g. TypeError) — retry
  const permanent = [
    "permission-denied",
    "invalid-argument",
    "already-exists",
    "unauthenticated",
    "failed-precondition",
  ];
  return !permanent.includes(code);
}

function readQueue(): QueuedRegistration[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as QueuedRegistration[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRegistration[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* storage full or unavailable — nothing else to do */
  }
}

export function readRegistrationQueue(): QueuedRegistration[] {
  return readQueue();
}

/**
 * Pure queue mutation: add `item`, replacing any existing entry with the same
 * registrationId so enqueueing is idempotent (a resend of the same registration
 * can never appear twice). Exported for unit testing without localStorage.
 */
export function upsertQueueItem(
  items: QueuedRegistration[],
  item: QueuedRegistration,
): QueuedRegistration[] {
  return [...items.filter((q) => q.registrationId !== item.registrationId), item];
}

/** Pure queue mutation: drop the entry with `registrationId` (idempotent). */
export function removeQueueItem(
  items: QueuedRegistration[],
  registrationId: string,
): QueuedRegistration[] {
  return items.filter((q) => q.registrationId !== registrationId);
}

/**
 * Decide what a flush should do with a write error: keep the item queued for a
 * later retry, or treat it as settled (a permanent error on a client-minted id
 * means the doc already committed on an earlier attempt). Pure and testable.
 */
export function flushDecision(error: unknown): "remain" | "settled" {
  return isRetriableRegistrationError(error) ? "remain" : "settled";
}

export function enqueueRegistration(item: QueuedRegistration): void {
  writeQueue(upsertQueueItem(readQueue(), item));
}

export function dequeueRegistration(registrationId: string): void {
  writeQueue(removeQueueItem(readQueue(), registrationId));
}

/** An item that reached a settled state during a flush (written, or confirmed present). */
export type FlushedRegistration = { registrationId: string; eventId: string };

/**
 * Try to resend every queued registration. Settled items (written now, or a
 * permission-denied that means the doc already committed on an earlier attempt)
 * are removed from the queue and returned so the UI can mark them confirmed.
 * Genuinely retriable failures stay queued for the next attempt.
 */
export async function flushRegistrationQueue(): Promise<FlushedRegistration[]> {
  if (!isFirebaseConfigured()) return [];
  const items = readQueue();
  if (!items.length) return [];
  const settled: FlushedRegistration[] = [];
  const remaining: QueuedRegistration[] = [];
  for (const item of items) {
    try {
      await submitEventRegistration(item, item.registrationId);
      settled.push({ registrationId: item.registrationId, eventId: item.eventId });
    } catch (error) {
      if (flushDecision(error) === "remain") {
        remaining.push(item);
      } else {
        // Non-retriable: the id already committed on a prior attempt (create ->
        // update is denied), so the registration is safely saved. Settle it.
        settled.push({ registrationId: item.registrationId, eventId: item.eventId });
      }
    }
  }
  writeQueue(remaining);
  if (settled.length) recordRegistrationEvent("queue_flush_settled", settled.length);
  return settled;
}
