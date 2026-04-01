"use client";

import { TesseraMark } from "@/components/tessera-mark";
import { useGuardDashboard } from "@/lib/guard-dashboard-context";

const statusStyles = {
  none: {
    label: "No credential",
    className: "bg-content-dim/10 text-content-muted",
  },
  valid: {
    label: "Valid",
    className: "bg-status-green/10 text-status-green",
  },
  revoked: {
    label: "Revoked",
    className: "bg-status-red/10 text-status-red",
  },
  expired: {
    label: "Expired",
    className: "bg-status-warm/10 text-status-warm",
  },
} as const;

function formatRelative(value: number) {
  const diff = Date.now() - value;
  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

export default function GuardDashboardPage() {
  const {
    runtime,
    credential,
    credentialStatus,
    actions,
    grantDemoCredential,
    revokeDemoCredential,
    clearDemoCredential,
    loading,
  } = useGuardDashboard();

  const status = statusStyles[credentialStatus];
  const latest = actions[0] ?? null;

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TesseraMark size={28} variant="twotone" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-[24px] font-semibold tracking-tight text-white">
                Tessera
              </p>
              <span className="text-content-dim">|</span>
              <p className="font-display text-[24px] font-semibold tracking-tight text-white">
                Guard
              </p>
            </div>
            <p className="text-sm text-content-muted">
              Execution-time authorization for OpenClaw
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-purple/10 px-3 py-1 font-mono text-[11px] font-semibold text-brand-purple-pale">
            local control plane
          </span>
          {loading ? (
            <span className="rounded-full bg-content-dim/10 px-3 py-1 font-mono text-[11px] font-semibold text-content-muted">
              syncing
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-[18px] border border-line bg-surface-raised p-4">
          <p className="mb-4 text-[11px] uppercase tracking-widest text-content-dim">
            Surfaces
          </p>
          <div className="space-y-2">
            <div className="rounded-[12px] border border-brand-purple/20 bg-brand-purple/10 px-3 py-2">
              <p className="text-sm font-medium text-content-primary">Runtime</p>
              <p className="text-[11px] text-content-muted">OpenClaw / local plugin</p>
            </div>
            <div className="rounded-[12px] border border-line bg-surface-card px-3 py-2">
              <p className="text-sm font-medium text-content-primary">Credential</p>
              <p className="text-[11px] text-content-muted">File-backed local authority</p>
            </div>
            <div className="rounded-[12px] border border-line bg-surface-card px-3 py-2">
              <p className="text-sm font-medium text-content-primary">Events</p>
              <p className="text-[11px] text-content-muted">Plugin JSONL decision log</p>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[18px] border border-line bg-surface-raised p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-widest text-content-dim">
                    Runtime / agent
                  </p>
                  <h1 className="font-display text-[24px] font-semibold tracking-tight text-white">
                    {runtime.runtime}
                  </h1>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                    runtime.connected && runtime.pluginLoaded
                      ? "bg-status-green/10 text-status-green"
                      : "bg-status-warm/10 text-status-warm"
                  }`}
                >
                  {runtime.connected && runtime.pluginLoaded ? "connected" : "local only"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[14px] border border-line bg-surface-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-content-dim">
                    Agent
                  </p>
                  <p className="mt-1 font-mono text-sm text-content-primary">
                    {runtime.agentId}
                  </p>
                </div>
                <div className="rounded-[14px] border border-line bg-surface-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-content-dim">
                    Plugin
                  </p>
                  <p className="mt-1 font-mono text-sm text-content-primary">
                    {runtime.pluginLoaded ? runtime.plugin : "not detected"}
                  </p>
                </div>
                <div className="rounded-[14px] border border-line bg-surface-card p-4">
                  <p className="text-[10px] uppercase tracking-widest text-content-dim">
                    Session
                  </p>
                  <p className="mt-1 font-mono text-sm text-content-primary">
                    {runtime.session}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-[14px] border border-line bg-surface-card p-4">
                <p className="text-[10px] uppercase tracking-widest text-content-dim">
                  Exec authority mode
                </p>
                <p className="mt-1 text-sm text-content-primary">
                  {runtime.durableExecPolicy
                    ? "Durable authority active. OpenClaw exec approvals are off for this local runtime, so Tessera Guard is the execution-time gate."
                    : "Generic OpenClaw exec approvals may still prompt. Granting a demo credential enables durable authority mode for agent main."}
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-line bg-surface-raised p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-widest text-content-dim">
                    Credential state
                  </p>
                  <p className="text-[15px] font-medium text-content-primary">
                    Local plugin credential bound to {runtime.agentId}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              {credential ? (
                <div className="space-y-3">
                  <div className="rounded-[14px] border border-line bg-surface-card p-4">
                    <p className="text-[10px] uppercase tracking-widest text-content-dim">
                      Credential ID
                    </p>
                    <p className="mt-1 font-mono text-xs text-content-primary">
                      {credential.credentialId}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[14px] border border-line bg-surface-card p-4">
                      <p className="text-[10px] uppercase tracking-widest text-content-dim">
                        Scope
                      </p>
                      <p className="mt-1 font-mono text-xs text-brand-purple-pale">
                        {credential.scope.actions.join(", ")}
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-line bg-surface-card p-4">
                      <p className="text-[10px] uppercase tracking-widest text-content-dim">
                        Expires
                      </p>
                      <p className="mt-1 font-mono text-xs text-content-primary">
                        {formatDate(credential.expiresAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-line bg-surface-card p-4 text-sm text-content-muted">
                  No credential is currently bound. Any guarded `exec.shell` action will be blocked.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="rounded-[18px] border border-line bg-surface-raised p-5">
              <p className="mb-4 text-[11px] uppercase tracking-widest text-content-dim">
                Basic controls
              </p>

              <div className="mb-3 grid gap-3">
                <button
                  type="button"
                  onClick={() => void grantDemoCredential()}
                  className="rounded-[12px] bg-brand-purple py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark"
                >
                  Grant demo credential
                </button>
                <button
                  type="button"
                  onClick={() => void revokeDemoCredential()}
                  className="rounded-[12px] border border-status-red/25 bg-status-red/[0.06] py-3.5 text-sm font-semibold text-status-red transition-colors hover:bg-status-red/[0.12]"
                >
                  Revoke credential
                </button>
                <button
                  type="button"
                  onClick={() => void clearDemoCredential()}
                  className="rounded-[12px] border border-line bg-surface-card py-3.5 text-sm font-semibold text-content-primary transition-colors hover:border-content-dim"
                >
                  Clear credential
                </button>
              </div>

              <p className="rounded-[14px] border border-line bg-surface-card p-4 text-sm leading-relaxed text-content-muted">
                These controls read and write the real local credential file used by the
                OpenClaw Guard plugin. Granting a demo credential also switches the
                repo-local OpenClaw runtime into durable exec mode for agent main, so
                `exec.shell` runs without `/approve` prompts until the credential is
                revoked or cleared. Trigger a real `exec` action in OpenClaw and this
                page will pick up the next allow/block decision from the plugin log.
              </p>
            </div>

            <div className="rounded-[18px] border border-line bg-surface-raised p-5">
              <p className="mb-4 text-[11px] uppercase tracking-widest text-content-dim">
                Latest decision
              </p>

              {latest ? (
                <div className="rounded-[14px] border border-line bg-surface-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-brand-purple-pale">
                      {latest.action}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                        latest.decision === "allowed"
                          ? "bg-status-green/10 text-status-green"
                          : "bg-status-red/10 text-status-red"
                      }`}
                    >
                      {latest.decision}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-content-primary">{latest.reason}</p>
                  <p className="font-mono text-[11px] text-content-dim">
                    {formatRelative(latest.timestamp)}
                  </p>
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-line bg-surface-card p-5 text-sm text-content-muted">
                  No Guard decisions yet. Run a real OpenClaw `exec` action locally and
                  this panel will update from the plugin log.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-line bg-surface-raised p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-content-dim">
                Recent guarded actions
              </p>
              <span className="font-mono text-[11px] text-content-dim">
                polled from local plugin log
              </span>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-line bg-surface-card">
              {actions.length === 0 ? (
                <div className="px-5 py-4 text-sm text-content-muted">
                  No Guard decisions recorded yet. Run a real OpenClaw `exec` action locally
                  and this panel will update from `probe-events.jsonl`.
                </div>
              ) : null}

              {actions.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    index < actions.length - 1 ? "border-b border-line-subtle" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        entry.decision === "allowed" ? "bg-status-green" : "bg-status-red"
                      }`}
                    />
                    <div>
                      <p className="text-sm text-content-primary">
                        {entry.action} · {entry.decision}
                      </p>
                      <p className="text-xs text-content-muted">{entry.reason}</p>
                    </div>
                  </div>
                  <span className="ml-4 shrink-0 font-mono text-[11px] text-content-dim">
                    {formatRelative(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
