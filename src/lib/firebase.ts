/**
 * PAAIPE Firebase (web SDK in Capacitor WebView).
 *
 * The project is SHARED with PostFlow (project "PAAIPE and POSTFLOW",
 * id postflowit-autos), but this uses PAAIPE's OWN web appId — NOT PostFlow's.
 * A Firebase web config is public by design: it is safe to commit, and Firestore
 * security rules (see the portal's firestore.rules) are what protect the data.
 * Every PAAIPE collection is prefixed `paaipe_` and lives in the NAMED database
 * `paaipe` (asia-southeast1), never the project's (default) database.
 *
 * These committed values are the defaults so real builds and local dev work out
 * of the box; VITE_FIREBASE_* env vars still override them per environment.
 * App profile data lives on api.paaipe.org (Linode), not Firestore collections.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { installFirebaseNativeFetchBridge } from "./firebase-native-fetch";

/** Public PAAIPE web config (not secret — protected by Firestore rules). */
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCeZ6CcSV79l9TPNK6UL0SV5d5b8EU11n8",
  authDomain: "postflowit-autos.firebaseapp.com",
  projectId: "postflowit-autos",
  storageBucket: "postflowit-autos.firebasestorage.app",
  messagingSenderId: "558511325456",
  // "PAAIPE web" appId — NOT PostFlow web.
  appId: "1:558511325456:web:6f8f383eb10116db8c6595",
} as const;

const env = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY", DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN", DEFAULT_FIREBASE_CONFIG.authDomain),
  projectId: env("VITE_FIREBASE_PROJECT_ID", DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET", DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: env(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  ),
  appId: env("VITE_FIREBASE_APP_ID", DEFAULT_FIREBASE_CONFIG.appId),
};

/** Consent doc versions — match web DOC_VERSIONS (terms/privacy "1.0"). */
export const DOC_VERSIONS = { terms: "1.0", privacy: "1.0" } as const;

export const TERMS_URL = "https://paaipe.org/terms-of-use";
export const PRIVACY_URL = "https://paaipe.org/privacy-notice";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let persistenceReady: Promise<void> | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
  );
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase env missing — set VITE_FIREBASE_* in .env.local");
  }
  if (!app) {
    const existing = getApps().find((a) => a.name === "paaipe");
    app = existing ?? initializeApp(firebaseConfig, "paaipe");
  }
  return app;
}

/**
 * Auth with durable persistence in WebView.
 * Native: indexedDBLocalPersistence + CapacitorHttp fetch bridge (WKWebView
 * fetch to Identity Toolkit can hang indefinitely).
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    installFirebaseNativeFetchBridge();
    const firebaseApp = getFirebaseApp();
    if (Capacitor.isNativePlatform()) {
      try {
        auth = initializeAuth(firebaseApp, {
          persistence: indexedDBLocalPersistence,
        });
      } catch {
        // Already initialized (HMR / remount) — reuse.
        auth = getAuth(firebaseApp);
      }
      persistenceReady = Promise.resolve();
    } else {
      auth = getAuth(firebaseApp);
      persistenceReady = setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("[firebase] setPersistence failed:", err);
      });
    }
  }
  return auth;
}

export async function ensureAuthPersistence(): Promise<void> {
  getFirebaseAuth();
  await persistenceReady;
}
