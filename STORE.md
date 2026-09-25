# PAAIPE Capacitor store shell — M-07

**Ticket:** M-07 (Rhowel) + STORE-UX G1 fold-in (Aryhan / Ericson)  
**Machine:** Paul Mac Mini (`dda19f8b-eb87-41f2-89b7-dbfd906862ef`)  
**Path:** `/Users/user/Desktop/PAAIPE-MOBILE-APP`  
**Updated:** 2026-09-24 ~11:25 Asia/Manila (PHT)  
**Git:** none (no init / remote / commit / push)  
**Other trees:** `get-hired-mobile` untouched  

---

## What M-07 did

- Capacitor **8.5.2** (`@capacitor/core`, `cli`, `ios`, `android`) + plugins: `status-bar`, `splash-screen`, `app`
- `capacitor.config.ts` — `appId: org.paaipe.agent`, `appName: PAAIPE`, `webDir: .output/public`
- TanStack Start **SPA shell** so native WebView has a static entry
- Web manifest + `theme-color: #2F6CF0` (M-06 `--sw-blue`)
- **G1 full-bleed:** `html.is-native` kills 390px `.phone-app` cage; desktop web preview keeps cage
- `viewport-fit=cover` + `env(safe-area-inset-*)` on headers + soft floating pill nav
- Placeholder icons only — see `ICONS.md`

### Commands
```sh
export PATH="$HOME/.bun/bin:$PATH"
cd /Users/user/Desktop/PAAIPE-MOBILE-APP
bun run build
bunx cap sync
```

### M-07 blockers
1. Xcode license unaccepted (human `sudo xcodebuild -license`)
2. No Java Runtime on PATH — Android Studio embedded JDK / `JAVA_HOME`
3. Icon / splash finals — Codex Correspondent
4. Prefer `bun`/`node` over `python3` (Xcode license)

---

# M-08 — Store honesty P0 (2026-09-24 ~11:10 Asia/Manila / PHT)

**Local only** — no git / no Firebase / no Ericson ping / `get-hired-mobile` untouched.

## Done
- Kill Prototype titles/OG → **PAAIPE Agent Portal**
- Remove auth footer “Interactive design prototype — no account data is stored.”
- Hide Agent ID chip until real ID (no em-dash)
- Notifications bell → empty-state sheet (not silent no-op)
- Events Register + Calendar removed; honest empty-note
- Kept M-05 motion, M-06 soft-widget, M-07 `html.is-native` + safe-area; fonts Poppins (auth) / Inter (portal)

## M-08.1 — Terms/Privacy URLs (2026-09-24)
Signup legal links retargeted to live policy pages (HTTP 200):
- Terms: https://paaipe.org/terms-of-use
- Privacy: https://paaipe.org/privacy-notice

---

# M-09 — Firebase Auth + api.paaipe.org (2026-09-24 ~11:25 Asia/Manila / PHT)

**Local only** — no git init/remote/push · no Ericson ping · `get-hired-mobile` untouched · **no new Firestore collections**.

## Done

### Auth (Firebase JS SDK web in Capacitor WebView)
- Installed `firebase` + `@capacitor/browser`
- Config = PAAIPE web app (NOT PostFlow) via `.env.local` `VITE_FIREBASE_*` (see `.env.example`)
- `browserLocalPersistence` so refresh keeps session
- Real email/password sign-up / sign-in; `onAuthStateChanged` gates portal vs onboarding
- Logout: `signOut` → clear profile state → onboarding
- Forgot password: `sendPasswordResetEmail` (no dead control)
- Google Sign-In: OUT
- Fake any-password enter path removed

### Consent versions
- Match web `DOC_VERSIONS`: terms `"1.0"`, privacy `"1.0"`
- Sent on `POST /v1/me/signup` as `termsVersion` / `privacyVersion`

### Membership honesty
- Signup = **Guest** until admin promotes; UI never invents “Agent” for guests
- Labels from API `status` when available (`Guest` / `Confirmed Agent` / `Suspended`)
- Agent ID chip only when `agentNumber` non-null
- Chrome uses Firebase `displayName` or `/v1/me` `full_name` (fallback email local-part)

### API (Linode)
- Base `https://api.paaipe.org` · media `https://media.paaipe.org`
- Transport: **CapacitorHttp** (`@capacitor/core`) so native requests have **no browser Origin** (CORS allowlist not ready)
- Web Dev fallback: CapacitorHttp → fetch (browser may still hit CORS — use native or proxy)
- After auth: `GET /v1/me` with `Authorization: Bearer <Firebase idToken>`
- First signup: `POST /v1/me/signup` — on **404/503** keep Firebase session + show “profile sync pending”
- Optional `PATCH /v1/me/profile` when row exists
- Public `GET /v1/events` + `GET /v1/sessions`; directory empty when `/v1/directory` 404 / unauthed
- No hard-coded Paul Espinas once signed in

### M-08.1 legal links (confirmed)
- Terms: https://paaipe.org/terms-of-use
- Privacy: https://paaipe.org/privacy-notice
- Native: `@capacitor/browser` → system browser
- Web: `target=_blank` / `window.open`

