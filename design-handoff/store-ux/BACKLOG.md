# STORE-UX backlog — PAAIPE mobile (Capacitor path)

**From:** Ericson PAAIPE  
**For:** Aryhan → Rhowel (ticket from this)  
**Date:** 2026-09-24  
**Tree:** `/Users/user/Desktop/PAAIPE-MOBILE-APP` (Lovable TanStack Agent Portal web → Capacitor wrap)  
**Visual polish:** M-02–M-06.1 done. This backlog = store-readiness UX only. **Do not implement from this note alone without Aryhan tickets.**

Scan detail: `/workspace/store-ux-scan/FINDINGS.md`

---

## Ericson review gates

### Must Ericson-review **before** Capacitor wrap
| # | Item |
|---|------|
| G1 | Full-bleed native shell (remove 390px phone mock for device builds) |
| G2 | App icon + adaptive Android icon + iOS icon set (final art) |
| G3 | Splash / launch screen |
| G4 | Store screenshot set (composition + which 5–8 frames) |
| G5 | First GPT banner creatives dropped into Home + Events slots |
| G6 | Auth → real identity in portal chrome (no hard-coded Paul) — visual pass only after eng wires data |
| G7 | Notification empty/list sheet chrome (once eng builds it) |

### Can wait until after first Capacitor shell (still before store submit)
| # | Item |
|---|------|
| W1 | Learn / Community banner art (after Home + Events) |
| W2 | Micro density polish on secondary details |
| W3 | Landscape / tablet layout (if we ship phone-only first) |
| W4 | Certificate / resource download success UI |
| W5 | Deep-link landing chrome per route |

---

## Banner art — Codex Correspondent PAAIPE first

Route: **Codex Correspondent PAAIPE** (`8fd5ffd7…`) → GPT finals only → Aryhan → Ericson visual → Rhowel drop-in. Placeholders stay until then.

| Priority | Slot | Aspect | First brief ask |
|----------|------|--------|-----------------|
| **Codex-1** | **Home** | 16:9 soft card | Membership / community welcome campaign |
| **Codex-2** | **Events** | 16:9 | Next PAAIPE AI Exchange / events promo |
| Codex-3 | Learn | 16:9 | Knowledge hub / learning campaign |
| Codex-4 | Community | 16:9 | Network / directory promo (optional) |

Do **not** invent Pillow/GenerateImage/stock banners in-app.

---

## P0 — store / reviewer blockers (ticket first)

1. **P0 — Kill prototype labeling**  
   DoD: Document/OG title no longer says “Prototype”; product name is PAAIPE Agent (or Paul-approved string).

2. **P0 — Real auth + session (eng) with identity in chrome**  
   DoD: Form credentials drive portal name/initials/membership; refresh keeps session; logout clears it. Fake “any password works” gone. Footer “no account data is stored” removed.

3. **P0 — Legal links on account creation**  
   DoD: Terms + Privacy are tappable links to live policies before checkbox submit (store requirement).

4. **P0 — Capacitor shell + full-bleed**  
   DoD: `@capacitor` ios/android projects exist; `.phone-app` 390px cage off for native; `viewport-fit=cover` + safe-area **top + bottom** on header/nav.

5. **P0 — App icon + splash**  
   DoD: iOS AppIcon set + Android adaptive icon + splash (light soft-widget wash, PAAIPE mark). Ericson signs off art before wrap freeze. *(GPT via Codex Correspondent if new marks needed.)*

6. **P0 — Dead primary CTAs → real or removed**  
   DoD: Events **Register** and **Calendar** either persist (API / device calendar) or are hidden/disabled with honest copy. Soft-note no longer claims inbox reminders that don’t exist.

7. **P0 — Notifications: ship empty state or hide bell**  
   DoD: Bell opens a sheet (empty state OK) **or** bell is removed until backend exists. No silent no-op.

8. **P0 — Agent ID**  
   DoD: Show real agent ID from backend **or** hide the Agent ID chip until issued (no permanent “—” in store build).

9. **P0 — Store screenshot pack (design)**  
   DoD: Ericson-approved frame list + sizes ready for listing: iPhone 6.7" (1290×2796), 6.5" (1284×2778), Android phone (1080×1920 or Play’s current). Capture from soft-widget builds, not review folders.

---

## P1 — production UX honesty (before submit)

10. **P1 — Banner slots: Home + Events art live**  
    DoD: Codex-1 + Codex-2 GPT assets in slots; placeholders gone on those two screens.

11. **P1 — Wire or strip secondary dead affordances**  
    DoD: Edit profile, member cards, spotlight “View all”, org email/website (mailto/https), cert Download/Share, resources Download — each either works or loses chevron/button affordance.

12. **P1 — Session / learning progress real**  
    DoD: Progress bar not CSS-hardcoded 68%/82%; reflects stored progress or shows indeterminate/zero honestly.

13. **P1 — Learn / Events filter pills**  
    DoD: Past/Online/Micros/Playlists either filter real data or are removed until data exists.

14. **P1 — Deep links / routes for store + push**  
    DoD: At least `/learn`, `/events`, `/community`, `/profile` (and detail ids) are real URLs under Capacitor.

15. **P1 — Tap targets ≥44pt on primary chrome**  
    DoD: Header icon buttons, text-links (See all / View all), auth forgot/terms meet 44×44 min hit area.

16. **P1 — Forgot password**  
    DoD: Works via auth provider **or** removed from UI until supported.

17. **P1 — Demo content labeled or replaced**  
    DoD: Static directory/library/events either from API or clearly “Sample” only in non-prod; store build uses real or empty states.

---

## P2 — polish / can trail first submit if phone-only

18. **P2 — Learn + Community banner art (Codex-3/4)**  
    DoD: GPT assets in remaining slots.

19. **P2 — Landscape / tablet policy**  
    DoD: Lock portrait in Capacitor **or** Ericson-reviewed landscape layout.

20. **P2 — PWA manifest (optional parallel)**  
    DoD: If web install wanted: manifest + theme-color + 192/512 icons (separate from store icons).

21. **P2 — QR / scanner**  
    DoD: Out of scope until product asks — **no stub** in store UI.

22. **P2 — Reduced-motion already OK** — keep; no ticket unless regressions.

---

## Suggested ticket order for Rhowel (under Aryhan)

1. P0 titles + hide/fix Agent ID + honest Register/Calendar/Notifications  
2. P0 Capacitor full-bleed + safe-area (with eng)  
3. P0 icon/splash art (Codex → Ericson → drop)  
4. P0 screenshot frames (Ericson art direction → capture)  
5. Parallel eng: real auth + legal links + identity  
6. P1 banners Home/Events (Codex) + dead-CTA sweep  
7. P1 routes/deep links + tap targets  
8. P2 remainder

**Local only until Paul authorizes push/merge/deploy.**
