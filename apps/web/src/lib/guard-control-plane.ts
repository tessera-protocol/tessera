import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export type GuardControlPlaneState = {
  runtime: GuardRuntimeRecord;
  credential: GuardCredentialRecord | null;
  credentialStatus: GuardCredentialStatus;
  actions: GuardActionRecord[];
};

type CredentialStore = {
  agents: Record<string, GuardCredentialRecord>;
};

type ExecApprovalsFile = {
  version: 1;
  defaults?: {
    security?: "deny" | "allowlist" | "full";
    ask?: "always" | "on-miss" | "off";
    askFallback?: "deny" | "allowlist" | "full";
    autoAllowSkills?: boolean;
  };
  agents?: Record<
    string,
    {
      security?: "deny" | "allowlist" | "full";
      ask?: "always" | "on-miss" | "off";
      askFallback?: "deny" | "allowlist" | "full";
      autoAllowSkills?: boolean;
      allowlist?: unknown[];
    }
  >;
};

type RuntimePolicySnapshotFile = {
  version: 1;
  agents: Record<
    string,
    {
      hadToolsExec: boolean;
      toolsExec: Record<string, unknown> | null;
      hadExecApprovalsAgent: boolean;
      execApprovalsAgent: Record<string, unknown> | null;
    }
  >;
};

const libDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(libDir, "../../../..");
const pluginDir = path.join(repoRoot, "openclaw-guard-plugin");
const openclawHomeDir = path.join(repoRoot, ".openclaw-probe-home", ".openclaw");
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const probeLogPath = path.join(pluginDir, "probe-events.jsonl");
const openclawConfigPath = path.join(openclawHomeDir, "openclaw.json");
const execApprovalsPath = path.join(openclawHomeDir, "exec-approvals.json");
const runtimePolicySnapshotPath = path.join(
  openclawHomeDir,
  "tessera-guard-runtime-policy.json",
);
const DEMO_CREDENTIAL_LIFETIME_SECONDS = 15 * 60;

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readCredentialStore(): CredentialStore {
  return readJsonFile<CredentialStore>(credentialsPath, { agents: {} });
}

function writeCredentialStore(value: CredentialStore) {
  writeJsonFile(credentialsPath, value);
}

function readExecApprovalsFile(): ExecApprovalsFile {
  return readJsonFile<ExecApprovalsFile>(execApprovalsPath, {
    version: 1,
    agents: {},
  });
}

function writeExecApprovalsFile(value: ExecApprovalsFile) {
  writeJsonFile(execApprovalsPath, value);
}

function readRuntimePolicySnapshotFile(): RuntimePolicySnapshotFile {
  return readJsonFile<RuntimePolicySnapshotFile>(runtimePolicySnapshotPath, {
    version: 1,
    agents: {},
  });
}

function writeRuntimePolicySnapshotFile(value: RuntimePolicySnapshotFile) {
  writeJsonFile(runtimePolicySnapshotPath, value);
}

function isDurableExecApprovalsEnabled(file: ExecApprovalsFile, agentId = "main") {
  const defaults = file.defaults ?? {};
  const agent = file.agents?.[agentId] ?? {};
  const security = agent.security ?? defaults.security ?? "deny";
  const ask = agent.ask ?? defaults.ask ?? "on-miss";

  return security === "full" && ask === "off";
}

function isRuntimeExecPolicyEnabled(config: Record<string, unknown>) {
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? {};

  return exec.security === "full" && exec.ask === "off";
}

function ensureRuntimeExecPolicy(config: Record<string, unknown>) {
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? {};

  writeJsonFile(openclawConfigPath, {
    ...config,
    tools: {
      ...tools,
      exec: {
        ...exec,
        security: "full",
        ask: "off",
      },
    },
  });
}

function ensureDurableExecPolicy(agentId = "main") {
  const file = readExecApprovalsFile();
  const agents = { ...(file.agents ?? {}) };
  const current = agents[agentId] ?? {};
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const snapshotFile = readRuntimePolicySnapshotFile();
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? {};

  if (!snapshotFile.agents[agentId]) {
    snapshotFile.agents[agentId] = {
      hadToolsExec: Object.prototype.hasOwnProperty.call(tools, "exec"),
      toolsExec: Object.prototype.hasOwnProperty.call(tools, "exec") ? exec : null,
      hadExecApprovalsAgent: Object.prototype.hasOwnProperty.call(agents, agentId),
      execApprovalsAgent: Object.prototype.hasOwnProperty.call(agents, agentId)
        ? current
        : null,
    };
    writeRuntimePolicySnapshotFile(snapshotFile);
  }

  agents[agentId] = {
    ...current,
    security: "full",
    ask: "off",
  };

  writeExecApprovalsFile({
    version: 1,
    defaults: file.defaults,
    agents,
  });

  ensureRuntimeExecPolicy(config);
}