### Kept
- M-05 motion, M-06 soft-widget, M-07 full-bleed/safe-area
- Poppins auth / Inter portal

## Bearer + CORS strategy
1. Firebase Auth issues ID token (`user.getIdToken()`)
2. Every authenticated API call sets `Authorization: Bearer <token>`
3. Prefer `CapacitorHttp.request` (native: no Origin header)
4. Pure web Dev may fail CORS until allowlist includes the Vite origin — not a product bug; use Capacitor native or temporary proxy

## Blockers (honest)
1. **`POST /v1/me/signup` → 404** on prod today — client keeps session + “profile sync pending” (Tab 08 / backend signup route)
2. **`GET /v1/directory` → 404** — empty directory state
3. **Firebase console**: Email/Password provider must be enabled for project `postflowit-autos` (PAAIPE web appId)
4. **Xcode license** unaccepted — native iOS compile may fail
5. **No JRE on PATH** — Android Gradle needs Android Studio JDK / `JAVA_HOME`
6. **Web CORS**: browser Dev against `api.paaipe.org` may be blocked until Origin allowlist

## Smoke
| Check | Result |
|-------|--------|
| `bun run build` | PASS (prerender `/`) |
| `bunx cap sync` | PASS — android + ios; plugins include Browser |
| Fake any-password path | GONE |
| Refresh keeps session | `browserLocalPersistence` + `onAuthStateChanged` (code-path verified; interactive login needs Email/Password enabled) |
| Logout | Drawer Logout → `signOut()` → onboarding |
| Native run | NOT RUN (Xcode license / JRE blockers) |
| Web @390 | Build green |

## Files touched
- `.env.local`, `.env.example`, `.gitignore`
- `src/lib/firebase.ts`, `auth-context.tsx`, `api.ts`, `profile-display.ts`, `legal-links.ts`
- `src/components/mobile-onboarding.tsx`, `mobile-agent-portal.tsx`
- `src/routes/index.tsx` (`AuthProvider`)
- `src/styles.css` (auth-error / auth-info)
- `package.json` / lockfile (`firebase`, `@capacitor/browser`)
- `STORE.md` (this section)
- Capacitor ios/android plugin lists (Browser)

## Explicitly NOT done
- Git init / remote / push
- Firestore collections
- Google Sign-In
- Touching `get-hired-mobile`
- Store upload / icon finals

# M-10 — Dead-CTA honesty (Ericson store-UX #11) — 2026-09-24 ~11:40 Asia/Manila (PHT)

**Local only** — no git push/merge/deploy · no Ericson ping · `get-hired-mobile` untouched · no screenshots / banners / Tab 08 / CORS / native sim.

## Goal
Every chevron/button that looks tappable does a real action, **or** the affordance is stripped. Prefer strip over fake “coming soon”. Honest empty states OK. Aryhan additive: Community spotlight must not show a fake named member (Melody Belza chrome emptied).

## Stripped
| Control | Change |
|---------|--------|
| Profile → Edit profile | Row removed (no edit flow) |
| Community → View all | Removed |
| Community → Melody Belza + ChevronRight | Replaced with honest empty: “Spotlight members will appear here when available.” |
| Directory → member cards | `button`+chevron → display-only `article.member-card` (no chevron) |
| Organization → Team members | Button+chevron → static `settings-static` row |
| Certificates → fake issued card + Download/Share | Removed; honest empty only |
| Resources → Download affordance | Display-only `settings-static` rows + note downloads aren’t in this build |
| Programs → enroll implication | Informational cards; “Open”→“Available”; note enrollment not in this build |
| Events → Past / Online filter pills | Removed; non-interactive “Upcoming” chip only |
| Learn → Sessions pill | Non-interactive selected chip (Resources stays wired) |
| Home → upcoming date as text-link | Stripped to `meta-date` (display-only) |

## Wired
| Control | Action now |
|---------|------------|
| Organization → Contact email | `mailto:hello@paaipe.org` |
| Organization → Website | `openExternalUrl("https://paaipe.org")` |
| Home → See all | → Learn tab (existing) |
| Learn → Resources pill | → Resources detail (existing) |
| Learn session rows / Home continue | → Session detail (existing) |
| Home event card | → Events tab (existing) |
| Profile → Certificates / Organization / Benefits | → detail screens (existing) |
| Community → Directory / Programs tiles | → detail screens (existing) |
| Session materials → Slides / Notes | → Resources (existing) |
| Drawer links + Logout | navigate / signOut (existing) |
| Notifications bell | empty sheet (M-08/G7 — untouched) |
| Auth forgot / Terms / Privacy | already real (M-09); **sizing only** ≥44pt via CSS |

## Optional thin (≥44pt)
- Header `icon-button` / `header-avatar` → 44×44
- `text-link` (See all) min hit area 44pt
- Auth `forgot-link` + `.terms-row a` min hit area 44pt (`mobile-onboarding.tsx` layout untouched)

