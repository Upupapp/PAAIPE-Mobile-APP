/**
 * Open Terms / Privacy in the system browser on native (Capacitor Browser).
 * Web keeps target=_blank via window.open.
 */
import { Capacitor } from "@capacitor/core";
import { TERMS_URL, PRIVACY_URL } from "./firebase";

export { TERMS_URL, PRIVACY_URL };

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch (err) {
      console.warn("[legal] Browser.open failed, falling back:", err);
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function openTerms(e?: { preventDefault?: () => void; stopPropagation?: () => void }) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  void openExternalUrl(TERMS_URL);
}

export function openPrivacy(e?: { preventDefault?: () => void; stopPropagation?: () => void }) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  void openExternalUrl(PRIVACY_URL);
}
