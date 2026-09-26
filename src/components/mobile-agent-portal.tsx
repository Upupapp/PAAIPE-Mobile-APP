import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity,
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
  Files,
  Gift,
  Grid2x2,
  Heart,
  LayoutTemplate,
  ListChecks,
  Home,
  ImagePlus,
  Link2,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Newspaper,
  Play,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import logo from "../assets/paaipe-logo.png";
import eventCover from "../assets/ai-exchange-cover.png";
import QRCode from "qrcode";
import "./portal-teresa.css";
import { MobileOnboarding } from "./mobile-onboarding";
import { useAuth } from "../lib/auth-context";
import {
  getEvents,
  getSessions,
  getDirectory,
  initialsFromName,
  type ApiEvent,
  type ApiSession,
  type DirectoryMember,
} from "../lib/api";
import { tryPatchProfile } from "../lib/auth-context";
import { type DisplayIdentity } from "../lib/profile-display";
import { openExternalUrl } from "../lib/legal-links";
import {
  canSubmitRegistration,
  submitEventRegistration,
  newRegistrationId,
  enqueueRegistration,
  dequeueRegistration,
  flushRegistrationQueue,
  isRetriableRegistrationError,
  fetchMyRegistrations,
  cancelMyRegistration,
  readRegistrationQueue,
} from "../lib/registrations";
import {
  recordRegistrationEvent,
  readRegistrationTelemetry,
  offlineWriteRate,
} from "../lib/telemetry";
import { useLoadable, type Loadable } from "../hooks/use-loadable";
import { DataState, MembershipPanel, ProfileGate } from "./membership-panel";
import { AppHaptics } from "../lib/app-haptics";

/** Four router branches. The center button opens the member feed. */
type Branch = "Home" | "Learn" | "Events" | "Profile";
type Detail =
  | "Directory"
  | "Benefits"
  | "Organization"
  | "Certificates"
  | "Programs"
  | "Session"
  | "EditProfile"
  | "PublicProfile"
  | "MemberProfile"
  | "Diagnostics";
type View = Branch | Detail | "Feed";
type LearnLane = "Sessions" | "Micros" | "Playlists" | "Resources";

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

const detailTitles: Record<Detail, string> = {
  Directory: "Directory",
  Benefits: "Member benefits",
  Organization: "Organization",
  Certificates: "My certificates",
  Programs: "Programs",
  Session: "Session",
  EditProfile: "Edit profile",
  PublicProfile: "Your public profile",
  MemberProfile: "Profile",
  Diagnostics: "Diagnostics",
};

const accountMenu: Array<{ label: string; view: View; icon: typeof Home }> = [
  { label: "Programs", view: "Programs", icon: Compass },
  { label: "Learning library", view: "Learn", icon: BookOpen },
  { label: "My certificates", view: "Certificates", icon: Award },
  { label: "My profile", view: "Profile", icon: UserRound },
];

const generalMenu: Array<{ label: string; view: View; icon: typeof Home; lane?: LearnLane }> = [
  { label: "Events", view: "Events", icon: CalendarDays },
  { label: "Member directory", view: "Directory", icon: UsersRound },
  { label: "Member benefits", view: "Benefits", icon: Gift },
  { label: "Resources", view: "Learn", icon: FileText, lane: "Resources" },
  { label: "Organization", view: "Organization", icon: Building2 },
  { label: "Diagnostics", view: "Diagnostics", icon: Activity },
];

function MiniLogo() {
  return <img src={logo} alt="PAAIPE" className="h-9 w-auto object-contain" />;
}

type PublicCard = {
  name: string;
  headline: string;
  about: string;
  work: string;
  link: string;
  photo: string;
  directoryVisible: boolean;
};

const PUBLIC_CARD_KEY = "paaipe-public-profile";

function readPublicCard(): PublicCard | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CARD_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PublicCard>;
    if (!value || typeof value.name !== "string") return null;
    return {
      name: value.name,
      headline: typeof value.headline === "string" ? value.headline : "",
      about: typeof value.about === "string" ? value.about : "",
      work: typeof value.work === "string" ? value.work : "",
      link: typeof value.link === "string" ? value.link : "",
      photo: typeof value.photo === "string" ? value.photo : "",
      directoryVisible: value.directoryVisible === true,
    };
  } catch {
    return null;
  }
}

function writePublicCard(card: PublicCard) {
  localStorage.setItem(PUBLIC_CARD_KEY, JSON.stringify(card));
}

export type EventTicket = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  attendeeName: string;
  attendeeEmail: string;
  note: string;
  code: string;
  reference: string;
  createdAt: string;
  synced: boolean;
  /** Event banner shown on the confirmation/QR pass, when the event has one. */
  coverUrl?: string;
  /** A signed-in member's write that failed to send and is queued to resend. */
  pending?: boolean;
};

/** How a cancellation resolved, so the UI can distinguish server vs. local. */
export type CancelOutcome = "server" | "local" | "failed";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
};

const TICKETS_KEY = "paaipe-event-tickets";
const NOTIFICATIONS_KEY = "paaipe-notifications";

function readTickets(): Record<string, EventTicket> {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, EventTicket>) : {};
  } catch {
    return {};
  }
}

function readNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function writeTickets(tickets: Record<string, EventTicket>) {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
}

function writeNotifications(notifications: AppNotification[]) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 30)));
}

function ticketCode(eventId: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `PAAIPE-${eventId.slice(0, 6).toUpperCase()}-${stamp}${rand}`;
}

