/**
 * Member directory, read from the source that actually backs it: the
 * `paaipe_agents` collection in the named Firestore database ("paaipe").
 *
 * This mirrors the web portal's `listDirectory()` — confirmed Agents who opted
 * in (`status == "agent"` and `directoryVisible == true`). The REST route
 * `/v1/directory` is not deployed on the API (it returns 404), so the app reads
 * Firestore directly, the same way the web portal does. Pagination is applied
 * client-side over the (small) opted-in set so the existing page controls work.
 */
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import { initialsFromName, type DirectoryMember, type DirectoryPage } from "./api";

const AGENTS = "paaipe_agents";
const PAGE = 50;

function readDatabaseId(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.["VITE_FIRESTORE_DATABASE_ID"];
  return typeof value === "string" && value.trim() ? value : "paaipe";
}
const DATABASE_ID = readDatabaseId();
function db(): Firestore {
  return getFirestore(getFirebaseApp(), DATABASE_ID);
}

/** Opted-in confirmed Agents, sorted by Agent number then name, paginated. */
export async function getDirectoryFromFirestore(offset = 0): Promise<DirectoryPage> {
  const q = query(
    collection(db(), AGENTS),
    where("status", "==", "agent"),
    where("directoryVisible", "==", true),
  );
  const snap = await getDocs(q);
  const all = snap.docs
    .map((docSnap): DirectoryMember => {
      const data = docSnap.data() as Record<string, unknown>;
      const name = (typeof data["full_name"] === "string" && data["full_name"].trim()) || "Member";
      const photo = typeof data["photoUrl"] === "string" ? data["photoUrl"] : "";
      const agentNumber = data["agentNumber"] == null ? null : String(data["agentNumber"]);
      return {
        uid: docSnap.id,
        name,
        initials: initialsFromName(name),
        agentNumber,
        ...(photo ? { photo } : {}),
      };
    })
    .sort(
      (a, b) =>
        (a.agentNumber || "").localeCompare(b.agentNumber || "") || a.name.localeCompare(b.name),
    );
  const start = Math.max(0, Math.floor(offset));
  return { members: all.slice(start, start + PAGE), total: all.length, limit: PAGE, offset: start };
}
