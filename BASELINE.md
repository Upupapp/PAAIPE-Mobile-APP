# PAAIPE Mobile App — Baseline (M-01)

**Ticket:** M-01 (Rhowel PAAIPE / Aryhan PAAIPE)  
**Machine:** Paul Mac Mini (`dda19f8b-eb87-41f2-89b7-dbfd906862ef`)  
**Path:** `/Users/user/Desktop/PAAIPE-MOBILE-APP`  
**Updated:** 2026-09-24 ~07:49 Asia/Manila (PHT)  
**Git:** none performed (no init / remote / commit / push)

---

## How to run (exact commands)

Bun is installed via the **official installer** at `~/.bun/bin/bun` (**v1.4.2**). Ensure PATH:

```sh
export PATH="$HOME/.bun/bin:$PATH"
cd /Users/user/Desktop/PAAIPE-MOBILE-APP
bun install
bun run dev
```

Dev server (this session): **http://localhost:8080/** (also Network: `http://192.168.1.85:8080/`).

Stop: kill the shell/bun parent or the Node listener on 8080, e.g. `kill 86129` (wrapper) or `kill 86136` (vite/node), or Ctrl+C in the terminal that started `bun run dev`.

Do **not** use npm for this project’s DoD unless owners change package-manager policy.

---

## M-01 run status

| Step | Result |
|------|--------|
| `bun` availability | **PASS** — `/Users/user/.bun/bin/bun` v1.4.2 (official installer → `~/.bun`) |
| `bun install` | **PASS** — 409 packages in ~2.3s |
| `bun run dev` | **PASS** — Vite 8.1.5 ready; Local **http://localhost:8080/** |
| `curl http://localhost:8080/` | **PASS** — HTTP 200, HTML title `PAAIPE Agent Portal — Mobile App Prototype`, onboarding SSR |
| Headless 390×844 smoke (Chrome + puppeteer-core in `/tmp`, not in app tree) | **PASS** — 20/20 checks |
| Minimal UI/FE fixes | **None** |

**Dev server left running:** wrapper PID **86129**, bun **86135**, node/vite listen PID **86136** on port **8080**.

---

## Screen inventory

**Routing:** single TanStack route `/` → `MobileAgentPortal`. All “screens” are in-component state (`onboarded`, `active`), not separate URLs. Extra paths (`/signin`, `/learn`, etc.) return **404**.

### Onboarding / auth (`mobile-onboarding.tsx`)

| Screen | Notes |
|--------|--------|
| Welcome 0 | Robot — “MEET YOUR AI NETWORK” / “Your agent journey starts here.” |
| Welcome 1 | Tokens — “LEARN. EARN. GROW.” |
| Welcome 2 | People — “BUILT FOR COMMUNITY”; CTA **Get started** → signup |
| Sign-up | Name, email, password, terms |
| Sign-in | Email, password; header switcher |

### Bottom tabs

Home · Learn · Events (center nav-book) · Community · Profile

### Detail views

Directory · Benefits · Organization · Certificates · Resources · Programs · Session

### Extras

- Hamburger drawer (account/general + Logout → onboarding)
- Notifications bell (UI only)
- Phone shell `.phone-app` (~390×844 verified in headless smoke)
- Hard-coded demo user “Paul Espinas” / Confirmed agent
- Static demo lists (library, directory, benefits, resources, programs, certificate, event)

---

## Known prototype limits (from UI copy / code)

- Auth footer: **“Interactive design prototype — no account data is stored.”** (confirmed in smoke)
- Submit only calls `onEnter()` / sets `onboarded` — no API, no credential persistence
- Forgot password is non-functional
- Hard-coded content arrays — not live backend
- Register / calendar / Download / Share / Edit profile are UI-only
- Web prototype in phone frame (not native Flutter) — see `roadmap.md`

---

## Gaps vs live web portal (paaipe.org) — high level

1. No real auth / membership session vs production member login  
2. No live directory / CRM sync (demo names only)  
3. No real LMS playback or progress sync  
4. No event registration / payments  
5. No real certificate issuance or verify/share pipeline  
6. No multi-org / team admin beyond a static org card  
7. Single `/` SPA state tree vs multi-page portal IA  
8. No Firebase/Linode/production API wiring (intentionally untouched)

*(Other trees not touched: Philippine-Association-of-AI, PAAIPE-backend, get-hired-mobile.)*

---

## Blockers / next-work notes

1. ~~Bun missing~~ — **resolved** (official installer → `~/.bun/bin`)  
2. Persist PATH (`export PATH="$HOME/.bun/bin:$PATH"`) in shell profiles for future sessions  
3. Homebrew still may need Xcode license if used for other tools (`sudo xcodebuild -license accept`) — not required for bun now  
4. Product decision (later): keep fake auth vs wire real PAAIPE auth  
5. Deep-link routes not implemented (only `/`)  
6. Smoke tooling lived under `/tmp/paaipe-smoke` (not committed to app); screenshots in `/tmp/paaipe-smoke/shots/`

---

## Smoke coverage (M-01)

| Flow | How verified |
|------|----------------|
| Welcome ×3 → Get started → sign-up | Headless Chrome 390×844 — **PASS** |
| Sign-in path + prototype note | Headless — **PASS** |
| Enter portal after fake auth | Headless — **PASS** |
| Tabs Home / Learn / Events / Community / Profile | Headless — **PASS** |
| Details Directory, Programs, Session, Resources, Certificates, Organization, Benefits | Headless — **PASS** |
| HTTP `/` | curl HTTP 200 — **PASS** |
| Deep routes `/signin` etc. | curl **404** (expected; SPA state only) |

---

## Minimal fixes applied

**None** in the app tree. Only documentation update to this `BASELINE.md`. Dependencies installed via `bun install` into local `node_modules` (expected).