function relativeTime(at: number): string {
  const diff = Math.max(0, Date.now() - at);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

const PREVIEW_DIRECTORY: DirectoryMember[] = [
  { uid: "d-ava", name: "Ava Cruz", initials: "AC", agentNumber: "0142", role: "Product lead, Northwind" },
  { uid: "d-marco", name: "Marco Reyes", initials: "MR", agentNumber: "0098", role: "ML engineer" },
  { uid: "d-liza", name: "Liza Tan", initials: "LT", agentNumber: "0211", role: "Data scientist" },
  { uid: "d-jomar", name: "Jomar Dela Cruz", initials: "JD", agentNumber: "0176", role: "Founder, Kalibrr AI" },
  { uid: "d-nina", name: "Nina Villanueva", initials: "NV", agentNumber: "0203", role: "AI researcher" },
];

// Sample content shown only in preview so Home and Learnings are usable when the
// live API is unreachable. Clearly marked as sample; not real scheduled events.
const PREVIEW_EVENTS: ApiEvent[] = [
  {
    id: "prev-ev-upcoming",
    title: "AI Exchange (sample)",
    series: "AI Exchange",
    format: "Webinar",
    status: "scheduled",
    date: "2nd Tuesday · monthly",
    startTime: "8:00 PM PHT",
    topic: "Sample topic — preview content",
    description:
      "Preview sample. Real Exchanges appear here when the association publishes them.",
    coverUrl: "/banners/events/events-banner@1x.png",
  },
  {
    id: "prev-ev-build-night",
    title: "Build Night (sample)",
    series: "Build Nights",
    format: "Lab",
    status: "scheduled",
    date: "Dates announced per cohort",
    topic: "Sample hands-on lab",
    description: "Preview sample. Cohort dates and seats are set by the association.",
  },
  {
    id: "prev-ev-recap",
    title: "AI Exchange recap (sample)",
    series: "AI Exchange",
    format: "Webinar",
    status: "held",
    date: "Held · sample recap",
    topic: "Sample recap",
    description:
      "Preview sample recap. The feedback form below is real, but sending to PAAIPE is not connected in this build.",
  },
];

const PREVIEW_SESSIONS: ApiSession[] = [
  {
    id: "prev-s-signals",
    title: "From Signals to Strategy (sample)",
    description: "Preview sample recording.",
    speaker: "Sample Speaker",
    published: true,
    displayOrder: 1,
  },
  {
    id: "prev-s-prompting",
    title: "Prompting foundations (sample)",
    description: "Preview sample recording.",
    speaker: "Sample Speaker",
    published: true,
    displayOrder: 2,
  },
  {
    id: "prev-s-llms",
    title: "Building with LLMs (sample)",
    description: "Preview sample recording without a listed speaker.",
    published: true,
    displayOrder: 3,
  },
];

const READY_RETRY = () => {};
function readyLoadable<T>(data: T): Loadable<T> {
  return { state: "ready", data, error: null, retry: READY_RETRY };
}

export function MobileAgentPortal() {
  const { ready, user, identity, profileState, profileSyncPending, signOut, refreshProfile, sendVerification, verificationNotice } = useAuth();
  const [publicCard, setPublicCard] = useState<PublicCard | null>(() => readPublicCard());
  const [preview, setPreview] = useState(false);
  const [directoryOffset, setDirectoryOffset] = useState(0);
  const signedIn = Boolean(user && profileState === "ready" && identity?.status !== "suspended");
  const showPortal = signedIn || preview;
  const usePreviewData = preview && !signedIn;
  const portalIdentity = identity ?? (preview ? PREVIEW_IDENTITY : null);
  const accountKey = signedIn ? user!.uid : null;
  const liveEventData = useLoadable(showPortal && !usePreviewData ? "events" : null, getEvents);
  const liveSessionData = useLoadable(showPortal && !usePreviewData ? "sessions" : null, getSessions);
  const eventData = usePreviewData ? readyLoadable(PREVIEW_EVENTS) : liveEventData;
  const sessionData = usePreviewData ? readyLoadable(PREVIEW_SESSIONS) : liveSessionData;
  const directoryData = useLoadable(
    accountKey ? `${accountKey}:${directoryOffset}` : null,
    async () => getDirectory(await user!.getIdToken(), directoryOffset),
  );
  const events = eventData.data ?? [];
  const sessions = sessionData.data ?? [];
  const baseDirectory = preview && !signedIn ? PREVIEW_DIRECTORY : directoryData.data?.members ?? [];
  const selfMember: DirectoryMember | null =
    publicCard && publicCard.directoryVisible && publicCard.name.trim()
      ? {
          uid: "self",
          name: publicCard.name.trim(),
          initials: initialsFromName(publicCard.name, portalIdentity?.email ?? ""),
          agentNumber: portalIdentity?.agentNumber ?? null,
          ...(publicCard.headline.trim() ? { role: publicCard.headline.trim() } : {}),
          ...(publicCard.photo ? { photo: publicCard.photo } : {}),
        }
      : null;
  const directory = selfMember
    ? [selfMember, ...baseDirectory.filter((m) => m.uid !== "self")]
    : baseDirectory;
  const directoryTotal =
    (preview && !signedIn ? PREVIEW_DIRECTORY.length : directoryData.data?.total ?? 0) +
    (selfMember ? 1 : 0);
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
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(FEED_SEED);
  const [tickets, setTickets] = useState<Record<string, EventTicket>>(() => readTickets());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => readNotifications());
  const [learnLane, setLearnLane] = useState<LearnLane>("Sessions");
  const [active, setActive] = useState<View>("Home");
  const [activeBranch, setActiveBranch] = useState<Branch>("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [fromSheet, setFromSheet] = useState(false);
  const [arriveTick, setArriveTick] = useState(0);
  const [centerPress, setCenterPress] = useState<"idle" | "in" | "over" | "settle">("idle");
  const overlayRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const centerAnimTimer = useRef<number[]>([]);
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;

  // Resend any registration whose backend write failed on a flaky network. The
  // write reuses the original client-minted id, so a resend cannot duplicate it.
  // Returns how many items settled so a manual "Sync now" can report a result.
  const syncPendingRegistrations = useCallback(async (): Promise<number> => {
    const settled = await flushRegistrationQueue();
    if (!settled.length) return 0;
    const currentTickets = ticketsRef.current;
    const confirmed: Array<{ eventId: string; title: string }> = [];
    for (const { registrationId, eventId } of settled) {
      const ticket = currentTickets[eventId];
      if (ticket && ticket.reference === registrationId && !ticket.synced)
        confirmed.push({ eventId, title: ticket.eventTitle });
    }
    if (!confirmed.length) return settled.length;
    setTickets((current) => {
      const next = { ...current };
      for (const { eventId } of confirmed) {
        const ticket = next[eventId];
        if (ticket) next[eventId] = { ...ticket, synced: true, pending: false };
      }
      writeTickets(next);
      return next;
    });
    setNotifications((current) => {
      const existing = new Set(current.map((item) => item.id));
      const fresh = confirmed
        .map(({ eventId, title }) => ({
          id: `n-sync-${eventId}`,
          title: "Registration synced",
          body: `Your spot for ${title} is now confirmed with PAAIPE.`,
          at: Date.now(),
          read: false,
        }))
        .filter((item) => !existing.has(item.id));
      if (!fresh.length) return current;
      const next = [...fresh, ...current];
      writeNotifications(next);
      return next;
    });
    return settled.length;
  }, []);

  // Reconcile local tickets against the backend so a member's registrations
  // follow them across devices. Reads the member's own rows (allowed for a
  // verified owner by email), adds a ticket for any active registration missing
  // locally, and drops a local ticket the member cancelled elsewhere.
  // Locally-pending (un-synced) tickets are left untouched.
  const reconcileTickets = useCallback(async (): Promise<void> => {
    const email = user?.email ?? "";
    if (!(signedIn && canSubmitRegistration() && user?.emailVerified && email)) return;
    const backendEvents = eventData.data ?? [];
    const remote = await fetchMyRegistrations(email);
    if (!remote.length) return;
    const byEvent = (id: string) => backendEvents.find((event) => event.id === id) ?? null;
    setTickets((current) => {
      let changed = false;
      const next = { ...current };
      for (const reg of remote) {
        if (!reg.eventId) continue;
        const existing = next[reg.eventId];
        if (reg.cancelled) {
          if (existing && existing.reference === reg.id) {
            delete next[reg.eventId];
            changed = true;
          }
          continue;
        }
        if (existing) {
          if (!existing.synced || existing.pending) {
            next[reg.eventId] = { ...existing, synced: true, pending: false, reference: reg.id };
            changed = true;
          }
          continue;
        }
        const event = byEvent(reg.eventId);
        next[reg.eventId] = {
          eventId: reg.eventId,
          eventTitle: event?.title || reg.event || "PAAIPE event",
          eventDate: event?.date || "Date to be announced",
          eventTime: event?.startTime
            ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`
            : "",
          attendeeName: publicCard?.name?.trim() || user?.displayName || "Member",
          attendeeEmail: email,
          note: "",
          code: ticketCode(reg.eventId),
          reference: reg.id,
          createdAt: new Date().toISOString(),
          synced: true,
          pending: false,
          ...(event?.coverUrl ? { coverUrl: event.coverUrl } : {}),
        };
        changed = true;
      }
      if (!changed) return current;
      writeTickets(next);
      return next;
    });
  }, [signedIn, user?.email, user?.emailVerified, user?.displayName, publicCard, eventData.data]);

  // Flush the queue and reconcile on mount, and again whenever the device comes
  // back online or the app resumes — cross-device changes appear without a cold
  // start, and offline writes resend as soon as connectivity returns.
  useEffect(() => {
    if (!(signedIn && canSubmitRegistration())) return;
    void syncPendingRegistrations();
    void reconcileTickets();
    const onWake = () => {
      void syncPendingRegistrations();
      void reconcileTickets();
    };
    window.addEventListener("online", onWake);
    window.addEventListener("paaipe:resume", onWake);
    return () => {
      window.removeEventListener("online", onWake);
      window.removeEventListener("paaipe:resume", onWake);
    };
  }, [signedIn, syncPendingRegistrations, reconcileTickets]);


  const triggerArrive = () => {
    setArriveTick((n) => n + 1);
  };

  const select = (view: View, opts?: { fromSheet?: boolean; haptic?: boolean }) => {
    setActive(view);
    setMenuOpen(false);
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

  const openFeed = () => {
    runCenterPressAnim();
    select("Feed");
    AppHaptics.medium();
  };

  const openLearn = (lane: LearnLane) => {
    setLearnLane(lane);
    select("Learn");
  };

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;
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
  }, [menuOpen, notificationsOpen]);

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
    setNotificationsOpen(false);
  }, [user?.uid]);

  const isDetail = active in detailTitles;
  const classicDetailParent: View =
    active === "Session"
      ? "Learn"
      : active === "MemberProfile"
        ? "Directory"
        : active === "Certificates" ||
            active === "Organization" ||
            active === "Benefits" ||
            active === "Directory" ||
            active === "Programs" ||
            active === "EditProfile" ||
            active === "PublicProfile"
          ? "Profile"
          : activeBranch;
  /** Sheet-opened destinations pop back to the last branch; Profile tools keep classic parents. */
  const detailParent: View =
    fromSheet &&
    (active === "Directory" ||
      active === "Benefits" ||
      active === "Programs" ||
      active === "Certificates" ||
      active === "Organization")
      ? activeBranch
      : classicDetailParent;
  const showBack = isDetail;
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

  const displayName = publicCard?.name.trim() || portalIdentity.displayName;
  const initials = publicCard?.name.trim()
    ? initialsFromName(publicCard.name, portalIdentity.email)
    : portalIdentity.initials;
  const shownIdentity: DisplayIdentity = {
    ...portalIdentity,
    displayName,
    firstName: displayName.split(/\s+/)[0] || portalIdentity.firstName,
    initials,
  };
  const photo = publicCard?.photo ?? "";
  const emailVerified = Boolean(user?.emailVerified);
  const memberCanWrite = signedIn && canSubmitRegistration();
  // The association requires a verified email before a member's registration is
  // sent to the backend. Guests/preview are unaffected (they get a local pass).
  const registrationNeedsVerification = memberCanWrite && !emailVerified;
  const registerForEvent = async (
    event: ApiEvent,
    form: { name: string; email: string; note: string },
  ): Promise<EventTicket> => {
    const attendeeName = form.name.trim() || shownIdentity.displayName;
    const attendeeEmail = form.email.trim();
    let reference = `REG-${Date.now().toString(36).toUpperCase()}`;
    let synced = false;
    let pending = false;
    // A verified signed-in member's registration is written to the backend under
    // a client-minted id so retries can never duplicate it. If the write fails on
    // a flaky network we keep an on-device pass and queue it to resend; a real
    // rejection (permission/validation) is surfaced instead of a fake ticket.
    // Preview/guest sessions always keep a purely on-device pass.
    if (memberCanWrite && emailVerified) {
      const registrationId = newRegistrationId();
      reference = registrationId;
      const input = {
        eventId: event.id,
        event: event.title || "PAAIPE event",
        full_name: attendeeName,
        email: attendeeEmail,
        speaker_question: form.note,
        updates: false,
      };
      try {
        reference = await submitEventRegistration(input, registrationId);
        synced = true;
        recordRegistrationEvent("write_success");
      } catch (error) {
        if (isRetriableRegistrationError(error)) {
          enqueueRegistration({ ...input, registrationId, queuedAt: Date.now() });
          pending = true;
          recordRegistrationEvent("write_queued");
        } else {
          recordRegistrationEvent("write_failure");
          throw error;
        }
      }
    }
    const ticket: EventTicket = {
      eventId: event.id,
      eventTitle: event.title || "PAAIPE event",
      eventDate: event.date || "Date to be announced",
      eventTime: event.startTime
        ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}`
        : "",
      attendeeName,
      attendeeEmail,
      note: form.note.trim(),
      code: ticketCode(event.id),
      reference,
      createdAt: new Date().toISOString(),
      synced,
      pending,
      ...(event.coverUrl ? { coverUrl: event.coverUrl } : {}),
    };
    setTickets((current) => {
      const next = { ...current, [event.id]: ticket };
      writeTickets(next);
      return next;
    });
    const note: AppNotification = {
      id: `n-${Date.now()}`,
      title: "You're registered",
      body: synced
        ? `Your spot for ${ticket.eventTitle} is confirmed with PAAIPE. Open Events to view your ticket and QR code.`
        : pending
          ? `Your spot for ${ticket.eventTitle} is saved and will sync to PAAIPE automatically once you're back online.`
          : `Your spot for ${ticket.eventTitle} is saved on this device. Open Events to view your ticket and QR code.`,
      at: Date.now(),
      read: false,
    };
    setNotifications((current) => {
      const next = [note, ...current];
      writeNotifications(next);
      return next;
    });
    return ticket;
  };
  const resendVerification = async () => {
    await sendVerification();
    await refreshProfile();
  };
  const cancelRegistration = async (eventId: string): Promise<CancelOutcome> => {
    const ticket = ticketsRef.current[eventId];
    // A synced registration cannot be deleted (rules forbid client deletes), so a
    // member cancel is a server-side status:'cancelled' update on their own row.
    // An un-synced pass is only in the resend queue — drop it so it never lands.
    if (ticket?.synced) {
      try {
        await cancelMyRegistration(ticket.reference);
        recordRegistrationEvent("cancel_success");
      } catch {
        // Couldn't reach the backend — keep the ticket so state stays truthful
        // (reconcile still shows it registered) and let the member retry.
        recordRegistrationEvent("cancel_failure");
        return "failed";
      }
    } else if (ticket && !ticket.synced) {
      dequeueRegistration(ticket.reference);
    }
    const outcome: CancelOutcome = ticket?.synced ? "server" : "local";
    setTickets((current) => {
      const next = { ...current };
      delete next[eventId];
      writeTickets(next);
      return next;
    });
    return outcome;
  };
  const markNotificationsRead = () => {
    setNotifications((current) => {
      if (!current.some((item) => !item.read)) return current;
      const next = current.map((item) => ({ ...item, read: true }));
      writeNotifications(next);
      return next;
    });
  };
  const unreadCount = notifications.filter((item) => !item.read).length;
  const pendingRegistrations = Object.values(tickets).filter((ticket) => ticket.pending).length;
  const savePublicCard = async (next: PublicCard) => {
    const saved = { ...next, name: next.name.trim() };
    setPublicCard(saved);
    writePublicCard(saved);
    if (!user) return;
    await tryPatchProfile(user, {
      full_name: saved.name,
      directoryVisible: saved.directoryVisible,
    });
    await refreshProfile();
  };
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
              {photo ? <img src={photo} alt="" /> : initials}
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
            <strong className="header-title">{active}</strong>
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
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
              type="button"
              onClick={() => {
                setNotificationsOpen(true);
                markNotificationsRead();
              }}
            >
              <Bell />
              {unreadCount ? <span className="notification-dot">{unreadCount}</span> : null}
            </button>
          </div>
        </header>

        <main
          key={arriveTick === 0 ? "content-0" : `content-${arriveTick}`}
          className={arriveTick === 0 ? "app-content" : "app-content page-arrive"}
        >
          {active === "Home" && (
            <HomeView
              identity={shownIdentity}
              events={events}
              sessions={sessions}
              eventData={eventData}
              onExplore={() => selectBranch("Learn")}
              onEvent={() => selectBranch("Events")}
              onBenefits={() => select("Benefits", { fromSheet: true })}
              onProfile={() => select("Profile")}
              onPrograms={() => select("Programs", { fromSheet: true })}
              onSession={openSession}
            />
          )}
          {active === "Learn" && (
            <LearnView
              sessions={sessions}
              loadState={sessionData}
              lane={learnLane}
              onLane={setLearnLane}
              onOpen={openSession}
            />
          )}
          {active === "Events" && (
            <EventsView
              events={events}
              loadState={eventData}
              identity={shownIdentity}
              tickets={tickets}
              onRegister={registerForEvent}
              onCancel={cancelRegistration}
              needsVerification={registrationNeedsVerification}
              onResendVerification={resendVerification}
              verificationNotice={verificationNotice}
              pendingCount={pendingRegistrations}
              onSyncNow={syncPendingRegistrations}
            />
          )}
          {active === "Profile" && (
            <ProfileView
              identity={shownIdentity}
              go={select}
              photo={photo}
              onEdit={() => select("EditProfile")}
              onPreview={() => select("PublicProfile")}
            />
          )}
          {active === "EditProfile" && (
            <EditProfileView
              identity={shownIdentity}
              card={publicCard}
              onSave={savePublicCard}
              signedIn={Boolean(user)}
              needsVerification={registrationNeedsVerification}
              onResendVerification={resendVerification}
              verificationNotice={verificationNotice}
            />
          )}
          {active === "PublicProfile" && (
            <PublicProfileView identity={shownIdentity} card={publicCard} />
          )}
          {active === "Feed" && (
            <FeedView
              author={displayName}
              initials={initials}
              photo={photo}
              posts={feedPosts}
              setPosts={setFeedPosts}
            />
          )}
          {active === "MemberProfile" && (
            <MemberProfileView member={selectedMember} />
          )}
          {active === "Directory" && (
            <>
              {preview && !signedIn ? (
                <DirectoryView
                  members={directory}
                  total={directoryTotal}
                  onOpen={(m) => {
                    setSelectedMember(m);
                    select("MemberProfile");
                  }}
                />
              ) : (
                <>
                  <DataState result={directoryData} label="Directory">
                    <DirectoryView
                      members={directory}
                      total={directoryTotal}
                      onOpen={(m) => {
                        setSelectedMember(m);
                        select("MemberProfile");
                      }}
                    />
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
            </>
          )}
          {active === "Benefits" && <BenefitsView />}
          {active === "Organization" && <OrganizationView />}
          {active === "Diagnostics" && (
            <DiagnosticsView
              pendingCount={pendingRegistrations}
              onSyncNow={syncPendingRegistrations}
            />
          )}
          {active === "Certificates" && <CertificatesView />}
          {active === "Programs" && (
            <ProgramsView onEvents={() => selectBranch("Events")} />
          )}
          {active === "Session" && (
            <SessionView
              session={selectedSession}
              onResources={() => openLearn("Resources")}
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
            aria-label="Feed"
            aria-current={active === "Feed" ? "page" : undefined}
            onClick={openFeed}
          >
            <Newspaper />
            <span className="nav-center-label">Feed</span>
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
                  <div className="avatar xl">{photo ? <img src={photo} alt="" /> : initials}</div>
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
                {generalMenu.map(({ label, view, icon: Icon, lane }) => (
                  <button
                    className="drawer-link"
                    key={label}
                    onClick={() => (lane ? openLearn(lane) : select(view))}
                  >
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
              {notifications.length === 0 ? (
                <div className="empty-note">
                  No notifications yet. Updates will appear here when available.
                </div>
              ) : (
                <div className="notify-list">
                  {notifications.map((item) => (
                    <article className="notify-item" key={item.id}>
                      <span className="notify-ico" aria-hidden="true">
                        <CalendarDays />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                        <small>{relativeTime(item.at)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
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
  const news: Array<{ title: string; copy: string; when: string }> = [];
  if (upcoming) {
    news.push({
      title: upcoming.title || "Upcoming AI Exchange",
      copy: upcoming.topic || upcoming.description || "Topic and speaker to be revealed soon.",
      when: upcoming.date || "Upcoming",
    });
  }
  if (continueSession) {
    news.push({
      title: "New in Learnings",
      copy: continueSession.speaker
        ? `${continueSession.title || "Latest session"} — with ${continueSession.speaker}`
        : continueSession.title || "Latest session published",
      when: "Session",
    });
  }
  news.push({
    title: "Explore your programs",
    copy: "Programs, the learning library, and member benefits are all in the portal.",
    when: "Portal",
  });
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
        <button
          type="button"
          onClick={() => (continueSession ? onSession(continueSession) : onExplore())}
        >
          <Play />
          <span>
            <strong>{continueSession ? "Continue watching" : "Open Learnings"}</strong>
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
          {news.map((item) => (
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

const LEARNING_FILES = [
  {
    title: "From Signals to Strategy (sample)",
    format: "Slides",
    detail: "Slide deck · preview",
    copy: "Sample AI Exchange deck by Sample Speaker — using AI to turn data into real insight. Preview content until session materials are connected.",
    meta: "AI Exchange · sample",
  },
] as const;

const FILE_FORMATS = [
  { label: "All formats", hint: "Every file", icon: Grid2x2 },
  { label: "Slides", hint: "Decks", icon: Presentation },
  { label: "PDF", hint: "Documents", icon: FileText },
  { label: "Template", hint: "Worksheets", icon: LayoutTemplate },
  { label: "Checklist", hint: "Step lists", icon: ListChecks },
  { label: "Docs", hint: "Notes", icon: Files },
] as const;

function BannerArt({ kind }: { kind: string }) {
  const tone = kind.toLowerCase();
  if (tone === "slides") {
    return (
      <span className="scene scene-slides" aria-hidden="true">
        <span className="paper">
          <i /><i /><i />
        </span>
      </span>
    );
  }
  if (tone === "pdf" || tone === "docs") {
    return (
      <span className="scene scene-page" aria-hidden="true">
        <span className="paper">
          <i /><i /><i /><i />
        </span>
      </span>
    );
  }
  if (tone === "template") {
    return (
      <span className="scene scene-template" aria-hidden="true">
        <span className="paper">
          <i /><i /><i /><i />
        </span>
      </span>
    );
  }
  if (tone === "checklist") {
    return (
      <span className="scene scene-checks" aria-hidden="true">
        <span className="paper">
          <i /><i /><i />
        </span>
      </span>
    );
  }
  if (tone === "micro") {
    return (
      <span className="scene scene-micro" aria-hidden="true">
        <span className="phone"><Play /></span>
      </span>
    );
  }
  if (tone === "playlist") {
    return (
      <span className="scene scene-playlist" aria-hidden="true">
        <span /><span /><span />
      </span>
    );
  }
  return (
    <span className="scene scene-session" aria-hidden="true">
      <span className="wide"><Play /></span>
    </span>
  );
}

function VisualCard({
  kind,
  title,
  description,
  meta,
  image,
  onClick,
  extra,
}: {
  kind: string;
  title: string;
  description: string;
  meta?: string;
  image?: string | undefined;
  onClick?: () => void;
  extra?: ReactNode;
}) {
  const face = (
    <>
      <span className={`visual-banner tone-${kind.toLowerCase()}`}>
        {image ? <img src={image} alt="" /> : <BannerArt kind={kind} />}
      </span>
      <span className="visual-copy">
        <small>{kind}</small>
        <strong>{title}</strong>
        <em>{description}</em>
        {meta ? <span className="visual-meta">{meta}</span> : null}
      </span>
    </>
  );
  return (
    <article className="visual-card">
      {onClick ? (
        <button className="visual-open" type="button" onClick={onClick}>
          {face}
        </button>
      ) : (
        face
      )}
      {extra}
    </article>
  );
}

type FeedReel = { id: string; title: string; author: string; caption: string; src: string; poster: string };

const FEED_REELS: FeedReel[] = [
  {
    id: "reel-members",
    title: "Meet the members",
    author: "PAAIPE",
    caption: "New Agents joined this month. Add yourself to the directory from Profile.",
    src: "/feed/reel-members.mp4",
    poster: "/feed/reel-members.jpg",
  },
  {
    id: "reel-prompts",
    title: "Prompt in 30s",
    author: "Ava Cruz",
    caption: "A quick prompting tip you can use today. Save it for your next build.",
    src: "/feed/reel-prompts.mp4",
    poster: "/feed/reel-prompts.jpg",
  },
  {
    id: "reel-agents",
    title: "Why become an Agent",
    author: "PAAIPE",
    caption: "What confirmed Agents get in the PAAIPE community.",
    src: "/feed/reel-agents.mp4",
    poster: "/feed/reel-agents.jpg",
  },
];

function MicrosReels() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { root, threshold: [0, 0.6, 1] },
    );
    for (const video of videos) observer.observe(video);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="reels-feed" ref={containerRef}>
      {FEED_REELS.map((reel) => (
        <section className="reels-page" key={reel.id}>
          <video
            src={reel.src}
            poster={reel.poster}
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="reels-overlay">
            <strong>{reel.title}</strong>
            <small>{reel.author}</small>
            <p>{reel.caption}</p>
          </div>
        </section>
      ))}
    </div>
  );
}

function LearnView({
  sessions,
  loadState,
  lane,
  onLane,
  onOpen,
}: {
  sessions: ApiSession[];
  loadState: Loadable<ApiSession[]>;
  lane: LearnLane;
  onLane: (lane: LearnLane) => void;
  onOpen: (session: ApiSession) => void;
}) {
  const [fileFormat, setFileFormat] = useState<(typeof FILE_FORMATS)[number]["label"]>("All formats");
  const [formatsOpen, setFormatsOpen] = useState(false);
  const [library, setLibrary] = useState<"hub" | "recordings" | "slides">("hub");
  const [query, setQuery] = useState("");
  const [watched, setWatched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setLibrary("hub");
  }, [lane]);
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
            <div className="visual-grid">
              <VisualCard
                kind="Session"
                title="No sessions yet"
                description="Published recordings appear here in the order set for members."
                meta="Horizontal recording"
              />
            </div>
          ) : (
            <div className="visual-grid">
              {shown.map((item) => (
                <VisualCard
                  key={item.id}
                  kind="Session"
                  title={item.title || "Session"}
                  description={item.description || "Longer horizontal recording"}
                  meta="Horizontal recording"
                  image={item.posterUrl}
                  onClick={() => onOpen(item)}
                  extra={
                    <button
                      className="visual-chip"
                      type="button"
                      onClick={() =>
                        setWatched((current) => ({ ...current, [item.id]: !current[item.id] }))
                      }
                    >
                      {watched[item.id] ? "Watched on this device" : "Mark as watched"}
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </DataState>
      </div>
    );
  }
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Knowledge hub"
        title="Learnings"
        subtitle="Horizontal sessions, short vertical micros, playlists, and files."
      />
      <label className="search-field">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lane === "Resources" ? "Search files" : "Search sessions"}
        />
      </label>
      <div className="lane-row" role="tablist" aria-label="Learnings">
        {(["Sessions", "Micros", "Playlists", "Resources"] as const).map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            className={lane === label ? "selected" : ""}
            aria-selected={lane === label}
            onClick={() => onLane(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {lane === "Sessions" && (
        <DataState result={loadState} label="Sessions">
          {shown.length === 0 ? (
            <div className="visual-grid">
              <VisualCard
                kind="Session"
                title={query ? "No matches" : "No sessions yet"}
                description={
                  query
                    ? "No sessions match your search."
                    : "Published sessions appear here in the order set for Learnings. Calendar and registration live under Events."
                }
                meta="Horizontal recording"
              />
            </div>
          ) : (
            <div className="visual-grid">
              {shown.map((item) => (
                <VisualCard
                  key={item.id}
                  kind="Session"
                  title={item.title || "Session"}
                  description={item.description || "Longer horizontal recording"}
                  meta="Horizontal recording"
                  image={item.posterUrl}
                  onClick={() => onOpen(item)}
                />
              ))}
            </div>
          )}
        </DataState>
      )}
      {lane === "Micros" && <MicrosReels />}
      {lane === "Playlists" && (
        <div className="visual-grid">
          <VisualCard
            kind="Playlist"
            title="No playlists yet"
            description="A playlist combines micros or sessions."
            meta="Micros or sessions"
          />
        </div>
      )}
      {lane === "Resources" && (
        <>
          <button className="format-trigger" type="button" onClick={() => setFormatsOpen(true)}>
            <FileText />
            <span>
              <strong>Format</strong>
              <small>{fileFormat}</small>
            </span>
            <ChevronRight />
          </button>
          {formatsOpen ? (
            <div className="format-sheet" role="dialog" aria-modal="true" aria-label="File format">
              <button className="format-backdrop" type="button" aria-label="Close formats" onClick={() => setFormatsOpen(false)} />
              <div className="format-panel">
                <div className="format-panel-head">
                  <strong>File format</strong>
                  <button type="button" aria-label="Close" onClick={() => setFormatsOpen(false)}>
                    <X />
                  </button>
                </div>
                <div className="format-grid">
                  {FILE_FORMATS.map((format) => {
                    const Icon = format.icon;
                    const selected = fileFormat === format.label;
                    return (
                      <button
                        key={format.label}
                        type="button"
                        className={selected ? "selected" : ""}
                        aria-pressed={selected}
                        onClick={() => {
                          setFileFormat(format.label);
                          setFormatsOpen(false);
                        }}
                      >
                        <Icon />
                        <strong>{format.label}</strong>
                        <span>{format.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {(() => {
            const files = LEARNING_FILES.filter((file) => {
              const matchesFormat = fileFormat === "All formats" || file.format === fileFormat;
              const hay = `${file.title} ${file.copy} ${file.detail} ${file.meta}`.toLowerCase();
              return matchesFormat && (!query || hay.includes(query.toLowerCase()));
            });
            if (files.length === 0) {
              return (
                <div className="visual-grid">
                  <VisualCard
                    kind={fileFormat === "All formats" ? "Docs" : fileFormat}
                    title={query ? "No matches" : "No files yet"}
                    description={
                      query
                        ? "No files match your search."
                        : "Nothing in this format yet. Choose another filter, or check back when a file is added."
                    }
                    meta={fileFormat === "All formats" ? "Files" : fileFormat}
                  />
                </div>
              );
            }
            return (
              <div className="visual-grid">
                {files.map((file) => (
                  <VisualCard
                    key={file.title}
                    kind={file.format}
                    title={file.title}
                    description={file.copy}
                    meta={`${file.detail} · ${file.meta}`}
                    onClick={() => setLibrary("slides")}
                  />
                ))}
              </div>
            );
          })()}
        </>
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
      </div>
      <div className="empty-note">
        Session materials are shared with PAAIPE members under the speaker's permission. Please keep
        them inside the association.
      </div>
    </div>
  );
}

const EVENT_FEEDBACK_KEY = "paaipe-event-feedback";
type EventFeedbackEntry = { rating: number; comment: string };
function readEventFeedback(): Record<string, EventFeedbackEntry> {
  try {
    const raw = localStorage.getItem(EVENT_FEEDBACK_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, EventFeedbackEntry>) : {};
  } catch {
    return {};
  }
}

function EventFeedback({ eventId }: { eventId: string }) {
  const existing = readEventFeedback()[eventId] ?? null;
  const [saved, setSaved] = useState<EventFeedbackEntry | null>(existing);
  const [editing, setEditing] = useState(!existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");

  const submit = () => {
    if (!rating) return;
    const entry: EventFeedbackEntry = { rating, comment: comment.trim() };
    const all = readEventFeedback();
    all[eventId] = entry;
    localStorage.setItem(EVENT_FEEDBACK_KEY, JSON.stringify(all));
    setSaved(entry);
    setEditing(false);
  };

  if (saved && !editing) {
    return (
      <section className="feedback-card">
        <div className="feedback-head">
          <strong>Your feedback</strong>
          <button type="button" className="text-link" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <div className="feedback-stars" aria-label={`You rated ${saved.rating} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={n <= saved.rating ? "on" : ""} fill={n <= saved.rating ? "currentColor" : "none"} />
          ))}
        </div>
        {saved.comment ? <p className="feedback-comment">“{saved.comment}”</p> : null}
        <p className="feedback-note">
          Saved on this device. Sending feedback to PAAIPE is not connected in this build, so nothing
          was submitted to the association.
        </p>
      </section>
    );
  }

  return (
    <section className="feedback-card">
      <div className="feedback-head">
        <strong>Share feedback</strong>
      </div>
      <div className="feedback-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={n <= rating ? "on" : ""}
            onClick={() => setRating(n)}
          >
            <Star fill={n <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea
        className="feedback-input"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder="What worked? What could be better?"
      />
      <button type="button" className="feedback-save" disabled={!rating} onClick={submit}>
        Save feedback
      </button>
      <p className="feedback-note">
        Your rating and notes are kept on this device only. Sending feedback to PAAIPE is not
        connected in this build yet — this does not submit anything to the association.
      </p>
    </section>
  );
}

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(value, {
      width: 220,
      margin: 1,
      color: { dark: "#0b1b3a", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? (
    <img className="ticket-qr" src={src} alt="Ticket QR code" width={220} height={220} />
  ) : (
    <div className="ticket-qr ticket-qr-loading" aria-hidden="true" />
  );
}

function VerifyGate({
  variant,
  title,
  description,
  onResend,
  notice,
}: {
  variant: "card" | "banner";
  title?: string;
  description: string;
  onResend: () => Promise<void>;
  notice: string | null;
}) {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const handleResend = () => {
    setResending(true);
    setResendMsg("");
    void onResend().then(
      () => setResending(false),
      () => {
        setResending(false);
        setResendMsg("Could not send the verification email just now. Please try again shortly.");
      },
    );
  };
  const message = resendMsg || notice;
  if (variant === "banner") {
    return (
      <div className="sync-banner" role="status">
        <Mail />
        <span>
          {description}{" "}
          <button type="button" className="text-link" disabled={resending} onClick={handleResend}>
            {resending ? "Sending…" : "Resend verification email"}
          </button>
          {message ? ` ${message}` : ""}
        </span>
      </div>
    );
  }
  return (
    <>
      <span className="soft-chip warn">Verify your email</span>
      {title ? <strong>{title}</strong> : null}
      <p>{description}</p>
      <button
        type="button"
        className="register-button"
        disabled={resending}
        onClick={handleResend}
      >
        {resending ? "Sending…" : "Resend verification email"}
      </button>
      {message ? <p className="feedback-note">{message}</p> : null}
    </>
  );
}

function DiagnosticsView({
  pendingCount,
  onSyncNow,
}: {
  pendingCount: number;
  onSyncNow: () => Promise<number>;
}) {
  const [telemetry, setTelemetry] = useState(() => readRegistrationTelemetry());
  const [queueLen, setQueueLen] = useState(() => readRegistrationQueue().length);
  const [syncing, setSyncing] = useState(false);
  const refresh = () => {
    setTelemetry(readRegistrationTelemetry());
    setQueueLen(readRegistrationQueue().length);
  };
  const rate = offlineWriteRate(telemetry);
  const c = telemetry.counts;
  const rows: Array<[string, number]> = [
    ["Writes confirmed", c.write_success],
    ["Writes queued (offline)", c.write_queued],
    ["Writes failed", c.write_failure],
    ["Queue flushes settled", c.queue_flush_settled],
    ["Cancels confirmed", c.cancel_success],
    ["Cancels failed", c.cancel_failure],
  ];
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Internal"
        title="Diagnostics"
        subtitle="Local registration sync telemetry. Nothing here leaves this device."
      />
      <section className="section-block">
        <div className="stat-grid">
          <div className="stat-cell">
            <strong>{rate === null ? "—" : `${Math.round(rate * 100)}%`}</strong>
            <small>Offline write rate</small>
          </div>
          <div className="stat-cell">
            <strong>{queueLen}</strong>
            <small>Queued now</small>
          </div>
          <div className="stat-cell">
            <strong>{pendingCount}</strong>
            <small>Pending tickets</small>
          </div>
        </div>
      </section>
      <section className="section-block">
        <dl className="ticket-details">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="feedback-note">
          {telemetry.updatedAt
            ? `Last event ${new Date(telemetry.updatedAt).toLocaleString()}.`
            : "No registration activity recorded on this device yet."}
        </p>
      </section>
      <div className="settings-list">
        <button
          type="button"
          disabled={syncing || pendingCount === 0}
          onClick={() => {
            setSyncing(true);
            void onSyncNow().finally(() => {
              setSyncing(false);
              refresh();
            });
          }}
        >
          <RefreshCw className={syncing ? "spin" : ""} />
          <span>
            <strong>{syncing ? "Syncing…" : "Flush queue now"}</strong>
            <small>Resend any queued registrations</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={refresh}>
          <Activity />
          <span>
            <strong>Refresh</strong>
            <small>Re-read local telemetry</small>
          </span>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function EventsView({
  events,
  loadState,
  identity,
  tickets,
  onRegister,
  onCancel,
  needsVerification,
  onResendVerification,
  verificationNotice,
  pendingCount,
  onSyncNow,
}: {
  events: ApiEvent[];
  loadState: Loadable<ApiEvent[]>;
  identity: DisplayIdentity;
  tickets: Record<string, EventTicket>;
  onRegister: (
    event: ApiEvent,
    form: { name: string; email: string; note: string },
  ) => Promise<EventTicket>;
  onCancel: (eventId: string) => Promise<CancelOutcome>;
  needsVerification: boolean;
  onResendVerification: () => Promise<void>;
  verificationNotice: string | null;
  pendingCount: number;
  onSyncNow: () => Promise<number>;
}) {
  const [period, setPeriod] = useState<"Upcoming" | "Past">("Upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flow, setFlow] = useState<"detail" | "register" | "ticket">("detail");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regNote, setRegNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [regError, setRegError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNotice, setCancelNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const handleSyncNow = () => {
    setSyncing(true);
    setSyncMsg("");
    void onSyncNow().then(
      (settled) => {
        setSyncing(false);
        setSyncMsg(settled > 0 ? "Synced." : "Still waiting for a connection — will keep retrying.");
      },
      () => {
        setSyncing(false);
        setSyncMsg("Couldn't sync just now — will keep retrying automatically.");
      },
    );
  };
  const list = events.filter((event) =>
    period === "Past" ? event.status === "held" : event.status !== "held",
  );
  const selected = events.find((event) => event.id === selectedId) || null;

  const openEvent = (id: string) => {
    setSelectedId(id);
    setFlow("detail");
    setCopied(false);
    setCancelNotice("");
  };
  const startRegister = () => {
    setRegName(identity.displayName === "Member" ? "" : identity.displayName);
    setRegEmail(identity.email && !identity.email.startsWith("guest@") ? identity.email : "");
    setRegNote("");
    setRegError("");
    setSubmitting(false);
    setFlow("register");
  };

  if (selected) {
    const held = selected.status === "held";
    const ticket = tickets[selected.id] ?? null;

    if (flow === "register") {
      const canSubmit = regName.trim().length > 1 && /.+@.+\..+/.test(regEmail.trim());
      return (
        <div className="screen-stack animate-fade-in page-screen">
          <button className="text-link back-link" type="button" onClick={() => setFlow("detail")}>
            <ArrowLeft /> {selected.title || "Event"}
          </button>
          <PageTitle
            kicker="Registration"
            title="Reserve your spot"
            subtitle={selected.title || "PAAIPE event"}
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
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || submitting) return;
              setSubmitting(true);
              setRegError("");
              void onRegister(selected, { name: regName, email: regEmail, note: regNote }).then(
                () => {
                  setSubmitting(false);
                  setFlow("ticket");
                },
                () => {
                  setSubmitting(false);
                  setRegError(
                    "Your registration could not be sent. Check your connection and try again — nothing was submitted.",
                  );
                },
              );
            }}
          >
            <label>
              Full name
              <input value={regName} onChange={(event) => setRegName(event.target.value)} placeholder="Your name" />
            </label>
            <label>
              Email
              <input
                type="email"
                value={regEmail}
                onChange={(event) => setRegEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Anything to share? (optional)
              <textarea
                value={regNote}
                onChange={(event) => setRegNote(event.target.value)}
                rows={3}
                placeholder="Questions for the speaker, access needs, etc."
              />
            </label>
            {regError ? <p role="alert">{regError}</p> : null}
            <button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? "Registering…" : "Confirm registration"}
            </button>
          </form>
          <p className="feedback-note">
            {canSubmitRegistration()
              ? "Registering as a signed-in member sends your details to PAAIPE and creates your ticket. In preview it stays on this device."
              : "This creates a registration and ticket on this device and adds a confirmation to your notifications. Sending your registration to the association is not connected in this build."}
          </p>
        </div>
      );
    }

    if (flow === "ticket" && ticket) {
      const copyCode = () => {
        void navigator.clipboard?.writeText(ticket.code).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => {},
        );
      };
      return (
        <div className="screen-stack animate-fade-in page-screen">
          <button className="text-link back-link" type="button" onClick={() => setFlow("detail")}>
            <ArrowLeft /> {selected.title || "Event"}
          </button>
          <section className="ticket-card">
            <BannerSlot
              label="Event banner"
              {...(ticket.coverUrl ? { src: ticket.coverUrl } : {})}
              alt={ticket.eventTitle}
            />
            <div className="ticket-head">
              <img src={logo} alt="PAAIPE" />
              <span className={`soft-chip ${ticket.synced ? "ok" : ticket.pending ? "warn" : "ok"}`}>
                {ticket.synced ? "Registered" : ticket.pending ? "Syncing…" : "Registered"}
              </span>
            </div>
            <h2>{ticket.eventTitle}</h2>
            <div className="ticket-meta">
              <span>
                <CalendarDays />
                {ticket.eventDate}
              </span>
              {ticket.eventTime ? (
                <span>
                  <Clock3 />
                  {ticket.eventTime}
                </span>
              ) : null}
            </div>
            <QrImage value={ticket.reference} />
            <p className="ticket-hint">Show this QR code at check-in.</p>
            <dl className="ticket-details">
              <div>
                <dt>Attendee</dt>
                <dd>{ticket.attendeeName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{ticket.attendeeEmail || "—"}</dd>
              </div>
              <div>
                <dt>Ticket code</dt>
                <dd className="ticket-code">{ticket.code}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{ticket.reference}</dd>
              </div>
            </dl>
            <button type="button" className="ticket-copy" onClick={copyCode}>
              {copied ? "Copied" : "Copy ticket code"}
            </button>
          </section>
          <div className="settings-list">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => {
                const eventId = selected.id;
                const wasSynced = ticket.synced;
                setCancelling(true);
                setCancelNotice("");
                void onCancel(eventId).then(
                  (outcome) => {
                    setCancelling(false);
                    if (outcome === "failed") {
                      setCancelNotice(
                        "Couldn't reach PAAIPE to cancel — you're still registered. Try again when you're back online.",
                      );
                      return;
                    }
                    setCancelNotice(
                      outcome === "server"
                        ? "Your registration was cancelled with PAAIPE."
                        : wasSynced
                          ? "Your registration was cancelled with PAAIPE."
                          : "This device pass was removed.",
                    );
                    setFlow("detail");
                  },
                  () => {
                    setCancelling(false);
                    setCancelNotice(
                      "Couldn't reach PAAIPE to cancel — you're still registered. Try again when you're back online.",
                    );
                  },
                );
              }}
            >
              <X />
              <span>
                <strong>{cancelling ? "Cancelling…" : "Cancel registration"}</strong>
                <small>
                  {ticket.synced
                    ? "Cancels your spot with PAAIPE"
                    : "Removes this ticket from your device"}
                </small>
              </span>
              <ChevronRight />
            </button>
          </div>
          {cancelNotice ? <p role="status">{cancelNotice}</p> : null}
          <p className="feedback-note">
            {ticket.synced
              ? "Your registration is confirmed with PAAIPE. Present this QR code at check-in."
              : ticket.pending
                ? "Saved on this device. Your registration will sync to PAAIPE automatically once you're back online."
                : "This is a preview pass generated on your device. Real check-in and the association's registration system are not connected in this build."}
          </p>
        </div>
      );
    }

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
        <BannerSlot
          label="Event banner"
          {...(selected.coverUrl ? { src: selected.coverUrl } : {})}
          alt={selected.title || "PAAIPE event"}
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
          {selected.format ? <span className="soft-chip">{selected.format}</span> : null}
        </div>
        {!held ? (
          ticket ? (
            <section className="register-cta registered">
              <span className="soft-chip ok">You're registered</span>
              <p>Your spot is saved. Your ticket has a QR code for check-in.</p>
              <button type="button" className="register-button" onClick={() => setFlow("ticket")}>
                View ticket
              </button>
            </section>
          ) : (
            <section className="register-cta">
              {cancelNotice ? <p role="status">{cancelNotice}</p> : null}
              {needsVerification ? (
                <VerifyGate
                  variant="card"
                  title="Confirm your email to register"
                  description="PAAIPE sends your ticket and event updates to your verified email. Verify your address, then come back to register."
                  onResend={onResendVerification}
                  notice={verificationNotice}
                />
              ) : (
                <>
                  <strong>Save your spot</strong>
                  <p>
                    Register to get a ticket with a QR code and a confirmation in notifications.
                  </p>
                  <button type="button" className="register-button" onClick={startRegister}>
                    Register
                  </button>
                </>
              )}
            </section>
          )
        ) : null}
        <h2 className="subheading">{held ? "After the session" : "What to expect"}</h2>
        <div className="program-list">
          {(held
            ? [
                ["Session recording", "Members only · Watch in Learnings"],
                ["Speaker's slides", "As presented, shared with the speaker's permission"],
                ["Certificate", "After registration and feedback"],
                ["Q&A follow-ups", "Questions the speaker answered after the session"],
              ]
            : [
                ["Live session", selected.startTime ? `Starts ${selected.startTime}` : "Time to be announced"],
                ["Speaker", "Introduced at the start of the session"],
                ["Q&A", "Ask questions live during the session"],
                ["Certificate", "Issued after you attend and give feedback"],
              ]
          ).map(([title, copy]) => (
            <article className="program-card" key={title}>
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
              <span className="state">{held && title === "Session recording" ? "Watch" : "Info"}</span>
            </article>
          ))}
        </div>
        {held ? (
          <>
            <h2 className="subheading">Feedback</h2>
            <EventFeedback eventId={selected.id} />
          </>
        ) : null}
        <div className="empty-note">
          Join links and calendar files are not connected in this build.
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
      {pendingCount > 0 ? (
        <div className="sync-banner" role="status">
          <RefreshCw className={syncing ? "spin" : ""} />
          <span>
            {pendingCount} registration{pendingCount === 1 ? "" : "s"} pending —{" "}
            {syncMsg || "will sync when you're back online."}
          </span>
          <button
            type="button"
            className="sync-now"
            disabled={syncing}
            onClick={handleSyncNow}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      ) : null}
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
            <article className="teresa-event-card" key={event.id} onClick={() => openEvent(event.id)} role="button" tabIndex={0} onKeyDown={(eventKey) => {
              if (eventKey.key === "Enter") openEvent(event.id);
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
              {tickets[event.id] ? (
                <div className="event-registered-tag">
                  <span className="soft-chip ok">Registered</span>
                </div>
              ) : (
                <div className="empty-note">Open this event to register and get your ticket.</div>
              )}
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

type FeedComment = { id: string; author: string; body: string };
type FeedMedia =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; poster: string };
type FeedPost = {
  id: string;
  author: string;
  handle: string;
  initials: string;
  avatar?: string;
  time: string;
  body: string;
  media?: FeedMedia;
  likes: number;
  liked: boolean;
  comments: FeedComment[];
};

const FEED_SEED: FeedPost[] = [
  {
    id: "exchange-recap",
    author: "PAAIPE",
    handle: "@paaipe",
    initials: "PA",
    time: "2h",
    body: "Recap reel from a recent AI Exchange — From Signals to Strategy with Sample Speaker. Full deck is in Learnings under Resources. (Sample preview post.)",
    media: { kind: "video", src: "/feed/exchange-recap.mp4", poster: "/feed/exchange-recap.jpg" },
    likes: 24,
    liked: false,
    comments: [
      { id: "c-recap-1", author: "Ava Cruz", body: "The data-to-decision framing was gold." },
    ],
  },
  {
    id: "welcome-agents",
    author: "PAAIPE",
    handle: "@paaipe",
    initials: "PA",
    time: "5h",
    body: "Welcome to the newest confirmed Agents this week. Say hello in the comments and add yourself to the directory from Profile.",
    media: { kind: "image", src: "/banners/home/home-banner@2x.png", alt: "PAAIPE members" },
    likes: 31,
    liked: false,
    comments: [],
  },
  {
    id: "next-exchange",
    author: "Maria Santos",
    handle: "@maria",
    initials: "MS",
    time: "1d",
    body: "Prepping my questions for the next Exchange. What would you ask a founder shipping AI in the Philippines? 🇵🇭",
    likes: 12,
    liked: false,
    comments: [
      { id: "c-next-1", author: "PAAIPE", body: "Great thread — drop them here and we'll pass the best ones on." },
    ],
  },
];

function FeedView({
  author,
  initials,
  photo,
  posts,
  setPosts,
}: {
  author: string;
  initials: string;
  photo: string;
  posts: FeedPost[];
  setPosts: Dispatch<SetStateAction<FeedPost[]>>;
}) {
  const [draft, setDraft] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [reel, setReel] = useState<FeedReel | null>(null);
  const [composerActive, setComposerActive] = useState(false);
  const [attachment, setAttachment] = useState<FeedMedia | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const src = URL.createObjectURL(file);
    setAttachment(
      file.type.startsWith("video")
        ? { kind: "video", src, poster: "" }
        : { kind: "image", src, alt: "Your upload" },
    );
    setComposerActive(true);
  };

  const publish = () => {
    const body = draft.trim();
    if (!body && !attachment) return;
    setPosts((current) => [
      {
        id: `local-${Date.now()}`,
        author,
        handle: "@you",
        initials,
        ...(photo ? { avatar: photo } : {}),
        time: "now",
        body,
        ...(attachment ? { media: attachment } : {}),
        likes: 0,
        liked: false,
        comments: [],
      },
      ...current,
    ]);
    setDraft("");
    setAttachment(null);
    setComposerActive(false);
    if (fileRef.current) fileRef.current.value = "";
    if (draftRef.current) draftRef.current.style.height = "auto";
  };

  const toggleLike = (id: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post,
      ),
    );
  };

  const addComment = (id: string) => {
    const body = commentDraft.trim();
    if (!body) return;
    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? {
              ...post,
              comments: [...post.comments, { id: `c-${Date.now()}`, author, body }],
            }
          : post,
      ),
    );
    setCommentDraft("");
  };

  const share = (network: "facebook" | "linkedin" | "x") => {
    if (!sharePost) return;
    const text = encodeURIComponent(sharePost.body);
    const url = encodeURIComponent("https://paaipe.org");
    const href =
      network === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`
        : network === "linkedin"
          ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
          : `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    void openExternalUrl(href);
    setSharePost(null);
  };

  return (
    <div className="screen-stack animate-fade-in page-screen feed-screen">
      <form
        className={composerActive || draft || attachment ? "feed-composer is-active" : "feed-composer"}
        onSubmit={(event) => {
          event.preventDefault();
          publish();
        }}
      >
        <div className="feed-composer-row">
          <div className="avatar">
            {photo ? <img src={photo} alt="" /> : initials}
          </div>
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              autoGrow(event.target);
            }}
            onFocus={() => setComposerActive(true)}
            onBlur={() => {
              if (!draft.trim() && !attachment) setComposerActive(false);
            }}
            placeholder="Share something with members"
            rows={1}
          />
        </div>
        {attachment ? (
          <div className="composer-attachment">
            {attachment.kind === "image" ? (
              <img src={attachment.src} alt="" />
            ) : (
              <video src={attachment.src} controls playsInline />
            )}
            <button
              type="button"
              className="composer-remove icon-button"
              aria-label="Remove attachment"
              onClick={() => {
                setAttachment(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              <X />
            </button>
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        {composerActive || draft || attachment ? (
          <div className="feed-composer-actions">
            <button
              type="button"
              className="composer-media"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
              Photo/Video
            </button>
            <button type="submit" disabled={!draft.trim() && !attachment}>
              Post
            </button>
          </div>
        ) : null}
      </form>
      <section className="reels-strip" aria-label="Reels">
        <div className="reels-head">
          <strong>Reels</strong>
          <small>Short vertical clips</small>
        </div>
        <div className="reels-row">
          {FEED_REELS.map((item) => (
            <button
              type="button"
              className="reel-thumb"
              key={item.id}
              onClick={() => setReel(item)}
            >
              <img src={item.poster} alt="" />
              <span className="reel-play">
                <Play fill="currentColor" />
              </span>
              <span className="reel-copy">
                <strong>{item.title}</strong>
                <small>{item.author}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      {posts.map((post) => (
        <article className="feed-card" key={post.id}>
          <header>
            <div className="avatar">
              {post.avatar ? <img src={post.avatar} alt="" /> : post.initials}
            </div>
            <span className="feed-author">
              <strong>{post.author}</strong>
              <small>
                {post.handle} · {post.time}
              </small>
            </span>
          </header>
          <p>{post.body}</p>
          {post.media ? (
            post.media.kind === "image" ? (
              <img className="feed-media" src={post.media.src} alt={post.media.alt} />
            ) : (
              <video
                className="feed-media"
                src={post.media.src}
                poster={post.media.poster}
                controls
                playsInline
                preload="none"
              />
            )
          ) : null}
          <div className="feed-actions">
            <button
              type="button"
              className={post.liked ? "on" : ""}
              aria-pressed={post.liked}
              onClick={() => toggleLike(post.id)}
            >
              <Heart fill={post.liked ? "currentColor" : "none"} />
              {post.likes}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenComments((current) => (current === post.id ? null : post.id));
                setCommentDraft("");
              }}
            >
              <MessageCircle />
              {post.comments.length}
            </button>
            <button type="button" onClick={() => setSharePost(post)}>
              <Share2 />
              Share
            </button>
          </div>
          {openComments === post.id ? (
            <div className="feed-comments">
              {post.comments.length === 0 ? (
                <p>No comments yet.</p>
              ) : (
                post.comments.map((comment) => (
                  <p key={comment.id}>
                    <strong>{comment.author}</strong> {comment.body}
                  </p>
                ))
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addComment(post.id);
                }}
              >
                <input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Write a comment"
                />
                <button type="submit" disabled={!commentDraft.trim()}>
                  Send
                </button>
              </form>
            </div>
          ) : null}
        </article>
      ))}
      {sharePost ? (
        <div className="format-sheet" role="dialog" aria-modal="true" aria-label="Share post">
          <button className="format-backdrop" type="button" aria-label="Close share" onClick={() => setSharePost(null)} />
          <div className="format-panel">
            <div className="format-panel-head">
              <strong>Share</strong>
              <button type="button" aria-label="Close" onClick={() => setSharePost(null)}>
                <X />
              </button>
            </div>
            <div className="feed-share">
              <button type="button" onClick={() => share("facebook")}>Facebook</button>
              <button type="button" onClick={() => share("linkedin")}>LinkedIn</button>
              <button type="button" onClick={() => share("x")}>X</button>
            </div>
          </div>
        </div>
      ) : null}
      {reel ? (
        <div className="reel-viewer" role="dialog" aria-modal="true" aria-label={reel.title}>
          <button className="reel-backdrop" type="button" aria-label="Close reel" onClick={() => setReel(null)} />
          <div className="reel-stage">
            <button className="reel-close icon-button" type="button" aria-label="Close" onClick={() => setReel(null)}>
              <X />
            </button>
            <video src={reel.src} poster={reel.poster} controls autoPlay playsInline />
            <div className="reel-meta">
              <strong>{reel.title}</strong>
              <small>{reel.author}</small>
            </div>
          </div>
        </div>
      ) : null}
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

function ProfileView({
  identity,
  go,
  photo,
  onEdit,
  onPreview,
}: {
  identity: DisplayIdentity;
  go: (view: View) => void;
  photo: string;
  onEdit: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="screen-stack animate-fade-in page-screen profile-screen">
      <section className="profile-hero">
        <button className="avatar profile-avatar" type="button" onClick={onPreview} aria-label="Preview public profile">
          {photo ? <img src={photo} alt="" /> : identity.initials}
        </button>
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
        <button type="button" onClick={onEdit}>
          <UserRound />
          <span>
            <strong>Edit profile</strong>
            <small>Name, about, work, and directory</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={onPreview}>
          <UserRound />
          <span>
            <strong>Preview public profile</strong>
            <small>What members see when they open your photo</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Organization")}>
          <Building2 />
          <span>
            <strong>My organization</strong>
            <small>Team and organization information</small>
          </span>
          <ChevronRight />
        </button>
      </div>
      <h2 className="subheading">Network</h2>
      <div className="settings-list">
        <button type="button" onClick={() => go("Directory")}>
          <UsersRound />
          <span>
            <strong>Directory</strong>
            <small>Agents and members</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Benefits")}>
          <Gift />
          <span>
            <strong>Benefits</strong>
            <small>Membership perks</small>
          </span>
          <ChevronRight />
        </button>
        <button type="button" onClick={() => go("Programs")}>
          <Compass />
          <span>
            <strong>Programs</strong>
            <small>AI Safari and Regional Circles</small>
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

function EditProfileView({
  identity,
  card,
  onSave,
  signedIn,
  needsVerification,
  onResendVerification,
  verificationNotice,
}: {
  identity: DisplayIdentity;
  card: PublicCard | null;
  onSave: (card: PublicCard) => Promise<void>;
  signedIn: boolean;
  needsVerification: boolean;
  onResendVerification: () => Promise<void>;
  verificationNotice: string | null;
}) {
  const [name, setName] = useState(card?.name || identity.displayName);
  const [headline, setHeadline] = useState(card?.headline || "");
  const [about, setAbout] = useState(card?.about || "");
  const [work, setWork] = useState(card?.work || "");
  const [link, setLink] = useState(card?.link || "");
  const [photo, setPhoto] = useState(card?.photo || "");
  const [directoryVisible, setDirectoryVisible] = useState(card?.directoryVisible ?? false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (needsVerification) {
      setError("Verify your email before saving changes to your account.");
      setSaved(false);
      return;
    }
    if (!name.trim()) {
      setError("Add the name members should see.");
      setSaved(false);
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onSave({ name, headline, about, work, link, photo, directoryVisible });
      setSaved(true);
    } catch {
      setError("The name could not be saved to your account. The public preview on this device was kept.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Account"
        title="Edit profile"
        subtitle={
          signedIn
            ? "Name and directory visibility save to your account. About, work, and the link stay on this device."
            : "This preview keeps your edits on this device."
        }
      />
      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {needsVerification ? (
          <VerifyGate
            variant="banner"
            description="Verify your email to save profile changes to your account."
            onResend={onResendVerification}
            notice={verificationNotice}
          />
        ) : null}
        <div className="photo-field">
          <div className="avatar profile-avatar photo-preview">
            {photo ? <img src={photo} alt="" /> : identity.initials}
          </div>
          <div className="photo-actions">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => pickPhoto(event.target.files?.[0])}
            />
            <button type="button" className="composer-media" onClick={() => photoRef.current?.click()}>
              <ImagePlus />
              {photo ? "Change photo" : "Upload photo"}
            </button>
            {photo ? (
              <button
                type="button"
                className="photo-clear"
                onClick={() => {
                  setPhoto("");
                  if (photoRef.current) photoRef.current.value = "";
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Headline
          <input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="What you do" />
        </label>
        <label>
          About
          <textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={4} placeholder="A short introduction" />
        </label>
        <label>
          Work
          <input value={work} onChange={(event) => setWork(event.target.value)} placeholder="Role and organization" />
        </label>
        <label>
          Link
          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://" />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={directoryVisible}
            onChange={(event) => setDirectoryVisible(event.target.checked)}
          />
          Show me in the member directory
        </label>
        {error ? <p role="alert">{error}</p> : null}
        {saved ? <p role="status">Saved. Open the preview to see the public profile.</p> : null}
        <button type="submit" disabled={saving || needsVerification}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

function PublicProfileView({ identity, card }: { identity: DisplayIdentity; card: PublicCard | null }) {
  const headline = card?.headline.trim() || "";
  const about = card?.about.trim() || "";
  const work = card?.work.trim() || "";
  const link = card?.link.trim() || "";
  const photo = card?.photo || "";
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <p className="public-note">This is what members see when they open your photo.</p>
      <section className="profile-hero public-card">
        <div className="avatar profile-avatar">
          {photo ? <img src={photo} alt="" /> : identity.initials}
        </div>
        <h1>{identity.displayName}</h1>
        {headline ? <p className="public-headline">{headline}</p> : null}
        <MembershipPill identity={identity} />
        {identity.agentNumber ? <p>Agent {identity.agentNumber}</p> : null}
      </section>
      <article className="program-card">
        <div>
          <strong>About</strong>
          <p>{about || "No introduction yet."}</p>
        </div>
      </article>
      <article className="program-card">
        <div>
          <strong>Work</strong>
          <p>{work || "No work details yet."}</p>
        </div>
      </article>
      {link ? (
        <button className="portal-link" type="button" onClick={() => void openExternalUrl(link)}>
          {link}
        </button>
      ) : (
        <div className="empty-note">No link is on this profile.</div>
      )}
    </div>
  );
}

function DirectoryView({
  members,
  total,
  onOpen,
}: {
  members: DirectoryMember[];
  total: number;
  onOpen: (member: DirectoryMember) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = members.filter((m) =>
    (m.name + (m.role || "")).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <PageTitle
        kicker="Member network"
        title="Directory"
        subtitle="Agents and members across the Philippine AI community."
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
            <button className="member-card" type="button" key={m.uid} onClick={() => onOpen(m)}>
              <div className="avatar">
                {m.photo ? <img src={m.photo} alt="" /> : m.initials}
              </div>
              <div>
                <strong>{m.name}</strong>
                <span>{m.role || (m.agentNumber ? `Agent ${m.agentNumber}` : "Confirmed Agent")}</span>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberProfileView({ member }: { member: DirectoryMember | null }) {
  if (!member) {
    return (
      <div className="screen-stack animate-fade-in page-screen">
        <div className="empty-note">Select a member from the directory to view their profile.</div>
      </div>
    );
  }
  return (
    <div className="screen-stack animate-fade-in page-screen">
      <section className="profile-hero public-card">
        <div className="avatar profile-avatar">
          {member.photo ? <img src={member.photo} alt="" /> : member.initials}
        </div>
        <h1>{member.name}</h1>
        {member.role ? <p className="public-headline">{member.role}</p> : null}
        <span className="membership-pill status-agent">
          <i aria-hidden="true" />
          Confirmed Agent
        </span>
        {member.agentNumber ? <p>Agent {member.agentNumber}</p> : null}
      </section>
      <article className="program-card">
        <div>
          <strong>About</strong>
          <p>This member has not added an introduction yet.</p>
        </div>
      </article>
      <article className="program-card">
        <div>
          <strong>Work</strong>
          <p>{member.role || "No work details shared yet."}</p>
        </div>
      </article>
      <div className="empty-note">
        Member profiles show what each Agent chooses to share in the directory.
      </div>
    </div>
  );
}

function BenefitsView() {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="Membership"
        title="Benefits"
        subtitle="Exclusive benefits for PAAIPE Agents"
      />
      <section className="soft-hero">
        <span className="soft-chip soon">Coming soon</span>
        <h2>Exclusive benefits for PAAIPE Agents</h2>
        <p>
          Partner perks and member-only offers will show up here when they are ready. Nothing to
          claim yet — check back soon.
        </p>
      </section>
    </div>
  );
}
function OrganizationView() {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="You"
        title="My Organization"
        subtitle="The company you speak for when you apply as a Partner"
      />
      <section className="soft-hero">
        <span className="soft-chip">No organization yet</span>
        <h2>Add the company you represent</h2>
        <p>
          Link an organization when you apply as a Partner. Your organization details and Partner
          application live in the PAAIPE portal; nothing is added to your account until you submit
          one.
        </p>
      </section>
      <div className="empty-note">
        Adding and editing an organization is not connected in this build. This screen does not mean
        your account has no organization.
      </div>
    </div>
  );
}
function CertificatesView() {
  const [query, setQuery] = useState("");
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="You"
        title="My Certificates"
        subtitle="Certificates of Participation you've earned from PAAIPE events"
      />
      <label className="search-field">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by event name"
        />
      </label>
      <div className="empty-note">
        <strong>No certificates yet</strong>
        <p>
          A Certificate of Participation is issued after you attend a PAAIPE event. Once you have
          one, it appears here to view and download.
        </p>
      </div>
    </div>
  );
}
const PORTAL_PROGRAMS = [
  {
    name: "AI Exchange",
    copy: "Monthly webinar series · every 2nd Tuesday, 8:00 PM PHT",
    status: "Registered for the next Exchange",
    tone: "ok" as const,
    action: "Events" as const,
  },
  {
    name: "AI Safari",
    copy: "Field trips to AI companies and showcases · seasonal, small groups",
    status: "In development",
    tone: "soon" as const,
    detail: "Interest list · seats offered to confirmed Agents first",
  },
  {
    name: "Build Nights",
    copy: "Hands-on labs of 10–20 members · periodic",
    status: "In development",
    tone: "soon" as const,
    detail: "First cohort · seats open soon",
  },
  {
    name: "Certification Pathways",
    copy: "Cohort courses with TESDA/DICT-recognized trainers · scheduled intakes",
    status: "In development",
    tone: "soon" as const,
  },
  {
    name: "Member Spotlight",
    copy: "Profiles and case studies of members' AI work · monthly",
    status: "In development",
    tone: "soon" as const,
  },
  {
    name: "Regional Circles",
    copy: "Local meetups led by Agents · quarterly per circle",
    status: "In development",
    tone: "soon" as const,
  },
  {
    name: "Mentorship",
    copy: "1:1 and small-group · 3-month cycles",
    status: "In development",
    tone: "soon" as const,
  },
] as const;

function ProgramsView({ onEvents }: { onEvents: () => void }) {
  return (
    <div className="screen-stack page-screen">
      <PageTitle
        kicker="An AI-powered Philippines"
        title="Programs"
        subtitle="Enrol, join waitlists and pick your circle"
      />
      <section className="soft-hero programs-hero">
        <h2>
          Your path in <span>Philippine AI</span>
        </h2>
        <div className="journey-row">
          {["Discover", "Learn", "Engage", "Build", "Certify", "Connect", "Contribute"].map(
            (step, index) => (
              <span className="journey-step" key={step}>
                <b>{index + 1}</b>
                {step}
              </span>
            ),
          )}
        </div>
      </section>
      <div className="program-list">
        {PORTAL_PROGRAMS.map((program) => (
          <article className="program-card" key={program.name}>
            <div>
              <span className={`soft-chip ${program.tone}`}>{program.status}</span>
              <strong>{program.name}</strong>
              <p>{program.copy}</p>
              {"detail" in program && program.detail ? (
                <p className="program-detail">{program.detail}</p>
              ) : null}
            </div>
            {"action" in program && program.action === "Events" ? (
              <button className="state on" type="button" onClick={onEvents}>
                Events
              </button>
            ) : null}
          </article>
        ))}
      </div>
      <p className="program-tagline">
        Building the Philippines' AI-Powered Future — Together
      </p>
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
      <article className="program-card speaker-card">
        <div className="avatar speaker-avatar">
          {session?.speakerPhotoUrl ? (
            <img src={session.speakerPhotoUrl} alt={session.speaker || "Speaker"} />
          ) : session?.speaker ? (
            initialsFromName(session.speaker)
          ) : (
            <UserRound aria-hidden="true" />
          )}
        </div>
        <div>
          <strong>{session?.speaker || "Speaker"}</strong>
          <p>
            {session?.speakerPhotoUrl
              ? "Speaker for this session."
              : session?.speaker
                ? "Speaker for this session. A photo appears when the speaker adds one."
                : "The speaker name and photo are shown when the published session includes them."}
          </p>
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
