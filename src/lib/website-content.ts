/**
 * Approved public copy from Upupapp/PAAIPE-website-front-end (main b6e9a87).
 * Member-facing text only. No admin, and no invented offers or dates.
 */

export const PROGRAMS = [
  {
    slug: "ai-explained",
    title: "AI, Explained",
    copy: "Important AI ideas, made clear. Accessible language, relatable examples and strong visual storytelling help people understand foundational AI concepts, capabilities and limitations.",
    visibility: "public",
    badge: "Public learning series",
  },
  {
    slug: "paaipe-ai-exchange",
    title: "PAAIPE AI Exchange",
    copy: "Learn directly from people doing the work. Every second Tuesday at 8:00 PM PHT, a guest speaker shares a topic connected to their experience and relevant to the PAAIPE community.",
    visibility: "members-only",
    badge: "Members-only online event",
    opensEvents: true,
  },
  {
    slug: "skills-labs-and-workshops",
    title: "Skills Labs & Workshops",
    copy: "Learn by working through real challenges. Guided sessions explore AI tools, workflows and decision frameworks that participants can apply in professional or business settings.",
    visibility: "public",
    badge: "Sessions announced throughout the year",
  },
  {
    slug: "ai-in-practice",
    title: "AI in Practice",
    copy: "Go behind the outcome. Discussions and case features examine opportunities, implementation choices, limitations and lessons learned.",
    visibility: "public",
    badge: "Case-based learning",
  },
  {
    slug: "responsible-ai-conversations",
    title: "Responsible AI Conversations",
    copy: "Progress requires judgment-not just capability. Thoughtful conversations cover accuracy, privacy, bias, transparency, human oversight and the real impact of AI-powered decisions.",
    visibility: "public",
    badge: "Trust and accountability",
  },
  {
    slug: "community-conversations",
    title: "Community Conversations",
    copy: "Thoughtful discussions where members exchange perspectives, lessons, and challenges from their fields.",
    visibility: "members-only",
    badge: "Member community",
  },
  {
    slug: "member-resource-library",
    title: "Member Resource Library",
    copy: "Useful knowledge, organized for continued learning. Eligible members can access selected guides, templates, recordings and event materials through the Members Portal.",
    visibility: "members-only",
    badge: "Members-only knowledge",
    opensResources: true,
  },
] as const;

export const PROGRAM_NOTES = [
  "Workshop schedules, eligibility and capacity are announced when each session is confirmed.",
  "Recordings and materials are provided only when publication rights and speaker permissions allow.",
] as const;

export const MEMBER_BENEFITS = [
  {
    name: "A professional AI community",
    description:
      "Connect with practitioners, entrepreneurs, educators and leaders across fields and levels of adoption.",
    partner: false,
  },
  {
    name: "Members-only events",
    description: "Join the monthly PAAIPE AI Exchange and other private sessions as announced.",
    partner: false,
  },
  {
    name: "Practical workshops and training",
    description:
      "Participate in eligible learning activities focused on tools, workflows, implementation and responsible practice.",
    partner: false,
  },
  {
    name: "Curated resources",
    description:
      "Access selected guides, templates, event materials and recordings when available and permissioned.",
    partner: false,
  },
  {
    name: "Opportunities to contribute",
    description:
      "Propose topics, share relevant experience and participate in discussions that strengthen the community.",
    partner: false,
  },
  {
    name: "Professional connection",
    description: "Participate in opt-in professional discovery when the future Members Portal supports it.",
    partner: false,
  },
  {
    name: "Partner opportunities",
    description:
      "Access eligible offers that may include AI-platform credits, tokens, trials, product access, training rates, or discounts from confirmed providers.",
    partner: true,
  },
] as const;

export const PARTNER_BENEFIT_DISCLAIMER =
  "Partner benefits are not guaranteed and may change or end without notice. Every offer is subject to a confirmed agreement, availability, member eligibility, geographic or account restrictions, redemption limits and the provider's own terms. Displayed examples must not imply a partnership until it is formally confirmed.";

export const BENEFITS_INTRO =
  "These are the kinds of benefit PAAIPE works towards. Each depends on a confirmed agreement, and none is guaranteed.";

export const RESOURCE_FORMATS = [
  "All formats",
  "Video",
  "Explainer",
  "Checklist",
  "Guide",
  "Template",
] as const;

