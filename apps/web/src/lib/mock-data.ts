export const passportCard = {
  holderName: "Guglielmo Reggio",
  tier: "Tier 1",
  id: "TSR-EU-2048-9812",
  jurisdiction: "EU / Open banking anchor",
  issuedAt: "31 Mar 2026",
  expiresAt: "31 Mar 2027",
  agentWallets: 3,
  status: "Verified human",
};

export const agents = [
  {
    id: "research-agent",
    name: "Research agent",
    description: "Collects vendor info and drafts recommendations.",
    scope: "Can post, can transact up to EUR 50",
    status: "Active",
  },
  {
    id: "scheduler",
    name: "Scheduler",
    description: "Handles bookings, reminders, and calendar coordination.",
    scope: "Can post, no payments",
    status: "Active",
  },
  {
    id: "wallet-guard",
    name: "Wallet guard",
    description: "Monitors outgoing spend and flags unusual patterns.",
    scope: "Observation only",
    status: "Paused",
  },
];

export const walletSummary = {
  balance: "€480.00",
  spendLimit: "€50 / delegated action",
  network: "Tessera escrow",
};

export const activityItems = [
  {
    id: "1",
    title: "Verification accepted",
    detail: "Passport shown to demo-platform",
    timestamp: "2 min ago",
  },
  {
    id: "2",
    title: "Agent wallet created",
    detail: "Research agent received scoped delegation",
    timestamp: "18 min ago",
  },
  {
    id: "3",
    title: "Credential refreshed",
    detail: "Tier 1 anchor still valid",
    timestamp: "Today",
  },
];
