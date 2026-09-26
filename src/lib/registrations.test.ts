/**
 * Unit tests for the registration queue classifier and enqueue/flush idempotency.
 *
 * These cover the pure logic that keeps offline registrations correct:
 *   - which write errors are worth retrying vs. permanent;
 *   - that enqueueing the same registration twice never duplicates it;
 *   - that a permanent error during flush is read as "already saved", not lost.
 *
 * Run with:  bun test  (from the repo root)
 */
import { test, expect, beforeEach } from "bun:test";
import {
  isRetriableRegistrationError,
  flushDecision,
  upsertQueueItem,
  removeQueueItem,
  enqueueRegistration,
  dequeueRegistration,
  readRegistrationQueue,
  type QueuedRegistration,
} from "./registrations";

// Minimal in-memory localStorage so the queue helpers run outside a browser.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

beforeEach(() => {
  localStorage.clear();
});

const item = (registrationId: string, eventId = "e1"): QueuedRegistration => ({
  registrationId,
  eventId,
  event: "AI Exchange",
  full_name: "Test Member",
  email: "member@example.com",
  queuedAt: 1,
});

test("classifier retries opaque/network errors", () => {
  expect(isRetriableRegistrationError(new TypeError("network"))).toBe(true);
  expect(isRetriableRegistrationError({ code: "unavailable" })).toBe(true);
  expect(isRetriableRegistrationError({ code: "deadline-exceeded" })).toBe(true);
  expect(isRetriableRegistrationError({})).toBe(true);
});

test("classifier does not retry permanent backend rejections", () => {
  for (const code of [
    "permission-denied",
    "invalid-argument",
    "already-exists",
    "unauthenticated",
    "failed-precondition",
  ]) {
    expect(isRetriableRegistrationError({ code })).toBe(false);
  }
});

test("flushDecision keeps retriable items queued and settles permanent ones", () => {
  expect(flushDecision({ code: "unavailable" })).toBe("remain");
  expect(flushDecision({ code: "permission-denied" })).toBe("settled");
});

test("upsertQueueItem is idempotent by registrationId", () => {
  let items: QueuedRegistration[] = [];
  items = upsertQueueItem(items, item("r1"));
  items = upsertQueueItem(items, item("r1"));
  expect(items).toHaveLength(1);
  items = upsertQueueItem(items, item("r2"));
  expect(items.map((q) => q.registrationId)).toEqual(["r1", "r2"]);
});

test("upsertQueueItem replaces the existing entry, keeping newest payload", () => {
  let items: QueuedRegistration[] = [item("r1")];
  items = upsertQueueItem(items, { ...item("r1"), queuedAt: 999 });
  expect(items).toHaveLength(1);
  expect(items[0]?.queuedAt).toBe(999);
});

test("removeQueueItem drops only the target and is a no-op when absent", () => {
  const items = [item("r1"), item("r2")];
  expect(removeQueueItem(items, "r1").map((q) => q.registrationId)).toEqual(["r2"]);
  expect(removeQueueItem(items, "missing")).toHaveLength(2);
});

test("enqueue then dequeue round-trips through storage without duplication", () => {
  enqueueRegistration(item("r1"));
  enqueueRegistration(item("r1"));
  enqueueRegistration(item("r2"));
  expect(readRegistrationQueue().map((q) => q.registrationId)).toEqual(["r1", "r2"]);
  dequeueRegistration("r1");
  expect(readRegistrationQueue().map((q) => q.registrationId)).toEqual(["r2"]);
  dequeueRegistration("r1");
  expect(readRegistrationQueue()).toHaveLength(1);
});
