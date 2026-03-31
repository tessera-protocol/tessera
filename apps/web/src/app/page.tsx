"use client";

import { TesseraMark } from "@/components/tessera-mark";

function QRCode() {
  return (
    <svg viewBox="0 0 100 100" width={60} height={60}>
      <rect x="5" y="5" width="28" height="28" rx="4" fill="#534AB7" />
      <rect x="9" y="9" width="20" height="20" rx="2" fill="#fff" />
      <rect x="13" y="13" width="12" height="12" rx="1" fill="#534AB7" />
      <rect x="67" y="5" width="28" height="28" rx="4" fill="#534AB7" />
      <rect x="71" y="9" width="20" height="20" rx="2" fill="#fff" />
      <rect x="75" y="13" width="12" height="12" rx="1" fill="#534AB7" />
      <rect x="5" y="67" width="28" height="28" rx="4" fill="#534AB7" />
      <rect x="9" y="71" width="20" height="20" rx="2" fill="#fff" />
      <rect x="13" y="75" width="12" height="12" rx="1" fill="#534AB7" />
      <rect x="40" y="44" width="20" height="20" rx="6" fill="#534AB7" />
      <rect x="44" y="48" width="12" height="12" rx="3" fill="#fff" />
      <path d="M47 51 L53 51 L53 57 L50 57 L50 54 L47 54 Z" fill="#534AB7" />
      <rect x="40" y="8" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="48" y="16" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="40" y="22" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="8" y="40" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="20" y="50" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="68" y="40" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="80" y="50" width="6" height="6" rx="1" fill="#534AB7" />
      <rect x="68" y="68" width="10" height="10" rx="2" fill="#534AB7" />
      <rect x="84" y="68" width="10" height="10" rx="2" fill="#534AB7" />
      <rect x="68" y="84" width="10" height="10" rx="2" fill="#534AB7" />
      <rect x="84" y="84" width="10" height="10" rx="2" fill="#534AB7" />
    </svg>
  );
}

const actions = [
  {
    label: "Agent wallet",
    sub: "Issue an agent ID",
    href: "/agents/new",
    color: "rgba(83,74,183,0.15)",
    stroke: "#7F77DD",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7F77DD"
        strokeWidth="1.5"
      >
        <path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4z" />
        <rect x="3" y="10" width="18" height="12" rx="2" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    label: "Invite",
    sub: "Grow the network",
    href: "#",
    color: "rgba(126,200,159,0.12)",
    stroke: "#7ec89f",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7ec89f"
        strokeWidth="1.5"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Watermark",
    sub: "Sign your work",
    href: "#",
    color: "rgba(240,198,116,0.12)",
    stroke: "#f0c674",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f0c674"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Settings",
    sub: "Manage account",
    href: "#",
    color: "rgba(136,136,160,0.1)",
    stroke: "#8888a0",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8888a0"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const credential = {
  name: "Guglielmo Reggio",
  id: "tess:0x7a8f...3c21",
  tier: 1,
  jurisdiction: "EU",
  memberSince: "Mar 2026",
  activeAgents: 3,
};

export default function PassportPage() {
  return (
    <div className="py-4">
      <div className="mb-4 rounded-3xl border border-line bg-surface-raised p-7">
        <div className="mb-6 flex items-center justify-between">
          <TesseraMark size={44} variant="twotone" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-green/10 px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-status-green">
            TIER {credential.tier} - VERIFIED
          </span>
        </div>

        <h1 className="mb-1 font-display text-[24px] font-semibold tracking-tight text-white">
          {credential.name}
        </h1>
        <p className="mb-6 font-mono text-xs text-content-dim">
          {credential.id}
        </p>

        <div className="mb-5 h-px bg-line-subtle" />

        <div className="flex justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[10px] uppercase tracking-widest text-content-dim">
              Member since
            </span>
            <span className="text-sm font-medium text-content-primary">
              {credential.memberSince}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[10px] uppercase tracking-widest text-content-dim">
              Jurisdiction
            </span>
            <span className="text-sm font-medium text-content-primary">
              {credential.jurisdiction}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[10px] uppercase tracking-widest text-content-dim">
              Agents
            </span>
            <span className="text-sm font-medium text-content-primary">
              {credential.activeAgents} active
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-5 rounded-2xl border border-line bg-surface-raised p-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white">
          <QRCode />
        </div>
        <div className="flex-1">
          <p className="mb-1 text-[15px] font-medium text-content-primary">
            Verify or vouch
          </p>
          <p className="text-xs leading-relaxed text-content-muted">
            Scan to prove your identity or vouch for someone in person
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface-raised p-[18px] transition-colors hover:border-content-dim"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{ background: action.color }}
            >
              {action.icon}
            </div>
            <span className="text-xs font-medium text-content-primary">
              {action.label}
            </span>
            <span className="text-center text-[11px] text-content-dim">
              {action.sub}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
