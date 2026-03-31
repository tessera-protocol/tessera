"use client";

import {
  createAgentWallet as createAgentWalletRecord,
  generateProof as generateProofRecord,
  getActivityLog,
  getAgents,
  getCredential,
  initializeCredential,
  revokeAgent as revokeAgentRecord,
  type TesseraProofResult,
} from "@/lib/tessera-client";
import {
  hasCredential,
  type TesseraActivityRecord,
  type TesseraAgentRecord,
  type TesseraAgentScope,
  type TesseraCredentialRecord,
} from "@/lib/tessera-store";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type TesseraContextValue = {
  credential: TesseraCredentialRecord | null;
  agents: TesseraAgentRecord[];
  activity: TesseraActivityRecord[];
  createAgentWallet: (params: {
    name: string;
    scope: TesseraAgentScope;
    expiryMs: number;
  }) => Promise<TesseraAgentRecord>;
  revokeAgent: (agentId: string) => TesseraAgentRecord | null;
  generateProof: (platformScope: string) => Promise<TesseraProofResult>;
  refresh: () => void;
};

const TesseraContext = createContext<TesseraContextValue | null>(null);

export function TesseraProvider({ children }: { children: ReactNode }) {
  const [credential, setCredential] = useState<TesseraCredentialRecord | null>(null);
  const [agents, setAgents] = useState<TesseraAgentRecord[]>([]);
  const [activity, setActivity] = useState<TesseraActivityRecord[]>([]);
  const didInit = useRef(false);

  const refresh = () => {
    setCredential(getCredential());
    setAgents(getAgents());
    setActivity(
      getActivityLog().sort((left, right) => right.timestamp - left.timestamp),
    );
  };

  useEffect(() => {
    if (didInit.current) {
      return;
    }

    didInit.current = true;

    const boot = async () => {
      if (!hasCredential()) {
        await initializeCredential("Guglielmo Reggio", 1, "EU");
      }

      refresh();
    };

    void boot();
  }, []);

  const value: TesseraContextValue = {
    credential,
    agents,
    activity,
    createAgentWallet: async (params) => {
      const created = await createAgentWalletRecord(params);
      refresh();
      return created;
    },
    revokeAgent: (agentId) => {
      const revoked = revokeAgentRecord(agentId);
      refresh();
      return revoked;
    },
    generateProof: async (platformScope) => {
      const proof = await generateProofRecord(platformScope);
      refresh();
      return proof;
    },
    refresh,
  };

  return (
    <TesseraContext.Provider value={value}>{children}</TesseraContext.Provider>
  );
}

export function useTessera() {
  const context = useContext(TesseraContext);

  if (!context) {
    throw new Error("useTessera must be used within a TesseraProvider");
  }

  return context;
}
