import { createFileRoute } from "@tanstack/react-router";
import { MobileAgentPortal } from "../components/mobile-agent-portal";
import { AuthProvider } from "../lib/auth-context";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAAIPE Agent Portal" },
      { name: "description", content: "PAAIPE agent portal — learn, events, community, and credentials." },
      { property: "og:title", content: "PAAIPE Agent Portal" },
      { property: "og:description", content: "PAAIPE agent portal for Philippine AI professionals and entrepreneurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <AuthProvider>
      <MobileAgentPortal />
    </AuthProvider>
  );
}
