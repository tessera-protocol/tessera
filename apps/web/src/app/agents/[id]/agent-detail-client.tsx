"use client";

import Link from "next/link";

const agents = {
  "claude-code": {
    name: "claude-code",
    id: "tess:agent:0x4d2a...8f11",
    status: "Active",
    issued: "Mar 29",
    expires: "Apr 3, 11:00",
    iconBg: "bg-brand-purple/15",
    iconStroke: "#7F77DD",
    permissions: [
      { name: "Post content", value: "allowed", style: "text-status-green" },
      { name: "Transact", value: "allowed", style: "text-status-green" },
      { name: "Spending limit", value: "50 EUR", style: "text-status-warm" },
      { name: "Categories", value: "saas, api", style: "text-status-green" },
      { name: "Browse", value: "not allowed", style: "text-content-dim" },
    ],
  },
  "mcp-browser": {
    name: "mcp-browser",
    id: "tess:agent:0x7bc1...2e30",
    status: "Active",
    issued: "Mar 31",
    expires: "Apr 7, 19:00",
    iconBg: "bg-status-green/12",
    iconStroke: "#7ec89f",
    permissions: [
      { name: "Browse", value: "allowed", style: "text-status-green" },
      { name: "Post content", value: "allowed", style: "text-status-green" },
      { name: "Transact", value: "not allowed", style: "text-content-dim" },
      { name: "Spending limit", value: "none", style: "text-content-dim" },
      { name: "Categories", value: "general", style: "text-status-green" },
    ],
  },
  "openclaw-v1": {
    name: "openclaw-v1",
    id: "tess:agent:0x91c2...4a07",
    status: "Revoked",
    issued: "Mar 22",
    expires: "Revoked Mar 29",
    iconBg: "bg-status-red/[0.08]",
    iconStroke: "#e88",
    permissions: [
      { name: "Post content", value: "revoked", style: "text-status-red" },
      { name: "Transact", value: "revoked", style: "text-status-red" },
      { name: "Spending limit", value: "0 EUR", style: "text-status-red" },
      { name: "Categories", value: "none", style: "text-content-dim" },
      { name: "Browse", value: "revoked", style: "text-status-red" },
    ],
  },
} as const;

const activity = [
  { text: "Verified on dev-tools.io", dot: "bg-status-green", time: "2h ago" },
  { text: "Verified on mcp-hub.com", dot: "bg-status-green", time: "1d ago" },
  { text: "Token exported", dot: "bg-brand-purple-light", time: "2d ago" },
  { text: "Wallet issued", dot: "bg-brand-purple-light", time: "2d ago" },
];

const token =
  "eyJhbGciOiJFZERTQSIsInR5cCI6InRlc3NlcmErYWdlbnQifQ.eyJwYXJlbnQiOiIweDdhOGYuLi4zYzIxIiwibmFtZSI6ImNsYXVkZS1jb2RlIiwic2NvcGUiOnsiY2FuUG9zdCI6dHJ1ZSwiY2FuVHJh...";

export function AgentDetailClient({ id }: { id: string }) {
  const agent = agents[id as keyof typeof agents] ?? agents["claude-code"];
  const isRevoked = agent.status === "Revoked";

  return (
    <div className="py-4">
      <Link href="/agents" className="mb-5 flex items-center gap-1.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7F77DD"
          strokeWidth="1.5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="text-sm font-medium text-brand-purple-light">
          Agents
        </span>
      </Link>

      <div className="mb-6 flex items-center gap-3.5">
        <div
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${agent.iconBg}`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={agent.iconStroke}
            strokeWidth="1.5"
          >
            <path d="M8 9l3 3-3 3" />
            <path d="M13 15h3" />
            <rect x="3" y="4" width="18" height="16" rx="3" />
          </svg>
        </div>
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-white">
            {agent.name}
          </h1>
          <p className="font-mono text-xs text-content-dim">{agent.id}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 rounded-[14px] border border-line bg-surface-raised p-4">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Status
          </span>
          <span
            className={`text-[13px] font-medium ${isRevoked ? "text-status-red" : "text-status-green"}`}
          >
            {agent.status}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Issued
          </span>
          <span className="text-[13px] font-medium text-content-primary">
            {agent.issued}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Expires
          </span>
          <span className="text-[13px] font-medium text-content-primary">
            {agent.expires}
          </span>
        </div>
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Permissions
      </p>
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {agent.permissions.map((permission, index) => (
          <div
            key={permission.name}
            className={`flex items-center justify-between px-5 py-3.5 ${index < agent.permissions.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <span className="text-[13px] text-content-primary">
              {permission.name}
            </span>
            <span className={`font-mono text-xs ${permission.style}`}>
              {permission.value}
            </span>
          </div>
        ))}
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Credential token
      </p>
      <div className="mb-4 rounded-[14px] border border-line bg-surface-raised p-5">
        <div className="mb-3 break-all rounded-lg border border-line bg-surface-base p-3 font-mono text-[11px] leading-relaxed text-content-muted">
          {token}
        </div>
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-purple/15 px-4 py-2 text-xs font-semibold text-brand-purple-light">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy token
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-content-dim/[0.08] px-4 py-2 text-xs font-semibold text-content-muted">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        </div>
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Recent activity
      </p>
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {activity.map((entry, index) => (
          <div
            key={`${entry.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3 ${index < activity.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`h-1.5 w-1.5 rounded-full ${entry.dot}`} />
              <span className="text-xs text-content-primary">{entry.text}</span>
            </div>
            <span className="font-mono text-[11px] text-content-dim">
              {entry.time}
            </span>
          </div>
        ))}
      </div>

      <button className="w-full rounded-[10px] border border-status-red/30 bg-status-red/[0.06] py-3.5 text-sm font-semibold text-status-red transition-colors hover:bg-status-red/[0.12]">
        Revoke this agent
      </button>
    </div>
  );
}
