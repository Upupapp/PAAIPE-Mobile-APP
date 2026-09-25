# Soft-widget visual system — PAAIPE mobile (post-auth)

**From:** Ericson PAAIPE (UI/UX Director)  
**For:** Aryhan PAAIPE → Rhowel PAAIPE  
**Locked by Paul:** 2026-09-24  
**Status:** Implement locally; no push/merge/deploy until Paul authorizes.

## Scope
- **IN:** All screens inside the signed-in app (portal shell): Home, Learn, Events, Community, Profile, drawer, secondary lists/details (Directory, Benefits, Organization, Certificates, Resources, Programs, Session, etc.).
- **OUT:** Welcome, Sign up, Sign in (and other pre-auth / onboarding). Leave those alone.

## Already owned (do not re-litigate)
- **Bottom nav behavior / motion** — already with Aryhan (M-05 Approved): 5 equal tabs (Home | Learn | Events | Community | Profile), no Events FAB; aperture ~600ms ease-out portal-blue; page wipe ~600ms ease-in; labels always on; SafeArea via env(safe-area-inset-bottom). Keep that motion; only restyle chrome to match soft-widget (soft floating pill bar, active = soft blue circle + Medium label).

## Visual direction (match comps)
Reference PNGs in this folder: `home.png`, `events.png`, `community.png`  
Also live HTML: `/workspace/font-comps/v2/index.html`

### Layout / chrome
- Soft light-blue header wash (not dark navy bar)
- Soft circular icon buttons (menu, bell, search)
- Pill chips / filters
- Floating soft white bottom nav
- Widget cards: ~22px corner radii, soft shadow, white or soft tint on light gray/off-white page ground
- Generous spacing; modular widgets, not dense slabs

### Typography — Inter (web / Flutter proto); SF Pro on native iOS later
| Weight | Use |
|--------|-----|
| Regular 400 | Body, descriptions, eyebrows, inactive nav, secondary labels |
| Medium 500 | Section titles, chips, CTAs, list names, active nav |
| Semibold 600 | Page H1 and large hero numbers only |
| Bold 700 | Avoid on labels / CTAs / eyebrows |

### Color
- Primary: portal blue (vibrant tech blue) for accents, active states, primary gradient widgets
- Continue-learning + network heroes: soft blue → deep-blue **gradient widgets** (not opaque navy slabs)
- Agent ID can stay "—" until real ID exists

### Supersedes prior KEEP chrome
Paul locked soft-widget over the old navy Community hero / navy Continue-learning card. Prefer the blue gradient widget treatment in the comps.

## Banner placements (required)
Reserve clear banner slots on key post-auth surfaces. Do **not** invent banner artwork in code or with non-GPT tools.

Suggested slots (wire empty / placeholder aspect until asset lands):
1. **Home** — below greeting / above or replacing a featured strip (hero banner ~16:9 or full-bleed soft card)
2. **Events** — above the event list / under chips (campaign or next-event promo)
3. **Learn** — top of catalog / playlist strip
4. **Community** — optional secondary strip under network widget (events/programs promo)
5. **Profile / drawer** — optional thin promo only if needed later

Placeholder: soft rounded empty card with muted label "Banner" + fixed aspect; never ship stock/Pillow/GenerateImage stand-ins as final creatives.

## Banner production rule (Paul hard)
- Banners are **only** produced by GPT.
- Request creatives from **Codex PAAIPE** (do not fabricate banners locally).
- When a slot needs art: Ericson or Aryhan briefs Codex PAAIPE with size, copy, and screen context; Codex returns GPT asset; then drop into the slot.

## Success criteria
- Every post-auth route visually matches soft-widget + Inter weights above
- Auth/welcome untouched
- M-05 nav motion preserved; visual chrome aligned
- Banner slots present with correct aspects; no non-GPT banner art shipped
- Local review @ 390×844; Ericson formal review before Paul deploy auth

## Out of scope for this pass
Push / merge / deploy. Auth redesign. Inventing banner images.
