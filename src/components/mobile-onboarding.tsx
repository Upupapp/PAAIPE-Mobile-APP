import { type CSSProperties, type FormEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import logo from "../assets/paaipe-logo.png";
import people from "../assets/onboarding-people.png";
import robot from "../assets/onboarding-robot.png";
import tokens from "../assets/onboarding-tokens.png";
import { useAuth } from "../lib/auth-context";
import { TERMS_URL, PRIVACY_URL, openTerms, openPrivacy } from "../lib/legal-links";

type Stage = 0 | 1 | 2 | "signin" | "signup";
type WelcomeStage = 0 | 1 | 2;

const slides = [
  { image: robot, eyebrow: "MEET YOUR AI NETWORK", title: "Your agent journey starts here.", copy: "Learn, connect, and build alongside the Philippines' most ambitious AI community.", alt: "Friendly PAAIPE AI robot" },
  { image: tokens, eyebrow: "LEARN. EARN. GROW.", title: "Turn knowledge into momentum.", copy: "Access practical sessions, collect credentials, and keep your AI capabilities moving forward.", alt: "AI knowledge tokens and credentials" },
  { image: people, eyebrow: "BUILT FOR COMMUNITY", title: "Find your people in AI.", copy: "Meet Filipino builders, leaders, and entrepreneurs shaping responsible AI together.", alt: "A group of Filipino AI professionals" },
] as const;

function authErrorMessage(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
  const map: Record<string, string> = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found for that email.",
    "auth/wrong-password": "Incorrect password. Try again or reset it.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-login-credentials": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for that email. Sign in instead.",
    "auth/weak-password": "Password must be at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/missing-email": "Enter your email to reset your password.",
    "auth/operation-not-allowed": "Email/Password sign-in is disabled for this Firebase project. Ask an admin to enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/configuration-not-found": "Firebase Auth is not configured for this app. Check the Firebase project settings.",
  };
  if (code && map[code]) return map[code];
  if (err instanceof Error && /timed out/i.test(err.message)) {
    return "Sign-in timed out. Check your network and try again.";
  }
  if (err instanceof Error && err.message) {
    return code ? `${err.message} (${code})` : err.message;
  }
  return code ? `Sign-in failed (${code}).` : "Something went wrong. Please try again.";
}

