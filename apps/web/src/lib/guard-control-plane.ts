import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export type GuardCredentialStatus = "none" | "valid" | "revoked" | "expired";
export type GuardConnectionStatus =
  | "disconnected"
  | "scanning"
  | "local_config_found"
  | "runtime_reachable"
  | "error";
export type GuardPluginStatus = "plugin_loaded" | "plugin_missing" | "unknown";
export type GuardPluginTrustStatus = "trusted_only" | "untrusted_plugins_detected";
export type GuardAuditIntegrityStatus = "empty" | "legacy" | "verified" | "broken";

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
  pluginTrustStatus: GuardPluginTrustStatus;
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
  timestamp: number;
  runtime: string;
  agentId: string;
  evidenceId: string;
};

export type GuardControlPlaneState = {
  scan: GuardScanRecord;
  runtime: GuardRuntimeRecord;
  pluginTrust: GuardPluginTrustRecord;
  audit: GuardAuditRecord;
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

type RuntimePolicySnapshotFile = {
  version: 1;
  agents: Record<
    string,
    {
      toolsExec?: Record<string, unknown>;
      execApprovalsAgent?: {
        security?: "deny" | "allowlist" | "full";
        ask?: "always" | "on-miss" | "off";
        askFallback?: "deny" | "allowlist" | "full";
        autoAllowSkills?: boolean;
        allowlist?: unknown[];
      };
    }
  >;
};

type GuardControlPlanePaths = {
  repoRoot: string;
  pluginDir: string;
  openclawHomeDir: string;
  credentialsPath: string;
  probeLogPath: string;
  openclawConfigPath: string;
  execApprovalsPath: string;
  runtimePolicySnapshotPath: string;
};

const libDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(libDir, "../../../..");
const DEMO_CREDENTIAL_LIFETIME_SECONDS = 15 * 60;
const EXEC_ACTION = "exec.shell";
const MESSAGE_ACTION = "message.send";
const CODE_WRITE_ACTION = "code.write";
const TRUSTED_DEMO_PLUGINS = ["tessera-guard-local"] as const;

function getGuardControlPlanePaths(): GuardControlPlanePaths {
  const repoRoot = resolveRepoRoot();
  const pluginDir =
    process.env.TESSERA_GUARD_PLUGIN_DIR ?? path.join(repoRoot, "openclaw-guard-plugin");
  const openclawHomeDir =
    process.env.TESSERA_OPENCLAW_HOME_DIR ??
    path.join(repoRoot, ".openclaw-probe-home", ".openclaw");

  return {
    repoRoot,
    pluginDir,
    openclawHomeDir,
    credentialsPath: path.join(pluginDir, "local-credentials.json"),
    probeLogPath: path.join(pluginDir, "probe-events.jsonl"),
    openclawConfigPath: path.join(openclawHomeDir, "openclaw.json"),
    execApprovalsPath: path.join(openclawHomeDir, "exec-approvals.json"),
    runtimePolicySnapshotPath: path.join(
      openclawHomeDir,
      "tessera-guard-runtime-policy.json",
    ),
  };
}

function resolveRepoRoot() {
  if (process.env.TESSERA_REPO_ROOT) {
    return process.env.TESSERA_REPO_ROOT;
  }

  const candidates = [
    path.resolve(process.cwd(), "../.."),
    process.cwd(),
    defaultRepoRoot,
    path.resolve(defaultRepoRoot, ".."),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "openclaw-guard-plugin")) &&
      fs.existsSync(path.join(candidate, "apps", "web"))
    ) {
      return candidate;
    }
  }

  return defaultRepoRoot;
}

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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readCredentialStore(): CredentialStore {
  const { credentialsPath } = getGuardControlPlanePaths();
  return readJsonFile<CredentialStore>(credentialsPath, { agents: {} });
}

function readCredentialStoreState() {
  const { credentialsPath } = getGuardControlPlanePaths();
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
  const { credentialsPath } = getGuardControlPlanePaths();
  writeJsonFile(credentialsPath, value);
}

function readExecApprovalsFile(): ExecApprovalsFile {
  const { execApprovalsPath } = getGuardControlPlanePaths();
  return readJsonFile<ExecApprovalsFile>(execApprovalsPath, {
    version: 1,
    agents: {},
  });
}

function writeExecApprovalsFile(value: ExecApprovalsFile) {
  const { execApprovalsPath } = getGuardControlPlanePaths();
  writeJsonFile(execApprovalsPath, value);
}

function readRuntimePolicySnapshotFile(): RuntimePolicySnapshotFile {
  const { runtimePolicySnapshotPath } = getGuardControlPlanePaths();
  return readJsonFile<RuntimePolicySnapshotFile>(runtimePolicySnapshotPath, {
    version: 1,
    agents: {},
  });
}

