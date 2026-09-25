# PAAIPE Mobile Web — STORE-UX scan findings

**Scan time:** 2026-09-24 ~10:59 Asia/Manila (PHT)  
**Tree:** machine `dda19f8b-eb87-41f2-89b7-dbfd906862ef` → `/Users/user/Desktop/PAAIPE-MOBILE-APP`  
**Live smoke:** `http://localhost:8080/` → HTTP 200 (Vite/TanStack Start). Title still **“PAAIPE Agent Portal — Mobile App Prototype”**.  
**Scope:** inventory only — no implement / git / deploy. Soft-widget + Inter post-auth noted as shipped (M-06).  
**Stack:** Lovable TanStack Agent Portal web app (not Flutter). Future store path = Capacitor wrap.

---

## 0. Architecture snapshot (routes / deep links)

| Item | Fact |
|------|------|
| File routes | Only `/` (`src/routes/index.tsx` → `MobileAgentPortal`). `src/routeTree.gen.ts` confirms `fullPaths: '/'`. |
| In-app “screens” | React state: `onboarded` + `active` view (`Home` \| `Learn` \| `Events` \| `Community` \| `Profile` + details `Directory` \| `Benefits` \| `Organization` \| `Certificates` \| `Resources` \| `Programs` \| `Session`). |
| Deep links | **None.** `/signin`, `/learn`, `/manifest.json` → **404** (smoke). Shareable URLs / push deep links not possible without new routes. |
| Shell | `.app-stage` > `.phone-app` max-width **390px**; post-auth adds `.portal-shell`. |

---

## 1. Fake / prototype UX still user-visible post-auth

Concrete gaps in `src/components/mobile-agent-portal.tsx` (line hints):

### Hard-coded identity / demo data
- **Paul Espinas / PE** baked into header greet (L211), Home copy “Magandang araw, Paul.” (L312), drawer identity (L275–277), Profile hero (L382). Not derived from auth form.
- **Agent ID = em dash “—”** in Home identity strip (L313) — empty credential slot still visible.
- **Membership** always “Confirmed Agent” (L313, L277, L382).
- **Profile strength 82%** hard-coded bar (L382 + CSS `.completion em { width: 82% }`).
- Static lists: `library` (L82–86), `directory` (L88–93: Melody Belza, Ana Reyes, Kathryn Uy, Marisol Tan), `benefits`, `resources`, `programs`, featured event **PAAIPE AI Exchange / Sep 25**, stats band **05 / 04 / 12** (L334–336), certificate **ISSUED SEP 2026** (L411).
- Org contact **hello@paaipe.org** / **paaipe.org** (L405) — display-only rows with chevrons, no navigation.

### Banner slots (placeholders only — see §4)
- Home, Learn, Events, Community each render `<BannerSlot label="Banner" />` (L316, L344, L354, L373) → dashed empty card with literal “Banner” label (`aria-label="Banner placeholder"`).

### Dead / non-persisting CTAs
| Control | Location | Behavior |
|---------|----------|----------|
| Notification bell | Header L219 | `aria-label="Notifications"` only — **no onClick**, no panel/list. CSS hides badge (`.portal-shell .notification-button span { display: none }` ~L1255). |
| Register | Events L359 | `type="button"` — **no handler**; does not register. |
| Calendar / Saved | Events L359 | Toggles local `saved` boolean only — **no calendar API / persistence**. Soft-note (L366) claims “Reminders land in your inbox…” — copy overpromises. |
| See all | Home Continue learning L319 | Navigates to Learn tab (works) — OK as tab jump, not a real library route. |
| View all | Community spotlight L375 | `<span className="text-link">` — **not a button**, no handler. |
| Spotlight card | L376 | Chevron affordance, **no onClick**. |
| Member cards | Directory L392 | Buttons with chevron, **no profile destination**. |
| Edit profile | Profile L383 | Button with chevron, **no onClick**. |
| Org rows (email / website / team) | Organization L405 | Buttons, **no onClick** / no `mailto:` / no external link. |
| Certificate Download / Share | L411 | Buttons, **no handlers**. |
| Resources list Download | L418 | Buttons show Download icon, **no file download**. |
| Session player | L430–431 | Cover + play disc — **no playback**; progress bar CSS hard-wires **68%** (`.progress-line i { width: 68% }`) independent of real progress. |
| Filter pills Learn | L346 | Sessions selected; **Micros / Playlists** no logic; only Resources has `onClick`. |
| Filter pills Events | L353 | Upcoming selected; **Past / Online** no logic. |
| Programs cards | L424 | Display Enrolled/Open — **no join/enroll action**. |
| List event “Member briefings” | L361–365 | Static article — no Register. |

