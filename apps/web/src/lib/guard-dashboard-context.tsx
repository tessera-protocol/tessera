"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type GuardCredentialStatus = "none" | "valid" | "revoked" | "expired";
export type GuardConnectionStatus =
  | "no_openclaw_found"
  | "scanning"
  | "openclaw_config_found"
  | "runtime_not_reachable"
  | "runtime_reachable"
  | "multiple_agents_found"
  | "attached"
  | "error";
export type GuardPluginStatus = "plugin_loaded" | "plugin_missing" | "unknown";
export type GuardPluginTrustStatus = "trusted_only" | "untrusted_plugins_detected";
export type GuardAuditIntegrityStatus = "empty" | "legacy" | "verified" | "broken";
export type GuardRuntimeKind = "repo_scoped" | "standard_local";

export type GuardRuntimeRecord = {
  agentId: string;
  runtime: string;
  plugin: string;
  session: string;
  connected: boolean;
  pluginLoaded: boolean;
  durableExecPolicy: boolean;
};

export type GuardScanRecord = {
  connectionStatus: GuardConnectionStatus;
  installationFound: boolean;
  configFound: boolean;
  runtimeReachable: boolean;
  runtimeKind: GuardRuntimeKind | null;
  runtimeLabel: string | null;
  availableRuntimeKinds: GuardRuntimeKind[];
  runtimeSelectionRequired: boolean;
  pluginStatus: GuardPluginStatus;
  pluginTrustStatus: GuardPluginTrustStatus;
  availableAgents: string[];
  defaultAttachableAgentId: string | null;
  agentSelectionRequired: boolean;
  autoAttached: boolean;
  attachedAgentId: string | null;
  reason: string | null;
};

export type GuardPluginTrustRecord = {
  trustStatus: GuardPluginTrustStatus;
  expectedPlugins: string[];
  allowedPlugins: string[];
  unexpectedPlugins: string[];
};

export type GuardAuditRecord = {
  integrity: GuardAuditIntegrityStatus;
  totalEvents: number;
  verifiedEvents: number;
  invalidEvents: number;
  lastHash: string | null;
  lastSeq: number;
  reason: string | null;
};

export type GuardCredentialRecord = {
  credentialId: string;
  agentId: string;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  scope: {
    actions: string[];
  };
};

export type GuardActionRecord = {
  id: string;
  action: string;
  decision: "allowed" | "blocked";
  reason: string;
  reasonCode: string | null;
  timestamp: number;
  runtime: string;
  agentId: string;
  evidenceId: string;
  hook: string | null;
  toolName: string | null;
  credentialId: string | null;
};

type GuardDashboardState = {
  scan: GuardScanRecord;
  runtime: GuardRuntimeRecord;
  pluginTrust: GuardPluginTrustRecord;
  audit: GuardAuditRecord;
  credential: GuardCredentialRecord | null;
  credentialStatus: GuardCredentialStatus;
  credentialStoreError: string | null;
  actions: GuardActionRecord[];
};

