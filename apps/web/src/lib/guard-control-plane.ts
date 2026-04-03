import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";

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
  runtimeKind: GuardRuntimeKind;
  runtimeLabel: string;
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
const DEFAULT_GUARD_AGENT_ID = "main";

type GuardSelection = {
  runtimeKind?: GuardRuntimeKind | null;
  agentId?: string | null;
};

type GuardDiscoveredRuntime = {
  paths: GuardControlPlanePaths;
  configFound: boolean;
  config: Record<string, unknown>;
  configError: string | null;
  runtimeReachable: boolean;
  runtimeReason: string;
  runtimeProbeError: boolean;
  pluginStatus: GuardPluginStatus;
  pluginTrust: GuardPluginTrustRecord;
  availableAgents: string[];
};

type GuardRuntimeProbeResult = {
  runtimeReachable: boolean;
  reason: string;
  error: boolean;
};

function resolveOpenClawHomeDir(runtimeKind: GuardRuntimeKind) {
  const repoRoot = resolveRepoRoot();
  const repoScopedHomeDir =
    process.env.TESSERA_OPENCLAW_HOME_DIR ??
    path.join(repoRoot, ".openclaw-probe-home", ".openclaw");
  const standardHomeDir =
    process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR ?? path.join(os.homedir(), ".openclaw");

  return runtimeKind === "repo_scoped" ? repoScopedHomeDir : standardHomeDir;
}

function resolveOpenClawHomeForLog(runtimeKind: GuardRuntimeKind) {
  return path.resolve(resolveOpenClawHomeDir(runtimeKind));
}

function getProbeLogFileNameForRuntime(runtimeKind: GuardRuntimeKind) {
  const runtimeHome = resolveOpenClawHomeForLog(runtimeKind);
  const suffix = crypto.createHash("sha256").update(runtimeHome, "utf8").digest("hex").slice(0, 12);
  return `probe-events-${suffix}.jsonl`;
}

