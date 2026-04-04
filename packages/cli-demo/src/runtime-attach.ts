import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProtectAction } from "./roles.js";

export type SupportedRuntimeKind = "repo_scoped" | "standard_local";

type LocalCredentialRecord = {
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
  role?: string;
};

type CredentialStore = {
  agents: Record<string, LocalCredentialRecord>;
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

export type CliRuntimePaths = {
  repoRoot: string;
  pluginDir: string;
  credentialsPath: string;
  openclawHomeDir: string;
  openclawConfigPath: string;
  execApprovalsPath: string;
  runtimePolicySnapshotPath: string;
  runtimeKind: SupportedRuntimeKind;
};

export function resolveCliRuntimePaths(runtimeKind: SupportedRuntimeKind): CliRuntimePaths {
  const repoRoot = resolveRepoRoot();
  const pluginDir =
    process.env.TESSERA_GUARD_PLUGIN_DIR ?? path.join(repoRoot, "openclaw-guard-plugin");
  const openclawHomeDir = resolveOpenClawHomeDir(repoRoot, runtimeKind);

  return {
    repoRoot,
    pluginDir,
    credentialsPath: path.join(pluginDir, "local-credentials.json"),
    openclawHomeDir,
    openclawConfigPath: path.join(openclawHomeDir, "openclaw.json"),
    execApprovalsPath: path.join(openclawHomeDir, "exec-approvals.json"),
    runtimePolicySnapshotPath: path.join(openclawHomeDir, "tessera-guard-runtime-policy.json"),
    runtimeKind,
  };
}

export function assertAttachableRuntime(paths: CliRuntimePaths) {
  if (!fs.existsSync(paths.pluginDir)) {
    throw new Error(`OpenClaw Guard plugin directory not found at ${paths.pluginDir}.`);
  }

  if (!fs.existsSync(paths.openclawConfigPath)) {
    throw new Error(
      `OpenClaw runtime config not found at ${paths.openclawConfigPath}. Install or initialize the selected runtime before attaching Tessera authority.`,
    );
  }
}

export function attachRoleCredential(options: {
  runtimeKind: SupportedRuntimeKind;
  agentId: string;
  actions: ProtectAction[];
  roleId: string;
  expiryHours: number;
}) {
  const paths = resolveCliRuntimePaths(options.runtimeKind);
  assertAttachableRuntime(paths);

  const store = readCredentialStore(paths);
  const now = Math.floor(Date.now() / 1000);
  const credentialId = `cred-${options.agentId}-${options.roleId}-${now.toString(36)}`;
  const actions = Array.from(new Set(options.actions));

  if (actions.includes("exec.shell")) {
    ensureDurableExecPolicy(paths, options.agentId);
  }

  store.agents[options.agentId] = {
    credentialId,
    agentId: options.agentId,
    issuer: "local-role-template",
    issuedAt: now,
    expiresAt: now + options.expiryHours * 3600,
    revoked: false,
    scope: {
      actions,
    },
    role: options.roleId,
  };
  writeJsonFile(paths.credentialsPath, store);

  return {
    credentialId,
    credentialsPath: paths.credentialsPath,
    openclawConfigPath: paths.openclawConfigPath,
    runtimeKind: paths.runtimeKind,
  };
}

export function revokeRoleCredential(options: {
  runtimeKind: SupportedRuntimeKind;
  credentialId: string;
  agentId?: string;
}) {
  const paths = resolveCliRuntimePaths(options.runtimeKind);
  assertAttachableRuntime(paths);

  const store = readCredentialStore(paths);
  const target = findCredential(store, options.credentialId, options.agentId);
  if (!target) {
    throw new Error(`Credential "${options.credentialId}" was not found in ${paths.credentialsPath}.`);
  }

  target.record.revoked = true;
  target.record.revokedAt = Math.floor(Date.now() / 1000);
  writeJsonFile(paths.credentialsPath, store);

  if (target.record.scope.actions.includes("exec.shell")) {
    restoreRuntimeExecPolicy(paths, target.agentId);
  }

  return {
    credentialId: target.record.credentialId,
    agentId: target.agentId,
    credentialsPath: paths.credentialsPath,
  };
}

export function createCustomPolicyScaffold(options: {
  outputPath?: string;
  projectRoot: string;
}) {
  const outputPath =
    options.outputPath ?? path.join(options.projectRoot, ".tessera", "custom-policy.json");
  const scaffold = {
    role: "custom",
    note: "Advanced path. Edit the allowedActions list intentionally before attaching authority.",
    allowedActions: [],
    blockedActions: ["exec.shell", "code.write", "message.send"],
    limits: {
      expiryHours: 24,
      spendCap: null,
      projectRoot: options.projectRoot,
    },
    boundary: {
      semanticEnforcement: false,
    },
  };

  writeJsonFile(outputPath, scaffold);
  return outputPath;
}

function resolveRepoRoot() {
  if (process.env.TESSERA_REPO_ROOT) {
    return process.env.TESSERA_REPO_ROOT;
  }

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../.."),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "openclaw-guard-plugin")) &&
      fs.existsSync(path.join(candidate, "packages", "cli-demo"))
    ) {
      return candidate;
    }
  }

  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
}