function writeRuntimePolicySnapshotFile(value: RuntimePolicySnapshotFile) {
  const { runtimePolicySnapshotPath } = getGuardControlPlanePaths();
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
  const { openclawConfigPath } = getGuardControlPlanePaths();
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

function isPermissiveExecState(
  toolsExec: Record<string, unknown> | undefined,
  execApprovalsAgent:
    | {
        security?: "deny" | "allowlist" | "full";
        ask?: "always" | "on-miss" | "off";
      }
    | undefined,
) {
  return (
    toolsExec?.security === "full" &&
    toolsExec?.ask === "off" &&
    execApprovalsAgent?.security === "full" &&
    execApprovalsAgent?.ask === "off"
  );
}

function snapshotRuntimePolicy(agentId = "main") {
  const snapshot = readRuntimePolicySnapshotFile();
  if (snapshot.agents[agentId]) {
    return;
  }

  const { openclawConfigPath } = getGuardControlPlanePaths();
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? undefined;
  const execApprovals = readExecApprovalsFile();
  const execApprovalsAgent = execApprovals.agents?.[agentId];

  if (isPermissiveExecState(exec, execApprovalsAgent)) {
    return;
  }

  snapshot.agents[agentId] = {
    toolsExec: exec ? { ...exec } : undefined,
    execApprovalsAgent: execApprovalsAgent ? { ...execApprovalsAgent } : undefined,
  };

  writeRuntimePolicySnapshotFile(snapshot);
}

function restoreRuntimeExecPolicy(agentId = "main") {
  const { openclawConfigPath } = getGuardControlPlanePaths();
  const snapshot = readRuntimePolicySnapshotFile();
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const execApprovals = readExecApprovalsFile();
  const agents = { ...(execApprovals.agents ?? {}) };
  const prior = snapshot.agents[agentId];

  if (prior) {
    const nextTools = { ...tools };
    if (prior.toolsExec) {
      nextTools.exec = { ...prior.toolsExec };
    } else {
      delete nextTools.exec;
    }

    writeJsonFile(openclawConfigPath, {
      ...config,
      tools: nextTools,
    });

    if (prior.execApprovalsAgent) {
      agents[agentId] = { ...prior.execApprovalsAgent };
    } else {
      delete agents[agentId];
    }

    writeExecApprovalsFile({
      version: 1,
      defaults: execApprovals.defaults,
      agents,
    });

    delete snapshot.agents[agentId];
    writeRuntimePolicySnapshotFile(snapshot);
    return;
  }

  writeJsonFile(openclawConfigPath, {
    ...config,
    tools: {
      ...tools,
      exec: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });

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
}

function ensureDurableExecPolicy(agentId = "main") {
  snapshotRuntimePolicy(agentId);
  const file = readExecApprovalsFile();
  const agents = { ...(file.agents ?? {}) };
  const current = agents[agentId] ?? {};
  const { openclawConfigPath } = getGuardControlPlanePaths();
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
  const { openclawConfigPath } = getGuardControlPlanePaths();
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

function getPluginTrust(config: Record<string, unknown>): GuardPluginTrustRecord {
  const plugins = (config.plugins as { allow?: unknown[] } | undefined) ?? {};
  const allowedPlugins = Array.isArray(plugins.allow) ? plugins.allow.map(String) : [];
  const expectedPlugins = [...TRUSTED_DEMO_PLUGINS];
  const unexpectedPlugins = allowedPlugins.filter(
    (pluginId) => !expectedPlugins.includes(pluginId),
  );

  return {
    trustStatus: unexpectedPlugins.length > 0 ? "untrusted_plugins_detected" : "trusted_only",
    expectedPlugins,
    allowedPlugins,
    unexpectedPlugins,
  };
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
      pluginTrustStatus: "trusted_only",
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
      pluginTrustStatus: "trusted_only",
      attachedAgentId: null,
      reason: `Repo-scoped OpenClaw config is unreadable: ${configState.error}`,
    };
  }

  const pluginLoaded = getPluginLoaded(configState.config);
  const pluginTrust = getPluginTrust(configState.config);
  const reachability = await probeRuntimeReachability(configState.config);

  if (!reachability.runtimeReachable) {
    return {
      connectionStatus: reachability.error ? "error" : "local_config_found",
      configFound: true,
      runtimeReachable: false,
      pluginStatus: pluginLoaded ? "plugin_loaded" : "plugin_missing",
      pluginTrustStatus: pluginTrust.trustStatus,
      attachedAgentId: null,
      reason: reachability.reason,
    };
  }

  return {
    connectionStatus: "runtime_reachable",
    configFound: true,
    runtimeReachable: true,
    pluginStatus: pluginLoaded ? "plugin_loaded" : "plugin_missing",
    pluginTrustStatus: pluginTrust.trustStatus,
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

function computeAuditHash(parsed: Record<string, unknown>) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        seq: parsed.seq ?? null,
        prevHash: parsed.prevHash ?? null,
        ts: parsed.ts ?? null,
        hook: parsed.hook ?? null,
        action: parsed.action ?? null,
        allowed: parsed.allowed ?? null,
        reason: parsed.reason ?? null,
        message: parsed.message ?? null,
        agentId: parsed.agentId ?? null,
        toolName: parsed.toolName ?? null,
        credentialId: parsed.credentialId ?? null,
      }),
      "utf8",
    )
    .digest("hex");
}

