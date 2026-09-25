import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  Gift,
  Grid2x2,
  Home,
  Link2,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Play,
  Presentation,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import logo from "../assets/paaipe-logo.png";
import eventCover from "../assets/ai-exchange-cover.png";
import "./portal-teresa.css";
import { MobileOnboarding } from "./mobile-onboarding";
import { useAuth } from "../lib/auth-context";
import {
  getEvents,
  getSessions,
  getDirectory,
  type ApiEvent,
  type ApiSession,
  type DirectoryMember,
} from "../lib/api";
import { type DisplayIdentity } from "../lib/profile-display";
import { openExternalUrl } from "../lib/legal-links";
import { useLoadable, type Loadable } from "../hooks/use-loadable";
import { DataState, MembershipPanel, ProfileGate } from "./membership-panel";
import { AppHaptics } from "../lib/app-haptics";
import {
  BENEFITS_INTRO,
  MEMBER_BENEFITS,
  PARTNER_BENEFIT_DISCLAIMER,
  PROGRAM_NOTES,
  PROGRAMS,
  RESOURCE_FILM,
  RESOURCE_FORMATS,
  RESOURCE_PREVIEWS,
} from "../lib/website-content";

/** M-14: 4 router branches only. Community lives in the center sheet. */
type Branch = "Home" | "Learn" | "Events" | "Profile";
type SheetDest = "Community";
type Detail =
  "Directory" | "Benefits" | "Organization" | "Certificates" | "Resources" | "Programs" | "Session";
type View = Branch | SheetDest | Detail;

const branches: Array<{ label: Branch; icon: typeof Home; slot: number }> = [
  { label: "Home", icon: Home, slot: 0 },
  { label: "Learn", icon: BookOpen, slot: 1 },
  { label: "Events", icon: CalendarDays, slot: 3 },
  { label: "Profile", icon: UserRound, slot: 4 },
];

const BRANCH_SET = new Set<string>(["Home", "Learn", "Events", "Profile"]);

function isBranch(view: View): view is Branch {
  return BRANCH_SET.has(view);
}

/** Soft-widget SVG notch (hidden by M-06 paint). Slots 0/1/3/4 — never center. */
function navSurfacePath(slot: number | null, w = 390, h = 64) {
  if (slot === null) {
    return `M0,12 Q0,0 12,0 L${w - 12},0 Q${w},0 ${w},12 L${w},${h} L0,${h} Z`;
  }
  const cx = ((slot + 0.5) / 5) * w;
  const half = 36;
  const dip = 13;
  const left = cx - half;
  const right = cx + half;
  return [
    `M0,12 Q0,0 12,0`,
    `L${(left - 6).toFixed(1)},0`,
    `C${(left + 12).toFixed(1)},0 ${(cx - 17).toFixed(1)},${dip} ${cx.toFixed(1)},${dip}`,
    `C${(cx + 17).toFixed(1)},${dip} ${(right - 12).toFixed(1)},0 ${(right + 6).toFixed(1)},0`,
    `L${w - 12},0 Q${w},0 ${w},12`,
    `L${w},${h} L0,${h} Z`,
  ].join(" ");
}

const quickActionRows: Array<{ label: string; view: View; icon: typeof Home; copy: string }> = [
  {
    label: "Community",
    view: "Community",
    icon: UsersRound,
    copy: "Network hub and agent spotlight",
  },
  { label: "Directory", view: "Directory", icon: UsersRound, copy: "Find agents and members" },
  {
    label: "Benefits & programs",
    view: "Benefits",
    icon: Gift,
    copy: "Membership benefits and programs",
  },
];

const browseAllRows: Array<{ label: string; view: View; icon: typeof Home }> = [
  { label: "Certificates", view: "Certificates", icon: Award },
  { label: "Resources", view: "Resources", icon: FileText },
  { label: "Organization", view: "Organization", icon: Building2 },
];

const detailTitles: Record<Detail, string> = {
  Directory: "Member directory",
  Benefits: "Member benefits",
  Organization: "Organization",
  Certificates: "My certificates",
  Resources: "Resources",
  Programs: "Programs",
  Session: "Session",
};

const accountMenu: Array<{ label: string; view: View; icon: typeof Home }> = [
  { label: "Programs", view: "Programs", icon: Compass },
  { label: "Learning library", view: "Learn", icon: BookOpen },
  { label: "My certificates", view: "Certificates", icon: Award },
  { label: "My profile", view: "Profile", icon: UserRound },
];

const generalMenu: Array<{ label: string; view: View; icon: typeof Home }> = [
  { label: "Events", view: "Events", icon: CalendarDays },
  { label: "Community", view: "Community", icon: UsersRound },
  { label: "Member directory", view: "Directory", icon: UsersRound },
  { label: "Member benefits", view: "Benefits", icon: Gift },
  { label: "Resources", view: "Resources", icon: FileText },
  { label: "Organization", view: "Organization", icon: Building2 },
];

function MiniLogo() {
  return <img src={logo} alt="PAAIPE" className="h-9 w-auto object-contain" />;
}

const PREVIEW_IDENTITY: DisplayIdentity = {
  displayName: "Guest Member",
  firstName: "Guest",
  initials: "GM",
  email: "guest@paaipe.org",
  status: "guest",
  state: "guest_pending",
  membershipLabel: "Guest · awaiting confirmation",
  agentNumber: null,
  isAgent: false,
  emailVerified: true,
  confirmationSeen: false,
  profileSyncPending: false,
};

