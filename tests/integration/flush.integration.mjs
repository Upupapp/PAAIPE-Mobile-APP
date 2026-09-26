/**
 * End-to-end offline queue test: drives the REAL flushRegistrationQueue from
 * src/lib/registrations.ts against a live Firestore emulator, not a stub.
 *
 * It proves the whole offline path plumbs through to the backend and stays
 * idempotent under retries:
 *   1. queued registrations flush to real documents and clear the queue;
 *   2. re-flushing the same client-minted id never creates a duplicate;
 *   3. enqueueing the same id twice before a flush collapses to one write.
 *
 * Run with:  sh tests/integration/run.sh   (boots the emulator, runs this)
 * Requires:  bun (runs the TypeScript lib directly) + Java (for the emulator).
 */
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}
globalThis.localStorage = new MemoryStorage();

// The Firestore emulator only serves the DEFAULT database, and the SDK's
// FIRESTORE_EMULATOR_HOST auto-connect doesn't cover instances created with an
// explicit database id — so point the lib at the default db and wire the shared
// instance to the emulator explicitly before any read/write. Production keeps the
// named "paaipe" database.
const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8080;
process.env.VITE_FIRESTORE_DATABASE_ID = "(default)";

const { enqueueRegistration, flushRegistrationQueue, readRegistrationQueue, newRegistrationId } =
  await import("../../src/lib/registrations.ts");
const { getFirebaseApp } = await import("../../src/lib/firebase.ts");
const { getFirestore, collection, getDocs, connectFirestoreEmulator } =
  await import("firebase/firestore");

// getFirestore(app, id) is memoized, so connecting this instance also connects
// the one the lib uses internally (same app + database id).
const DB = getFirestore(getFirebaseApp(), "(default)");
connectFirestoreEmulator(DB, EMULATOR_HOST, EMULATOR_PORT);
const COL = "paaipe_event_registrations";

async function countDocs() {
  const snap = await getDocs(collection(DB, COL));
  return snap.size;
}

function mkItem(registrationId, eventId) {
  return {
    registrationId,
    eventId,
    event: "AI Exchange",
    full_name: "Integration Tester",
    email: "integ@example.com",
    queuedAt: Date.now(),
  };
}

let pass = 0;
async function check(name, fn) {
  await fn();
  console.log(`  PASS  ${name}`);
  pass++;
}

// 1. Two queued registrations flush to real docs and clear the queue.
const r1 = newRegistrationId();
const r2 = newRegistrationId();
enqueueRegistration(mkItem(r1, "e1"));
enqueueRegistration(mkItem(r2, "e2"));
await check("two queued items flush and settle", async () => {
  assert.equal(readRegistrationQueue().length, 2);
  const settled = await flushRegistrationQueue();
  assert.equal(settled.length, 2);
  assert.equal(readRegistrationQueue().length, 0);
  assert.equal(await countDocs(), 2);
});

// 2. Re-flushing the same id is idempotent — no duplicate document.
enqueueRegistration(mkItem(r1, "e1"));
await check("re-flushing a settled id creates no duplicate", async () => {
  const settled = await flushRegistrationQueue();
  assert.equal(settled.length, 1);
  assert.equal(readRegistrationQueue().length, 0);
  assert.equal(await countDocs(), 2);
});

// 3. Enqueueing the same id twice before a flush collapses to one write.
const r3 = newRegistrationId();
enqueueRegistration(mkItem(r3, "e3"));
enqueueRegistration(mkItem(r3, "e3"));
await check("duplicate enqueue before flush writes once", async () => {
  assert.equal(readRegistrationQueue().length, 1);
  const settled = await flushRegistrationQueue();
  assert.equal(settled.length, 1);
  assert.equal(await countDocs(), 3);
});

console.log(`\n==== ${pass} passed ====`);
process.exit(0);
