"use client";

import { TesseraMark } from "@/components/tessera-mark";
import { useTessera } from "@/lib/tessera-context";

const actions = [
  {
    name: "Add to Apple Wallet",
    sub: "Carry your credential on your phone",
    iconBg: "rgba(83,74,183,0.15)",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7F77DD"
        strokeWidth="1.5"
      >
        <rect x="2" y="5" width="20" height="15" rx="3" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    name: "Upgrade verification",
    sub: "Add layers to strengthen your credential",
    iconBg: "rgba(126,200,159,0.12)",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7ec89f"
        strokeWidth="1.5"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Renew credential",
    sub: "Expires Mar 2027",
    iconBg: "rgba(240,198,116,0.12)",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f0c674"
        strokeWidth="1.5"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
  },
  {
    name: "Export credential",
    sub: "Download your raw VC for backup",
    iconBg: "rgba(136,136,160,0.08)",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8888a0"
        strokeWidth="1.5"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    ),
  },
];

function formatMonth(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelative(value: number) {
  const diff = Date.now() - value;
  const hours = Math.floor(diff / (60 * 60 * 1000));

  if (hours < 1) {
    return "just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

export default function WalletPage() {
  const { activity, credential } = useTessera();

  if (!credential) {
    return <div className="py-4 text-sm text-content-muted">Initializing wallet...</div>;
  }

  const history = activity.slice(0, 4);

  return (
    <div className="py-4">
      <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-white">
        Wallet
      </h1>

      <div className="relative mb-4 overflow-hidden rounded-[18px] border border-line bg-gradient-to-br from-[#1c1836] via-[#1a1a2e] to-[#181830] p-6">
        <div className="pointer-events-none absolute -top-[30px] -right-[30px] h-[140px] w-[140px] rounded-full bg-brand-purple/10 blur-2xl" />

        <div className="relative mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TesseraMark size={24} variant="twotone" />
            <span className="font-display text-base font-semibold tracking-tight text-content-primary">
              tessera<span className="text-brand-purple-light">.</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-status-green/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-status-green">
              TIER {credential.tier}
            </span>
            {credential.demo ? (
              <span className="rounded-full bg-status-warm/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-status-warm">
                DEMO
              </span>
            ) : null}
          </div>
        </div>

        <p className="mb-0.5 text-lg font-semibold text-white">
          {credential.name}
        </p>
        <p className="mb-4 font-mono text-xs text-content-dim">
          tess:{credential.identityCommitment.slice(0, 12)}...
        </p>

        <div className="flex justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-content-dim">
              Issued
            </span>
            <span className="text-[13px] font-medium text-content-primary">
              {formatMonth(credential.issuedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-content-dim">
              Expires
            </span>
            <span className="text-[13px] font-medium text-content-primary">
              {formatMonth(credential.expiresAt)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-content-dim">
              Jurisdiction
            </span>
            <span className="text-[13px] font-medium text-content-primary">
              {credential.jurisdiction}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Actions
      </p>
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {actions.map((action, index) => (
          <button
            key={action.name}
            className={`flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-card ${index < actions.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                style={{ background: action.iconBg }}
              >
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">
                  {action.name}
                </p>
                <p className="text-[11px] text-content-dim">{action.sub}</p>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#55556a"
              strokeWidth="1.5"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Verification history
      </p>
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {history.map((entry, index) => (
          <div
            key={`${entry.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3 ${index < history.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  entry.type === "verification"
                    ? "bg-status-green"
                    : entry.type === "agent"
                      ? "bg-brand-purple-light"
                      : entry.type === "proof-demo"
                        ? "bg-status-warm"
                      : entry.type === "revocation"
                        ? "bg-status-red"
                        : "bg-status-warm"
                }`}
              />
              <div>
                <p className="text-xs text-content-primary">{entry.text}</p>
                <p className="text-[11px] text-content-muted">
                  {entry.platform}
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] text-content-dim">
              {formatRelative(entry.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
