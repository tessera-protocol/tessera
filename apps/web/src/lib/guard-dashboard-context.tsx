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

export type GuardRuntimeRecord = {
  agentId: string;
  runtime: string;
  plugin: string;
  session: string;
  connected: boolean;
  pluginLoaded: boolean;
  durableExecPolicy: boolean;
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
  runtime: GuardRuntimeRecord;
  credential: GuardCredentialRecord | null;
  credentialStatus: GuardCredentialStatus;
  actions: GuardActionRecord[];
};

type GuardDashboardContextValue = GuardDashboardState & {
  loading: boolean;
  refresh: () => Promise<void>;
  grantDemoCredential: () => Promise<void>;
  revokeDemoCredential: () => Promise<void>;
  clearDemoCredential: () => Promise<void>;
};

const defaultState: GuardDashboardState = {
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

async function postCredentialAction(action: "grant" | "revoke" | "clear") {
  const response = await fetch("/api/guard/credential", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    throw new Error("Failed to update credential state");
  }

  return (await response.json()) as GuardDashboardState;
}

export function GuardDashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardDashboardState>(defaultState);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const next = await fetchState();
    setState(next);
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const next = await fetchState();
        if (!cancelled) {
          setState(next);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    const interval = window.setInterval(() => {
      void fetchState().then((next) => {
        if (!cancelled) {
          setState(next);
        }
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

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
      grantDemoCredential: async () => {
        setLoading(true);
        try {
          setState(await postCredentialAction("grant"));
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