function resolveOpenClawHomeDir(repoRoot: string, runtimeKind: SupportedRuntimeKind) {
  if (runtimeKind === "repo_scoped") {
    return (
      process.env.TESSERA_OPENCLAW_HOME_DIR ??
      path.join(repoRoot, ".openclaw-probe-home", ".openclaw")
    );
  }

  return process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR ?? path.join(os.homedir(), ".openclaw");
}

function readCredentialStore(paths: CliRuntimePaths): CredentialStore {
  return readJsonFile<CredentialStore>(paths.credentialsPath, { agents: {} });
}

function findCredential(store: CredentialStore, credentialId: string, agentId?: string) {
  if (agentId) {
    const record = store.agents[agentId];
    if (record?.credentialId === credentialId) {
      return { agentId, record };
    }
    return null;
  }

  for (const [candidateAgentId, record] of Object.entries(store.agents)) {
    if (record.credentialId === credentialId) {
      return { agentId: candidateAgentId, record };
    }
  }

  return null;
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

function readExecApprovalsFile(paths: CliRuntimePaths): ExecApprovalsFile {
  return readJsonFile<ExecApprovalsFile>(paths.execApprovalsPath, {
    version: 1,
    agents: {},
  });
}

function writeExecApprovalsFile(paths: CliRuntimePaths, value: ExecApprovalsFile) {
  writeJsonFile(paths.execApprovalsPath, value);
}

function readRuntimePolicySnapshotFile(paths: CliRuntimePaths): RuntimePolicySnapshotFile {
  return readJsonFile<RuntimePolicySnapshotFile>(paths.runtimePolicySnapshotPath, {
    version: 1,
    agents: {},
  });
}

function writeRuntimePolicySnapshotFile(paths: CliRuntimePaths, value: RuntimePolicySnapshotFile) {
  writeJsonFile(paths.runtimePolicySnapshotPath, value);
}

function ensureDurableExecPolicy(paths: CliRuntimePaths, agentId: string) {
  snapshotRuntimePolicy(paths, agentId);
  const config = readJsonFile<Record<string, unknown>>(paths.openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? {};

  writeJsonFile(paths.openclawConfigPath, {
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

  const approvals = readExecApprovalsFile(paths);
  writeExecApprovalsFile(paths, {
    ...approvals,
    version: 1,
    agents: {
      ...(approvals.agents ?? {}),
      [agentId]: {
        ...(approvals.agents?.[agentId] ?? {}),
        security: "full",
        ask: "off",
      },
    },
  });
}

function restoreRuntimeExecPolicy(paths: CliRuntimePaths, agentId: string) {
  const snapshot = readRuntimePolicySnapshotFile(paths);
  const agentSnapshot = snapshot.agents[agentId];
  if (!agentSnapshot) {
    return;
  }

  const config = readJsonFile<Record<string, unknown>>(paths.openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const nextTools = { ...tools };

  if (agentSnapshot.toolsExec) {
    nextTools.exec = agentSnapshot.toolsExec;
  } else {
    delete nextTools.exec;
  }

  writeJsonFile(paths.openclawConfigPath, {
    ...config,
    tools: nextTools,
  });

  const approvals = readExecApprovalsFile(paths);
  const nextAgents = { ...(approvals.agents ?? {}) };
  if (agentSnapshot.execApprovalsAgent) {
    nextAgents[agentId] = agentSnapshot.execApprovalsAgent;
  } else {
    delete nextAgents[agentId];
  }
  writeExecApprovalsFile(paths, {
    ...approvals,
    version: 1,
    agents: nextAgents,
  });

  delete snapshot.agents[agentId];
  writeRuntimePolicySnapshotFile(paths, snapshot);
}

function snapshotRuntimePolicy(paths: CliRuntimePaths, agentId: string) {
  const snapshot = readRuntimePolicySnapshotFile(paths);
  if (snapshot.agents[agentId]) {
    return;
  }

  const config = readJsonFile<Record<string, unknown>>(paths.openclawConfigPath, {});
  const tools = (config.tools as Record<string, unknown> | undefined) ?? {};
  const exec = (tools.exec as Record<string, unknown> | undefined) ?? undefined;
  const approvals = readExecApprovalsFile(paths);

  snapshot.agents[agentId] = {
    toolsExec: exec ? { ...exec } : undefined,
    execApprovalsAgent: approvals.agents?.[agentId]
      ? { ...approvals.agents[agentId] }
      : undefined,
  };
  writeRuntimePolicySnapshotFile(paths, snapshot);
}

