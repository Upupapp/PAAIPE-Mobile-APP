/**
 * Event registration writes, matching the web portal's backend.
 *
 * Registrations are documents in the `paaipe_event_registrations` collection of
 * PAAIPE's own named Firestore database ("paaipe", asia-southeast1) — the same
 * store paaipe-firebase.js writes to. The firestore.rules `isWellFormedRegistration`
 * check requires event/full_name/email/consent(true)/createdAt(server time) and
 * caps the optional fields; this payload stays inside that contract. The new
 * document id is the registration id the rest of the app (and admin) keys on.
 */
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp, isFirebaseConfigured, DOC_VERSIONS } from "./firebase";

const DATABASE_ID = "paaipe";
const REGISTRATIONS = "paaipe_event_registrations";

export type RegistrationInput = {
  eventId: string;
  event: string;
  full_name: string;
  email: string;
  speaker_question?: string;
  updates?: boolean;
};

export function canSubmitRegistration(): boolean {
  return isFirebaseConfigured();
}

export async function submitEventRegistration(input: RegistrationInput): Promise<string> {
  const db = getFirestore(getFirebaseApp(), DATABASE_ID);
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
  const ref = await addDoc(collection(db, REGISTRATIONS), payload);
  return ref.id;
}