function getGuardControlPlanePaths(runtimeKind: GuardRuntimeKind): GuardControlPlanePaths {
  const repoRoot = resolveRepoRoot();
  const pluginDir =
    process.env.TESSERA_GUARD_PLUGIN_DIR ?? path.join(repoRoot, "openclaw-guard-plugin");
  const openclawHomeDir = resolveOpenClawHomeDir(runtimeKind);
  const runtimeLabel =
    runtimeKind === "repo_scoped" ? "repo-scoped demo runtime" : "standard local runtime";

  return {
    runtimeKind,
    runtimeLabel,
    repoRoot,
    pluginDir,
    openclawHomeDir,
    credentialsPath: path.join(pluginDir, "local-credentials.json"),
    probeLogPath: path.join(pluginDir, getProbeLogFileNameForRuntime(runtimeKind)),
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
  const { credentialsPath } = getGuardControlPlanePaths("repo_scoped");
  return readJsonFile<CredentialStore>(credentialsPath, { agents: {} });
}

function readCredentialStoreState() {
  const { credentialsPath } = getGuardControlPlanePaths("repo_scoped");
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
  const { credentialsPath } = getGuardControlPlanePaths("repo_scoped");
  writeJsonFile(credentialsPath, value);
}

function readExecApprovalsFile(runtimeKind: GuardRuntimeKind): ExecApprovalsFile {
  const { execApprovalsPath } = getGuardControlPlanePaths(runtimeKind);
  return readJsonFile<ExecApprovalsFile>(execApprovalsPath, {
    version: 1,
    agents: {},
  });
}

function writeExecApprovalsFile(runtimeKind: GuardRuntimeKind, value: ExecApprovalsFile) {
  const { execApprovalsPath } = getGuardControlPlanePaths(runtimeKind);
  writeJsonFile(execApprovalsPath, value);
}

function readRuntimePolicySnapshotFile(runtimeKind: GuardRuntimeKind): RuntimePolicySnapshotFile {
  const { runtimePolicySnapshotPath } = getGuardControlPlanePaths(runtimeKind);
  return readJsonFile<RuntimePolicySnapshotFile>(runtimePolicySnapshotPath, {
    version: 1,
    agents: {},
  });
}

function writeRuntimePolicySnapshotFile(runtimeKind: GuardRuntimeKind, value: RuntimePolicySnapshotFile) {
  const { runtimePolicySnapshotPath } = getGuardControlPlanePaths(runtimeKind);
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

function ensureRuntimeExecPolicy(runtimeKind: GuardRuntimeKind, config: Record<string, unknown>) {
  const { openclawConfigPath } = getGuardControlPlanePaths(runtimeKind);
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

function snapshotRuntimePolicy(runtimeKind: GuardRuntimeKind, agentId = DEFAULT_GUARD_AGENT_ID) {
  const snapshot = readRuntimePolicySnapshotFile(runtimeKind);
  if (snapshot.agents[agentId]) {
    return;
  }

  const { openclawConfigPath } = getGuardControlPlanePaths(runtimeKind);
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? undefined;
  const execApprovals = readExecApprovalsFile(runtimeKind);
  const execApprovalsAgent = execApprovals.agents?.[agentId];

  if (isPermissiveExecState(exec, execApprovalsAgent)) {
    return;
  }

  snapshot.agents[agentId] = {
    toolsExec: exec ? { ...exec } : undefined,
    execApprovalsAgent: execApprovalsAgent ? { ...execApprovalsAgent } : undefined,
  };

  writeRuntimePolicySnapshotFile(runtimeKind, snapshot);
}

function restoreRuntimeExecPolicy(runtimeKind: GuardRuntimeKind, agentId = DEFAULT_GUARD_AGENT_ID) {
  const { openclawConfigPath } = getGuardControlPlanePaths(runtimeKind);
  const snapshot = readRuntimePolicySnapshotFile(runtimeKind);
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const execApprovals = readExecApprovalsFile(runtimeKind);
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

    writeExecApprovalsFile(runtimeKind, {
      version: 1,
      defaults: execApprovals.defaults,
      agents,
    });

    delete snapshot.agents[agentId];
    writeRuntimePolicySnapshotFile(runtimeKind, snapshot);
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

  writeExecApprovalsFile(runtimeKind, {
    version: 1,
    defaults: execApprovals.defaults,
    agents,
  });
}

function ensureDurableExecPolicy(runtimeKind: GuardRuntimeKind, agentId = DEFAULT_GUARD_AGENT_ID) {
  snapshotRuntimePolicy(runtimeKind, agentId);
  const file = readExecApprovalsFile(runtimeKind);
  const agents = { ...(file.agents ?? {}) };
  const current = agents[agentId] ?? {};
  const { openclawConfigPath } = getGuardControlPlanePaths(runtimeKind);
  const config = readJsonFile<Record<string, unknown>>(openclawConfigPath, {});

  agents[agentId] = {
    ...current,
    security: "full",
    ask: "off",
  };

  writeExecApprovalsFile(runtimeKind, {
    version: 1,
    defaults: file.defaults,
    agents,
  });

  ensureRuntimeExecPolicy(runtimeKind, config);
}

function readOpenClawConfigFile(runtimeKind: GuardRuntimeKind) {
  const { openclawConfigPath } = getGuardControlPlanePaths(runtimeKind);
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
  const expectedPlugins: string[] = [...TRUSTED_DEMO_PLUGINS];
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

async function probeRuntimeReachability(
  runtimeKind: GuardRuntimeKind,
  config: Record<string, unknown>,
) {
  const override = readRuntimeProbeOverride(runtimeKind);
  if (override) {
    return override;
  }

  const { host, port } = resolveGatewayTarget(config);
  const runtimePrefix =
    runtimeKind === "repo_scoped" ? "Repo-scoped OpenClaw" : "OpenClaw";

  return await new Promise<GuardRuntimeProbeResult>((resolve) => {
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
        reason: `${runtimePrefix} runtime is reachable.`,
        error: false,
      });
    });

    socket.once("timeout", () => {
      finish({
        runtimeReachable: false,
        reason: `${runtimePrefix} config found, but the local runtime is not reachable.`,
        error: false,
      });
    });

    socket.once("error", (error: NodeJS.ErrnoException) => {
      if (
        error.code === "ECONNREFUSED" ||
        error.code === "EHOSTUNREACH" ||
        error.code === "ETIMEDOUT" ||
        error.code === "EPERM" ||
        error.code === "EACCES"
      ) {
        finish({
          runtimeReachable: false,
          reason: `${runtimePrefix} config found, but the local runtime is not reachable.`,
          error: false,
        });
        return;
      }

      finish({
        runtimeReachable: false,
        reason: error.message || `Could not inspect the ${runtimePrefix.toLowerCase()} runtime.`,
        error: true,
      });
    });
  });
}

