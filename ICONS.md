# PAAIPE icons & splash — PLACEHOLDERS ONLY (M-07)

**Final art:** Codex Correspondent PAAIPE (GPT/Codex-only) → Aryhan → Ericson visual sign-off → drop-in.  
**Do not** invent brand marks, Pillow/GenerateImage stand-ins, or stock logos as finals.

Current files under `public/icons/` are **temporary** upscales of `public/favicon.png` (64×64 source) for scaffolding only.

## Theme / soft-widget blue

- `#2F6CF0` (`--sw-blue` / M-06 soft-widget) — theme-color, splash wash, StatusBar notes

## Web / PWA (present as placeholders)

| File | Size | Notes |
|------|------|--------|
| `public/favicon.png` | 64×64 | Existing; replace with final favicon |
| `public/icons/icon-48.png` | 48×48 | Placeholder |
| `public/icons/icon-192.png` | 192×192 | PWA any |
| `public/icons/icon-512.png` | 512×512 | PWA any + maskable slot |
| `public/icons/apple-touch-icon-180.png` | 180×180 | iOS home-screen web |

## iOS AppIcon slots (Xcode Asset Catalog) — TODO Codex

Deliver a full **AppIcon.appiconset** (or single 1024 master for Xcode to slice). Typical slots:

| Idiom | Size (pt) | Scale | Px |
|-------|-----------|-------|-----|
| iPhone | 20 | 2x / 3x | 40 / 60 |
| iPhone | 29 | 2x / 3x | 58 / 87 |
| iPhone | 40 | 2x / 3x | 80 / 120 |
| iPhone | 60 | 2x / 3x | 120 / 180 |
| iPad | 20 | 1x / 2x | 20 / 40 |
| iPad | 29 | 1x / 2x | 29 / 58 |
| iPad | 40 | 1x / 2x | 40 / 80 |
| iPad | 76 | 1x / 2x | 76 / 152 |
| iPad Pro | 83.5 | 2x | 167 |
| App Store | 1024 | 1x | **1024×1024** (no alpha) |

Path after sync: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## Android adaptive icon — TODO Codex

| Asset | Size | Notes |
|-------|------|--------|
| `ic_launcher` foreground | **108×108 dp** safe zone; export **432×432 px** (4×) typical | Brand mark centered |
| `ic_launcher` background | 108×108 dp / 432×432 px | Soft blue `#2F6CF0` wash OK |
| Play store high-res | **512×512** | PNG, 32-bit |
| Feature graphic (listing) | **1024×500** | Later / store listing ticket |

Path: `android/app/src/main/res/mipmap-*` + `mipmap-anydpi-v26/ic_launcher.xml`

## Splash / launch — TODO Codex

| Platform | Spec | Notes |
|----------|------|--------|
| iOS LaunchScreen / storyboard | Full-bleed soft-widget wash `#2F6CF0` or `#F3F7FF` + centered mark | No invented mark; slot only |
| Android SplashScreen API / `@capacitor/splash-screen` | Same wash + mark; 12-bit or vector preferred | `backgroundColor: #2F6CF0` already in `capacitor.config.ts` |
| Suggested master | **2732×2732** centered art on brand wash (safe for tablets) | Codex |

Capacitor plugin already configured with `backgroundColor: "#2F6CF0"` — replace drawable/storyboard assets when Codex delivers.
