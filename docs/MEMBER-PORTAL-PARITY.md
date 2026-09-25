# PAAIPE mobile — member/agent portal parity backlog

Audit date: 25 September 2026.

Reference: [Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs), remote `main` at `434a27d55846e50cc45801268a9e63d615bfb5ea` (20 September 2026). Mobile: `/Users/user/Desktop/PAAIPE-MOBILE-APP`, including the Teresa-style inner-screen updates.

Scope: signed-in members/guests and confirmed agents only. Excludes admin functions and public website development. Includes authentication and event registration pages only where they are part of a member's portal journey.

This is a source-code audit, not a claim that every remote feature works on the deployed production backend. “Implemented on web” means a UI and handler were found. Some handlers mix Firestore and REST; some comments describe older deployment states. Validate the deployed contracts before implementation. A source snapshot is in `_parity-audit/`.

## Audit-time mobile baseline

Already present: email/password sign-up and sign-in, password-reset email, persisted Firebase session, sign-out, API profile read, honest Guest/Agent labels, event list with Upcoming/Past filter, session list and title search, selected session detail with external YouTube launch when a URL exists, basic directory name/role search, and navigation to all inner screens.

The mobile UI now resembles Teresa, but this is not functional parity. Organization, certificates, resources, programs, and community are largely static or empty. Mobile currently calls only profile, events, sessions and directory endpoints; its profile PATCH helper is not connected to an editor.

Priority meanings: **P0** correct claims, identity, and data boundaries; **P1** reproduce implemented member journeys; **P2** secondary parity and reference-screen coverage. Separate “shared unfinished work” from required reproduction of working web behavior.

## Development checklist

### P0 — foundations and immediate corrections

Implementation update: MP-01 and MP-04 are implemented in mobile and pass mocked Chromium/WebKit validation; MP-03 is implemented. MP-02 remains open for Linode/web deployment and cross-surface verification. See [P0 implementation and contracts](P0-DATA-CONTRACTS.md). Architecture confirmed by the owner: Linode application data, Firebase users/authentication, Netlify web hosting. Legacy Firestore references below describe audited code that needs migration.

- [ ] **MP-01 — Align membership lifecycle and access.** Add unverified guest → verified guest awaiting confirmation → confirmed agent status, verification-email send/resend, refreshed verification state, four-step membership progress, and the one-time confirmation acknowledgement. Keep agent numbers server-assigned. Handle suspended accounts explicitly, especially member materials. Web currently has `GATE_GUESTS = false`; do not introduce a blanket confirmed-agent-only paywall. **Done when:** web and mobile show consistent state for the same identity and never promote an account locally. Sources: `paaipe-firebase.js`, `paaipe-portal.js`, `paaipe-members-only.js`.

- [ ] **MP-02 — Unify member application data on Linode.** Establish shared identifiers and persistence for profiles, directory visibility, photos, registrations, organization applications and membership acknowledgement. Audited web code still contains legacy Firestore calls that must be migrated to Linode; mobile uses the canonical REST architecture. Verify compatible reads/writes rather than assuming the existing mobile PATCH endpoint covers every field. **Done when:** an authorized update on one surface survives refresh and appears on the other.

- [x] **MP-03 — Remove contradictory sample claims.** Benefits must match the web's “Coming soon; nothing to claim yet.” Replace mobile's AI for Business / Responsible AI / Agent Builders list and fabricated “Enrolled” state with the actual seven-program roadmap. Review fixed “5 connected,” “5 confirmed agents,” sample resource titles/page counts, and unsupported stats. Show facts or explicit unavailable states. **Done when:** mobile makes no entitlement, enrollment, attendance, connection, or organization-membership claim unsupported by actual data.

- [x] **MP-04 — Distinguish load failures from empty accounts.** Existing mobile list functions catch failures and return `[]`. Add separate loading, empty, signed-out/forbidden, network failure and retry states; refresh stale profile/data after returning to the app. **Done when:** an API outage cannot look like “no certificates/events/members.” This is also necessary for fair parity testing.

### P1 — events, registration, feedback and certificates

