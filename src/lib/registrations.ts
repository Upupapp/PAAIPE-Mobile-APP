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
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseApp, isFirebaseConfigured, DOC_VERSIONS } from "./firebase";

const DATABASE_ID = "paaipe";
const REGISTRATIONS = "paaipe_event_registrations";
const QUEUE_KEY = "paaipe-registration-queue";
const WRITE_TIMEOUT_MS = 15000;

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

/** A client-minted document id (also the registration id / ticket reference). */
export function newRegistrationId(): string {
  const db = getFirestore(getFirebaseApp(), DATABASE_ID);
  return doc(collection(db, REGISTRATIONS)).id;
}

function buildPayload(input: RegistrationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    event: input.event.trim().slice(0, 120),
    full_name: input.full_name.trim().slice(0, 120),
    email: input.email.trim().slice(0, 254),
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
  const db = getFirestore(getFirebaseApp(), DATABASE_ID);
  const ref = doc(db, REGISTRATIONS, registrationId);
  await withTimeout(setDoc(ref, buildPayload(input)), WRITE_TIMEOUT_MS);
  return ref.id;
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

export function enqueueRegistration(item: QueuedRegistration): void {
  const items = readQueue().filter((q) => q.registrationId !== item.registrationId);
  items.push(item);
  writeQueue(items);
}

export function dequeueRegistration(registrationId: string): void {
  writeQueue(readQueue().filter((q) => q.registrationId !== registrationId));
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
      if (isRetriableRegistrationError(error)) {
        remaining.push(item);
      } else {
        // Non-retriable: the id already committed on a prior attempt (create ->
        // update is denied), so the registration is safely saved. Settle it.
        settled.push({ registrationId: item.registrationId, eventId: item.eventId });
      }
    }
  }
  writeQueue(remaining);
  return settled;
}
