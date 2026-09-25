# P0 implementation and data contracts

Updated 25 September 2026.

## Architecture

Owner-confirmed architecture: **Linode owns all application data and media; Firebase owns users and authentication; Netlify hosts the web portal.** The mobile app uses `api.paaipe.org` for application data. It does not read or write Firestore or Firebase Storage.

The audited remote web source at `434a27d55846e50cc45801268a9e63d615bfb5ea` still contains legacy Firestore operations in `assets/js/paaipe-firebase.js`. These are migration gaps, not the intended architecture. They must be replaced with Linode contracts, rather than reproduced in mobile. Source review does not establish which Netlify commit is currently deployed.

## Delivery status

| P0 | Mobile implementation | Remaining acceptance dependency |
| --- | --- | --- |
| MP-01 | Unverified/verified Guests, confirmed Agents, suspension gate, verification email/cooldown, Firebase verification reload, four steps, server-persisted acknowledgement | Same-account web/mobile status acceptance requires both clients to use the canonical Linode profile |
| MP-02 | Firebase UID is the profile key; authenticated REST; correct directory envelope and pagination; strict self-write allow-list; unsaved profile detection; explicit signup failures | Incomplete: legacy web adapter migration, backend route deployment and cross-surface persistence verification |
| MP-03 | Unsupported counts, benefits, enrolled programs, sample resources, organization membership and certificate-empty claims removed; seven actual programs restored | Complete in mobile source |
| MP-04 | Separate loading, genuine empty, unauthenticated, forbidden, unavailable, invalid-response and network states; retries; bounded requests; foreground/online refresh; stale-account guards | Browser verified; device-level native resume acceptance remains for release QA |

## Supported mobile contracts

| Concern | Linode contract / identifier | Mobile treatment |
| --- | --- | --- |
| Authentication | Firebase ID token, Firebase `uid` | Bearer token; Firebase verification refreshed with reload and forced token refresh |
| Membership | `GET /v1/me`, response `uid`, `status`, `agentNumber`, `createdAt` | UID must match current Firebase user. Only server status/number establish membership. `createdAt:null` is an unsaved stub, never a persisted member |
| Profile creation | `POST /v1/me/signup` | Explicit consent with terms/privacy versions; full name, updates=false, directoryVisible=false, source. Must return persisted profile for same UID |
| Self changes | `PATCH /v1/me/profile` | Only full_name, updates, directoryVisible, confirmation_seen. Never sends status, agentNumber, uid or emailVerified |
| Acknowledgement | `confirmation_seen` via self PATCH | Notice dismissed only after response confirms true; reload reads persisted value |
| Directory | `GET /v1/directory?limit=50&offset=…` → `{agents,total,limit,offset}` | Agent/opt-in rows only; render UID, name, initials and agent number. Exclude email/private fields. Failure is not an empty directory |
| Events | `GET /v1/events` → `{events:[…]}` | Preserve event IDs, distinguish request failure from empty list |
| Sessions | `GET /v1/sessions` → `{sessions:[…]}` | Preserve session IDs; only explicitly published content |
| Photos | Not in the verified self PATCH allow-list | No invented profile write or Firebase upload. Requires a Linode upload + profile metadata contract before MP-14 |
| Registrations / organizations | Member journeys still need verified Linode contracts | Not implemented by P0; preserve user/event/application identifiers when implementing MP-06 and MP-16. No Firestore fallback |

## Deployment evidence and remaining MP-02 work

Read-only checks on 25 September returned:

- `/v1/me`: 200, but the supplied smoke-test identity has `createdAt:null` (no saved Linode profile).
- `/v1/directory?limit=1&offset=0`: 404.
- `/v1/events`: 200 with the `events` envelope.
- `/v1/sessions`: 200 with the `sessions` envelope and `published` flag.

The signup route also returned 404 during a failed test request using a non-production test token; no successful profile mutation occurred. The later unit and browser suites replace transport entirely. Schema-only read evidence is in `_p0-review/live-read-contracts.json`; it contains no credentials or tokens.

Backend remote `main` reviewed at `172dd3d0cff2205d5c73c3ec65fded4842997ca0` provides profile read/update but not the signup/directory additions. The local backend has existing unpublished work for those routes and an explicit production deployment restriction in `docs/identity/agents-signup-directory.md`. That work was not overwritten, migrated or deployed by this mobile change.

To finish MP-02 across the system:

1. Review and deploy the existing Linode signup/directory changes with their migrations and authorization checks.
2. Replace the legacy member-facing web Firestore reads/writes with the same Linode API, then deploy that reviewed web change to Netlify. Avoid blind replacement of admin/public handlers; those are outside this task's scope.
3. Reconcile existing member records into Linode using Firebase UID. Preserve server-authorized membership/number, consent, visibility and acknowledgement; do not recreate confirmed members as new Guests. Review collisions before migration.
4. Establish and verify Linode photo, registration and organization-application contracts. Keep P1 UI work tied to real persisted records.
5. With dedicated test identities, update an allowed field on web, reload mobile and compare; update on mobile, reload web and compare. Confirm opt-out removes directory visibility, acknowledgement survives both clients, and unauthorized authority changes fail. Do not mark MP-02 complete before this passes.

## Validation

- Unit suite: `bun test tests/p0-contracts.test.ts`; API transport is mocked, including write allow-lists, malformed schemas, membership authority, error classification and timeout.
- Browser suite: `node _p0-review/check.mjs`; `BROWSER=webkit node _p0-review/check.mjs`. It exercises the real AuthProvider, identity logic, API parsing and UI; only Firebase SDK transport and API responses are replaced. All non-local/non-fixture requests are blocked, so no email or real data write is sent.
- Scenarios: verification and resend cooldown; verified pending state; acknowledgement failure/success/reload; suspension with no content requests; missing profile and failed/successful setup; 401/403 recovery; service failure versus empty list; online refresh; directory unavailable; program/benefit corrections; sign-out failure recovery; delayed old-account profile response.
- Responsive checks: 320, 390 and 430 CSS pixels. Screenshots and results are in `_p0-review/chromium/` and `_p0-review/webkit/`.
- TypeScript, production build and Capacitor asset copy are checked separately. Browser tests do not prove native email delivery, native transport or cross-surface production persistence.

Validation result: TypeScript passed; 18 unit tests passed; all nine scenarios passed in Chromium and WebKit with zero page errors. This is source-level/mobile acceptance, not production end-to-end parity.