- [ ] **MP-05 — Event detail screen.** Add Overview, Feedback and Certificate sections. Overview needs topic/about, speaker information when supplied, expectations, program/schedule, date/time in PHT, format/location, event partners, and state-aware actions. Preserve event identity and support forthcoming/live/past/cancelled states. Mobile currently has list cards only. **Done when:** a listed event opens its own content and actions, not a generic card.

- [ ] **MP-06 — Member registration.** Reproduce the portal-origin registration journey with signed-in name/email prefill and appropriate account-field locking, event-configured questions, validations, consent/version fields, optional updates choice, duplicate/error handling, persisted registration receipt and return to the same event. Web currently submits via Firestore; do not invent a REST route. **Done when:** successful registration corresponds to a stored record and survives reopening the event. Do not copy the web catalog's hardcoded `listedRegistered` flags as proof of a user's registration.

- [ ] **MP-07 — Join, calendar and sharing.** Show join availability only when permitted and a real URL is supplied. Support actual Zoom/external links, calendar/ICS or equivalent native action, and event sharing. Distinguish registration acknowledgement from join-link availability. **Done when:** unavailable links are explained and valid actions open the correct event/time. Native calendar/share implementation is an adaptation of web behavior, not a new reminders service.

- [ ] **MP-08 — Event feedback.** Fetch configured questions and the server feedback window; support scale, yes/no and short-answer inputs, required validation, own-registration association, submitted/already-submitted states, and closed-window handling. Submit once and preserve answers on retryable failure. **Done when:** the same account sees its submission across web/mobile and feedback cannot be submitted for another member.

- [ ] **MP-09 — Per-event certificate.** Read certificate eligibility/state and real returned media links. Reflect registration/feedback requirements, pending and issued states. After feedback submission, show a thank-you and open the Certificate section without falsely declaring a file issued. Support actual certificate view/download and email action. **Done when:** only server-issued certificates appear and existing issued certificates remain accessible after the feedback window closes.

- [ ] **MP-10 — My Certificates library.** Replace the permanent empty note with the account's certificate list; add search, year and series filters, date/name sorting, year grouping, event links, view/download/email actions and accurate empty/error states. Handle cards missing `eventId` or file URLs without inventing actions. **Done when:** the same account sees the same issued records on both surfaces. Endpoint deployment requires verification; web code explicitly anticipates an unavailable list endpoint.

### P1 — learning and member resources

- [ ] **MP-11 — Sessions, Micros and Playlists.** Expand Learn beyond one flat session list. Add all three web hub sections, published-only content, sessions/micros playlist types, playlist detail and ordered items, poster/description metadata and correct empty/error states. **Done when:** all published library content available in the web hub is reachable in mobile.

- [ ] **MP-12 — In-app playback and recording selection.** Add equivalent YouTube and uploaded-video playback, 16:9 session and 9:16 micro layouts, available recording/part selection, playback cleanup on close/navigation, and share/copy links that identify the actual item. Current mobile only launches a YouTube URL externally. **Done when:** supported media plays from its actual record in mobile, and no fake watch percentage or completion state appears. Saved progress/offline downloads are not established web capabilities in this audit.

- [ ] **MP-13 — Real resources and slide viewer.** Replace three sample text rows with the real member resource catalog. Match format filters (Slides, PDF, Template, Checklist, Docs), material metadata, item links, share/copy behavior and return to the originating session. Support embedded viewing where allowed and an explicit external-open fallback for Gamma, which the web already uses. **Done when:** the real published slide deck opens correctly, missing formats have honest empty states, and no unsupported file download is promised.

### P1 — personal identity, directory and organizations

- [ ] **MP-14 — Profile photo and directory visibility.** Add photo selection, square crop/zoom, JPEG/PNG/WebP validation and size limit, upload/persist/remove, initials fallback and shared avatar rendering. Add persisted directory opt-in with Guest explanation and rollback on save failure. **Done when:** changes appear in web and mobile; uploading bytes without persisting the profile is not reported as success.

- [ ] **MP-15 — Agent detail and self preview.** Add tappable directory entries leading to name, agent number, photo, role, location, tags and supplied biography/links; add own-profile preview and appropriate missing/not-found states. The web implements founding-agent detail and self-preview, but its directory itself is largely static. Preserve opt-in/privacy semantics; verify a suitable data contract for arbitrary API members rather than pretending the web has a complete live detail endpoint. **Done when:** each supported person opens the correct profile and no missing data is filled with another person's content.