function readRuntimeProbeOverride(runtimeKind: GuardRuntimeKind): GuardRuntimeProbeResult | null {
  const raw = process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE;
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let scopedValue: string | null = null;
  let fallbackValue: string | null = null;

  for (const entry of entries) {
    const [maybeKind, maybeState] = entry.includes("=")
      ? entry.split("=", 2)
      : [null, entry];
    const state = maybeState?.trim().toLowerCase() ?? "";
    if (state.length === 0) {
      continue;
    }
    if (maybeKind === null) {
      fallbackValue = state;
      continue;
    }
    const kind = maybeKind.trim();
    if (kind === runtimeKind) {
      scopedValue = state;
    }
  }

  const value = scopedValue ?? fallbackValue;
  if (!value) {
    return null;
  }

  const runtimePrefix = runtimeKind === "repo_scoped" ? "Repo-scoped OpenClaw" : "OpenClaw";
  if (value === "reachable" || value === "up") {
    return {
      runtimeReachable: true,
      reason: `${runtimePrefix} runtime is reachable.`,
      error: false,
    };
  }

  if (value === "runtime_not_reachable" || value === "not_reachable" || value === "down") {
    return {
      runtimeReachable: false,
      reason: `${runtimePrefix} config found, but the local runtime is not reachable.`,
      error: false,
    };
  }

  if (value === "error") {
    return {
      runtimeReachable: false,
      reason: `Could not inspect the ${runtimePrefix.toLowerCase()} runtime.`,
      error: true,
    };
  }

  return null;
}
function discoverAgents(config: Record<string, unknown>) {
  const discovered = new Set<string>([DEFAULT_GUARD_AGENT_ID]);
  const agentsNode = (config.agents as Record<string, unknown> | undefined) ?? {};
  const listNode = Array.isArray(agentsNode.list) ? agentsNode.list : [];

  for (const entry of listNode) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const id = (entry as { id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
      discovered.add(id.trim());
    }
  }

  for (const id of Object.keys(agentsNode)) {
    if (id === "defaults" || id === "list" || id === "entries") {
      continue;
    }
    if (id.trim().length > 0) {
      discovered.add(id.trim());
    }
  }

  return Array.from(discovered).sort((a, b) =>
    a === DEFAULT_GUARD_AGENT_ID
      ? -1
      : b === DEFAULT_GUARD_AGENT_ID
        ? 1
        : a.localeCompare(b),
  );
}