export function MobileAgentPortal() {
  const { ready, user, identity, profileState, profileSyncPending, signOut } = useAuth();
  const [preview, setPreview] = useState(false);
  const [directoryOffset, setDirectoryOffset] = useState(0);
  const signedIn = Boolean(user && profileState === "ready" && identity?.status !== "suspended");
  const showPortal = signedIn || preview;
  const portalIdentity = identity ?? (preview ? PREVIEW_IDENTITY : null);
  const accountKey = signedIn ? user!.uid : null;
  const eventData = useLoadable(showPortal ? "events" : null, getEvents);
  const sessionData = useLoadable(showPortal ? "sessions" : null, getSessions);
  const directoryData = useLoadable(
    accountKey ? `${accountKey}:${directoryOffset}` : null,
    async () => getDirectory(await user!.getIdToken(), directoryOffset),
  );
  const events = eventData.data ?? [];
  const sessions = sessionData.data ?? [];
  const directory = directoryData.data?.members ?? [];
  const [signOutError, setSignOutError] = useState("");
  const logout = async () => {
    if (preview && !user) {
      setPreview(false);
      setMenuOpen(false);
      setActive("Home");
      return;
    }
    try {
      await signOut();
      setMenuOpen(false);
    } catch {
      setSignOutError("Sign-out failed. Please retry.");
    }
  };
  const [selectedSession, setSelectedSession] = useState<ApiSession | null>(null);
  const [active, setActive] = useState<View>("Home");
  const [activeBranch, setActiveBranch] = useState<Branch>("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const [fromSheet, setFromSheet] = useState(false);
  const [arriveTick, setArriveTick] = useState(0);
  const [centerPress, setCenterPress] = useState<"idle" | "in" | "over" | "settle">("idle");
  const overlayRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const centerAnimTimer = useRef<number[]>([]);

  const triggerArrive = () => {
    setArriveTick((n) => n + 1);
  };

  const select = (view: View, opts?: { fromSheet?: boolean; haptic?: boolean }) => {
    setActive(view);
    setMenuOpen(false);
    setQuickOpen(false);
    setFromSheet(Boolean(opts?.fromSheet));
    if (isBranch(view)) setActiveBranch(view);
    triggerArrive();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Branch tap — haptics only here (never deep-link / restore). */
  const selectBranch = (label: Branch) => {
    const atRoot = active === label;
    const canPop = activeBranch === label && active !== label;
    if (atRoot) {
      // Already at branch root — no haptic
      return;
    }
    if (canPop) {
      AppHaptics.light();
      select(label);
      return;
    }
    AppHaptics.selection();
    setActiveBranch(label);
    select(label);
  };

  const runCenterPressAnim = () => {
    for (const id of centerAnimTimer.current) window.clearTimeout(id);
    centerAnimTimer.current = [];
    setCenterPress("in");
    const t1 = window.setTimeout(() => setCenterPress("over"), 90);
    const t2 = window.setTimeout(() => setCenterPress("settle"), 90 + 70);
    const t3 = window.setTimeout(() => setCenterPress("idle"), 90 + 70 + 100);
    centerAnimTimer.current = [t1, t2, t3];
  };

  /** Center opens sheet while press animation starts (not after it ends). */
  const openQuickActions = () => {
    runCenterPressAnim();
    setBrowseAllOpen(false);
    setQuickOpen(true);
    AppHaptics.medium();
  };

  const openFromSheet = (view: View) => {
    AppHaptics.selection();
    select(view, { fromSheet: true });
  };

  useEffect(() => {
    if (!menuOpen && !quickOpen && !notificationsOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        overlayRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()
      .find((el) => !el.classList.contains("drawer-backdrop"))
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setQuickOpen(false);
        setNotificationsOpen(false);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [menuOpen, quickOpen, notificationsOpen]);

  useEffect(
    () => () => {
      for (const id of centerAnimTimer.current) window.clearTimeout(id);
    },
    [],
  );

  useEffect(() => {
    setActive("Home");
    setActiveBranch("Home");
    setSelectedSession(null);
    setDirectoryOffset(0);
    setMenuOpen(false);
    setQuickOpen(false);
    setNotificationsOpen(false);
  }, [user?.uid]);

  const isDetail = active in detailTitles;
  const isCommunity = active === "Community";
  const classicDetailParent: View =
    active === "Resources" || active === "Session"
      ? "Learn"
      : active === "Certificates" || active === "Organization" || active === "Benefits"
        ? "Profile"
        : active === "Directory" || active === "Programs"
          ? "Community"
          : activeBranch;
  /** Sheet-opened destinations pop back to the last branch; Profile tools keep classic parents. */
  const detailParent: View =
    fromSheet &&
    (active === "Directory" ||
      active === "Benefits" ||
      active === "Programs" ||
      active === "Certificates" ||
      active === "Resources" ||
      active === "Organization" ||
      active === "Community")
      ? activeBranch
      : isCommunity
        ? activeBranch
        : classicDetailParent;
  const showBack = isDetail || isCommunity;
  /** Bubble always tracks the last selected branch — center never looks selected. */
  const navBranch: Branch = activeBranch;
  const navEntry = branches.find((tab) => tab.label === navBranch) ?? {
    label: "Home" as const,
    icon: Home,
    slot: 0,
  };
  const activeSlot = navEntry.slot;
  const BubbleIcon = navEntry.icon;
  const apertureLeft = `${activeSlot * 20 + 10}%`;

  if (!ready) {
    return (
      <div className="app-stage">
        <div className="phone-app">
          <div
            className="auth-screen"
            style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}
          >
            <p className="auth-info" role="status">
              Restoring your session…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!showPortal) {
    return (
      <div className="app-stage">
        <div className="phone-app">
          <MobileOnboarding />
          <div style={{ padding: "0 24px 28px" }}>
            <button
              type="button"
              onClick={() => setPreview(true)}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 14,
                border: "1px solid #cbd9f3",
                background: "#2f6cf0",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Preview signed-in screens
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!portalIdentity || (!preview && (profileState !== "ready" || identity?.status === "suspended")))
    return <ProfileGate />;

  const displayName = portalIdentity.displayName;
  const initials = portalIdentity.initials;
  const agentNumber = portalIdentity.agentNumber;
  const openSession = (session: ApiSession) => {
    setSelectedSession(session);
    select("Session");
  };

  return (
    <div className="app-stage">
      <div ref={phoneRef} className="phone-app portal-shell teresa-inside">
        <div className="ambient-grid" aria-hidden="true" />
        <header className={active === "Home" ? "app-header flush home-header" : "app-header"}>
          {showBack ? (
            <button
              className="icon-button"
              aria-label="Go back"
              onClick={() => select(detailParent)}
            >
              <ArrowLeft />
            </button>
          ) : active === "Home" ? (
            <button
              className="header-avatar"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              {initials}
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </button>
          )}
          {isDetail ? (
            <strong className="header-title">{detailTitles[active as Detail]}</strong>
          ) : active === "Home" ? (
            <div className="header-brand">
              <MiniLogo />
              <span>Member portal</span>
            </div>
          ) : (
            <strong className="header-title">
              {active === "Community" ? "Community" : active}
            </strong>
          )}
          <div className="header-actions">
            {active === "Home" && !isDetail ? (
              <button
                className="icon-button"
                aria-label="Search"
                onClick={() => selectBranch("Learn")}
              >
                <Search />
              </button>
            ) : null}
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              type="button"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell />
            </button>
          </div>
        </header>

        <main
          key={arriveTick === 0 ? "content-0" : `content-${arriveTick}`}
          className={arriveTick === 0 ? "app-content" : "app-content page-arrive"}
        >
          {active === "Home" && (
            <HomeView
              identity={portalIdentity}
              events={events}
              sessions={sessions}
              eventData={eventData}
              onExplore={() => selectBranch("Learn")}
              onEvent={() => selectBranch("Events")}
              onBenefits={() => select("Benefits")}
              onProfile={() => select("Profile")}
              onPrograms={() => select("Programs")}
              onSession={openSession}
            />
          )}
          {active === "Learn" && (
            <LearnView
              sessions={sessions}
              loadState={sessionData}
              onOpen={openSession}
              onResources={() => select("Resources")}
            />
          )}
          {active === "Events" && <EventsView events={events} loadState={eventData} />}
          {active === "Community" && (
            <CommunityView
              onDirectory={() => select("Directory")}
              onPrograms={() => select("Programs")}
            />
          )}
          {active === "Profile" && <ProfileView identity={portalIdentity} go={select} />}
          {active === "Directory" && (
            <>
              <DataState result={directoryData} label="Directory">
                <DirectoryView members={directory} total={directoryData.data?.total ?? 0} />
              </DataState>
              <div className="directory-pagination">
                <button
                  disabled={directoryOffset === 0 || directoryData.state === "loading"}
                  onClick={() => setDirectoryOffset((n) => Math.max(0, n - 50))}
                >
                  Previous page
                </button>
                <button
                  disabled={
                    directoryData.state !== "ready" ||
                    directoryOffset + directory.length >= (directoryData.data?.total ?? 0)
                  }
                  onClick={() => setDirectoryOffset((n) => n + 50)}
                >
                  Next page
                </button>
              </div>
            </>
          )}
          {active === "Benefits" && <BenefitsView />}
          {active === "Organization" && <OrganizationView />}
          {active === "Certificates" && <CertificatesView />}
          {active === "Resources" && <ResourcesView />}
          {active === "Programs" && (
            <ProgramsView onEvents={() => selectBranch("Events")} onResources={() => select("Resources")} />
          )}
          {active === "Session" && (
            <SessionView
              session={selectedSession}
              onResources={() => select("Resources")}
              onEvents={() => selectBranch("Events")}
            />
          )}
        </main>

        <nav ref={navRef} className="bottom-nav" aria-label="Primary navigation">
          <svg
            className="nav-surface"
            viewBox="0 0 390 72"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={navSurfacePath(activeSlot)} />
          </svg>
          <span className="nav-bubble" style={{ left: apertureLeft }} aria-hidden="true">
            <BubbleIcon />
          </span>
          {branches.slice(0, 2).map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={navBranch === label ? "nav-item active" : "nav-item"}
              aria-current={navBranch === label ? "page" : undefined}
              onClick={() => selectBranch(label)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            className={centerPress === "idle" ? "nav-center" : `nav-center press-${centerPress}`}
            aria-label="Quick actions"
            aria-haspopup="dialog"
            aria-expanded={quickOpen}
            onClick={openQuickActions}
          >
            <Grid2x2 />
            <span className="nav-center-label">Explore</span>
          </button>
          {branches.slice(2).map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className={navBranch === label ? "nav-item active" : "nav-item"}
              aria-current={navBranch === label ? "page" : undefined}
              onClick={() => selectBranch(label)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {menuOpen && (
          <div
            ref={overlayRef}
            className="drawer-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Portal menu"
          >
            <button
              className="drawer-backdrop"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="drawer">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="drawer-hero">
                <MiniLogo />
                <button
                  className="icon-button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                >
                  <X />
                </button>
                <div className="drawer-sheet" />
                <div className="drawer-identity">
                  <div className="avatar xl">{initials}</div>
                  <strong>{displayName}</strong>
                  <MembershipPill identity={portalIdentity} />
                  {agentNumber ? (
                    <span className="agent-id-chip">Agent ID {agentNumber}</span>
                  ) : null}
                  {profileSyncPending ? (
                    <span className="auth-info profile-sync-pending-note">
                      Profile sync pending
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="drawer-body">
                <p className="drawer-label">My account</p>
                {accountMenu.map(({ label, view, icon: Icon }) => (
                  <button className="drawer-link" key={label} onClick={() => select(view)}>
                    <Icon />
                    <span>{label}</span>
                    <ChevronRight />
                  </button>
                ))}
                <div className="drawer-divider" />
                <p className="drawer-label">General</p>
                {generalMenu.map(({ label, view, icon: Icon }) => (
                  <button className="drawer-link" key={label} onClick={() => select(view)}>
                    <Icon />
                    <span>{label}</span>
                    <ChevronRight />
                  </button>
                ))}
                <button className="drawer-link logout" onClick={() => void logout()}>
                  <LogOut />
                  <span>Logout</span>
                  <ChevronRight />
                </button>
                {signOutError && <p role="alert">{signOutError}</p>}
              </div>
            </aside>
          </div>
        )}

        {quickOpen && (
          <div
            ref={overlayRef}
            className="drawer-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Quick actions"
          >
            <button
              className="drawer-backdrop"
              aria-label="Close quick actions"
              type="button"
              onClick={() => setQuickOpen(false)}
            />
            <aside className="quick-actions-sheet">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="quick-actions-head">
                <strong>Quick actions</strong>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close quick actions"
                  onClick={() => setQuickOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="quick-actions-list">
                {quickActionRows.map(({ label, view, icon: Icon, copy }) => (
                  <button
                    type="button"
                    className="quick-action-row"
                    key={label}
                    onClick={() => openFromSheet(view)}
                  >
                    <span className="quick-action-ico">
                      <Icon />
                    </span>
                    <span className="quick-action-copy">
                      <strong>{label}</strong>
                      <small>{copy}</small>
                    </span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="quick-browse-toggle"
                aria-expanded={browseAllOpen}
                onClick={() => setBrowseAllOpen((v) => !v)}
              >
                Browse all
              </button>
              {browseAllOpen ? (
                <div className="quick-actions-list browse-all-list">
                  {browseAllRows.map(({ label, view, icon: Icon }) => (
                    <button
                      type="button"
                      className="quick-action-row"
                      key={label}
                      onClick={() => openFromSheet(view)}
                    >
                      <span className="quick-action-ico">
                        <Icon />
                      </span>
                      <span className="quick-action-copy">
                        <strong>{label}</strong>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        )}

        {notificationsOpen && (
          <div
            ref={overlayRef}
            className="drawer-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
          >
            <button
              className="drawer-backdrop"
              aria-label="Close notifications"
              type="button"
              onClick={() => setNotificationsOpen(false)}
            />
            <aside className="notify-sheet">
              <div className="sheet-handle" aria-hidden="true" />
              <div className="notify-sheet-head">
                <strong>Notifications</strong>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="empty-note">
                No notifications yet. Updates will appear here when available.
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function BannerSlot({
  label = "Banner",
  src,
  srcSet,
  alt,
}: {
  label?: string;
  src?: string;
  srcSet?: string;
  alt?: string;
}) {
  const hasImage = Boolean(src);
  return (
    <div
      className={hasImage ? "banner-slot has-image" : "banner-slot"}
      role={hasImage ? undefined : "img"}
      aria-label={hasImage ? undefined : `${label} placeholder`}
    >
      {hasImage ? (
        <img src={src} srcSet={srcSet} alt={alt || label} decoding="async" />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

const HOME_NEWS = [
  {
    title: "October AI Exchange: save the date",
    copy: "Tuesday, October 13, 8:00 PM PHT. Topic and speaker revealed soon.",
    when: "Today",
  },
  {
    title: "September recap is up",
    copy: "Sven Bally's recordings and Q&A follow-ups are in Learnings.",
    when: "Yesterday",
  },
  {
    title: "The program roadmap is out",
    copy: "AI Safari, Build Nights, Certification Pathways and more, in order.",
    when: "Sep 14",
  },
] as const;

function HomeView({
  identity,
  events,
  sessions,
  eventData,
  onExplore,
  onEvent,
  onBenefits,
  onProfile,
  onPrograms,
  onSession,
}: {
  identity: DisplayIdentity;
  events: ApiEvent[];
  sessions: ApiSession[];
  eventData: Loadable<ApiEvent[]>;
  onExplore: () => void;
  onEvent: () => void;
  onBenefits: () => void;
  onProfile: () => void;
  onPrograms: () => void;
  onSession: (session: ApiSession) => void;
}) {
  const upcoming =
    events.find((e) => e.status === "registration_open") ||
    events.find((e) => e.status !== "held" && e.status !== "cancelled") ||
    null;
  const continueSession = sessions[0] || null;
  return (
    <div className="screen-stack animate-fade-in">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <h1>Welcome back, {identity.firstName}.</h1>
          <p>{identity.membershipLabel}</p>
        </div>
        <div className="identity-strip">
          <div>
            <span>Membership</span>
            <strong className={`membership-value status-${identity.status}`}>
              {identity.membershipLabel}
            </strong>
          </div>
          <div>
            <span>Agent ID</span>
            <strong>{identity.agentNumber || "Not assigned"}</strong>
          </div>
        </div>
        {identity.profileSyncPending ? (
          <div className="empty-note profile-sync-pending-note">
            Profile sync pending — your account is signed in.
          </div>
        ) : null}
      </section>

      <div className="home-membership">
        <MembershipPanel />
      </div>
      <BannerSlot
        label="Home banner"
        src="/banners/home/home-banner@1x.png"
        srcSet="/banners/home/home-banner@1x.png 1x, /banners/home/home-banner@2x.png 2x, /banners/home/home-banner@3x.png 3x"
        alt="PAAIPE community welcome"
      />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Next up</h2>
          </div>
          <button className="text-link" type="button" onClick={onEvent}>
            Events
          </button>
        </div>
        <DataState result={eventData} label="Events">
          {upcoming ? (
            <button className="event-feature soft-event" type="button" onClick={onEvent}>
              <div className="event-hero-wash">
                <span className="event-tag">{upcoming.format || "Online"}</span>
                <strong className="event-hero-title">{upcoming.series || "AI Exchange"}</strong>
              </div>
              <div className="event-body">
                <strong>{upcoming.title || "PAAIPE AI Exchange"}</strong>
                <small>
                  {upcoming.topic || upcoming.description || "Topic and speaker to be revealed soon"}
                </small>
              </div>
            </button>
          ) : (
            <div className="empty-note">No upcoming Exchange is published yet.</div>
          )}
        </DataState>
      </section>

      <div className="settings-list">
        <button type="button" onClick={onBenefits}>
          <Gift />
          <span>
            <strong>See benefits</strong>
            <small>Exclusive benefits for PAAIPE Agents · coming soon</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onExplore}>
          <Play />
          <span>
            <strong>Open Learnings</strong>
            <small>
              {continueSession
                ? continueSession.title || "Published sessions"
                : "Sessions, micros, and playlists"}
            </small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onProfile}>
          <UserRound />
          <span>
            <strong>Complete profile</strong>
            <small>Add your role and sector so other Agents can find you</small>
          </span>
          <ChevronRight />
        </button>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Latest from PAAIPE</h2>
          </div>
          <button className="text-link" type="button" onClick={onExplore}>
            Learnings
          </button>
        </div>
        <div className="resource-list">
          {HOME_NEWS.map((item) => (
            <article className="resource-card" key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.when} · {item.copy}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Your Agent stats</h2>
          </div>
        </div>
        <div className="program-list">
          <article className="program-card">
            <div>
              <strong>Exchanges attended</strong>
              <p>Nothing to show yet. Attendance is counted after each Exchange.</p>
            </div>
          </article>
          <article className="program-card">
            <div>
              <strong>Streak</strong>
              <p>Nothing to show yet.</p>
            </div>
          </article>
          <article className="program-card">
            <div>
              <strong>Badges</strong>
              <p>0 badges yet. Your first arrives after you attend an Exchange.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Programs for you</h2>
          </div>
          <button className="text-link" type="button" onClick={onPrograms}>
            All programs
          </button>
        </div>
        <div className="program-list">
          <article className="program-card">
            <div>
              <strong>AI Safari</strong>
              <p>Join the interest list for the first field trip.</p>
            </div>
            <span className="state">Join list</span>
          </article>
          <article className="program-card">
            <div>
              <strong>Regional Circles</strong>
              <p>Pick your circle when they open.</p>
            </div>
            <span className="state">Notify me</span>
          </article>
        </div>
        <div className="empty-note">Interest lists are not connected in this build.</div>
      </section>
    </div>
  );
}

function LearnView({
  sessions,
  loadState,
  onOpen,
  onResources,
}: {
  sessions: ApiSession[];
  loadState: Loadable<ApiSession[]>;
  onOpen: (session: ApiSession) => void;
  onResources: () => void;
}) {
  const [lane, setLane] = useState<"Sessions" | "Micros" | "Playlists">("Sessions");
  const [library, setLibrary] = useState<"hub" | "recordings" | "slides">("hub");
  const [query, setQuery] = useState("");
  const [watched, setWatched] = useState<Record<string, boolean>>({});
  const shown = sessions.filter((item) =>
    (item.title || "").toLowerCase().includes(query.toLowerCase()),
  );
  if (library === "slides") {
    return (
      <div className="screen-stack animate-fade-in page-screen">
        <button className="text-link back-link" type="button" onClick={() => setLibrary("hub")}>
          <ArrowLeft /> Learnings
        </button>
        <PageTitle
          kicker="Member materials"
          title="Speaker's slides"
          subtitle="Viewed inside the PAAIPE member portal. Please don't re-post outside the association."
        />
        <div className="empty-note">
          <strong>The deck opens in a new window</strong>
          <p>
            No slide deck is published for this session. Gamma decks open outside the page when a
            speaker shares one.
          </p>
        </div>
      </div>
    );
  }
  if (library === "recordings") {
    return (
      <div className="screen-stack animate-fade-in page-screen">
        <button className="text-link back-link" type="button" onClick={() => setLibrary("hub")}>
          <ArrowLeft /> Library home
        </button>
        <PageTitle
          kicker="Learnings"
          title="All recordings"
          subtitle="Published sessions, in the order set for members."
        />
        <DataState result={loadState} label="Sessions">
          {shown.length === 0 ? (
            <div className="empty-note">No sessions published yet.</div>
          ) : (
            shown.map((item) => (
              <article className="program-card" key={item.id}>
                <div>
                  <strong>{item.title || "Session"}</strong>
                  <p>{item.description || "Recorded session"}</p>
                </div>
                <button className="state on" type="button" onClick={() => onOpen(item)}>
                  Watch
                </button>
              </article>
            ))
          )}
        </DataState>
        {shown.map((item) => (
          <button
            key={`${item.id}-watched`}
            className="portal-link"
            type="button"
            onClick={() => setWatched((current) => ({ ...current, [item.id]: !current[item.id] }))}
          >
            {watched[item.id] ? "Watched on this device" : "Mark as watched"}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Knowledge hub"
        title="Learnings"
        subtitle="Sessions, micros, and playlists published for members."
      />
      <label className="search-field">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions"
        />
      </label>
      <div className="filter-pills" aria-label="Learnings">
        {(["Sessions", "Micros", "Playlists"] as const).map((label) => (
          <button
            key={label}
            type="button"
            className={lane === label ? "selected" : ""}
            aria-pressed={lane === label}
            onClick={() => setLane(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {lane === "Sessions" && (
        <DataState result={loadState} label="Sessions">
          {shown.length === 0 ? (
            <div className="empty-note">
              {query
                ? "No sessions match your search."
                : "No sessions published yet. Published sessions appear here in the order set for Learnings. Calendar and registration live under Events."}
            </div>
          ) : (
            <div className="resource-list">
              {shown.map((item, index) => (
                <button className="resource-card" key={item.id} type="button" onClick={() => onOpen(item)}>
                  <div className={`resource-icon tone-${index % 3}`}>
                    <Play fill="currentColor" />
                  </div>
                  <div>
                    <strong>{item.title || "Session"}</strong>
                    <span>{item.description || "Recorded session"}</span>
                  </div>
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
        </DataState>
      )}
      {lane === "Micros" && (
        <div className="empty-note">
          <strong>No micros yet</strong>
          <p>Short vertical clips appear here when published in Learnings. No placeholder reels.</p>
        </div>
      )}
      {lane === "Playlists" && (
        <div className="empty-note">
          <strong>No playlists published yet</strong>
          <p>Published playlists from the library will appear here.</p>
        </div>
      )}
      <div className="settings-list">
        <button type="button" onClick={() => setLibrary("recordings")}>
          <Play />
          <span>
            <strong>All recordings</strong>
            <small>Watch, slides, and mark as watched</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => setLibrary("slides")}>
          <Presentation />
          <span>
            <strong>Speaker's slides</strong>
            <small>Opens when a deck is shared</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onResources}>
          <FileText />
          <span>
            <strong>Resources</strong>
            <small>Guides and references</small>
          </span>
          <ChevronRight />
        </button>
      </div>
      <div className="empty-note">
        Session materials are shared with PAAIPE members under the speaker's permission. Please keep
        them inside the association.
      </div>
    </div>
  );
}

function EventsView({
  events,
  loadState,
}: {
  events: ApiEvent[];
  loadState: Loadable<ApiEvent[]>;
}) {
  const [period, setPeriod] = useState<"Upcoming" | "Past">("Upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = events.filter((event) =>
    period === "Past" ? event.status === "held" : event.status !== "held",
  );
  const selected = events.find((event) => event.id === selectedId) || null;
  if (selected) {
    const held = selected.status === "held";
    return (
      <div className="screen-stack animate-fade-in page-screen">
        <button className="text-link back-link" type="button" onClick={() => setSelectedId(null)}>
          <ArrowLeft /> Events
        </button>
        <PageTitle
          kicker={held ? "Recap" : "Upcoming"}
          title={selected.title || "AI Exchange"}
          subtitle={selected.topic || selected.description || "Topic to be announced"}
        />
        <div className="event-meta">
          <span>
            <CalendarDays />
            {selected.date || "Date to be announced"}
          </span>
          {selected.startTime && (
            <span>
              <Clock3 />
              {selected.startTime}
              {selected.endTime ? ` – ${selected.endTime}` : ""}
            </span>
          )}
        </div>
        <div className="program-list">
          {[
            ["Session recording", held ? "Members only · Watch in Learnings" : "Not published yet"],
            ["Speaker's slides", "As presented, shared with the speaker's permission"],
            ["Feedback", "Opens after the session, for people who registered"],
            ["Certificate", "After registration and feedback"],
            ["Q&A follow-ups", "Questions the speaker answered after the session"],
          ].map(([title, copy]) => (
            <article className="program-card" key={title}>
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
              <span className="state">{held && title === "Session recording" ? "Watch" : "Not yet"}</span>
            </article>
          ))}
        </div>
        <div className="empty-note">
          Join links, calendar files, and registration are not connected in this build.
        </div>
      </div>
    );
  }
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Community calendar"
        title="Events"
        subtitle="Upcoming and past Exchanges for members."
      />
      <div className="filter-pills" aria-label="Event filter">
        {(["Upcoming", "Past"] as const).map((label) => (
          <button
            key={label}
            type="button"
            className={period === label ? "selected" : ""}
            aria-pressed={period === label}
            onClick={() => setPeriod(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <BannerSlot
        label="Events banner"
        src="/banners/events/events-banner@1x.png"
        srcSet="/banners/events/events-banner@1x.png 1x, /banners/events/events-banner@2x.png 2x"
        alt="PAAIPE community events"
      />
      <DataState result={loadState} label="Events">
        {list.length === 0 ? (
          <div className="empty-note">No {period.toLowerCase()} events right now.</div>
        ) : (
          list.map((event) => (
            <article className="teresa-event-card" key={event.id} onClick={() => setSelectedId(event.id)} role="button" tabIndex={0} onKeyDown={(eventKey) => {
              if (eventKey.key === "Enter") setSelectedId(event.id);
            }}>
              <div className="event-poster">
                {event.coverUrl ? (
                  <img src={event.coverUrl} alt="" loading="lazy" />
                ) : (
                  <>
                    <CalendarDays />
                    <span>{event.series || "PAAIPE events"}</span>
                  </>
                )}
              </div>
              <div className="event-title-row">
                <h2>{event.title || "PAAIPE event"}</h2>
                <span className="soft-chip">{event.format || "Event"}</span>
              </div>
              <div className="event-meta">
                <span>
                  <CalendarDays />
                  {event.date || "Date to be announced"}
                </span>
                {event.startTime && (
                  <span>
                    <Clock3 />
                    {event.startTime}
                    {event.endTime ? ` – ${event.endTime}` : ""}
                  </span>
                )}
              </div>
              {(event.description || event.topic) && <p>{event.description || event.topic}</p>}
              <div className="empty-note">Open this event for the recap, recording, slides, and certificate.</div>
            </article>
          ))
        )}
      </DataState>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Your attendance</h2>
          </div>
        </div>
        <div className="empty-note">
          Attendance is taken from the Zoom register after each Exchange. Nothing to show yet.
          Register for an Exchange and it will be counted here.
        </div>
      </section>
    </div>
  );
}

function CommunityView({
  onDirectory,
  onPrograms,
}: {
  onDirectory: () => void;
  onPrograms: () => void;
}) {
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Your AI network"
        title="Community"
        subtitle="Find expertise, collaborators, and opportunities."
      />
      <div className="community-map">
        <div>
          <strong>Your AI community</strong>
          <span className="network-cap">Explore the member directory and program roadmap.</span>
        </div>
      </div>

      <div className="quick-grid">
        <button type="button" onClick={onDirectory}>
          <span className="quick-ico">
            <UsersRound />
          </span>
          <strong>Directory</strong>
          <span>Discover members</span>
        </button>
        <button type="button" onClick={onPrograms}>
          <span className="quick-ico">
            <Clock3 />
          </span>
          <strong>Programs</strong>
          <span>Join an initiative</span>
        </button>
      </div>
      <div className="section-heading spotlight-head">
        <div>
          <h2>Agent spotlight</h2>
        </div>
      </div>
      <div className="empty-note">Spotlight members will appear here when available.</div>
    </div>
  );
}

function MembershipPill({ identity }: { identity: DisplayIdentity }) {
  return (
    <span className={`membership-pill status-${identity.status}`}>
      <i aria-hidden="true" />
      {identity.membershipLabel}
    </span>
  );
}

function ProfileView({ identity, go }: { identity: DisplayIdentity; go: (view: View) => void }) {
  return (
    <div className="screen-stack animate-fade-in page-screen profile-screen">
      <section className="profile-hero">
        <div className="avatar profile-avatar">{identity.initials}</div>
        <h1>{identity.displayName}</h1>
        <MembershipPill identity={identity} />
        <p>{identity.email}</p>
        {identity.profileSyncPending && (
          <div className="empty-note profile-sync-pending-note">
            Profile sync pending — your account is signed in.
          </div>
        )}
      </section>
      <div className="profile-membership">
        <div>
          <span>Membership</span>
          <strong>{identity.membershipLabel}</strong>
        </div>
        <div>
          <span>Agent ID</span>
          <strong>{identity.agentNumber || "Not assigned"}</strong>
        </div>
      </div>
      <div className="profile-brand">
        <MiniLogo />
        <span>
          Philippine Association of AI
          <br />
          Professionals and Entrepreneurs
        </span>
      </div>
      <MembershipPanel />
      <h2 className="subheading">Account</h2>
      <div className="settings-list">
        <button type="button" onClick={() => go("Organization")}>
          <Building2 />
          <span>
            <strong>My organization</strong>
            <small>Team and organization information</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Benefits")}>
          <Gift />
          <span>
            <strong>Member benefits</strong>
            <small>Upcoming partner perks</small>
          </span>
          <ChevronRight />
        </button>
      </div>
      <h2 className="subheading">Activity</h2>
      <div className="settings-list">
        <button type="button" onClick={() => go("Certificates")}>
          <Award />
          <span>
            <strong>My certificates</strong>
            <small>View earned credentials</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Programs")}>
          <Compass />
          <span>
            <strong>Programs</strong>
            <small>Explore learning initiatives</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Learn")}>
          <BookOpen />
          <span>
            <strong>Learning library</strong>
            <small>Sessions and resources</small>
          </span>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function DirectoryView({ members, total }: { members: DirectoryMember[]; total: number }) {
  const [query, setQuery] = useState("");
  const shown = members.filter((m) =>
    (m.name + (m.role || "")).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Member network"
        title="Member directory"
        subtitle="Members across the Philippine AI community."
      />
      <label className="search-field">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names on this page"
        />
      </label>
      <p className="directory-count">{total} opted-in Agents · search covers this page</p>
      {shown.length === 0 ? (
        <div className="empty-note">
          {query
            ? "No members match your search on this page."
            : "No opted-in Agents are listed yet."}
        </div>
      ) : (
        <div className="member-list">
          {shown.map((m) => (
            <article className="member-card" key={m.uid}>
              <div className="avatar">{m.initials}</div>
              <div>
                <strong>{m.name}</strong>
                <span>{m.agentNumber ? `Agent ${m.agentNumber}` : "Confirmed Agent"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BenefitsView() {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Membership"
        title="Member benefits"
        subtitle="Benefits designed to help members learn, build and connect."
      />
      <p className="copy-block">{BENEFITS_INTRO}</p>
      <div className="program-list">
        {MEMBER_BENEFITS.map((benefit) => (
          <article className="program-card" key={benefit.name}>
            <div>
              <strong>{benefit.name}</strong>
              <p>{benefit.description}</p>
              {benefit.partner ? <p className="partner-disclaimer">{PARTNER_BENEFIT_DISCLAIMER}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
function OrganizationView() {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Your organizations"
        title="Organization"
        subtitle="Manage the organizations you represent."
      />
      <div className="empty-note">
        Organization management is not connected in this mobile version. This screen does not
        indicate whether your account has organizations.
      </div>
      <button
        className="portal-link"
        onClick={() => void openExternalUrl("https://paaipe.org/portal-organization.html")}
      >
        Open My Organizations on the web
      </button>
    </div>
  );
}
function CertificatesView() {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Credentials"
        title="My certificates"
        subtitle="Certificates issued for your participation."
      />
      <div className="empty-note">
        Your certificate library is not connected in this mobile version. Open the web portal to
        check issued certificates.
      </div>
      <button
        className="portal-link"
        onClick={() => void openExternalUrl("https://paaipe.org/portal-my-certificates.html")}
      >
        Open My Certificates on the web
      </button>
    </div>
  );
}
function ResourcesView() {
  const [format, setFormat] = useState<(typeof RESOURCE_FORMATS)[number]>("All formats");
  const previews = RESOURCE_PREVIEWS.filter((item) => format === "All formats" || item.format === format);
  const showFilm = format === "All formats" || format === "Video";
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Member materials"
        title="Resources"
        subtitle="PDFs, videos and templates — every resource says up front what it is and how to get it."
      />
      <div className="filter-pills" aria-label="Filter by format">
        {RESOURCE_FORMATS.map((label) => (
          <button
            key={label}
            type="button"
            className={format === label ? "selected" : ""}
            aria-pressed={format === label}
            onClick={() => setFormat(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {showFilm ? (
        <article className="program-card">
          <div>
            <span className="soft-chip">{RESOURCE_FILM.format}</span>
            <strong>{RESOURCE_FILM.title}</strong>
            <p>{RESOURCE_FILM.description}</p>
            <p>
              {RESOURCE_FILM.medium} · {RESOURCE_FILM.detail}
            </p>
            <button
              className="portal-link"
              type="button"
              onClick={() => void openExternalUrl(RESOURCE_FILM.href)}
            >
              {RESOURCE_FILM.actionLabel} on {RESOURCE_FILM.host}
            </button>
          </div>
        </article>
      ) : null}
      {previews.length === 0 && !showFilm ? (
        <div className="empty-note">No resources in this format yet.</div>
      ) : (
        <div className="program-list">
          {previews.map((item) => (
            <article className="program-card" key={item.title}>
              <div>
                <span className="soft-chip">{item.status}</span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <p>
                  {item.format} · {item.medium} · {item.topic}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function ProgramsView({ onEvents, onResources }: { onEvents: () => void; onResources: () => void }) {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Program roadmap"
        title="Programs"
        subtitle="Public learning and members-only programs published by PAAIPE."
      />
      <div className="program-list">
        {PROGRAMS.map((program) => (
          <article className="program-card" key={program.slug}>
            <div>
              <strong>{program.title}</strong>
              <p>{program.copy}</p>
            </div>
            {"opensEvents" in program && program.opensEvents ? (
              <button className="state on" type="button" onClick={onEvents}>
                Events
              </button>
            ) : "opensResources" in program && program.opensResources ? (
              <button className="state on" type="button" onClick={onResources}>
                Resources
              </button>
            ) : (
              <span className={`state ${program.visibility === "public" ? "public" : ""}`}>
                {program.visibility === "public" ? "Public" : "Members only"}
              </span>
            )}
          </article>
        ))}
      </div>
      {PROGRAM_NOTES.map((note) => (
        <div className="empty-note" key={note}>
          {note}
        </div>
      ))}
    </div>
  );
}

function SessionView({
  session,
  onResources,
  onEvents,
}: {
  session: ApiSession | null;
  onResources: () => void;
  onEvents: () => void;
}) {
  const videoUrl =
    session?.youtubeUrl ||
    (session?.youtubeId
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(session.youtubeId)}`
      : null);
  return (
    <div className="screen-stack animate-fade-in page-screen session-screen">
      <PageTitle
        kicker="Learnings · Recordings"
        title={session?.title || "Session"}
        subtitle={session?.description || "Members-only recording."}
      />
      <div className="session-player">
        <img src={session?.posterUrl || eventCover} alt="" />
        {videoUrl ? (
          <button className="session-watch" type="button" onClick={() => void openExternalUrl(videoUrl)}>
            <Play fill="currentColor" />
            Watch
          </button>
        ) : null}
      </div>
      {!videoUrl && <div className="empty-note">A recording is not available for this session yet.</div>}
      <h2 className="subheading">Speaker</h2>
      <article className="program-card">
        <div>
          <strong>Speaker</strong>
          <p>The speaker name is shown when the published session includes one.</p>
        </div>
      </article>
      <h2 className="subheading">Chapters</h2>
      <div className="empty-note">No chapters are published for this recording yet.</div>
      <h2 className="subheading">Q&A follow-ups</h2>
      <div className="empty-note">Questions the speaker answered after the session will appear here.</div>
      <div className="settings-list">
        <button type="button" onClick={onResources}>
          <Presentation />
          <span>
            <strong>Resources</strong>
            <small>Slides and guides for this session</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onEvents}>
          <CalendarDays />
          <span>
            <strong>Next Exchange</strong>
            <small>Topic to be announced · open Events</small>
          </span>
          <ChevronRight />
        </button>
      </div>
      <div className="empty-note">Report a playback problem from the association if the recording will not play.</div>
    </div>
  );
}

function PageTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="page-title">
      <span>{kicker}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