- [ ] **MP-16 — My Organizations.** Replace the static PAAIPE association card with the user's organization list (zero/one/many). Add create/edit with required name and optional validated website, save/error states, and derived Not published / Under review / Partner labels. Do not equate the personal “company” profile field with an organization record. Web v1 does not let members delete organizations or assign their own Partner status. **Done when:** owned organizations and changes agree on web/mobile.

- [ ] **MP-17 — Apply as Partner.** From an eligible event or owned organization, select an event accepting applications, prefill organization/contact details, collect support types/message, submit and display a real acknowledgement/reference. Reflect existing application status where available. **Done when:** the application is stored and review state appears accurately; mobile cannot approve or publish it. This is member-side application work, not admin development.

### P2 — navigation and secondary parity

- [ ] **MP-18 — First-entry chooser.** Add Watch Sessions / MicroLearning / Join Events / Become a Partner with Skip, remembering the choice per account as the web does. Route directly to the corresponding mobile destination. This is post-sign-in orientation, separate from the existing welcome carousel.

- [ ] **MP-19 — Deep links and return destinations.** Give events, feedback/certificate sections, sessions/micros, playlists, profiles and resources stable route parameters. Support reopening shared links, retaining the intended destination through sign-in, and predictable device Back behavior. Mobile currently uses in-memory `active`/selected-session state. Native app/universal links need platform configuration; at minimum shared portal URLs must map to the correct in-app content when opened there.

- [ ] **MP-20 — Member sign-in options and recovery completion.** Add equivalent Google sign-in and a tested native callback flow if the same login options are required. Email/password and reset-email sending already exist. Verify password-reset link completion and return to the app rather than assuming email sending completes recovery. Keep profile/consent creation consistent. Any extra store-specific sign-in requirement should be assessed separately at release time.

- [ ] **MP-21 — Home, announcements and roadmap coverage.** Match the portal's entry points to Learnings, Events, Benefits, Resources, Directory, Programs, Announcements, Profile, Certificates and Organizations. Add useful next-event/registration and membership progress summaries from trusted data. Include the actual program roadmap: AI Exchange, AI Safari, Build Nights, Certification Pathways, Member Spotlight, Regional Circles, Mentorship. Provide an Announcements destination rather than treating the existing Community network card as equivalent. Static editorial content can be mirrored; dynamic activity/social claims need the additional work below.

## Shared unfinished web features — do not count these as proven working parity

These items are visible in the reference but their end-to-end implementation was not found in the audited page scripts. Developing them would extend both products, not merely port working web behavior.

| Area | Evidence and implication |
|---|---|
| Full profile editor | `portal-profile.html` has role, company, persona/sector, location, AI experience, LinkedIn, goals and skills fields plus Save changes. Its loaded scripts wire identity, photo and directory visibility, but no general Save changes handler was found. Build a real editor/shared persistence contract as an additional workstream; do not claim all profile editing already works on web. |
| Mentoring preferences | “Open to mentoring” / “Looking for a mentor” are decorative toggles in profile markup. Persistence and matching workflow need development. |
| Directory filtering and Connect | Sector/location/mentoring controls and Connect copy exist, but no working filter or mutual-introduction submission handler was found on this page. Member detail links work. Live filtering and consent-based introductions are separate shared work. |
| Program participation | Safari interest lists, Build Nights waitlist, certification notifications, spotlight nominations, circles and mentorship applications appear as planned controls. `paaipe-programs.js` mainly populates the next Exchange; enrollment/list-join handlers were not found. Mirror truthful “In development” content first; build participation only with agreed contracts. |
| Community social functions | Announcements/discussion rows, like/comment counts, Post, New topic and Share controls are static markup without identified social persistence handlers. Live posting, reactions, comments and moderation dependencies need a separate backlog. |
| Dashboard statistics | Fixed attendance/streak/badge/progress numbers and registration flags exist in web markup/catalog data. Do not transfer these as personal facts. Define real data sources before showing them. |
| Global search and notifications | The shared header search and notification indicator are mostly decorative. A full cross-content search, push notifications, notification inbox/unread state are not established web parity requirements. |
| Benefits redemption | Web Benefits explicitly says “Coming soon.” A benefits marketplace, claims or redemption engine would be new development. |