### Search
- Home Search icon (L217) → jumps to Learn tab.
- Learn / Directory search inputs filter **in-memory static arrays** only (L341–342, L388–389) — no backend.

### QR / scanner
- **No QR, camera, scanner, or barcode** references anywhere under `src/` (grep empty). Not even a stub UI.

### Prototype labeling still live
- Document title / OG: **“…Mobile App Prototype”** (`src/routes/index.tsx` L10–12; live HTML confirmed).
- package.json `"name": "tanstack_start_ts"` — not store-facing, but unmarked product name.

---

## 2. Auth / onboarding vs portal (store blockers noted; auth out of soft-widget polish)

File: `src/components/mobile-onboarding.tsx`

| Gap | Detail |
|-----|--------|
| Fake auth | Form `submit` → `event.preventDefault(); onEnter();` (L53). Any valid-looking email/password enters portal. **No API, no tokens, no validation against a backend.** |
| No persistence | Explicit footer: **“Interactive design prototype — no account data is stored.”** (L75). `onboarded` is React `useState(false)` only — refresh returns to onboarding. |
| Inputs discarded | Name / email / password never stored or passed into portal; portal always shows Paul Espinas. |
| Forgot password | L71 — button with **no handler**. |
| Terms / privacy | Checkbox required (L70) but **no links** to actual policies (store risk for account creation). |
| Skip button | **No explicit Skip** — but auth is effectively skippable by submitting any credentials. |
| Hard-coded paul@ | **No `paul@…` email string** in code. Demo identity is **name/initials Paul Espinas / PE**, not an email autofill. |
| Decorative alts | Signup parallax imgs use `alt=""` (L59–60) — OK as decorative; welcome slides have real alts (L13–15). |

Logout (portal L290): sets `setOnboarded(false)` → back to onboarding; no session revoke (none exists).

---

## 3. Existing assets / Capacitor / PWA / icons

| Asset | Status |
|-------|--------|
| **Capacitor** | **Absent.** No `capacitor.config.*`, no `@capacitor/*` in `package.json`, no `android/` / `ios/` / `www/`. |
| **Web manifest / PWA** | **Absent.** No `manifest.webmanifest` / `manifest.json`; `/manifest.json` → 404. No service worker. |
| **Favicon** | `public/favicon.png` — **64×64 PNG**; linked in `__root.tsx` L101. Too small for App Store / Play icon sets. |
| **App icon / splash** | **None** (no apple-touch-icon, no adaptive icons, no splash screens). |
| **PWA / iOS meta** | Viewport is `width=device-width, initial-scale=1` only — **no `viewport-fit=cover`**, no `theme-color`, no `apple-mobile-web-app-*`. |
| **Brand / content images** | `src/assets/paaipe-logo.png` (720×251), onboarding robot/tokens/people (1024²), `ai-exchange-cover.png` (1600×420) used as **Session** cover only (not Events hero — Events uses soft-widget wash). |
| **Screenshot folders** | `_m02-review` … `_m06-review`, `_m04-before`, `_m05-before`, `design-handoff/m06/` — **internal review/handoff PNGs**, not App Store / Play listing screenshot packs. |
| **robots.txt** | Present; allows all crawlers. |

---

## 4. Banner slot inventory (JSX + CSS)

