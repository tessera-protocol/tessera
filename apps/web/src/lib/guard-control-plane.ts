import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export type GuardControlPlaneState = {
  scan: GuardScanRecord;
  runtime: GuardRuntimeRecord;
  credential: GuardCredentialRecord | null;
  credentialStatus: GuardCredentialStatus;
  credentialStoreError: string | null;
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

const libDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(libDir, "../../../..");
const pluginDir = path.join(repoRoot, "openclaw-guard-plugin");
const openclawHomeDir = path.join(repoRoot, ".openclaw-probe-home", ".openclaw");
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const probeLogPath = path.join(pluginDir, "probe-events.jsonl");
const openclawConfigPath = path.join(openclawHomeDir, "openclaw.json");
const execApprovalsPath = path.join(openclawHomeDir, "exec-approvals.json");
const DEMO_CREDENTIAL_LIFETIME_SECONDS = 15 * 60;
const EXEC_ACTION = "exec.shell";
const MESSAGE_ACTION = "message.send";

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

function readCredentialStoreState() {
  if (!fs.existsSync(credentialsPath)) {
    return {
      store: { agents: {} } as CredentialStore,
      error: null as string | null,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(credentialsPath, "utf8")) as CredentialStore;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.agents &&
      typeof parsed.agents === "object"
    ) {
      return {
        store: parsed,
        error: null as string | null,
      };
    }

    return {
      store: { agents: {} } as CredentialStore,
      error: "Credential file is present but has an invalid shape.",
    };
  } catch (error) {
    return {
      store: { agents: {} } as CredentialStore,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

function readOpenClawConfigFile() {
  if (!fs.existsSync(openclawConfigPath)) {
    return {
      exists: false,
      config: {} as Record<string, unknown>,
      error: null as string | null,
    };
  }

  try {
    return {
      exists: true,
      config: JSON.parse(
        fs.readFileSync(openclawConfigPath, "utf8"),
      ) as Record<string, unknown>,
      error: null as string | null,
    };
  } catch (error) {
    return {
      exists: true,
      config: {} as Record<string, unknown>,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getPluginLoaded(config: Record<string, unknown>) {
  const plugins = (config.plugins as { allow?: unknown[] } | undefined) ?? {};
  const allowList = Array.isArray(plugins.allow) ? plugins.allow : [];

  return allowList.includes("tessera-guard-local");
}

function resolveGatewayTarget(config: Record<string, unknown>) {
  const gateway = (config.gateway as Record<string, unknown> | undefined) ?? {};
  const bind = typeof gateway.bind === "string" ? gateway.bind : "loopback";
  const host =
    bind === "loopback" || bind === "0.0.0.0" || bind === "all"
      ? "127.0.0.1"
      : bind;
  const port =
    typeof gateway.port === "number"
      ? gateway.port
      : Number(gateway.port ?? 19001);

  return { host, port };
}

async function probeRuntimeReachability(config: Record<string, unknown>) {
  const { host, port } = resolveGatewayTarget(config);

  return await new Promise<{
    runtimeReachable: boolean;
    reason: string;
    error: boolean;
  }>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result: {
      runtimeReachable: boolean;
      reason: string;
      error: boolean;
    }) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);

    socket.once("connect", () => {
      finish({
        runtimeReachable: true,
        reason: "Repo-scoped OpenClaw runtime is reachable.",
        error: false,
      });
    });

    socket.once("timeout", () => {
      finish({
        runtimeReachable: false,
        reason:
          "Repo-scoped OpenClaw config found, but the local runtime is not reachable.",
        error: false,
      });
    });

    socket.once("error", (error: NodeJS.ErrnoException) => {
      if (
        error.code === "ECONNREFUSED" ||
        error.code === "EHOSTUNREACH" ||
        error.code === "ETIMEDOUT"
      ) {
        finish({
          runtimeReachable: false,
          reason:
            "Repo-scoped OpenClaw config found, but the local runtime is not reachable.",
          error: false,
        });
        return;
      }

      finish({
        runtimeReachable: false,
        reason: error.message || "Could not inspect the repo-scoped OpenClaw runtime.",
        error: true,
      });
    });
  });
}

export async function scanRepoScopedGuardRuntime(): Promise<GuardScanRecord> {
  const configState = readOpenClawConfigFile();

  if (!configState.exists) {
    return {
      connectionStatus: "disconnected",
      configFound: false,
      runtimeReachable: false,
      pluginStatus: "unknown",
      attachedAgentId: null,
      reason:
        "No repo-scoped OpenClaw config found. Start the local runtime or create .openclaw-probe-home first.",
    };
  }

  if (configState.error) {
    return {
      connectionStatus: "error",
      configFound: true,
      runtimeReachable: false,
      pluginStatus: "unknown",
      attachedAgentId: null,
      reason: `Repo-scoped OpenClaw config is unreadable: ${configState.error}`,
    };
  }

  const pluginLoaded = getPluginLoaded(configState.config);
  const reachability = await probeRuntimeReachability(configState.config);

  if (!reachability.runtimeReachable) {
    return {
      connectionStatus: reachability.error ? "error" : "local_config_found",
      configFound: true,
      runtimeReachable: false,
      pluginStatus: pluginLoaded ? "plugin_loaded" : "plugin_missing",
      attachedAgentId: null,
      reason: reachability.reason,
    };
  }

  return {
    connectionStatus: "runtime_reachable",
    configFound: true,
    runtimeReachable: true,
    pluginStatus: pluginLoaded ? "plugin_loaded" : "plugin_missing",
    attachedAgentId: "main",
    reason: pluginLoaded
      ? "Attached to repo-scoped OpenClaw agent main."
      : "Repo-scoped OpenClaw runtime is reachable, but tessera-guard-local is not loaded.",
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

export async function readGuardControlPlaneState(): Promise<GuardControlPlaneState> {
  const runtimeScan = await scanRepoScopedGuardRuntime();
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const execApprovals = readExecApprovalsFile();
  const agentId = runtimeScan.attachedAgentId ?? "main";
  const credentialStoreState = readCredentialStoreState();
  const store = credentialStoreState.store;
  const credential = store.agents[agentId] ?? null;

  return {
    scan: runtimeScan,
    runtime: {
      agentId,
      runtime: "OpenClaw",
      plugin: "tessera-guard-local",
      session: runtimeScan.runtimeReachable ? "local loopback" : "not attached",
      connected: runtimeScan.runtimeReachable,
      pluginLoaded: runtimeScan.pluginStatus === "plugin_loaded",
      durableExecPolicy:
        runtimeScan.runtimeReachable &&
        isDurableExecApprovalsEnabled(execApprovals, agentId) &&
        isRuntimeExecPolicyEnabled(config),
    },
    credential,
    credentialStatus: getCredentialStatus(credential),
    credentialStoreError: credentialStoreState.error,
    actions: readRecentGuardActions(),
  };
}

function normalizeCredentialActions(actions?: string[]) {
  const provided = Array.isArray(actions) && actions.length > 0 ? actions : [EXEC_ACTION];
  return Array.from(new Set(provided)).filter(
    (action) => action === EXEC_ACTION || action === MESSAGE_ACTION,
  );
}

export async function grantDemoCredential(agentId = "main", actions?: string[]) {
  const store = readCredentialStore();
  const now = Math.floor(Date.now() / 1000);
  const normalizedActions = normalizeCredentialActions(actions);

  if (normalizedActions.includes(EXEC_ACTION)) {
    ensureDurableExecPolicy(agentId);
  }

  store.agents[agentId] = {
    credentialId: `cred-${agentId}-${normalizedActions.join("-").replace(/\./g, "-")}-${now.toString(36)}`,
    agentId,
    issuer: "local-demo",
    issuedAt: now,
    expiresAt: now + DEMO_CREDENTIAL_LIFETIME_SECONDS,
    revoked: false,
    scope: {
      actions: normalizedActions,
    },
  };

  writeCredentialStore(store);
  return await readGuardControlPlaneState();
}

export async function revokeDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  const credential = store.agents[agentId];

  if (credential) {
    credential.revoked = true;
    credential.revokedAt = Math.floor(Date.now() / 1000);
    writeCredentialStore(store);
  }

  return await readGuardControlPlaneState();
}

export async function clearDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  delete store.agents[agentId];
  writeCredentialStore(store);
  return await readGuardControlPlaneState();
}