## Kept intact
- Soft-widget + Inter (M-06)
- M-05 bottom nav motion
- M-07 full-bleed / safe-area
- M-09 Firebase auth / API / session
- Notifications empty sheet (not rebuilt)

## Smoke
| Check | Result |
|-------|--------|
| `bun run build` | PASS |
| Fake Melody Belza | GONE |
| Edit profile dead row | GONE |
| Cert Download/Share | GONE |
| No git / no Ericson / get-hired-mobile | untouched |

## Files touched
- `src/components/mobile-agent-portal.tsx`
- `src/styles.css` (M-10 block + meta-date)
- `STORE.md` (this section)
- `mobile-onboarding.tsx` — **not modified** (hit targets via CSS only)


---

# M-11 — Home + Events banners (2026-09-24 ~11:33 Asia/Manila / PHT)

**Local only** — no git push/deploy · no Ericson ping · `get-hired-mobile` untouched.

## Done
- Drop-in GPT Home banner + Codex-2 Events banner (`public/banners/{home,events}/` @1x/@2x/@3x)
- `BannerSlot` srcset; `.has-image` strips dashed chrome + slot shadow; `object-fit: cover` + `overflow: hidden`
- Learn/Community placeholders unchanged
- `bun run build` PASS; shots `_m11-review/home-390.png` + `events-390.png`
- Double-frame: mild structural YES (slot 22px clips baked shadow); visual OK — no square re-export

---

# Submission readiness — 2026-09-24 PHT (Rhowel packaging)

**Local only** — no git init/remote/push · no App Store Connect / Play Console upload · `get-hired-mobile` untouched.  
**Aryhan DoD folders:** `_store-upload/ios-6.7/` · `ios-6.5/` · `play-phone/`

## DONE (closeable without Paul console / sudo / JRE / inventing art)

| Area | Status |
|------|--------|
| M-01…M-13 product shell | Soft-widget UI, honesty (M-08/M-10), Firebase Auth (M-09), banners Home/Events (M-11), frames 1–5 (M-12/M-13) |
| Capacitor shell | `appId: org.paaipe.agent`, `appName: PAAIPE`, `webDir: .output/public`, theme `#2F6CF0` |
| Auth honesty | Guest until promote; Agent ID only when real; listing flag **OFF** by default |
| Banners | Home (GPT) + Events (Codex-2) live; Learn/Community dashed placeholders = **parallel polish, not screenshot-pack blockers** |
| Screenshots packaged | `_store-upload/` — 15 PNGs (5×3 sizes) + README / MANIFEST / SUBMISSION-CHECKLIST / LISTING-COPY |
| Frame 1 | **listing** Home from `_m13-screenshots/frame-01-home-listing-*` (not sync-pending m12 Home) |
| Profile in shots | **Guest** (honest) |
| `bun run build` | **PASS** (2026-09-24 ~21:15 PHT) |
| `bunx cap sync` | **PASS** — android + ios; plugins: App, Browser, SplashScreen, StatusBar |
| Legal URLs | Terms https://paaipe.org/terms-of-use · Privacy https://paaipe.org/privacy-notice |

## BLOCKERS — binary / console (Paul / tools; do not soft-pedal)

| # | Blocker | Owner | Blocks |
|---|---------|-------|--------|
| 1 | **Xcode license unaccepted** (`You have not agreed to the Xcode license…` — needs `sudo xcodebuild -license`) | **Paul** | iOS archive / IPA |
| 2 | **No JRE on PATH** (`Unable to locate a Java Runtime`) | **Paul** (Android Studio JDK / `JAVA_HOME`) | Android Gradle / Play AAB |
| 3 | Firebase Email/Password enable in console (if still needed for interactive auth smoke) | **Paul** (Firebase console) | Interactive login verify |
| 4 | `/v1/me/signup` 404 / Tab 08 API gaps | Clarence (not required for this **screenshot pack**) | Profile sync beyond Guest honesty |
| 5 | Learn/Community dashed banners until Codex-3/4 | Ericson/Codex — **parallel polish; NOT a blocker for screenshot pack** | Optional listing polish |
| 6 | Icon/splash final GPT/Codex art | Codex → Aryhan — placeholders in `public/icons/` + ICONS.md | Store icon slots before binary submit |
| 7 | Console upload of screenshots | **Aryhan** after **Paul** auth | Listing live in Connect / Play |

## Screenshot pack readiness

- **Ready for Aryhan console upload of screenshots? YES**
- Path: `/Users/user/Desktop/PAAIPE-MOBILE-APP/_store-upload/`
- **Ping:** Rhowel → Aryhan (package ready; Paul authorized packaging)

## Binary readiness

| Target | Ready? | Why |
|--------|--------|-----|
| iOS archive | **NO** | Xcode license |
| Play AAB | **NO** | No JRE |

## Explicitly NOT done this pass

- Console login / upload
- Inventing Learn/Community banner art or icons
- Git remote / push / deploy
- Changing Guest honesty or listing-flag default ON
- `xcodebuild` archive attempt (license fails first)
