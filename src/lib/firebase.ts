/**
 * PAAIPE Firebase Auth (web SDK in Capacitor WebView).
 * Config = PAAIPE web appId — NOT PostFlow. Source: paaipe-firebase.js on web.
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

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string,
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