async function discoverRuntime(runtimeKind: GuardRuntimeKind): Promise<GuardDiscoveredRuntime> {
  const paths = getGuardControlPlanePaths(runtimeKind);
  const configState = readOpenClawConfigFile(runtimeKind);

  if (!configState.exists) {
    return {
      paths,
      configFound: false,
      config: {},
      configError: null,
      runtimeReachable: false,
      runtimeReason:
        runtimeKind === "repo_scoped"
          ? "No repo-scoped OpenClaw config found. Start the local demo runtime or create .openclaw-probe-home first."
          : "No standard local OpenClaw config found under ~/.openclaw.",
      runtimeProbeError: false,
      pluginStatus: "unknown",
      pluginTrust: {
        trustStatus: "trusted_only",
        expectedPlugins: [...TRUSTED_DEMO_PLUGINS],
        allowedPlugins: [],
        unexpectedPlugins: [],
      },
      availableAgents: [DEFAULT_GUARD_AGENT_ID],
    };
  }

  if (configState.error) {
    return {
      paths,
      configFound: true,
      config: {},
      configError: configState.error,
      runtimeReachable: false,
      runtimeReason: `OpenClaw config is unreadable: ${configState.error}`,
      runtimeProbeError: true,
      pluginStatus: "unknown",
      pluginTrust: {
        trustStatus: "trusted_only",
        expectedPlugins: [...TRUSTED_DEMO_PLUGINS],
        allowedPlugins: [],
        unexpectedPlugins: [],
      },
      availableAgents: [DEFAULT_GUARD_AGENT_ID],
    };
  }

  const pluginLoaded = getPluginLoaded(configState.config);
  const pluginTrust = getPluginTrust(configState.config);
  const reachability = await probeRuntimeReachability(runtimeKind, configState.config);
  const availableAgents = discoverAgents(configState.config);

  return {
    paths,
    configFound: true,
    config: configState.config,
    configError: null,
    runtimeReachable: reachability.runtimeReachable,
    runtimeReason: reachability.reason,
    runtimeProbeError: reachability.error,
    pluginStatus: pluginLoaded ? "plugin_loaded" : "plugin_missing",
    pluginTrust,
    availableAgents,
  };
}

function buildNoOpenClawFoundScan(): GuardScanRecord {
  return {
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
    reason: "No local OpenClaw installation detected.",
  };
}

