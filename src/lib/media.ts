/**
 * Profile photo pipeline, matching the web portal (paaipe-media.js +
 * paaipe-profile-photo.js).
 *
 * A photo is uploaded to media.paaipe.org/upload (multipart, kind=photo) and the
 * returned https://media.paaipe.org/... URL is persisted as `photoUrl` on the
 * member's `paaipe_agents/{uid}` document in the named Firestore database
 * ("paaipe"). A failed upload never invents a URL and never marks a photo saved.
 */
import { doc, getDoc, getFirestore, setDoc, type Firestore } from "firebase/firestore";
import { MEDIA_BASE } from "./api";
import { getFirebaseApp } from "./firebase";

const MEDIA_UPLOAD_ENDPOINT = `${MEDIA_BASE}/upload`;
const AGENTS = "paaipe_agents";

function readDatabaseId(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_FIRESTORE_DATABASE_ID"];
  return typeof value === "string" && value.trim() ? value : "paaipe";
}
const DATABASE_ID = readDatabaseId();
function db(): Firestore {
  return getFirestore(getFirebaseApp(), DATABASE_ID);
}

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Human-readable reason a file cannot be used, or "" when it is fine. */
export function rejectPhotoFile(file: File): string {
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  if (type === "image/gif" || /\.gif$/i.test(name))
    return "GIFs are not supported. Please choose a JPG, PNG or WebP.";
  if (!PHOTO_TYPES.includes(type) && !/\.jpe?g$|\.png$|\.webp$/i.test(name))
    return "Please choose a JPG, PNG or WebP.";
  if (file.size > PHOTO_MAX_BYTES)
    return "That file is larger than 2 MB. Please choose a smaller JPG, PNG or WebP.";
  return "";
}

function isMediaPaaipeUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith(`${MEDIA_BASE}/`);
}

/**
 * POST the photo. Resolves to the media URL from the 201 body. Throws on any
 * other status or a body without url+path — never invents a URL.
 */
export async function uploadProfilePhoto(file: File, token: string): Promise<string> {
  if (!token) throw new Error("You need to be signed in to upload.");
  const form = new FormData();
  form.append("file", file);
  form.append("kind", "photo");
  let res: Response;
  try {
    res = await fetch(MEDIA_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (error) {
    throw new Error("Could not reach the media service. Nothing was uploaded.", { cause: error });
  }
  if (res.status !== 201) {
    if (res.status === 401) throw new Error("Sign-in expired or missing. Nothing was uploaded.");
    if (res.status === 403) throw new Error("You do not have permission to upload that.");
    throw new Error(`The photo upload failed (${res.status}). Nothing was uploaded.`);
  }
  let data: { url?: unknown; path?: unknown };
  try {
    data = (await res.json()) as { url?: unknown; path?: unknown };
  } catch {
    throw new Error("Upload did not return a media URL. Nothing was saved.");
  }
  const url = typeof data?.url === "string" ? data.url.trim() : "";
  const path = typeof data?.path === "string" ? data.path.trim() : "";
  if (!url || !path || !isMediaPaaipeUrl(url))
    throw new Error("Upload did not return a media URL. Nothing was saved.");
  return url;
}

/** Persist (or clear) the member's photoUrl on their agent document. */
export async function persistAgentPhotoUrl(uid: string, photoUrl: string): Promise<void> {
  if (!uid) throw new Error("A signed-in member is required to save a photo.");
  await setDoc(doc(db(), AGENTS, uid), { photoUrl: photoUrl || "" }, { merge: true });
}

/** Read the member's saved photoUrl, or "" when none is stored / readable. */
export async function readAgentPhotoUrl(uid: string): Promise<string> {
  if (!uid) return "";
  try {
    const snap = await getDoc(doc(db(), AGENTS, uid));
    const value = snap.exists() ? (snap.data() as { photoUrl?: unknown }).photoUrl : "";
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}
