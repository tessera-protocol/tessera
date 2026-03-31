"use client";

import Link from "next/link";
import { useTessera } from "@/lib/tessera-context";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatActivityTime(value: number) {
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

export function AgentDetailClient({ id }: { id: string }) {
  const { activity, agents, revokeAgent } = useTessera();
  const agent = agents.find((item) => item.id === id) ?? null;

  if (!agent) {
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
        <div className="rounded-[14px] border border-line bg-surface-raised p-5">
          <p className="text-sm font-medium text-content-primary">
            Agent not found
          </p>
          <p className="mt-1 text-xs text-content-muted">
            This route does not match an agent stored in local state.
          </p>
        </div>
      </div>
    );
  }

  const isRevoked = agent.status === "revoked";
  const permissions = [
    {
      name: "Browse",
      value: agent.scope.browse ? "allowed" : "not allowed",
      style: agent.scope.browse ? "text-status-green" : "text-content-dim",
    },
    {
      name: "Post content",
      value: agent.scope.post ? "allowed" : "not allowed",
      style: agent.scope.post ? "text-status-green" : "text-content-dim",
    },
    {
      name: "Transact",
      value: agent.scope.transact ? "allowed" : "not allowed",
      style: agent.scope.transact ? "text-status-green" : "text-content-dim",
    },
    {
      name: "Send messages",
      value: agent.scope.messages ? "allowed" : "not allowed",
      style: agent.scope.messages ? "text-status-green" : "text-content-dim",
    },
    {
      name: "Spending limit",
      value: `${agent.scope.maxTransactionValue} ${agent.scope.currency}`,
      style: agent.scope.maxTransactionValue > 0 ? "text-status-warm" : "text-content-dim",
    },
  ];
  const relatedActivity = activity
    .filter((entry) => entry.platform === agent.name)
    .slice(0, 4);

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
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${isRevoked ? "bg-status-red/[0.08]" : "bg-brand-purple/15"}`}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isRevoked ? "#e88" : "#7F77DD"}
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
          <p className="font-mono text-xs text-content-dim">
            tess:agent:{agent.publicKey.slice(0, 12)}...
          </p>
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
            {isRevoked ? "Revoked" : "Active"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Issued
          </span>
          <span className="text-[13px] font-medium text-content-primary">
            {formatDate(agent.issuedAt)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Expires
          </span>
          <span className="text-[13px] font-medium text-content-primary">
            {formatDate(agent.expiresAt)}
          </span>
        </div>
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Permissions
      </p>
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {permissions.map((permission, index) => (
          <div
            key={permission.name}
            className={`flex items-center justify-between px-5 py-3.5 ${index < permissions.length - 1 ? "border-b border-line-subtle" : ""}`}
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
          {agent.token}
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
        {relatedActivity.length === 0 ? (
          <div className="px-5 py-4 text-xs text-content-muted">
            No agent-specific activity yet.
          </div>
        ) : null}
        {relatedActivity.map((entry, index) => (
          <div
            key={`${entry.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3 ${index < relatedActivity.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  entry.type === "revocation"
                    ? "bg-status-red"
                    : entry.type === "verification"
                      ? "bg-status-green"
                      : "bg-brand-purple-light"
                }`}
              />
              <span className="text-xs text-content-primary">{entry.text}</span>
            </div>
            <span className="font-mono text-[11px] text-content-dim">
              {formatActivityTime(entry.timestamp)}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => revokeAgent(agent.id)}
        className="w-full rounded-[10px] border border-status-red/30 bg-status-red/[0.06] py-3.5 text-sm font-semibold text-status-red transition-colors hover:bg-status-red/[0.12]"
      >
        Revoke this agent
      </button>
    </div>
  );
}
