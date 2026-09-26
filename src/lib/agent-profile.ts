/**
 * The member's own public profile fields on `paaipe_agents/{uid}`, in the named
 * Firestore database ("paaipe"). These are the same fields the web portal reads
 * and writes (`updateAgentProfile` / `currentAgent` in paaipe-firebase.js), so a
 * member's company (organization) and bio stay in sync across web and mobile.
 *
 * Identity fields owned elsewhere are NOT written here: `full_name` and
 * `directoryVisible` go through the REST profile endpoint, `photoUrl` through the
 * media pipeline (see media.ts). This module only carries organization, headline,
 * about and link. Values are trimmed and length-clamped to the exact limits the
 * Firestore rules enforce, so a write never fails validation on a too-long field.
 */
import { doc, getDoc, getFirestore, updateDoc, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";

const AGENTS = "paaipe_agents";

const LIMITS = { organization: 160, headline: 120, about: 2000, link: 300 } as const;

export type AgentProfileFields = {
  /** The member's company/organization — the directory tile's second line. */
  organization: string;
  /** Position or professional role. */
  headline: string;
  /** A short introduction. */
  about: string;
  /** A link the member chooses to share (e.g. LinkedIn). */
  link: string;
};

function readDatabaseId(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_FIRESTORE_DATABASE_ID"];
  return typeof value === "string" && value.trim() ? value : "paaipe";
}
const DATABASE_ID = readDatabaseId();
function db(): Firestore {
  return getFirestore(getFirebaseApp(), DATABASE_ID);
}

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Read the member's saved profile fields, or blanks when none/unreadable. */
export async function readAgentProfile(uid: string): Promise<AgentProfileFields> {
  const empty: AgentProfileFields = { organization: "", headline: "", about: "", link: "" };
  if (!uid) return empty;
  try {
    const snap = await getDoc(doc(db(), AGENTS, uid));
    if (!snap.exists()) return empty;
    const data = snap.data() as Record<string, unknown>;
    return {
      organization: clamp(data["organization"], LIMITS.organization),
      headline: clamp(data["headline"], LIMITS.headline),
      about: clamp(data["about"], LIMITS.about),
      link: clamp(data["link"], LIMITS.link),
    };
  } catch {
    return empty;
  }
}

/** Persist the member's profile fields on their own agent document. */
export async function writeAgentProfile(uid: string, fields: AgentProfileFields): Promise<void> {
  if (!uid) throw new Error("A signed-in member is required to save a profile.");
  await updateDoc(doc(db(), AGENTS, uid), {
    organization: clamp(fields.organization, LIMITS.organization),
    headline: clamp(fields.headline, LIMITS.headline),
    about: clamp(fields.about, LIMITS.about),
    link: clamp(fields.link, LIMITS.link),
  });
}
