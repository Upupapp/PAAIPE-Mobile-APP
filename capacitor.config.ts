import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for PAAIPE Agent Portal (M-07).
 * webDir = Nitro/TanStack client public output (verified: `.output/public`).
 * Final App Store / Play icons + splash: TODO Codex Correspondent PAAIPE — see ICONS.md / STORE.md.
 */
const config: CapacitorConfig = {
  appId: "org.paaipe.agent",
  appName: "PAAIPE",
  webDir: ".output/public",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#2F6CF0",
      showSpinner: false,
    },
    StatusBar: {
      // Overlay WebView so env(safe-area-inset-*) pads header + soft floating pill nav.
      style: "LIGHT",
      backgroundColor: "#2F6CF0",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#2F6CF0",
  },
  android: {
    backgroundColor: "#2F6CF0",
    allowMixedContent: false,
  },
};

export default config;
