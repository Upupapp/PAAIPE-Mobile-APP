# Teresa bottom nav — Servana behavior lock (motion / haptics only)

**Source sample:** https://github.com/Upupapp/ServanaClientAPP  
**Key files:**
- `lib/common/presentation/navigation/servana_curved_main_navigation.dart`
- `lib/common/presentation/navigation/servana_nav_motion.dart`
- `lib/common/presentation/navigation/servana_book_action.dart`
- `lib/common/presentation/shell/quick_book_sheet.dart`
- `lib/common/presentation/widgets/main_nav_scaffold.dart`
- `lib/common/services/app_haptics.dart`

**Paul (2026-09-24):** Adopt Servana **movement, behavior, and haptics only**.  
**Do NOT** redesign or restyle Teresa soft-widget chrome (pill, blur, tokens, Inter, colors stay per `TERESA-RIZAL-UI-BLUEPRINT.md` §4).  
**Do NOT** copy Servana’s orange Book button, curved cradle painter look, or Bold 700 labels.

---

## 1. Slot layout (behavior change vs Cluster 1 equal-5)

Servana pattern: **4 branch tabs + 1 center action that is NOT a branch**.

| Slot | Servana | **Teresa** |
|------|---------|------------|
| 0 | Home | **Home** |
| 1 | Bookings | **Balita** |
| 2 | **[Book action — not a tab]** | **[Services action — not a tab]** |
| 3 | Messages | **Events** |
| 4 | Profile | **Profile** |

Router / shell branches = **4 only** (Home, Balita, Events, Profile).  
Center **Services** never sets `currentIndex` and never renders as “selected.”

### Services splits to three (Servana QuickBookSheet behavior)

Center tap → **modal bottom sheet** (not a tab route) with three primary rows:

1. **Dokyu** — document requests  
2. **Tulong** — assistance requests  
3. **Emergency** — emergency help  

Optional fourth escape (like Servana “Browse all”): open Services hub list if needed — do not invent extra categories.

Sheet opens while the center control is still settling (callback fires after press animation **starts**, not after it ends).

---

## 2. Movement (copy timings/curves — not Servana chrome)

| Motion | Servana value | Teresa use |
|--------|---------------|------------|
| Active selection travel | **320ms** · `Curves.easeOutCubic` | Soft-widget **aperture / active bubble** slides to the selected **branch** tab |
| Page / branch change | **260ms** · `easeOutCubic` · rise **8px** · scale **0.985 → 1.0** · fade | Content arrival on tab change (keep IndexedStack / shell so scroll state survives) |
| Center press | **1.00 → 0.94** (90ms) → **1.03** (70ms) → **1.00** (~160ms total) | Services center control only |
| Badge appear | 150ms · easeOutBack | If badges used later |
| Reduced motion | Selection/page ≈ **100ms**; flatten traveling surface character; **haptics still fire** | Honor OS reduce-motion |

**Geometry envelopes from Servana (behavior sizing, chrome stays soft-widget):**
- Bar height ~**72** (68–76) + SafeArea bottom once (do not double-count)
- Active bubble ~**52** diameter, lift ~**12** above bar top (adapt onto soft aperture; keep Teresa blue `#2f6cf0` + existing aperture shadow)
- Center action diameter ~**56** (reads as distinct affordance, not a 5th tab)
- Bubble must not clip bar corner radius — clamp centre X like Servana (`bubbleRadius + ~0.5 * surfaceRadius`)

**One traveling bubble** owned by the bar (not per-item bubbles). Branch cells own the hit target; bubble is `IgnorePointer` decoration.

**Labels always visible** on all four branch tabs (never icon-only). Active label weight stays Teresa **Inter 500** (do not adopt Servana 700).

**Supersedes** earlier M-05 “600ms aperture / 600ms wipe” for **primary tab motion**. Soft-widget **visual** chrome from Cluster 1 / blueprint §4 remains.

---

## 3. Behavior rules (scaffold owns routing)

1. **Center Services is not a destination** — opens sheet only; does not change selected branch; does not look selected.
2. **Tab tap → different branch:** `selection` haptic once → go to branch.  
3. **Tab reselect (same branch):** only haptic if navigator **actually pops** toward root (`goBranch(..., initialLocation: true)` when `canPop`). Haptic = `light`. No haptic if already at root.
4. **Deep links / cold restore / notification routes:** change index **without** haptic or “user selected” analytics (haptics live only in tap handlers).
5. **Out-of-range index** → fall back to Home visually.
6. **Badges** (if any): absolute positioned; must not shift labels; active tab’s badge rides on the bubble, not behind it; `9+` above 9.
7. **extendBody OFF** — nav must not cover scroll content (Servana explicitly).
8. **Whole cell tappable** (≥48pt), one semantic node per destination (badge folded into label).

---

## 4. Haptics (from `AppHaptics`)

| Event | Call | Notes |
|-------|------|-------|
| Branch tab change | `HapticFeedback.selectionClick()` | Via `AppHaptics.selection()` |
| Branch reselect that pops | `HapticFeedback.lightImpact()` | Only if `canPop` |
| Center Services opens sheet | `HapticFeedback.mediumImpact()` | Fire **inside** sheet show, only if mounted / sheet can open |
| Sheet row tap (Dokyu / Tulong / Emergency) | optional `selection` | Pair with visible navigation; never haptic-only |

Rules to keep:
- User toggle can disable **app** haptics; never crash if no motor
- Never on keystrokes / passive scroll / failed API spam
- Never as the **only** signal of a result

---

## 5. What we explicitly do **not** copy from Servana

- Curved cradle `CustomPainter` look / notch aesthetic as a redesign  
- Orange center “Book / +” styling  
- FontWeight **700** active labels  
- Servana color palette / dark-mode surface recipes (use Teresa tokens)  
- Four Servana service categories (Aircon / Beauty / Nails / Massage) — Teresa has **three**: Dokyu / Tulong / Emergency  

---

## 6. Implementation pointers for Rhowel

- Keep soft-widget pill: `rgba(255,255,255,.94)` + `blur(16)` + radius 24 + blue-tinted shadows (blueprint §4).  
- Re-slot chrome: 4 equal branch columns + reserved center slot for Services control.  
- Port motion constants from `ServanaNavMotion` (numbers above).  
- Port scaffold tap / reselect / haptic wiring from `MainNavScaffold`.  
- Port sheet open pattern from `QuickBookSheet.show` → Teresa Services sheet with three rows.  
- Cluster 1 equal-5 **Services-as-tab** is **superseded** by this lock for Cluster 2+ shell polish.

---

## 7. Review shots when wired

1. Home active — aperture on Home; Services center raised, not selected  
2. Balita / Events / Profile each selected once — bubble travels 320ms  
3. Center Services → sheet with Dokyu / Tulong / Emergency  
4. Reselect Home at nested route → pops + light haptic  
5. Reduce-motion ON → no long travel; selection still clear  

Refs: Servana tests in `test/navigation/servana_curved_nav_test.dart` (structure, slots, badges, reduced motion, motion budget).
