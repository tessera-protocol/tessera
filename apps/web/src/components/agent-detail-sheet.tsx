"use client";

import Link from "next/link";
import type { TesseraActivityRecord, TesseraAgentRecord } from "@/lib/tessera-store";

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

export function AgentDetailSheet({
  agent,
  activity,
  onRevoke,
  closeHref = "/agents",
}: {
  agent: TesseraAgentRecord | null;
  activity: TesseraActivityRecord[];
  onRevoke: (agentId: string) => void;
  closeHref?: string;
}) {
  if (!agent) {
    return (
      <div className="mb-4 rounded-[14px] border border-line bg-surface-raised p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-content-primary">
            Agent not found
          </p>
          <Link href={closeHref} className="text-xs font-medium text-brand-purple-light">
            Close
          </Link>
        </div>
        <p className="text-xs text-content-muted">
          This route does not match an agent stored in local state.
        </p>
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
      style:
        agent.scope.maxTransactionValue > 0 ? "text-status-warm" : "text-content-dim",
    },
  ];
  const relatedActivity = activity.filter((entry) => entry.platform === agent.name).slice(0, 4);

  return (
    <div className="mb-4 rounded-[18px] border border-line bg-surface-raised p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${
              isRevoked ? "bg-status-red/[0.08]" : "bg-brand-purple/15"
            }`}
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
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-white">
              {agent.name}
            </h2>
            <p className="font-mono text-xs text-content-dim">
              tess:agent:{agent.publicKey.slice(0, 12)}...
            </p>
          </div>
        </div>
        <Link href={closeHref} className="text-xs font-medium text-brand-purple-light">
          Close
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-4 rounded-[14px] border border-line bg-surface-card p-4">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-content-dim">
            Status
          </span>
          <span
            className={`text-[13px] font-medium ${
              isRevoked ? "text-status-red" : "text-status-green"
            }`}
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
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-card">
        {permissions.map((permission, index) => (
          <div
            key={permission.name}
            className={`flex items-center justify-between px-5 py-3.5 ${
              index < permissions.length - 1 ? "border-b border-line-subtle" : ""
            }`}
          >
            <span className="text-[13px] text-content-primary">{permission.name}</span>
            <span className={`font-mono text-xs ${permission.style}`}>
              {permission.value}
            </span>
          </div>
        ))}
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Credential token
      </p>
      <div className="mb-4 rounded-[14px] border border-line bg-surface-card p-5">
        <div className="mb-3 break-all rounded-lg border border-line bg-surface-base p-3 font-mono text-[11px] leading-relaxed text-content-muted">
          {agent.token}
        </div>
      </div>

      <p className="mb-2.5 text-[13px] font-medium uppercase tracking-widest text-content-muted">
        Recent activity
      </p>
      <div className="mb-4 overflow-hidden rounded-[14px] border border-line bg-surface-card">
        {relatedActivity.length === 0 ? (
          <div className="px-5 py-4 text-xs text-content-muted">
            No agent-specific activity yet.
          </div>
        ) : null}
        {relatedActivity.map((entry, index) => (
          <div
            key={`${entry.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3 ${
              index < relatedActivity.length - 1 ? "border-b border-line-subtle" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  entry.type === "revocation"
                    ? "bg-status-red"
                    : entry.type === "verification"
                      ? "bg-status-green"
                      : entry.type === "proof-demo"
                        ? "bg-status-warm"
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
        onClick={() => onRevoke(agent.id)}
        className="w-full rounded-[10px] border border-status-red/30 bg-status-red/[0.06] py-3.5 text-sm font-semibold text-status-red transition-colors hover:bg-status-red/[0.12]"
      >
        Revoke this agent
      </button>
    </div>
  );
}
