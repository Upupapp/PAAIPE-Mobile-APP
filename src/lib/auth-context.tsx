import { Capacitor } from "@capacitor/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  DOC_VERSIONS,
  ensureAuthPersistence,
  getFirebaseAuth,
  isFirebaseConfigured,
} from "./firebase";
import {
  ApiRequestError,
  describeFailure,
  getMe,
  patchMeProfile,
  postMeSignup,
  withTimeout,
  type LoadFailure,
  type MeProfile,
  type ProfilePatch,
} from "./api";
import { buildIdentity, type DisplayIdentity } from "./profile-display";
export type ProfileState = "idle" | "loading" | "ready" | "missing" | "error";
type AuthContextValue = {
  ready: boolean;
  user: User | null;
  profile: MeProfile | null;
  identity: DisplayIdentity | null;
  profileState: ProfileState;
  profileError: LoadFailure | null;
  profileSyncPending: boolean;
  authError: string | null;
  verificationNotice: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (opts: {
    full_name: string;
    email: string;
    password: string;
  }) => Promise<{ profileSyncPending: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendVerification: () => Promise<void>;
  acknowledgeConfirmation: () => Promise<void>;
  completeProfile: (fullName: string) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Unable to complete this action. Please retry.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>("idle");
  const [profileError, setProfileError] = useState<LoadFailure | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [verificationRevision, setVerificationRevision] = useState(0);
  const userRef = useRef<User | null>(null);
  const version = useRef(0);
  const mounted = useRef(true);
  const lastRefresh = useRef(0);
  const lastVerificationSent = useRef(0);
  const current = (uid: string, request: number) =>
    mounted.current && userRef.current?.uid === uid && version.current === request;

  const loadProfile = useCallback(async (account: User, refreshAuth = false) => {
    const request = ++version.current;
    lastRefresh.current = Date.now();
    setProfileState("loading");
    setProfileError(null);
    try {
      const next = await withTimeout(
        (async () => {
          if (refreshAuth) await reload(account);
          const token = await account.getIdToken(refreshAuth);
          return getMe(token);
        })(),
        15000,
        "Profile check",
      );
      if (!current(account.uid, request)) return;
      if (next.uid !== account.uid) throw new ApiRequestError(502, "Profile identity mismatch");
      setProfile(next);
      setVerificationRevision((n) => n + 1);
      setProfileState(next.createdAt === null ? "missing" : "ready");
    } catch (error) {
      if (!current(account.uid, request)) return;
      // Keep the last known profile for diagnosis; never turn a failed check into a Guest.
      setProfileState("error");
      setProfileError(describeFailure(error));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let unsubscribe = () => {};
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        setReady(true);
        setAuthError("Session restore took too long. Please sign in again.");
      }
    }, 10000);
    void (async () => {
      if (!isFirebaseConfigured()) {
        setReady(true);
        setAuthError("Sign-in is unavailable right now.");
        clearTimeout(watchdog);
        return;
      }
      try {
        try {
          await withTimeout(ensureAuthPersistence(), 4000, "Session persistence");
        } catch {
          /* still subscribe */
        }
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(
          getFirebaseAuth(),
          (next) => {
            if (cancelled) return;
            const changed = next?.uid !== userRef.current?.uid;
            userRef.current = next;
            setUser(next);
            setReady(true);
            clearTimeout(watchdog);
            if (changed) {
              ++version.current;
              setProfile(null);
              setProfileError(null);
              setVerificationNotice(null);
              lastVerificationSent.current = 0;
            }
            if (!next) {
              setProfileState("idle");
              return;
            }
            void loadProfile(next);
          },
          () => {
            if (!cancelled) {
              setReady(true);
              setAuthError("Unable to restore your session. Please sign in again.");
              clearTimeout(watchdog);
            }
          },
        );
      } catch (error) {
        if (!cancelled) {
          setReady(true);
          setAuthError(errorText(error));
          clearTimeout(watchdog);
        }
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
      ++version.current;
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const account = userRef.current;
    if (account) await loadProfile(account, true);
  }, [loadProfile]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden" && Date.now() - lastRefresh.current > 15000)
        void refreshProfile();
    };
    const online = () => {
      void refreshProfile();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("paaipe:resume", refresh);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("paaipe:resume", refresh);
      window.removeEventListener("online", online);
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) window.dispatchEvent(new Event("paaipe:resume"));
        });
        if (disposed) await listener.remove();
        else
          cleanup = () => {
            void listener.remove();
          };
      })
      .catch(() => {
        /* Browser focus/visibility handling remains available. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await withTimeout(
        signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password),
        20000,
        "Sign-in",
      );
    } catch (error) {
      setAuthError(errorText(error));
      throw error;
    }
  }, []);
  const sendVerification = useCallback(async () => {
    const account = userRef.current;
    if (!account) throw new Error("Sign in to verify your email.");
    if (account.emailVerified) {
      setVerificationNotice("Your email is already verified.");
      return;
    }
    if (Date.now() - lastVerificationSent.current < 60000)
      throw new Error("Please wait a minute before requesting another verification email.");
    await withTimeout(sendEmailVerification(account), 12000, "Verification email");
    if (userRef.current?.uid === account.uid) {
      lastVerificationSent.current = Date.now();
      setVerificationNotice(
        "Verification email sent. Check your inbox, then tap Check verification.",
      );
    }
  }, []);
  const signUp = useCallback(
    async (opts: { full_name: string; email: string; password: string }) => {
      setAuthError(null);
      const cred = await withTimeout(
        createUserWithEmailAndPassword(getFirebaseAuth(), opts.email.trim(), opts.password),
        20000,
        "Sign-up",
      );
      userRef.current = cred.user;
      setUser(cred.user);
      setReady(true);
      ++version.current;
      setProfileState("loading");
      try {
        await withTimeout(
          updateProfile(cred.user, { displayName: opts.full_name.trim() }),
          8000,
          "Display name",
        );
      } catch {
        /* profile name still goes to API */
      }
      try {
        await sendVerification();
      } catch {
        setVerificationNotice("Verification email was not sent. You can retry from Membership.");
      }
      let pending = false;
      const request = ++version.current;
      try {
        const next = await withTimeout(
          cred.user
            .getIdToken()
            .then((token) =>
              postMeSignup(token, {
                full_name: opts.full_name,
                termsVersion: DOC_VERSIONS.terms,
                privacyVersion: DOC_VERSIONS.privacy,
              }),
            ),
          15000,
          "Profile setup",
        );
        if (current(cred.user.uid, request)) {
          if (next.uid !== cred.user.uid)
            throw new ApiRequestError(502, "Profile identity mismatch");
          setProfile(next);
          setProfileState(next.createdAt === null ? "missing" : "ready");
          setProfileError(null);
        }
        pending = next.createdAt === null;
      } catch (error) {
        pending = true;
        if (current(cred.user.uid, request)) {
          setProfileError(describeFailure(error));
          setProfileState("error");
        }
      }
      return { profileSyncPending: pending };
    },
    [sendVerification],
  );
  const completeProfile = useCallback(async (fullName: string) => {
    const account = userRef.current;
    if (!account) throw new Error("Sign in to continue.");
    if (!fullName.trim()) throw new Error("Please enter your name.");
    const request = ++version.current;
    try {
      const next = await withTimeout(
        account
          .getIdToken()
          .then((token) =>
            postMeSignup(token, {
              full_name: fullName,
              termsVersion: DOC_VERSIONS.terms,
              privacyVersion: DOC_VERSIONS.privacy,
            }),
          ),
        15000,
        "Profile setup",
      );
      if (!current(account.uid, request)) return;
      if (next.uid !== account.uid || next.createdAt === null)
        throw new ApiRequestError(502, "Profile was not saved");
      setProfile(next);
      setProfileState("ready");
      setProfileError(null);
    } catch (error) {
      if (current(account.uid, request)) setProfileError(describeFailure(error));
      throw error;
    }
  }, []);
  const acknowledgeConfirmation = useCallback(async () => {
    const account = userRef.current;
    if (!account || profileState !== "ready" || profile?.status !== "agent")
      throw new Error("Confirmed membership is required.");
    const request = version.current;
    const next = await withTimeout(
      account.getIdToken().then((token) => patchMeProfile(token, { confirmation_seen: true })),
      15000,
      "Membership acknowledgement",
    );
    if (!current(account.uid, request)) return;
    if (next.uid !== account.uid) throw new ApiRequestError(502, "Profile identity mismatch");
    if (!next.confirmation_seen) throw new Error("Acknowledgement was not saved. Please retry.");
    setProfile(next);
  }, [profileState, profile]);
  const signOut = useCallback(async () => {
    setAuthError(null);
    ++version.current;
    try {
      await withTimeout(firebaseSignOut(getFirebaseAuth()), 10000, "Sign-out");
    } catch (error) {
      const account = userRef.current;
      if (account) void loadProfile(account);
      throw error;
    }
    userRef.current = null;
    setUser(null);
    setProfile(null);
    setProfileState("idle");
    setProfileError(null);
  }, [loadProfile]);
  const resetPassword = useCallback(async (email: string) => {
    await withTimeout(
      sendPasswordResetEmail(getFirebaseAuth(), email.trim()),
      20000,
      "Password reset",
    );
  }, []);
  const identity = useMemo(
    () => buildIdentity(user, profile, { profileSyncPending: profileState === "missing" }),
    [user, profile, profileState, verificationRevision],
  );
  const value: AuthContextValue = {
    ready,
    user,
    profile,
    identity,
    profileState,
    profileError,
    profileSyncPending: profileState === "missing" || profileState === "error",
    authError,
    verificationNotice,
    clearAuthError: () => setAuthError(null),
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshProfile,
    sendVerification,
    acknowledgeConfirmation,
    completeProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
export async function tryPatchProfile(user: User, body: ProfilePatch): Promise<MeProfile> {
  return patchMeProfile(await user.getIdToken(), body);
}
