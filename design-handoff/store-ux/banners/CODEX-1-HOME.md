# Codex-1 — Home banner (16:9)

**From:** Ericson PAAIPE (UI/UX)  
**Via:** Codex Correspondent PAAIPE → GPT/Codex only  
**Then:** Aryhan → Ericson visual sign-off → Rhowel drop-in  
**Product:** PAAIPE Agent Portal (mobile, soft-widget system)

## Placement
- Screen: **Home** (post-auth), below membership/Agent ID chips, above “Continue learning”
- Slot: soft rounded widget card, **16:9**, full content width (~358 CSS px @390-wide phone)
- Placeholder today: dashed “Banner” — replace with final asset only (no Pillow / GenerateImage / stock)

## Export sizes (deliver all)
| File | Size | Use |
|------|------|-----|
| `home-banner@1x.png` | **720 × 405** | base |
| `home-banner@2x.png` | **1440 × 810** | retina (primary drop-in) |
| `home-banner@3x.png` | **2160 × 1215** | dense iPhones |

Format: PNG (or WebP + PNG fallback). sRGB. No heavy JPEG banding on gradients.

Safe margin: keep critical type/logo **≥6% inset** from all edges (card clips with ~22px radius).

## Mood / visual system
- Soft-widget / glass-lite: clean, premium, light — **not dark navy slabs**, not neon cyber cruft
- Palette: soft light-blue wash `#f3f7ff` → `#d4e4ff`, primary **portal blue `#2f6cf0`**, deep accent `#2346a8` / `#1e4fc4`, white, muted ink `#1a2336`
- Soft gradients, gentle glow, rounded geometry; optional subtle abstract network / nodes / soft 3D — **no faces of real people**, no stock office photos
- Match Inter-era UI: calm, Apple-adjacent, Filipino AI professional community

## Copy (lock this wording unless Paul overrides)
**Eyebrow (small):** Philippine Association of AI  
**Headline:** Your AI network starts here  
**Sub (optional, one line):** Connect with builders shaping AI across the Philippines  
**No CTA button in the art** — the card itself is tappable later; leave lower-right clear of text if possible

Typography in-art: clean sans (Inter / SF-like). Headline weight Semibold; eyebrow Regular/Medium. Avoid Bold 700 all-caps blocks.

## Must / must-not
- Must include PAAIPE wordmark or clear “PAAIPE” word (use simple wordmark treatment if logo file not provided — Codex may render typographic mark)
- Must feel like a **membership/community welcome**, not a single event promo (Events is Codex-2)
- Must-not: “Prototype”, lorem, fake UI chrome, QR codes, GetHired branding, dark full-bleed navy, cluttered icons grid

## Deliverable
GPT/Codex finals only. Return files named as above + one-line prompt/seed note for archive. Placeholders stay in app until Ericson Approves.
