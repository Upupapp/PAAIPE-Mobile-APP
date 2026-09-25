/**
 * Minimal Capacitor native chrome for soft-widget portal (M-07).
 * - Marks html.is-native → CSS kills 390px .phone-app cage (G1 full-bleed)
 * - StatusBar overlays WebView so env(safe-area-inset-*) drives header + soft pill nav
 * No-ops on web / when plugins unavailable.
 */
import { Capacitor } from "@capacitor/core";

/** Sync: add shell class before paint when possible (called from root useEffect). */
export function markNativeShell(): void {
  if (typeof document === "undefined") return;
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add("is-native");
  } else {
    document.documentElement.classList.remove("is-native");
  }
}

export async function initCapacitorNative(): Promise<void> {
  if (typeof window === "undefined") return;
  markNativeShell();
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    // Soft-widget headers are light → dark status-bar icons (Style.Light)
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#2F6CF0" });
  } catch (err) {
    console.warn("[capacitor] StatusBar init skipped:", err);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* optional — splash assets are PLACEHOLDERS until Codex */
  }
}
