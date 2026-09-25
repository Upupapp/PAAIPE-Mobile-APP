import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth-context";
import { openPrivacy, openTerms, PRIVACY_URL, TERMS_URL } from "../lib/legal-links";
import type { Loadable } from "../hooks/use-loadable";
import type { ReactNode } from "react";
export function DataState({
  result,
  children,
  label,
}: {
  result: Loadable<unknown>;
  children: ReactNode;
  label: string;
}) {
  if (result.state === "loading")
    return (
      <div className="data-state" role="status">
        Loading {label}…
      </div>
    );
  if (result.state === "error")
    return (
      <div className="data-state error" role="alert">
        <strong>{label} could not be loaded</strong>
        <p>{result.error?.message}</p>
        <button type="button" onClick={result.retry}>
          Retry {label.toLowerCase()}
        </button>
      </div>
    );
  return <>{children}</>;
}
export function MembershipPanel() {
  const {
    identity,
    sendVerification,
    refreshProfile,
    acknowledgeConfirmation,
    verificationNotice,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!identity) return null;
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete this action. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="membership-panel" aria-label="Membership status">
      <h2>Membership status</h2>
      <p>
        {identity.state === "guest_unverified"
          ? "Verify your email to complete the next step."
          : identity.state === "guest_pending"
            ? "Your email is verified. PAAIPE confirmation is pending."
            : identity.state === "suspended"
              ? "Your membership is suspended."
              : "PAAIPE has confirmed your Agent membership."}
      </p>
      <ol>
        {[
          { label: "Signed up", done: true },
          { label: "Email verified", done: identity.emailVerified },
          { label: "PAAIPE confirmation", done: identity.isAgent },
          { label: "Agent number assigned", done: Boolean(identity.agentNumber) },
        ].map((step) => (
          <li key={step.label} className={step.done ? "done" : ""}>
            <span aria-hidden="true">{step.done ? "✓" : "○"}</span>
            {step.label}
            <small>{step.done ? "Complete" : "Pending"}</small>
          </li>
        ))}
      </ol>
      {!identity.emailVerified && (
        <div className="membership-actions">
          <button type="button" disabled={busy} onClick={() => void act(sendVerification)}>
            Send verification email
          </button>
          <button type="button" disabled={busy} onClick={() => void act(refreshProfile)}>
            Check verification
          </button>
        </div>
      )}
      {identity.emailVerified && (
        <div className="membership-actions">
          <button type="button" disabled={busy} onClick={() => void act(refreshProfile)}>
            Refresh membership
          </button>
        </div>
      )}
      {identity.isAgent && !identity.confirmationSeen && (
        <div className="confirmation-notice">
          <strong>You’re now a confirmed Agent.</strong>
          <p>
            {identity.agentNumber
              ? `Your Agent number is ${identity.agentNumber}.`
              : "Your Agent number has not been assigned yet."}
          </p>
          <button type="button" disabled={busy} onClick={() => void act(acknowledgeConfirmation)}>
            Got it
          </button>
        </div>
      )}
      {verificationNotice && <p role="status">{verificationNotice}</p>}
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function ProfileGate() {
  const {
    profileState,
    profileError,
    profile,
    identity,
    user,
    signOut,
    refreshProfile,
    completeProfile,
  } = useAuth();
  const [name, setName] = useState(profile?.full_name || user?.displayName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError("This action could not be completed. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (consent) void act(() => completeProfile(name));
  };
  const suspended = identity?.status === "suspended";
  const loading = profileState === "loading" || profileState === "idle";
  return (
    <div className="app-stage">
      <main className="phone-app portal-shell teresa-inside profile-gate">
        <section className="membership-panel">
          <h1>
            {suspended
              ? "Membership suspended"
              : loading
                ? "Checking your membership…"
                : profileState === "missing"
                  ? "Finish connecting your profile"
                  : "Membership could not be checked"}
          </h1>
          <p role={loading ? "status" : undefined}>
            {suspended
              ? "Access to member content is paused. Contact PAAIPE if you believe this is a mistake."
              : loading
                ? "Your sign-in is being checked with PAAIPE."
                : profileState === "missing"
                  ? "You are signed in, but a saved member profile is not yet available in the mobile service. This does not change any membership you may already hold on the web."
                  : "Your membership has not been changed. Please retry to check your access."}
          </p>
          {profileError && <p role="alert">{profileError.message}</p>}
          {profileState === "missing" && !suspended && (
            <form onSubmit={submit}>
              <label>
                Full name
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  disabled={busy}
                />
                <span>
                  I agree to the{" "}
                  <a href={TERMS_URL} onClick={openTerms}>
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href={PRIVACY_URL} onClick={openPrivacy}>
                    Privacy Notice
                  </a>{" "}
                  to set up my mobile profile.
                </span>
              </label>
              <button type="submit" disabled={busy || !consent}>
                Complete profile setup
              </button>
            </form>
          )}
          <div className="membership-actions">
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void act(refreshProfile)}
            >
              Retry membership check
            </button>
            <button type="button" disabled={busy} onClick={() => void act(signOut)}>
              Sign out
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </section>
      </main>
    </div>
  );
}
