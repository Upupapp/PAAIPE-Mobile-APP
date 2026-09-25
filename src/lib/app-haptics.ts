/**
 * App haptics (M-14) — Capacitor Haptics when available; no-op safe on web.
 * Fire only from user tap handlers (never deep-link / restore / scroll).
 */
import { Capacitor } from "@capacitor/core";

type HapticsMod = typeof import("@capacitor/haptics");

let hapticsPromise: Promise<HapticsMod | null> | null = null;

function loadHaptics(): Promise<HapticsMod | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!hapticsPromise) {
    hapticsPromise = import("@capacitor/haptics")
      .then((m) => m)
      .catch(() => null);
  }
  return hapticsPromise;
}

async function run(fn: (h: HapticsMod) => Promise<void>): Promise<void> {
  try {
    const mod = await loadHaptics();
    if (!mod) return;
    // Plugins register on native; on web the calls are typically no-ops.
    await fn(mod);
  } catch {
    /* motor missing / web stub — never throw */
  }
}

export const AppHaptics = {
  /** Branch tab change — selectionClick analog */
  selection(): void {
    void run(async ({ Haptics }) => {
      await Haptics.selectionChanged();
    });
  },

  /** Reselect that actually pops nested stack */
  light(): void {
    void run(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Light });
    });
  },

  /** Center quick-actions sheet opens (inside show) */
  medium(): void {
    void run(async ({ Haptics, ImpactStyle }) => {
      await Haptics.impact({ style: ImpactStyle.Medium });
    });
  },

  /** Optional sheet-row tap paired with visible nav */
  selectionIfNative(): void {
    if (!Capacitor.isNativePlatform()) {
      // Still fine to fire selectionChanged on web stubs when present
    }
    AppHaptics.selection();
  },
};