type GuardDashboardContextValue = GuardDashboardState & {
  loading: boolean;
  selectedRuntimeKind: GuardRuntimeKind | null;
  selectedAgentId: string | null;
  selectRuntimeKind: (runtimeKind: GuardRuntimeKind | null) => Promise<void>;
  selectAgentId: (agentId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  scanForLocalAgents: () => Promise<void>;
  grantDemoCredential: () => Promise<void>;
  revokeDemoCredential: () => Promise<void>;
  clearDemoCredential: () => Promise<void>;
};

const defaultState: GuardDashboardState = {
  scan: {
    connectionStatus: "no_openclaw_found",
    installationFound: false,
    configFound: false,
    runtimeReachable: false,
    runtimeKind: null,
    runtimeLabel: null,
    availableRuntimeKinds: [],
    runtimeSelectionRequired: false,
    pluginStatus: "unknown",
    pluginTrustStatus: "trusted_only",
    availableAgents: [],
    defaultAttachableAgentId: null,
    agentSelectionRequired: false,
    autoAttached: false,
    attachedAgentId: null,
    reason: "No local OpenClaw runtime attached.",
  },
  runtime: {
    agentId: "main",
    runtime: "OpenClaw",
    plugin: "tessera-guard-local",
    session: "local loopback",
    connected: false,
    pluginLoaded: false,
    durableExecPolicy: false,
  },
  pluginTrust: {
    trustStatus: "trusted_only",
    expectedPlugins: ["tessera-guard-local"],
    allowedPlugins: [],
    unexpectedPlugins: [],
  },
  audit: {
    integrity: "empty",
    totalEvents: 0,
    verifiedEvents: 0,
    invalidEvents: 0,
    lastHash: null,
    lastSeq: 0,
    reason: null,
  },
  credential: null,
  credentialStatus: "none",
  credentialStoreError: null,
  actions: [],
};

const GuardDashboardContext = createContext<GuardDashboardContextValue | null>(null);

async function fetchStateWithSelection(selection: {
  runtimeKind?: GuardRuntimeKind | null;
  agentId?: string | null;
}) {
  const params = new URLSearchParams();
  if (selection.runtimeKind) {
    params.set("runtimeKind", selection.runtimeKind);
  }
  if (selection.agentId) {
    params.set("agentId", selection.agentId);
  }
  const targetUrl =
    params.size > 0 ? `/api/guard/state?${params.toString()}` : "/api/guard/state";
  const scopedResponse = await fetch(targetUrl, {
    cache: "no-store",
  });

  if (!scopedResponse.ok) {
    throw new Error("Failed to load guard state");
  }

  return (await scopedResponse.json()) as GuardDashboardState;
}

async function scanState(selection: {
  runtimeKind?: GuardRuntimeKind | null;
  agentId?: string | null;
}) {
  const response = await fetch("/api/guard/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      runtimeKind: selection.runtimeKind ?? undefined,
      agentId: selection.agentId ?? undefined,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to scan local runtime");
  }

  return (await response.json()) as GuardDashboardState;
}

async function postCredentialAction(
  action: "grant" | "revoke" | "clear",
  selection: {
    runtimeKind?: GuardRuntimeKind | null;
    agentId?: string | null;
  },
) {
  const response = await fetch("/api/guard/credential", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      runtimeKind: selection.runtimeKind ?? undefined,
      agentId: selection.agentId ?? undefined,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update credential state");
  }

  return (await response.json()) as GuardDashboardState;
}

export function GuardDashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardDashboardState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [selectedRuntimeKind, setSelectedRuntimeKind] = useState<GuardRuntimeKind | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const refresh = async () => {
    const next = await fetchStateWithSelection({
      runtimeKind: selectedRuntimeKind,
      agentId: selectedAgentId,
    });
    setState(next);
    if (next.scan.runtimeKind !== null) {
      setSelectedRuntimeKind(next.scan.runtimeKind);
    }
    if (next.scan.attachedAgentId !== null) {
      setSelectedAgentId(next.scan.attachedAgentId);
    } else if (next.scan.defaultAttachableAgentId) {
      setSelectedAgentId(next.scan.defaultAttachableAgentId);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setState((current) => ({
      ...current,
      scan: {
        ...current.scan,
        connectionStatus: "scanning",
        reason: "Looking for local OpenClaw runtime...",
      },
    }));

    void scanState({
      runtimeKind: null,
      agentId: null,
    })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setState(next);
        if (next.scan.runtimeKind !== null) {
          setSelectedRuntimeKind(next.scan.runtimeKind);
        }
        if (next.scan.attachedAgentId !== null) {
          setSelectedAgentId(next.scan.attachedAgentId);
        } else if (next.scan.defaultAttachableAgentId) {
          setSelectedAgentId(next.scan.defaultAttachableAgentId);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setState((current) => ({
          ...current,
          scan: {
            ...current.scan,
            connectionStatus: "error",
            reason: "Could not scan local OpenClaw runtime.",
          },
        }));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (state.scan.connectionStatus !== "attached") {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void fetchStateWithSelection({
        runtimeKind: selectedRuntimeKind,
        agentId: selectedAgentId,
      })
        .then((next) => {
          if (!cancelled) {
            setState(next);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              scan: {
                ...current.scan,
                connectionStatus: "error",
                reason: "Failed to refresh local OpenClaw runtime state.",
              },
            }));
          }
        });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedAgentId, selectedRuntimeKind, state.scan.connectionStatus]);

  const value = useMemo<GuardDashboardContextValue>(
    () => ({
      ...state,
      loading,
      selectedRuntimeKind,
      selectedAgentId,
      selectRuntimeKind: async (runtimeKind) => {
        setLoading(true);
        setSelectedRuntimeKind(runtimeKind);
        try {
          const next = await fetchStateWithSelection({
            runtimeKind,
            agentId: selectedAgentId,
          });
          setState(next);
        } finally {
          setLoading(false);
        }
      },
      selectAgentId: async (agentId) => {
        setLoading(true);
        setSelectedAgentId(agentId);
        try {
          const next = await fetchStateWithSelection({
            runtimeKind: selectedRuntimeKind,
            agentId,
          });
          setState(next);
        } finally {
          setLoading(false);
        }
      },
      refresh: async () => {
        setLoading(true);
        try {
          await refresh();
        } finally {
          setLoading(false);
        }
      },
      scanForLocalAgents: async () => {
        setLoading(true);
        setState((current) => ({
            ...current,
            scan: {
              ...current.scan,
              connectionStatus: "scanning",
              reason: "Looking for local OpenClaw runtime...",
            },
          }));
        try {
          const next = await scanState({
            runtimeKind: selectedRuntimeKind,
            agentId: selectedAgentId,
          });
          setState(next);
          if (next.scan.runtimeKind !== null) {
            setSelectedRuntimeKind(next.scan.runtimeKind);
          }
          if (next.scan.attachedAgentId !== null) {
            setSelectedAgentId(next.scan.attachedAgentId);
          } else if (next.scan.defaultAttachableAgentId) {
            setSelectedAgentId(next.scan.defaultAttachableAgentId);
          }
        } catch {
          setState((current) => ({
            ...current,
            scan: {
              ...current.scan,
              connectionStatus: "error",
              reason: "Could not scan local OpenClaw runtime.",
            },
          }));
        } finally {
          setLoading(false);
        }
      },
      grantDemoCredential: async () => {
        setLoading(true);
        try {
          setState(
            await postCredentialAction("grant", {
              runtimeKind: selectedRuntimeKind,
              agentId: selectedAgentId,
            }),
          );
        } finally {
          setLoading(false);
        }
      },
      revokeDemoCredential: async () => {
        setLoading(true);
        try {
          setState(
            await postCredentialAction("revoke", {
              runtimeKind: selectedRuntimeKind,
              agentId: selectedAgentId,
            }),
          );
        } finally {
          setLoading(false);
        }
      },
      clearDemoCredential: async () => {
        setLoading(true);
        try {
          setState(
            await postCredentialAction("clear", {
              runtimeKind: selectedRuntimeKind,
              agentId: selectedAgentId,
            }),
          );
        } finally {
          setLoading(false);
        }
      },
    }),
    [loading, selectedAgentId, selectedRuntimeKind, state],
  );

  return (
    <GuardDashboardContext.Provider value={value}>
      {children}
    </GuardDashboardContext.Provider>
  );
}

export function useGuardDashboard() {
  const context = useContext(GuardDashboardContext);

  if (!context) {
    throw new Error("useGuardDashboard must be used within GuardDashboardProvider");
  }

  return context;
}