function readRecentGuardActions() {
  const { probeLogPath } = getGuardControlPlanePaths();
  if (!fs.existsSync(probeLogPath)) {
    return {
      actions: [] as GuardActionRecord[],
      audit: {
        integrity: "empty" as GuardAuditIntegrityStatus,
        totalEvents: 0,
        verifiedEvents: 0,
        invalidEvents: 0,
        lastHash: null,
        lastSeq: 0,
        reason: null,
      },
    };
  }

  const lines = fs.readFileSync(probeLogPath, "utf8").split("\n").filter(Boolean);
  const recentLines = lines.slice(-200).reverse();

  const actions: GuardActionRecord[] = [];
  let previousHash: string | null = null;
  let previousSeq = 0;
  let verifiedEvents = 0;
  let invalidEvents = 0;
  let sawHashedEvent = false;
  let lastHash: string | null = null;
  let lastSeq = 0;
  let integrity: GuardAuditIntegrityStatus = "verified";
  let integrityReason: string | null = null;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const seq = typeof parsed.seq === "number" ? parsed.seq : null;
      const hash = typeof parsed.hash === "string" ? parsed.hash : null;
      const prevHash = typeof parsed.prevHash === "string" ? parsed.prevHash : null;

      if (seq === null || hash === null) {
        continue;
      }

      sawHashedEvent = true;
      lastHash = hash;
      lastSeq = seq;
      const computed = computeAuditHash(parsed);

      if (computed !== hash) {
        invalidEvents += 1;
        integrity = "broken";
        integrityReason = "Guard audit hash verification failed.";
        continue;
      }

      if (seq !== previousSeq + 1 || prevHash !== previousHash) {
        invalidEvents += 1;
        integrity = "broken";
        integrityReason = "Guard audit event chain is not contiguous.";
        previousSeq = seq;
        previousHash = hash;
        continue;
      }

      verifiedEvents += 1;
      previousSeq = seq;
      previousHash = hash;
    } catch {
      invalidEvents += 1;
      integrity = "broken";
      integrityReason = "Guard audit log contains unreadable events.";
    }
  }

  for (const line of recentLines) {
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
        evidenceId:
          typeof parsed.hash === "string" ? parsed.hash.slice(0, 12) : "legacy-unverified",
      });
    } catch {
      continue;
    }
  }

  if (lines.length > 0 && !sawHashedEvent) {
    integrity = "legacy";
  }

  if (lines.length === 0) {
    integrity = "empty";
  }

  return {
    actions: actions.slice(0, 12),
    audit: {
      integrity,
      totalEvents: lines.length,
      verifiedEvents,
      invalidEvents,
      lastHash,
      lastSeq,
      reason: integrityReason,
    },
  };
}

export async function readGuardControlPlaneState(): Promise<GuardControlPlaneState> {
  const runtimeScan = await scanRepoScopedGuardRuntime();
  const { openclawConfigPath } = getGuardControlPlanePaths();
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const execApprovals = readExecApprovalsFile();
  const pluginTrust = getPluginTrust(config);
  const auditAndActions = readRecentGuardActions();
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
    pluginTrust,
    audit: auditAndActions.audit,
    credential,
    credentialStatus: getCredentialStatus(credential),
    credentialStoreError: credentialStoreState.error,
    actions: auditAndActions.actions,
  };
}

function normalizeCredentialActions(actions?: string[]) {
  const provided = Array.isArray(actions) && actions.length > 0 ? actions : [EXEC_ACTION];
  return Array.from(new Set(provided)).filter(
    (action) => action === EXEC_ACTION || action === MESSAGE_ACTION || action === CODE_WRITE_ACTION,
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
    const includesExecScope = credential.scope.actions.includes(EXEC_ACTION);
    credential.revoked = true;
    credential.revokedAt = Math.floor(Date.now() / 1000);
    writeCredentialStore(store);
    if (includesExecScope) {
      restoreRuntimeExecPolicy(agentId);
    }
  }

  return await readGuardControlPlaneState();
}

export async function clearDemoCredential(agentId = "main") {
  const store = readCredentialStore();
  const credential = store.agents[agentId];
  delete store.agents[agentId];
  writeCredentialStore(store);
  if (
    credential?.scope.actions.includes(EXEC_ACTION) ||
    readRuntimePolicySnapshotFile().agents[agentId]
  ) {
    restoreRuntimeExecPolicy(agentId);
  }
  return await readGuardControlPlaneState();
}