**Component:** `BannerSlot` L301–307 — empty `.banner-slot` with text label.  
**CSS:** `src/styles.css` ~L1404–1428 (`.portal-shell .banner-slot` dashed soft card, 16:9, “no invented art”).

| Screen | Has `<BannerSlot>`? | Content vs placeholder |
|--------|---------------------|------------------------|
| **Home** | Yes (L316) | **Placeholder** (“Banner”) |
| **Learn** | Yes (L344) | **Placeholder** |
| **Events** | Yes (L354) | **Placeholder** |
| **Community** | Yes (L373) | **Placeholder** |
| Profile / details | No | N/A |

No CMS/image/source wired; all four are empty slots.

---

## 5. Notification bell, search, drawer logout, routes

### Notification bell
- Rendered on every post-auth header (L219).
- **UI-only:** no click handler, no sheet, no unread count in DOM (badge CSS forced `display: none` under `.portal-shell`).

### Search
- Home: icon → `selectTab("Learn")`.
- Learn / Directory: client filter of static mock lists.

### Drawer
- Open via Home avatar **PE** or Menu icon (L204–206).
- Account + General menus navigate in-app views (wired).
- **Logout** (L290): closes drawer + `setOnboarded(false)` only.

### Routes list (effective)
1. `/` — only real URL (onboarding or portal shell).  
2. In-memory views: Home, Learn, Events, Community, Profile, Directory, Benefits, Organization, Certificates, Resources, Programs, Session.  
3. No hash/query routing for views.

---

## 6. Accessibility / store risk notes

| Risk | Evidence |
|------|----------|
| **Tiny tap targets** | Portal icon buttons ~**36×36** (CSS ~L1239); Apple HIG often expects ≥44pt. `.text-link` has **padding: 0** (~L1327) — “See all” / “View all” hard to hit. Auth `.forgot-link` / `.terms-row span` use **~9–10px** type (`styles.css` auth block). Onboarding `.page-dots` buttons are small hit areas. |
| **Safe-area** | Bottom nav / content use `env(safe-area-inset-bottom)` in several places. **No `safe-area-inset-top`** on sticky `.app-header`; viewport **lacks `viewport-fit=cover`** — notch/Dynamic Island risk under Capacitor WKWebView. |
| **Landscape lock** | **No** orientation / landscape CSS or Capacitor config notes found. Wide desktop still centers 390px phone shell; landscape phones unconstrained. |
| **Alt text** | Logos and session cover have alts; BannerSlot uses `role="img"` + “Banner placeholder”; decorative signup art `alt=""`. Avatars are initials text, not images. |
| **Reduced motion** | Present: `@media (prefers-reduced-motion: reduce)` ~L204, L246 — good. |
| **Prototype / incomplete UX** | App Store / Play reviewers may flag non-functional Register, notifications, downloads, empty banners, “Prototype” title, and fake auth. |
| **Account / legal** | Terms checkbox without linked policies; no privacy policy surface in-app. |
| **Phone-shell vs full-bleed native** | `.phone-app { max-width: 390px }` — Capacitor wrap will still look like a centered 390px web mock unless shell is removed for native. |

---

## 7. Quick smoke (optional, server was up)

- `GET /` → 200, HTML includes onboarding SSR, Inter + Poppins fonts, favicon `/favicon.png`.
- `GET /signin`, `/learn`, `/manifest.json` → 404.
- `GET /favicon.png` → 200.

---

## 8. File index (primary sources)

- `src/components/mobile-agent-portal.tsx` — all post-auth UX / mocks / dead CTAs / banners  
- `src/components/mobile-onboarding.tsx` — welcome + fake auth  
- `src/styles.css` — soft-widget, banner-slot, safe-area-bottom, notification badge hide, tap sizes  
- `src/routes/index.tsx` + `__root.tsx` — titles, viewport, favicon only  
- `public/favicon.png` — sole public icon  
- `package.json` — no Capacitor/PWA deps  
- `BASELINE.md` — prior inventory aligns (notifications UI-only, Paul Espinas demo user, single route)

---

*End of scan. No ranking applied — parent prioritizes store-UX backlog.*
