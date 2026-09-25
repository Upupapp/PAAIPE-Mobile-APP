# PAAIPE bottom nav — Servana behavior lock (motion / haptics only)

**Paul (2026-09-24 via Ericson Teresa):** Adopt Servana **movement, behavior, and haptics only** on PAAIPE.  
**Keep** PAAIPE soft-widget chrome (Inter, tokens, floating pill, blue aperture).  
**Do NOT** copy Servana orange Book, curved cradle painter, or Bold 700 labels.

**Behavior SoT (shared):** `/workspace/teresa-handoff/SERVANA-NAV-BEHAVIOR.md`  
**Sample repo:** https://github.com/Upupapp/ServanaClientAPP  
**Visual SoT:** `/workspace/font-comps/v2/handoff/BRIEF.md` + `/workspace/font-comps/v2/index.html`

**Supersedes:** M-05 equal-five + 600ms aperture / 600ms wipe as **primary tab motion**. Soft-widget look (M-06) remains.

---

## Slot layout (4 branches + center action)

| Slot | Role | PAAIPE (proposed — confirm at M-nav review) |
|------|------|-----------------------------------------------|
| 0 | Branch | **Home** |
| 1 | Branch | **Learn** |
| 2 | **Center action — not a tab** | Opens **Quick actions** sheet |
| 3 | Branch | **Events** |
| 4 | Branch | **Profile** |

Router / shell branches = **4 only**. Center never sets `currentIndex` and never renders selected.

**Community** moves into the center sheet (was a 5th equal tab under M-05). If Paul prefers Community as a branch instead of Events or Learn, swap at review — do not invent a 6th slot.

### Center sheet rows (PAAIPE IA — not Teresa Dokyu/Tulong/Emergency)

1. **Community** — network / community hub  
2. **Directory** — find agents / members  
3. **Benefits & programs** — membership benefits / programs hub  

Optional escape: “Browse all” → full more-menu / drawer destinations (Certificates, Resources, Organization) — do not invent new categories.

Sheet opens while center press is still settling (callback after press animation **starts**).

---

## Motion (numbers only — chrome stays soft-widget)

| Motion | Value |
|--------|--------|
| Selection travel | **320ms** · easeOutCubic (aperture / active bubble to selected **branch**) |
| Page / branch change | **260ms** · easeOutCubic · rise **8px** · scale **0.985 → 1.0** · fade |
| Center press | **1.00 → 0.94** (90ms) → **1.03** (70ms) → **1.00** |
| Reduced motion | Selection/page ≈ **100ms**; haptics still fire |

Geometry envelopes (behavior sizing; paint soft-widget):
- Bar ~72 (68–76) + SafeArea bottom once  
- Active bubble ~52 dia, lift ~12; PAAIPE blue `#2f6cf0` + existing soft shadow  
- Center control ~56 dia (distinct from tabs)  
- Labels always on; active label **Inter 500** (never 700)  
- One traveling bubble; `IgnorePointer`; `extendBody` OFF  

---

## Haptics

| Event | Haptic |
|-------|--------|
| Branch tab change | `selectionClick` |
| Reselect that pops to root | `lightImpact` (only if `canPop`) |
| Center sheet opens | `mediumImpact` (inside sheet show) |
| Sheet row tap | optional `selection` with visible nav |

No haptic on deep links / cold restore / passive scroll.

---

## Review shots when wired

1. Home active — bubble on Home; center raised, not selected  
2. Learn / Events / Profile each selected — bubble travels 320ms  
3. Center → sheet with Community / Directory / Benefits & programs  
4. Reselect nested → pop + light haptic  
5. Reduce-motion ON → short travel; selection still clear  

Owner: Aryhan → Rhowel. Ericson PAAIPE formal review before Paul ship.
