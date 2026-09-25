import { describe, it, expect, afterEach, mock } from "bun:test";
const request = mock(async (_options: any): Promise<any> => {
  throw new Error("Unexpected transport call");
});
mock.module("@capacitor/core", () => ({
  CapacitorHttp: { request },
  Capacitor: { isNativePlatform: () => false },
}));
const {
  ApiRequestError,
  describeFailure,
  getEvents,
  getSessions,
  getDirectory,
  parseDirectory,
  parseProfile,
  patchMeProfile,
  postMeSignup,
  withTimeout,
} = await import("../src/lib/api");
const { buildIdentity } = await import("../src/lib/profile-display");
const profile = {
  uid: "test-member",
  full_name: "Test Member",
  email: "test@example.test",
  status: "guest",
  agentNumber: null,
  directoryVisible: false,
  updates: false,
  emailVerified: false,
  confirmation_seen: false,
  createdAt: "2026-09-25T00:00:00Z",
};
const user = { email: profile.email, displayName: profile.full_name, emailVerified: false };
afterEach(() => {
  request.mockReset();
  request.mockImplementation(async () => {
    throw new Error("Unexpected transport call");
  });
});
function transport(status: number, data: unknown) {
  request.mockResolvedValue({ status, data, headers: {}, url: "https://api.example.test" });
  return request;
}
describe("P0 membership authority", () => {
  it("distinguishes unverified and verified Guests from confirmed Agents", () => {
    const p = parseProfile(profile);
    expect(buildIdentity(user, p)?.state).toBe("guest_unverified");
    expect(buildIdentity({ ...user, emailVerified: true }, p)?.state).toBe("guest_pending");
    expect(buildIdentity(user, { ...p, status: "agent" })?.state).toBe("agent");
  });
  it("does not derive verification from a stale API snapshot", () => {
    expect(
      buildIdentity(user, parseProfile({ ...profile, emailVerified: true }))?.emailVerified,
    ).toBe(false);
  });
  it("never invents an identity or a guest Agent number", () => {
    expect(buildIdentity(user, null)).toBeNull();
    expect(
      buildIdentity(user, parseProfile({ ...profile, agentNumber: "ADMIN-ISSUED" }))?.agentNumber,
    ).toBeNull();
    expect(
      buildIdentity(user, parseProfile({ ...profile, status: "agent" }))?.agentNumber,
    ).toBeNull();
  });
  it("keeps suspension explicit and acknowledgement persistent", () => {
    const id = buildIdentity(
      user,
      parseProfile({ ...profile, status: "suspended", confirmation_seen: true }),
    );
    expect(id?.state).toBe("suspended");
    expect(id?.confirmationSeen).toBe(true);
  });
  it("recognizes the API guest stub without treating it as a saved member", () => {
    expect(parseProfile({ ...profile, createdAt: null }).createdAt).toBeNull();
  });
  it("rejects missing and unknown profile schemas", () => {
    for (const value of [
      {},
      { ...profile, status: "admin" },
      { me: {} },
      { ...profile, uid: undefined },
    ])
      expect(() => parseProfile(value)).toThrow();
  });
});
describe("P0 request and response contracts", () => {
  it("parses the real agents envelope and strips private member fields", () => {
    const result = parseDirectory({
      agents: [
        {
          uid: "agent-a",
          full_name: "Agent A",
          status: "agent",
          directoryVisible: true,
          agentNumber: "002",
          email: "private@example.test",
        },
      ],
      total: 55,
      offset: 0,
      limit: 50,
    });
    expect(result.members[0]?.name).toBe("Agent A");
    expect(result.total).toBe(55);
    expect(result.members[0]).not.toHaveProperty("email");
  });
  it("does not accept legacy empty envelopes or non-opted-in accounts", () => {
    expect(() => parseDirectory({ members: [] })).toThrow();
    expect(() =>
      parseDirectory({
        agents: [{ uid: "a", status: "guest", directoryVisible: true }],
        total: 1,
        offset: 0,
        limit: 50,
      }),
    ).toThrow();
  });
  it("preserves real empty events", async () => {
    transport(200, { events: [] });
    expect(await getEvents()).toEqual([]);
  });
  it("does not turn a 404 directory into an empty account", async () => {
    transport(404, { message: "Not found" });
    await expect(getDirectory("token")).rejects.toMatchObject({ status: 404 });
  });
  it("does not turn failed or malformed events into zero events", async () => {
    transport(200, {});
    await expect(getEvents()).rejects.toMatchObject({ status: 502 });
  });
  it("only exposes published sessions", async () => {
    transport(200, {
      sessions: [
        { id: "visible", published: true },
        { id: "draft", published: false },
        { id: "unknown" },
      ],
    });
    expect((await getSessions()).map((x) => x.id)).toEqual(["visible"]);
  });
  it("rejects missing directory credentials before calling transport", async () => {
    const spy = transport(200, {});
    await expect(getDirectory("")).rejects.toMatchObject({ status: 401 });
    expect(spy).not.toHaveBeenCalled();
  });
  it("self PATCH sends only the backend allow-list", async () => {
    const spy = transport(200, { ...profile, confirmation_seen: true });
    await patchMeProfile("token", {
      confirmation_seen: true,
      ...{
        status: "agent",
        agentNumber: "123",
        uid: "someone-else",
        emailVerified: true,
        photoUrl: "fake",
      },
    });
    expect(spy.mock.calls[0]?.[0]?.data).toEqual({ confirmation_seen: true });
  });
  it("signup cannot smuggle privileged fields", async () => {
    const spy = transport(201, profile);
    await postMeSignup("token", {
      full_name: " Test ",
      termsVersion: "1.0",
      privacyVersion: "1.0",
      ...{ status: "agent", agentNumber: "999" },
    });
    expect(spy.mock.calls[0]?.[0]?.data).toEqual({
      full_name: "Test",
      termsVersion: "1.0",
      privacyVersion: "1.0",
      updates: false,
      directoryVisible: false,
      source: "paaipe-mobile",
    });
  });
  it("empty profile patches do not claim success", async () => {
    const spy = transport(200, profile);
    await expect(patchMeProfile("token", {})).rejects.toMatchObject({ status: 400 });
    expect(spy).not.toHaveBeenCalled();
  });
  it("distinguishes auth, forbidden, unavailable and network errors", () => {
    expect(describeFailure(new ApiRequestError(401, "x")).kind).toBe("auth");
    expect(describeFailure(new ApiRequestError(403, "x")).kind).toBe("forbidden");
    expect(describeFailure(new ApiRequestError(404, "x")).kind).toBe("unavailable");
    expect(describeFailure(new Error("offline")).kind).toBe("network");
  });
  it("bounds stalled requests", async () => {
    await expect(withTimeout(new Promise(() => {}), 5, "Test")).rejects.toMatchObject({
      status: 0,
    });
  });
});