function setRuntimeExecPolicy(
  config: Record<string, unknown>,
  policy: Record<string, unknown> | null,
) {
  const tools = { ...(((config.tools as Record<string, unknown> | undefined) ?? {})) };

  if (policy) {
    tools.exec = policy;
  } else {
    delete tools.exec;
  }

  writeJsonFile(openclawConfigPath, {
    ...config,
    tools,
  });
}

function restoreBaselineExecPolicy(agentId = "main") {
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const snapshotFile = readRuntimePolicySnapshotFile();
  const snapshot = snapshotFile.agents[agentId];
  const execApprovals = readExecApprovalsFile();
  const agents = { ...(execApprovals.agents ?? {}) };

  if (snapshot) {
    if (snapshot.hadExecApprovalsAgent && snapshot.execApprovalsAgent) {
      agents[agentId] = snapshot.execApprovalsAgent;
    } else {
      delete agents[agentId];
    }

    writeExecApprovalsFile({
      version: 1,
      defaults: execApprovals.defaults,
      agents,
    });

    setRuntimeExecPolicy(
      config,
      snapshot.hadToolsExec ? snapshot.toolsExec : null,
    );

    delete snapshotFile.agents[agentId];
    writeRuntimePolicySnapshotFile(snapshotFile);
    return;
  }

  agents[agentId] = {
    ...(agents[agentId] ?? {}),
    security: "deny",
    ask: "on-miss",
  };

  writeExecApprovalsFile({
    version: 1,
    defaults: execApprovals.defaults,
    agents,
  });

  setRuntimeExecPolicy(config, {
    security: "deny",
    ask: "on-miss",
  });
}

function readRuntimeMetadata() {
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const plugins = (config.plugins as { allow?: unknown[] } | undefined) ?? {};
  const allowList = Array.isArray(plugins.allow) ? plugins.allow : [];
  const execApprovals = readExecApprovalsFile();
  const agentId = "main";

  return {
    agentId,
    pluginLoaded: allowList.includes("tessera-guard-local"),
    connected: fs.existsSync(openclawConfigPath),
    durableExecPolicy:
      isDurableExecApprovalsEnabled(execApprovals, agentId) &&
      isRuntimeExecPolicyEnabled(config),
  };
}

export function getCredentialStatus(
  credential: GuardCredentialRecord | null,
): GuardCredentialStatus {
  if (!credential) {
    return "none";
  }
  if (credential.revoked || credential.revokedAt) {
    return "revoked";
  }
  if (credential.expiresAt <= Math.floor(Date.now() / 1000)) {
    return "expired";
  }

  return "valid";
}

function readRecentGuardActions() {
  if (!fs.existsSync(probeLogPath)) {
    return [] as GuardActionRecord[];
  }

  const lines = fs
    .readFileSync(probeLogPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-200)
    .reverse();

  const actions: GuardActionRecord[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.hook !== "guard_decision") {
        continue;
      }

      const timestamp = Date.parse(String(parsed.ts ?? new Date().toISOString()));
      actions.push({
        id: `${timestamp}-${actions.length}`,
        action: String(parsed.action ?? "unknown"),
        decision: Boolean(parsed.allowed) ? "allowed" : "blocked",
        reason: String(parsed.message ?? parsed.reason ?? "No reason provided."),
        timestamp,
        runtime: "OpenClaw",
        agentId: String(parsed.agentId ?? "unknown"),
      });
    } catch {
      continue;
    }
  }

  return actions.slice(0, 12);
}

export function readGuardControlPlaneState(): GuardControlPlaneState {
  const runtimeInfo = readRuntimeMetadata();
  const store = readCredentialStore();
  const credential = store.agents[runtimeInfo.agentId] ?? null;

  return {
    runtime: {
      agentId: runtimeInfo.agentId,
      runtime: "OpenClaw",
      plugin: "tessera-guard-local",
      session: "local loopback",
      connected: runtimeInfo.connected,
      pluginLoaded: runtimeInfo.pluginLoaded,
      durableExecPolicy: runtimeInfo.durableExecPolicy,
    },
    credential,
    credentialStatus: getCredentialStatus(credential),
    actions: readRecentGuardActions(),
  };
}

export function grantDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  const now = Math.floor(Date.now() / 1000);

  ensureDurableExecPolicy(agentId);

  store.agents[agentId] = {
    credentialId: `cred-${agentId}-exec-${now.toString(36)}`,
    agentId,
    issuer: "local-demo",
    issuedAt: now,
    expiresAt: now + DEMO_CREDENTIAL_LIFETIME_SECONDS,
    revoked: false,
    scope: {
      actions: ["exec.shell"],
    },
  };

  writeCredentialStore(store);
  return readGuardControlPlaneState();
}

export function revokeDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  const credential = store.agents[agentId];

  if (credential) {
    credential.revoked = true;
    credential.revokedAt = Math.floor(Date.now() / 1000);
    writeCredentialStore(store);
  }

  restoreBaselineExecPolicy(agentId);

  return readGuardControlPlaneState();
}

export function clearDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  delete store.agents[agentId];
  writeCredentialStore(store);
  restoreBaselineExecPolicy(agentId);
  return readGuardControlPlaneState();
}
