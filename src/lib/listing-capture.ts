/**
 * M-13 — store listing capture flag (local / screenshots only).
 *
 * Activate (any of):
 *   - URL query `?listing=1` (also persists to localStorage)
 *   - localStorage key `paaipe.listingCapture` = "1"
 *   - documentElement class `is-listing-capture` (set by capture scripts)
 *
 * Deactivate: `?listing=0` (clears localStorage) or remove the class / LS key.
 *
 * When active, CSS hides `.profile-sync-pending-note` so Home/Profile listing
 * shots stay clean. Normal Guest honesty (sync-pending strip) is unchanged
 * when the flag is off.
 */
const LS_KEY = "paaipe.listingCapture";

export function markListingCapture(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("listing");
    if (q === "1" || q === "true") {
      localStorage.setItem(LS_KEY, "1");
    } else if (q === "0" || q === "false") {
      localStorage.removeItem(LS_KEY);
    }
    const on =
      localStorage.getItem(LS_KEY) === "1" || q === "1" || q === "true";
    document.documentElement.classList.toggle("is-listing-capture", on);
  } catch {
    /* private mode / SSR — no-op */
  }
}
