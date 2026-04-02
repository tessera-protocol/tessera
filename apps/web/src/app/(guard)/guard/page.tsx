"use client";

import { TesseraMark } from "@/components/tessera-mark";
import {
  type GuardScanRecord,
  useGuardDashboard,
} from "@/lib/guard-dashboard-context";

const credentialStyles = {
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

function getScanCopy(scan: GuardScanRecord) {
  switch (scan.connectionStatus) {
    case "disconnected":
      return {
        title: "No local OpenClaw runtime attached",
        detail:
          "This dashboard only scans the repo-scoped OpenClaw demo runtime under .openclaw-probe-home.",
      };
    case "scanning":
      return {
        title: "Scanning repo-scoped OpenClaw runtime",
        detail:
          scan.reason ??
          "Checking local config, runtime reachability, and Guard plugin state for agent main.",
      };
    case "local_config_found":
      return {
        title: "Repo-scoped OpenClaw config found",
        detail:
          scan.reason ??
          "The local runtime config exists, but the runtime is not currently reachable.",
      };
    case "runtime_reachable":
      return {
        title: `Attached to local OpenClaw agent ${scan.attachedAgentId ?? "main"}`,
        detail:
          scan.reason ??
          "The repo-scoped OpenClaw runtime is reachable and the dashboard is attached.",
      };
    case "error":
      return {
        title: "Could not inspect the local OpenClaw runtime",
        detail:
          scan.reason ??
          "An unexpected error occurred while scanning the repo-scoped runtime.",
      };
  }
}

function getRuntimeSignal(scan: GuardScanRecord) {
  switch (scan.connectionStatus) {
    case "disconnected":
      return {
        label: "Disconnected",
        tone: "bg-content-dim/10 text-content-muted",
        detail: "No repo-scoped OpenClaw runtime is attached yet.",
      };
    case "scanning":
      return {
        label: "Scanning",
        tone: "bg-status-warm/10 text-status-warm",
        detail: "Checking repo-scoped config and local runtime reachability.",
      };
    case "local_config_found":
      return {
        label: "Config found",
        tone: "bg-status-warm/10 text-status-warm",
        detail: "Local config exists, but the runtime is not reachable.",
      };
    case "runtime_reachable":
      return {
        label: "Runtime reachable",
        tone: "bg-status-green/10 text-status-green",
        detail: `Repo-scoped runtime reached${scan.attachedAgentId ? `, attached to ${scan.attachedAgentId}` : ""}.`,
      };
    case "error":
      return {
        label: "Error",
        tone: "bg-status-red/10 text-status-red",
        detail: "The repo-scoped runtime could not be inspected cleanly.",
      };
  }
}

function getPluginSignal(pluginStatus: GuardScanRecord["pluginStatus"]) {
  switch (pluginStatus) {
    case "plugin_loaded":
      return {
        label: "Plugin loaded",
        tone: "bg-status-green/10 text-status-green",
        detail: "tessera-guard-local is configured in the repo-scoped runtime.",
      };
    case "plugin_missing":
      return {
        label: "Plugin missing",
        tone: "bg-status-red/10 text-status-red",
        detail: "Runtime is present, but Guard is not currently loaded.",
      };
    case "unknown":
      return {
        label: "Plugin unknown",
        tone: "bg-content-dim/10 text-content-muted",
        detail: "Plugin state is unknown until the repo-scoped runtime is scanned.",
      };
  }
}

export default function GuardDashboardPage() {
  const {
    scan,
    runtime,
    pluginTrust,
    audit,
    credential,
    credentialStatus,
    credentialStoreError,
    actions,
    scanForLocalAgents,
    grantDemoCredential,
    revokeDemoCredential,
    clearDemoCredential,
    loading,
  } = useGuardDashboard();

  const credentialState = credentialStyles[credentialStatus];
  const latest = actions[0] ?? null;
  const scanCopy = getScanCopy(scan);
  const runtimeSignal = getRuntimeSignal(scan);
  const pluginSignal = getPluginSignal(scan.pluginStatus);
  const isAttached = scan.connectionStatus === "runtime_reachable";
  const scanButtonLabel =
    scan.connectionStatus === "disconnected" ? "Scan for local agents" : "Scan again";

  const warnings = [
    scan.connectionStatus === "local_config_found"
      ? {
          id: "runtime-unreachable",
          title: "Runtime not reachable",
          message:
            "Repo-scoped OpenClaw config is present, but the local gateway/runtime is not currently reachable.",
        }
      : null,
    scan.connectionStatus === "error"
      ? {
          id: "runtime-error",
          title: "Runtime inspection error",
          message:
            scan.reason ??
            "The repo-scoped OpenClaw runtime could not be inspected cleanly.",
        }
      : null,
    scan.pluginStatus === "plugin_missing"
      ? {
          id: "plugin-missing",
          title: "Guard plugin missing",
          message:
            "The repo-scoped runtime is reachable, but tessera-guard-local is not configured or not loaded.",
        }
      : null,
    credentialStoreError
      ? {
          id: "credential-store-error",
          title: "Credential file unreadable",
          message: `Local credential state could not be read: ${credentialStoreError}`,
        }
      : null,
    scan.pluginTrustStatus === "untrusted_plugins_detected"
      ? {
          id: "plugin-trust",
          title: "Untrusted plugins enabled",
          message: `Guard is loaded, but additional plugins are enabled in this runtime: ${pluginTrust.unexpectedPlugins.join(", ")}.`,
        }
      : null,
    audit.integrity === "broken"
      ? {
          id: "audit-broken",
          title: "Guard audit log integrity failed",
          message:
            audit.reason ??
            "Guard decision events are present, but the hash chain is not contiguous or includes invalid records.",
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; title: string; message: string }>;

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
            local demo mode
          </span>
          <span className="rounded-full border border-line bg-surface-card px-3 py-1 font-mono text-[11px] font-semibold text-content-muted">
            repo-scoped runtime
          </span>
          {loading ? (
            <span className="rounded-full bg-content-dim/10 px-3 py-1 font-mono text-[11px] font-semibold text-content-muted">
              syncing
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-4 rounded-[18px] border border-line bg-surface-raised p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-widest text-content-dim">
              Runtime scan
            </p>
            <h1 className="font-display text-[24px] font-semibold tracking-tight text-white">
              {scanCopy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-content-muted">{scanCopy.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => void scanForLocalAgents()}
            disabled={scan.connectionStatus === "scanning"}
            className="rounded-[12px] border border-line bg-surface-card px-4 py-3 text-sm font-semibold text-content-primary transition-colors hover:border-content-dim disabled:cursor-not-allowed disabled:border-line disabled:text-content-dim"
          >
            {scan.connectionStatus === "scanning"
              ? "Scanning local runtime..."
              : scanButtonLabel}
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-4">
        <div className="rounded-[18px] border border-line bg-surface-raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-content-dim">
              Runtime status
            </p>
            <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${runtimeSignal.tone}`}>
              {runtimeSignal.label}
            </span>
          </div>
          <p className="text-sm text-content-primary">{runtime.runtime}</p>
          <p className="mt-1 text-xs text-content-muted">{runtimeSignal.detail}</p>
        </div>

        <div className="rounded-[18px] border border-line bg-surface-raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-content-dim">
              Plugin status
            </p>
            <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${pluginSignal.tone}`}>
              {pluginSignal.label}
            </span>
          </div>
          <p className="font-mono text-sm text-content-primary">{runtime.plugin}</p>
          <p className="mt-1 text-xs text-content-muted">{pluginSignal.detail}</p>
        </div>

        <div className="rounded-[18px] border border-line bg-surface-raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-content-dim">
              Credential status
            </p>
            <span
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${credentialState.className}`}
            >
              {credentialState.label}
            </span>
          </div>
          <p className="text-sm text-content-primary">
            {credential
              ? `Credential bound to ${runtime.agentId}`
              : "No local credential is bound."}
          </p>
          <p className="mt-1 text-xs text-content-muted">
            {credential
              ? `Scope: ${credential.scope.actions.join(", ")}`
              : "Any guarded action will be blocked until a valid credential is present."}
          </p>
        </div>

        <div className="rounded-[18px] border border-line bg-surface-raised p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-content-dim">
              Last decision
            </p>
            {latest ? (
              <span
                className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                  latest.decision === "allowed"
                    ? "bg-status-green/10 text-status-green"
                    : "bg-status-red/10 text-status-red"
                }`}
              >
                {latest.decision}
              </span>
            ) : (
              <span className="rounded-full bg-content-dim/10 px-3 py-1 font-mono text-[11px] font-semibold text-content-muted">
                none
              </span>
            )}
          </div>
          {latest ? (
            <>
              <p className="font-mono text-sm text-content-primary">{latest.action}</p>
              <p className="mt-1 text-xs text-content-muted">{latest.reason}</p>
              <p className="mt-2 font-mono text-[11px] text-content-dim">
                evidence {latest.evidenceId}
              </p>
              <p className="mt-2 font-mono text-[11px] text-content-dim">
                {formatRelative(latest.timestamp)}
              </p>
            </>
          ) : (
            <p className="text-sm text-content-muted">
              No Guard decision recorded yet for this local control plane.
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-[18px] border border-status-warm/20 bg-status-warm/10 p-4">
        <p className="text-sm font-semibold text-status-warm">Demo-only local control path</p>
        <p className="mt-1 text-sm text-status-warm">
          `/guard` can mutate repo-scoped credential and runtime policy files only for a local
          demo on loopback. It is not a production auth surface.
        </p>
      </div>

      {warnings.length > 0 ? (
        <div className="mb-4 space-y-3">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className="rounded-[16px] border border-status-red/25 bg-status-red/[0.06] p-4"
            >
              <p className="text-sm font-semibold text-status-red">{warning.title}</p>
              <p className="mt-1 text-sm text-status-red/90">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!isAttached ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-[18px] border border-line bg-surface-raised p-4">
            <p className="mb-4 text-[11px] uppercase tracking-widest text-content-dim">
              Surfaces
            </p>
            <div className="space-y-2">
              <div className="rounded-[12px] border border-brand-purple/20 bg-brand-purple/10 px-3 py-2">
                <p className="text-sm font-medium text-content-primary">Runtime</p>
                <p className="text-[11px] text-content-muted">Repo-scoped OpenClaw scan only</p>
              </div>
              <div className="rounded-[12px] border border-line bg-surface-card px-3 py-2">
                <p className="text-sm font-medium text-content-primary">Attach</p>
                <p className="text-[11px] text-content-muted">Agent main only</p>
              </div>
              <div className="rounded-[12px] border border-line bg-surface-card px-3 py-2">
                <p className="text-sm font-medium text-content-primary">Scope</p>
                <p className="text-[11px] text-content-muted">No machine-wide discovery</p>
              </div>
            </div>
          </aside>

          <div className="rounded-[18px] border border-line bg-surface-raised p-5">
            <p className="mb-4 text-[11px] uppercase tracking-widest text-content-dim">
              Local attach flow
            </p>
            <div className="rounded-[14px] border border-dashed border-line bg-surface-card p-5 text-sm leading-relaxed text-content-muted">
              `/guard` starts disconnected. Use{" "}
              <span className="font-mono text-content-primary">Scan for local agents</span>{" "}
              to inspect only the repo-scoped OpenClaw runtime used by the demo. Once the
              runtime is reachable, the dashboard attaches to{" "}
              <span className="font-mono text-content-primary">main</span> and the current
              durable exec flow works unchanged.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
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
                      <h2 className="font-display text-[24px] font-semibold tracking-tight text-white">
                        {runtime.runtime}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                        runtime.connected
                          ? "bg-status-green/10 text-status-green"
                          : "bg-status-warm/10 text-status-warm"
                      }`}
                    >
                      {runtime.connected ? "runtime reachable" : "config only"}
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
                        {runtime.pluginLoaded ? runtime.plugin : "not loaded"}
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
                      className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${credentialState.className}`}
                    >
                      {credentialState.label}
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
                      No credential is currently bound. Guarded `exec.shell`, `message.send`,
                      and `code.write` actions will be blocked.
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
                    Latest decision detail
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
                    {audit.integrity === "verified"
                      ? `verified log chain · seq ${audit.lastSeq}`
                      : audit.integrity === "legacy"
                        ? "legacy log format · unverified"
                        : audit.integrity === "broken"
                          ? "audit integrity failed"
                          : "secondary signal · local plugin log"}
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
                          <p className="text-[11px] font-mono text-content-dim">
                            evidence {entry.evidenceId}
                          </p>
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
      )}
    </div>
  );
}
