import type { MeProfile, MembershipStatus } from "./api";
import { initialsFromName } from "./api";
import type { User } from "firebase/auth";
export type MembershipState = "guest_unverified" | "guest_pending" | "agent" | "suspended";
export type DisplayIdentity = {
  displayName: string;
  firstName: string;
  initials: string;
  email: string;
  status: MembershipStatus;
  state: MembershipState;
  membershipLabel: string;
  agentNumber: string | null;
  isAgent: boolean;
  emailVerified: boolean;
  confirmationSeen: boolean;
  profileSyncPending: boolean;
};
export function membershipLabelFor(status: MembershipStatus, verified = false): string {
  if (status === "agent") return "Confirmed Agent";
  if (status === "suspended") return "Suspended";
  return verified ? "Guest · awaiting confirmation" : "Guest · verify email";
}
export function buildIdentity(
  user: Pick<User, "email" | "displayName" | "emailVerified"> | null,
  profile: MeProfile | null,
  opts?: { profileSyncPending?: boolean },
): DisplayIdentity | null {
  if (!user || !profile) return null;
  const email = user.email || profile.email;
  const full = profile.full_name.trim() || user.displayName?.trim() || "";
  const status = profile.status;
  // Firebase Auth is the current source for verification; API rows may contain an older snapshot.
  const emailVerified = user.emailVerified;
  return {
    displayName: full || "Member",
    firstName: full.split(/\s+/)[0] || "Member",
    initials: initialsFromName(full, email),
    email,
    status,
    state:
      status === "agent" || status === "suspended"
        ? status
        : emailVerified
          ? "guest_pending"
          : "guest_unverified",
    membershipLabel: membershipLabelFor(status, emailVerified),
    agentNumber: status === "agent" && profile.agentNumber?.trim() ? profile.agentNumber : null,
    isAgent: status === "agent",
    emailVerified,
    confirmationSeen: profile.confirmation_seen,
    profileSyncPending: Boolean(opts?.profileSyncPending),
  };
}
export function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabi";
}