export const RESOURCE_FILM = {
  title: "Which Side of the Change",
  format: "Video",
  medium: "Video · 1 min",
  detail: "Film on Streamable · AI Exchange opening film",
  topic: "Philippine AI Community",
  description:
    "Our short film on why PAAIPE exists: the speed of AI, what it means for Filipino jobs and industries, and the community built in response.",
  href: "https://streamable.com/q2877z",
  host: "streamable.com",
  actionLabel: "Watch video",
} as const;

export const RESOURCE_PREVIEWS = [
  {
    title: "What AI Is-and What It Isn't",
    format: "Explainer",
    medium: "PDF",
    topic: "AI Foundations",
    description:
      "Understand the difference between pattern-based generation, information retrieval, automation and human judgment.",
    status: "Coming soon",
  },
  {
    title: "Five Questions to Ask Before You Automate a Workflow",
    format: "Checklist",
    medium: "PDF",
    topic: "Practical Adoption",
    description:
      "Start with the problem, the people affected and the decisions that must remain accountable.",
    status: "Coming soon",
  },
  {
    title: "Where Small Teams Can Begin with AI",
    format: "Guide",
    medium: "PDF",
    topic: "Business & Entrepreneurship",
    description:
      "Look for focused, repeatable work where AI can support people without hiding responsibility.",
    status: "Coming soon",
  },
  {
    title: "Choosing an AI Tool: Look Beyond the Demo",
    format: "Template",
    medium: "Template",
    topic: "Tools & Workflows",
    description:
      "A side-by-side worksheet to evaluate fit, data handling, reliability, cost, access and the workflow around the tool.",
    status: "Coming soon",
  },
  {
    title: "A Human-Centered Generative AI Checklist",
    format: "Checklist",
    medium: "PDF",
    topic: "Responsible AI",
    description:
      "Review purpose, source quality, privacy, accuracy and human oversight before using an AI-generated result.",
    status: "Coming soon",
  },
  {
    title: "Building AI Capability Through Community",
    format: "Explainer",
    medium: "PDF",
    topic: "Philippine AI Community",
    description:
      "Why shared learning, honest examples and cross-industry collaboration matter as AI adoption grows.",
    status: "Coming soon",
  },
] as const;

export const EVENT_TYPES = [
  {
    name: "Skills Workshops",
    description: "Guided sessions focused on practical AI tools, methods, and workflows.",
  },
  {
    name: "Community Roundtables",
    description: "Member conversations centered on shared questions, challenges, and lessons.",
  },
  {
    name: "Public Briefings",
    description: "Selected sessions that make important AI ideas accessible to a wider audience.",
  },
  {
    name: "Collaborative Sessions",
    description: "Events developed with confirmed organizations, speakers, or learning partners.",
  },
] as const;

export const AI_EXCHANGE = {
  label: "SIGNATURE MONTHLY EVENT",
  title: "PAAIPE AI Exchange",
  subtitle: "A private monthly Zoom session for the PAAIPE community",
  description:
    "Each session features a guest speaker and a topic chosen around their expertise. The goal is simple: give members useful ideas, practical context and direct access to thoughtful conversation.",
  schedule: ["Every second Tuesday", "8:00 PM Philippine Time", "Private Zoom", "One hour maximum"],
  agenda: [
    "Opening - brief welcome and introduction",
    "Guest presentation - focused 20-30-minute talk",
    "Live Q&A - member questions and practical discussion",
    "Raffle and close - short community raffle, takeaways, and closing remarks",
  ],
  formatHeading: "What happens in this session",
  formatBody:
    "Each session runs for one hour on a private Zoom call. It opens, a guest speaker presents for 20 to 30 minutes, members ask questions live, and the session closes with a raffle.",
  audienceHeading: "Who this is for",
  audienceIntro: "PAAIPE members:",
  audiences: [
    "AI professionals and practitioners",
    "Entrepreneurs and founders",
    "Educators and researchers",
    "Companies and institutions",
    "Emerging AI talent",
  ],
  afterwardsHeading: "After the session",
  afterwardsBody:
    "We publish a recording only when the speaker has agreed and we hold the rights to do so. Anything cleared for publication appears under past events.",
  lockLabel: "MEMBERS ONLY - PRIVATE ZOOM",
  lockHeading: "This session is for PAAIPE members",
  lockBody:
    "What you can see above — the topic, the format and who the session is for — is everything PAAIPE publishes openly, and it is meant to be enough to decide on. The date, the speaker and the joining link go to members.",
  accessNote: "Registration and private Zoom access are provided to eligible PAAIPE members.",
} as const;
