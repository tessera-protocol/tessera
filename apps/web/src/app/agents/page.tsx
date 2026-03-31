"use client";

import Link from "next/link";
import { useTessera } from "@/lib/tessera-context";

const statusStyles = {
  active: {
    bg: "bg-status-green/10",
    text: "text-status-green",
    dot: "bg-status-green",
    label: "Active",
  },
  revoked: {
    bg: "bg-status-red/10",
    text: "text-status-red",
    dot: "bg-status-red",
    label: "Revoked",
  },
};

function formatIssuedLabel(value: number) {
  const diff = Date.now() - value;
  const hours = Math.floor(diff / (60 * 60 * 1000));

  if (hours < 1) {
    return "Issued just now";
  }
  if (hours < 24) {
    return `Issued ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `Issued ${days} day${days === 1 ? "" : "s"} ago`;
}

function formatExpiry(value: number) {
  const diff = value - Date.now();
  const hours = Math.max(0, Math.floor(diff / (60 * 60 * 1000)));
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return `${days}d ${remainder}h`;
}

function scopePills(scope: {
  browse: boolean;
  post: boolean;
  transact: boolean;
  messages: boolean;
  maxTransactionValue: number;
  currency: string;
}) {
  return [
    scope.browse ? "browse" : null,
    scope.post ? "post" : null,
    scope.transact ? "transact" : null,
    scope.messages ? "messages" : null,
  ].filter(Boolean) as string[];
}

function AgentIcon({
  revoked,
  scope,
}: {
  revoked: boolean;
  scope: {
    browse: boolean;
    post: boolean;
    transact: boolean;
    messages: boolean;
  };
}) {
  if (revoked) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e88"
        strokeWidth="1.5"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  }

  if (scope.browse && !scope.transact) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7ec89f"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7F77DD"
      strokeWidth="1.5"
    >
      <path d="M8 9l3 3-3 3" />
      <path d="M13 15h3" />
      <rect x="3" y="4" width="18" height="16" rx="3" />
    </svg>
  );
}

export default function AgentsPage() {
  const { agents } = useTessera();

  return (
    <div className="py-4">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-white">
          Agents
        </h1>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-[13px] font-semibold text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New wallet
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised p-6 text-center">
          <p className="text-sm font-medium text-content-primary">
            No agent wallets yet
          </p>
          <p className="mt-1 text-xs text-content-muted">
            Issue your first scoped credential to delegate actions to an agent.
          </p>
        </div>
      ) : null}

      {agents.map((agent) => {
        const st = statusStyles[agent.status];
        const isRevoked = agent.status === "revoked";
        const scopes = scopePills(agent.scope);
        const limit =
          agent.scope.transact && agent.scope.maxTransactionValue > 0
            ? `max ${agent.scope.maxTransactionValue} ${agent.scope.currency}`
            : null;

        return (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className={`mb-3 block rounded-2xl border border-line bg-surface-raised p-5 transition-colors hover:border-content-dim ${isRevoked ? "opacity-50" : ""}`}
          >
            <div className="mb-3.5 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                  style={{
                    background: isRevoked
                      ? "rgba(238,136,136,0.08)"
                      : agent.scope.browse && !agent.scope.transact
                        ? "rgba(126,200,159,0.12)"
                        : "rgba(83,74,183,0.15)",
                  }}
                >
                  <AgentIcon revoked={isRevoked} scope={agent.scope} />
                </div>
                <div>
                  <p className="text-[15px] font-medium text-content-primary">
                    {agent.name}
                  </p>
                  <p className="font-mono text-[11px] text-content-dim">
                    {formatIssuedLabel(agent.issuedAt)}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 font-mono text-[10px] font-semibold ${st.bg} ${st.text}`}
              >
                <span className={`h-[5px] w-[5px] rounded-full ${st.dot}`} />
                {st.label}
              </span>
            </div>

            {!isRevoked && (
              <>
                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  {scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-md bg-brand-purple/10 px-2.5 py-1 font-mono text-[11px] text-brand-purple-pale"
                    >
                      {scope}
                    </span>
                  ))}
                  {limit && (
                    <span className="rounded-md bg-status-warm/[0.08] px-2.5 py-1 font-mono text-[11px] text-status-warm">
                      {limit}
                    </span>
                  )}
                </div>

                <div className="border-t border-line-subtle pt-3.5">
                  <span className="font-mono text-[11px] text-content-dim">
                    Expires in {formatExpiry(agent.expiresAt)}
                  </span>
                </div>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