export function MobileOnboarding() {
  const { signIn, signUp, resetPassword, profileSyncPending } = useAuth();
  const [stage, setStage] = useState<Stage>(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [showPassword, setShowPassword] = useState(false);
  const [previousStage, setPreviousStage] = useState<WelcomeStage | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);


  const moveArt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt({ x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 });
  };
  const resetArt = () => setTilt({ x: 0, y: 0 });

  const moveToSlide = (nextStage: WelcomeStage) => {
    if (typeof stage !== "number" || nextStage === stage) return;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setPreviousStage(stage);
    setDirection(nextStage > stage ? "forward" : "backward");
    setTilt({ x: 0, y: 0 });
    setStage(nextStage);
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      setIsTransitioning(false);
      setPreviousStage(null);
    }, 760);
  };

  const onForgotPassword = async () => {
    setFormError(null);
    setFormInfo(null);
    if (!email.trim()) {
      setFormError("Enter your email above, then tap Forgot password.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setFormInfo("Password reset email sent. Check your inbox.");
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (stage === "signin" || stage === "signup") {
    const isSignup = stage === "signup";
    const submit = async (event: FormEvent) => {
      event.preventDefault();
      setFormError(null);
      setFormInfo(null);
      setBusy(true);
      try {
        if (isSignup) {
          const result = await signUp({ full_name: fullName, email, password });
          if (result.profileSyncPending) {
            setFormInfo("Account created. Profile sync is pending — you can still use the app.");
          }
        } else {
          await signIn(email, password);
        }
      } catch (err) {
        setFormError(authErrorMessage(err));
      } finally {
        setBusy(false);
      }
    };
    return (
      <main
        className={`auth-screen animate-fade-in ${isSignup ? "signup-screen" : ""}`}
        onPointerMove={isSignup ? moveArt : undefined}
        onPointerLeave={isSignup ? resetArt : undefined}
        style={isSignup ? ({ "--tilt-x": tilt.x, "--tilt-y": tilt.y } as CSSProperties) : undefined}
      >
        <div className="auth-glow" />
        {isSignup && (
          <div className="signup-motion" aria-hidden="true">
            <div className="signup-orbit orbit-far"><span /></div>
            <div className="signup-orbit orbit-near"><span /></div>
            <img className="signup-robot" src={robot} alt="" />
            <img className="signup-tokens" src={tokens} alt="" />
            <span className="signup-spark spark-one"><Sparkles /></span>
            <span className="signup-spark spark-two">＋</span>
          </div>
        )}
        <header className="auth-header">
          <button className="auth-back" type="button" onClick={() => setStage(2)} aria-label="Back to welcome"><ArrowLeft /></button>
          <img src={logo} alt="PAAIPE" />
        </header>
        <section className="auth-copy">
          <span>{isSignup ? "JOIN THE NETWORK" : "WELCOME BACK"}</span>
          <h1>{isSignup ? "Create your account." : "Sign in to your portal."}</h1>
          <p>{isSignup ? "Start as a Guest in the Philippine AI community. Agent status comes after confirmation." : "Continue learning, connecting, and building."}</p>
        </section>
        <form className="auth-form" onSubmit={(e) => void submit(e)}>
          {isSignup && (
            <label>
              <span>Full name</span>
              <div>
                <UserRound />
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" disabled={busy} />
              </div>
            </label>
          )}
          <label>
            <span>Email address</span>
            <div>
              <Mail />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" disabled={busy} />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div>
              <LockKeyhole />
              <input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={isSignup ? "new-password" : "current-password"} disabled={busy} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button>
            </div>
          </label>
          {isSignup && (
            <label className="terms-row">
              <input required type="checkbox" disabled={busy} />
              <i><Check /></i>
              <span>
                I agree to the{" "}
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" onClick={openTerms}>membership terms</a>
                {" "}and{" "}
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" onClick={openPrivacy}>privacy policy</a>.
              </span>
            </label>
          )}
          {!isSignup && (
            <button type="button" className="forgot-link" onClick={() => void onForgotPassword()} disabled={busy}>
              Forgot password?
            </button>
          )}
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          {formInfo && <p className="auth-info" role="status">{formInfo}</p>}
          {profileSyncPending && !formInfo && (
            <p className="auth-info" role="status">Profile sync pending — your Firebase session is active.</p>
          )}
          <button className="onboarding-primary auth-submit" type="submit" disabled={busy}>
            <span>{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</span>
            <ArrowRight />
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to PAAIPE?"}
          <button type="button" onClick={() => { setFormError(null); setFormInfo(null); setStage(isSignup ? "signin" : "signup"); }}>
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </main>
    );
  }

  const slide = slides[stage];
  const previousSlide = previousStage === null ? null : slides[previousStage];
  const parallaxStyle = { "--tilt-x": tilt.x, "--tilt-y": tilt.y } as CSSProperties;
  return (
    <main className={`onboarding-screen slide-${stage} transition-${direction}${isTransitioning ? " is-transitioning" : ""}`}>
      <header className="onboarding-header">
        <img src={logo} alt="PAAIPE" />
        <button type="button" onClick={() => setStage("signin")}>Sign in</button>
      </header>
      <div className="onboarding-art" onPointerMove={moveArt} onPointerLeave={resetArt} style={parallaxStyle}>
        <div className="art-halo" />
        <div className="orbit orbit-a"><span /></div>
        <div className="orbit orbit-b"><span /></div>
        {previousSlide && <img className={`onboarding-visual visual-${previousStage} visual-outgoing`} src={previousSlide.image} alt="" aria-hidden="true" width={1024} height={1024} />}
        <img key={slide.image} className={`onboarding-visual visual-${stage}${isTransitioning ? " visual-incoming" : ""}`} src={slide.image} alt={slide.alt} width={1024} height={1024} />
        <span className="float-glyph glyph-one">✦</span>
        <span className="float-glyph glyph-two">●</span>
        <span className="float-glyph glyph-three">＋</span>
      </div>
      <section className="onboarding-copy animate-fade-in" key={stage}>
        <span>{slide.eyebrow}</span>
        <h1>{slide.title}</h1>
        <p>{slide.copy}</p>
      </section>
      <footer className="onboarding-footer">
        <div className="page-dots">
          {slides.map((_, index) => (
            <button key={index} type="button" aria-label={`Welcome screen ${index + 1}`} className={stage === index ? "active" : ""} onClick={() => moveToSlide(index as WelcomeStage)} />
          ))}
        </div>
        <button className="onboarding-primary" type="button" disabled={isTransitioning} onClick={() => (stage < 2 ? moveToSlide((stage + 1) as WelcomeStage) : setStage("signup"))}>
          <span>{stage < 2 ? "Continue" : "Get started"}</span>
          <ArrowRight />
        </button>
      </footer>
    </main>
  );
}