function buildScanRecordFromRuntime(
  runtime: GuardDiscoveredRuntime,
  selection: GuardSelection,
  availableRuntimeKinds: GuardRuntimeKind[],
  runtimeSelectionRequired: boolean,
): GuardScanRecord {
  const requestedAgentId = selection.agentId?.trim() || null;
  const defaultAttachableAgentId = runtime.availableAgents[0] ?? null;
  const hasExactRequestedAgent =
    requestedAgentId !== null && runtime.availableAgents.includes(requestedAgentId);
  const autoAttachable = runtime.availableAgents.length === 1;
  const attachedAgentId =
    hasExactRequestedAgent
      ? requestedAgentId
      : autoAttachable
        ? runtime.availableAgents[0] ?? null
        : null;
  const agentSelectionRequired = runtime.runtimeReachable && attachedAgentId === null;

  if (!runtime.configFound) {
    return {
      connectionStatus: "no_openclaw_found",
      installationFound: false,
      configFound: false,
      runtimeReachable: false,
      runtimeKind: runtime.paths.runtimeKind,
      runtimeLabel: runtime.paths.runtimeLabel,
      availableRuntimeKinds,
      runtimeSelectionRequired,
      pluginStatus: "unknown",
      pluginTrustStatus: "trusted_only",
      availableAgents: runtime.availableAgents,
      defaultAttachableAgentId,
      agentSelectionRequired: false,
      autoAttached: false,
      attachedAgentId: null,
      reason: runtime.runtimeReason,
    };
  }

  if (runtime.configError) {
    return {
      connectionStatus: "error",
      installationFound: true,
      configFound: true,
      runtimeReachable: false,
      runtimeKind: runtime.paths.runtimeKind,
      runtimeLabel: runtime.paths.runtimeLabel,
      availableRuntimeKinds,
      runtimeSelectionRequired,
      pluginStatus: "unknown",
      pluginTrustStatus: "trusted_only",
      availableAgents: runtime.availableAgents,
      defaultAttachableAgentId,
      agentSelectionRequired: false,
      autoAttached: false,
      attachedAgentId: null,
      reason: runtime.runtimeReason,
    };
  }

  if (!runtime.runtimeReachable) {
    return {
      connectionStatus: runtime.runtimeProbeError ? "error" : "runtime_not_reachable",
      installationFound: true,
      configFound: true,
      runtimeReachable: false,
      runtimeKind: runtime.paths.runtimeKind,
      runtimeLabel: runtime.paths.runtimeLabel,
      availableRuntimeKinds,
      runtimeSelectionRequired,
      pluginStatus: runtime.pluginStatus,
      pluginTrustStatus: runtime.pluginTrust.trustStatus,
      availableAgents: runtime.availableAgents,
      defaultAttachableAgentId,
      agentSelectionRequired: false,
      autoAttached: false,
      attachedAgentId: null,
      reason:
        runtime.paths.runtimeKind === "standard_local"
          ? "OpenClaw detected, runtime not reachable."
          : "Repo-scoped OpenClaw config found, but runtime is not reachable.",
    };
  }

  if (agentSelectionRequired) {
    return {
      connectionStatus: "multiple_agents_found",
      installationFound: true,
      configFound: true,
      runtimeReachable: true,
      runtimeKind: runtime.paths.runtimeKind,
      runtimeLabel: runtime.paths.runtimeLabel,
      availableRuntimeKinds,
      runtimeSelectionRequired,
      pluginStatus: runtime.pluginStatus,
      pluginTrustStatus: runtime.pluginTrust.trustStatus,
      availableAgents: runtime.availableAgents,
      defaultAttachableAgentId,
      agentSelectionRequired: true,
      autoAttached: false,
      attachedAgentId: null,
      reason: "Multiple local agents found. Choose which agent Tessera should attach to.",
    };
  }

  return {
    connectionStatus: attachedAgentId ? "attached" : "runtime_reachable",
    installationFound: true,
    configFound: true,
    runtimeReachable: true,
    runtimeKind: runtime.paths.runtimeKind,
    runtimeLabel: runtime.paths.runtimeLabel,
    availableRuntimeKinds,
    runtimeSelectionRequired,
    pluginStatus: runtime.pluginStatus,
    pluginTrustStatus: runtime.pluginTrust.trustStatus,
    availableAgents: runtime.availableAgents,
    defaultAttachableAgentId,
    agentSelectionRequired: false,
    autoAttached: !hasExactRequestedAgent && autoAttachable,
    attachedAgentId: attachedAgentId ?? null,
    reason: attachedAgentId
      ? `Connected to ${runtime.paths.runtimeLabel} OpenClaw agent ${attachedAgentId}.`
      : "OpenClaw runtime is reachable.",
  };
}