## Integration inventory to verify

| Flow | Source contract found |
|---|---|
| Identity | Firebase Auth; named PAAIPE Firestore agent profiles on web; mobile `GET /v1/me`, `POST /v1/me/signup`, `PATCH /v1/me/profile`. Reconcile fields and ownership. |
| Registration | Web `submitRegistration()` writes the registrations collection. Member-prefill/return helpers are separate. Verify intended server API before replacing this with REST. |
| Learning | `GET /v1/sessions`, `/v1/sessions/{id}`, `/v1/micros`, `/v1/micros/{id}`, `/v1/playlists?kind=sessions|micros`, `/v1/playlists/{id}`, `/v1/playlists/{id}/items`. Bare `/v1/playlists` is not the documented contract. |
| Feedback | `GET /v1/events/{eventId}/feedback/questions`, `GET .../feedback/window`, `POST .../feedback/responses`, `GET .../feedback/responses/{registrationId}`. Own-member authorization must hold. |
| Certificates | `GET /v1/me/events/{eventId}/certificate`, `POST .../certificate/email`, `GET /v1/me/certificates?q=&year=&sort=`. Client-side series filtering; only approved returned file URLs. |
| Organizations | `GET/POST /v1/me/organizations`, `PATCH /v1/me/organizations/{id}`; partner applications use `POST /v1/partner-applications`. Web reads own applications from Firestore; verify mobile read contract. |
| Photos | Web media upload helper plus profile `photoUrl` persistence. Inspect `paaipe-media.js` and ownership rules before implementing mobile upload; never manufacture a media URL. |
| Resources | Web catalog includes static cards and session slide metadata; a general resources REST endpoint was not established. Choose a shared source deliberately. |

## Recommended delivery order and acceptance

1. **Foundation:** MP-01–04. Correct content/claims and agree on shared contracts.
2. **Complete event journey:** MP-05–10, with event routing from MP-19. Registration → join → feedback → issued certificate → library. Verify on both surfaces with dedicated test records.
3. **Learning:** MP-11–13 and item/playlist deep links. Test one YouTube session, one uploaded recording, one micro, one playlist and the real Gamma deck.
4. **Member and organization tools:** MP-14–17. Cross-surface photo/visibility and organization/application verification.
5. **Remaining parity:** MP-18–21. Then separately scope unfinished web features rather than silently adding them to the parity commitment.

For every implemented journey test signed-out, unverified guest, verified guest, confirmed agent and suspended states as applicable; success, empty, unavailable endpoint and retry cases; reopen and cross-surface persistence; iOS and Android on-device behavior. A matching screenshot alone is not acceptance.

## Reference files

All web links are pinned to the audited commit:
- [assets/js/paaipe-portal.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-portal.js)
- [assets/js/paaipe-firebase.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-firebase.js)
- [assets/js/paaipe-members-only.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-members-only.js)
- [assets/js/paaipe-portal-events.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-portal-events.js)
- [assets/js/paaipe-register-from-portal.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-register-from-portal.js)
- [assets/js/paaipe-register-questions.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-register-questions.js)
- [assets/js/paaipe-my-certificates.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-my-certificates.js)
- [assets/js/paaipe-session-view.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-session-view.js)
- [assets/js/paaipe-profile-photo.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-profile-photo.js)
- [assets/js/paaipe-organization.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-organization.js)
- [assets/js/paaipe-events-data.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-events-data.js)
- [assets/js/paaipe-partner.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-partner.js)
- [assets/js/paaipe-agent-view.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-agent-view.js)
- [assets/js/paaipe-entry-popup.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-entry-popup.js)
- [assets/js/paaipe-api.js](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/assets/js/paaipe-api.js)
- [portal-profile.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-profile.html)
- [portal-directory.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-directory.html)
- [portal-community.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-community.html)
- [portal-programs.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-programs.html)
- [portal-benefits.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-benefits.html)
- [portal-resources.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-resources.html)
- [portal-session-slides.html](https://github.com/Upupapp/PhilippineAssociationOfAIProfessionalsAndEntrepreneurs/blob/434a27d55846e50cc45801268a9e63d615bfb5ea/portal-session-slides.html)
