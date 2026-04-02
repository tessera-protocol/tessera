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
  | "disconnected"
  | "scanning"
  | "local_config_found"
  | "runtime_reachable"
  | "error";
export type GuardPluginStatus = "plugin_loaded" | "plugin_missing" | "unknown";

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
  configFound: boolean;
  runtimeReachable: boolean;
  pluginStatus: GuardPluginStatus;
  attachedAgentId: string | null;
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
  timestamp: number;
  runtime: string;
  agentId: string;
};

type GuardDashboardState = {
  scan: GuardScanRecord;
  runtime: GuardRuntimeRecord;
  credential: GuardCredentialRecord | null;
  credentialStatus: GuardCredentialStatus;
  credentialStoreError: string | null;
  actions: GuardActionRecord[];
};

type GuardDashboardContextValue = GuardDashboardState & {
  loading: boolean;
  refresh: () => Promise<void>;
  scanForLocalAgents: () => Promise<void>;
  grantExecCredential: () => Promise<void>;
  grantMessageCredential: () => Promise<void>;
  grantCombinedCredential: () => Promise<void>;
  revokeDemoCredential: () => Promise<void>;
  clearDemoCredential: () => Promise<void>;
};

const defaultState: GuardDashboardState = {
  scan: {
    connectionStatus: "disconnected",
    configFound: false,
    runtimeReachable: false,
    pluginStatus: "unknown",
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
  credential: null,
  credentialStatus: "none",
  credentialStoreError: null,
  actions: [],
};

const GuardDashboardContext = createContext<GuardDashboardContextValue | null>(null);

async function fetchState() {
  const response = await fetch("/api/guard/state", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load guard state");
  }

  return (await response.json()) as GuardDashboardState;
}

async function scanState() {
  const response = await fetch("/api/guard/scan", {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to scan local runtime");
  }

  return (await response.json()) as GuardDashboardState;
}

async function postCredentialAction(
  action: "grant" | "revoke" | "clear",
  actions?: string[],
) {
  const response = await fetch("/api/guard/credential", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, actions }),
  });

  if (!response.ok) {
    throw new Error("Failed to update credential state");
  }

  return (await response.json()) as GuardDashboardState;
}

export function GuardDashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardDashboardState>(defaultState);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const next = await fetchState();
    setState(next);
  };

  useEffect(() => {
    let cancelled = false;
    if (state.scan.connectionStatus !== "runtime_reachable") {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void fetchState()
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
                reason: "Failed to refresh the repo-scoped OpenClaw runtime state.",
              },
            }));
          }
        });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [state.scan.connectionStatus]);

  const value = useMemo<GuardDashboardContextValue>(
    () => ({
      ...state,
      loading,
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
            reason: "Scanning repo-scoped OpenClaw runtime...",
          },
        }));
        try {
          setState(await scanState());
        } catch {
          setState((current) => ({
            ...current,
            scan: {
              ...current.scan,
              connectionStatus: "error",
              reason: "Could not scan the repo-scoped OpenClaw runtime.",
            },
          }));
        } finally {
          setLoading(false);
        }
      },
      grantExecCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("grant", ["exec.shell"]));
        } finally {
          setLoading(false);
        }
      },
      grantMessageCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("grant", ["message.send"]));
        } finally {
          setLoading(false);
        }
      },
      grantCombinedCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("grant", ["exec.shell", "message.send"]));
        } finally {
          setLoading(false);
        }
      },
      revokeDemoCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("revoke"));
        } finally {
          setLoading(false);
        }
      },
      clearDemoCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("clear"));
        } finally {
          setLoading(false);
        }
      },
    }),
    [loading, state],
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