async function scanGuardRuntime(selection: GuardSelection = {}): Promise<{
  scan: GuardScanRecord;
  runtime: GuardDiscoveredRuntime | null;
}> {
  const repoScoped = await discoverRuntime("repo_scoped");
  const standardLocal = await discoverRuntime("standard_local");
  const discovered = [repoScoped, standardLocal];
  const configFoundRuntimes = discovered.filter((runtime) => runtime.configFound);
  const availableRuntimeKinds = configFoundRuntimes.map((runtime) => runtime.paths.runtimeKind);

  if (configFoundRuntimes.length === 0) {
    return { scan: buildNoOpenClawFoundScan(), runtime: null };
  }

  const requestedRuntimeKind = selection.runtimeKind ?? null;
  const requestedRuntime = requestedRuntimeKind
    ? configFoundRuntimes.find((runtime) => runtime.paths.runtimeKind === requestedRuntimeKind) ??
      null
    : null;
  const reachableRuntimes = configFoundRuntimes.filter((runtime) => runtime.runtimeReachable);
  const runtimeSelectionRequired = requestedRuntime === null && reachableRuntimes.length > 1;
  const selectedRuntime =
    requestedRuntime ??
    (reachableRuntimes.length === 1
      ? reachableRuntimes[0]
      : configFoundRuntimes.find((runtime) => runtime.paths.runtimeKind === "standard_local") ??
        configFoundRuntimes[0]);
  const scan = buildScanRecordFromRuntime(
    selectedRuntime,
    selection,
    availableRuntimeKinds,
    runtimeSelectionRequired,
  );
  if (runtimeSelectionRequired && scan.connectionStatus === "attached") {
    scan.connectionStatus = "runtime_reachable";
    scan.reason = "Multiple local OpenClaw runtimes found. Select a runtime before attaching.";
    scan.attachedAgentId = null;
    scan.autoAttached = false;
  }

  return { scan, runtime: selectedRuntime };
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
        openclawHome: parsed.openclawHome ?? null,
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

function readRecentGuardActions(runtimeKind: GuardRuntimeKind | null) {
  if (!runtimeKind) {
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

  const { probeLogPath } = getGuardControlPlanePaths(runtimeKind);
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

export async function readGuardControlPlaneState(
  selection: GuardSelection = {},
): Promise<GuardControlPlaneState> {
  const discovery = await scanGuardRuntime(selection);
  const runtimeScan = discovery.scan;
  const selectedRuntimeKind = runtimeScan.runtimeKind ?? "repo_scoped";
  const paths = getGuardControlPlanePaths(selectedRuntimeKind);
  const config = readJsonFile<Record<string, unknown>>(paths.openclawConfigPath, {});
  const execApprovals = readExecApprovalsFile(selectedRuntimeKind);
  const pluginTrust =
    discovery.runtime?.pluginTrust ?? getPluginTrust(config);
  const auditAndActions = readRecentGuardActions(
    runtimeScan.attachedAgentId ? selectedRuntimeKind : null,
  );
  const agentId = runtimeScan.attachedAgentId ?? selection.agentId ?? DEFAULT_GUARD_AGENT_ID;
  const credentialStoreState = readCredentialStoreState();
  const store = credentialStoreState.store;
  const credential = store.agents[agentId] ?? null;

  return {
    scan: runtimeScan,
    runtime: {
      agentId,
      runtime: "OpenClaw",
      plugin: "tessera-guard-local",
      session: runtimeScan.attachedAgentId ? "local loopback" : "not attached",
      connected: runtimeScan.attachedAgentId !== null,
      pluginLoaded: runtimeScan.pluginStatus === "plugin_loaded",
      durableExecPolicy:
        runtimeScan.attachedAgentId !== null &&
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

export async function grantDemoCredential(
  agentId = DEFAULT_GUARD_AGENT_ID,
  actions?: string[],
  runtimeKind: GuardRuntimeKind = "repo_scoped",
) {
  const store = readCredentialStore();
  const now = Math.floor(Date.now() / 1000);
  const normalizedActions = normalizeCredentialActions(actions);

  if (normalizedActions.includes(EXEC_ACTION)) {
    ensureDurableExecPolicy(runtimeKind, agentId);
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
  return await readGuardControlPlaneState({ runtimeKind, agentId });
}

export async function revokeDemoCredential(
  agentId = DEFAULT_GUARD_AGENT_ID,
  runtimeKind: GuardRuntimeKind = "repo_scoped",
) {
  const store = readCredentialStore();
  const credential = store.agents[agentId];

  if (credential) {
    const includesExecScope = credential.scope.actions.includes(EXEC_ACTION);
    credential.revoked = true;
    credential.revokedAt = Math.floor(Date.now() / 1000);
    writeCredentialStore(store);
    if (includesExecScope) {
      restoreRuntimeExecPolicy(runtimeKind, agentId);
    }
  }

  return await readGuardControlPlaneState({ runtimeKind, agentId });
}

export async function clearDemoCredential(
  agentId = DEFAULT_GUARD_AGENT_ID,
  runtimeKind: GuardRuntimeKind = "repo_scoped",
) {
  const store = readCredentialStore();
  const credential = store.agents[agentId];
  delete store.agents[agentId];
  writeCredentialStore(store);
  if (
    credential?.scope.actions.includes(EXEC_ACTION) ||
    readRuntimePolicySnapshotFile(runtimeKind).agents[agentId]
  ) {
    restoreRuntimeExecPolicy(runtimeKind, agentId);
  }
  return await readGuardControlPlaneState({ runtimeKind, agentId });
}
