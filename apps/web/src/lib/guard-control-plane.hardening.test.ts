import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
// @ts-ignore -- ESM + --experimental-strip-types test execution resolves .ts directly.
import {
  clearDemoCredential,
  grantDemoCredential,
  readGuardControlPlaneState,
  revokeDemoCredential,
} from "./guard-control-plane.ts";

const cleanupPaths: string[] = [];
const envKeys = [
  "TESSERA_REPO_ROOT",
  "TESSERA_GUARD_PLUGIN_DIR",
  "TESSERA_OPENCLAW_HOME_DIR",
  "TESSERA_STANDARD_OPENCLAW_HOME_DIR",
  "TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE",
];

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }

  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "tessera-guard-hardening-"));
  const pluginDir = path.join(root, "openclaw-guard-plugin");
  const openclawHomeDir = path.join(root, ".openclaw", ".openclaw");
  const standardOpenclawHomeDir = path.join(root, ".standard-openclaw-home");

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(openclawHomeDir, { recursive: true });
  mkdirSync(standardOpenclawHomeDir, { recursive: true });

  const configPath = path.join(openclawHomeDir, "openclaw.json");
  const approvalsPath = path.join(openclawHomeDir, "exec-approvals.json");
  const snapshotPath = path.join(openclawHomeDir, "tessera-guard-runtime-policy.json");
  const credentialPath = path.join(pluginDir, "local-credentials.json");

  writeJson(configPath, {
    tools: {
      exec: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });
  writeJson(approvalsPath, {
    version: 1,
    agents: {
      main: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });
  writeJson(credentialPath, { agents: {} });

  process.env.TESSERA_REPO_ROOT = root;
  process.env.TESSERA_GUARD_PLUGIN_DIR = pluginDir;
  process.env.TESSERA_OPENCLAW_HOME_DIR = openclawHomeDir;
  process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR = standardOpenclawHomeDir;
  cleanupPaths.push(root);

  return {
    root,
    pluginDir,
    openclawHomeDir,
    configPath,
    approvalsPath,
    snapshotPath,
    credentialPath,
  };
}

function createDiscoveryFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "tessera-guard-discovery-"));
  const pluginDir = path.join(root, "openclaw-guard-plugin");
  const repoOpenclawHomeDir = path.join(root, ".openclaw-probe-home", ".openclaw");
  const standardOpenclawHomeDir = path.join(root, ".standard-openclaw-home");

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(repoOpenclawHomeDir, { recursive: true });
  mkdirSync(standardOpenclawHomeDir, { recursive: true });
  writeJson(path.join(pluginDir, "local-credentials.json"), { agents: {} });

  process.env.TESSERA_REPO_ROOT = root;
  process.env.TESSERA_GUARD_PLUGIN_DIR = pluginDir;
  process.env.TESSERA_OPENCLAW_HOME_DIR = repoOpenclawHomeDir;
  process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR = standardOpenclawHomeDir;
  cleanupPaths.push(root);

  return {
    root,
    pluginDir,
    repoOpenclawHomeDir,
    standardOpenclawHomeDir,
    repoConfigPath: path.join(repoOpenclawHomeDir, "openclaw.json"),
    standardConfigPath: path.join(standardOpenclawHomeDir, "openclaw.json"),
  };
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function getProbeLogPath(pluginDir: string, openclawHomeDir: string) {
  const runtimeHome = path.resolve(openclawHomeDir);
  const suffix = crypto.createHash("sha256").update(runtimeHome, "utf8").digest("hex").slice(0, 12);
  return path.join(pluginDir, `probe-events-${suffix}.jsonl`);
}

test("grant widens exec for the demo flow and revoke restores a non-permissive baseline", async () => {
  const fixture = createFixture();

  await grantDemoCredential("main");

  const grantedConfig = readJson(fixture.configPath);
  const grantedApprovals = readJson(fixture.approvalsPath);
  const snapshot = readJson(fixture.snapshotPath);

  assert.equal(
    (grantedConfig.tools as { exec?: { security?: string } }).exec?.security,
    "full",
  );
  assert.equal(
    (grantedConfig.tools as { exec?: { ask?: string } }).exec?.ask,
    "off",
  );
  assert.equal(
    ((grantedApprovals.agents as Record<string, { security?: string }>).main).security,
    "full",
  );
  assert.deepEqual(Object.keys(snapshot.agents as Record<string, unknown>), ["main"]);

  await revokeDemoCredential("main");

  const revokedConfig = readJson(fixture.configPath);
  const revokedApprovals = readJson(fixture.approvalsPath);
  const revokedSnapshot = readJson(fixture.snapshotPath);

  assert.equal(
    (revokedConfig.tools as { exec?: { security?: string } }).exec?.security,
    "deny",
  );
  assert.equal(
    (revokedConfig.tools as { exec?: { ask?: string } }).exec?.ask,
    "on-miss",
  );
  assert.equal(
    ((revokedApprovals.agents as Record<string, { security?: string }>).main).security,
    "deny",
  );
  assert.deepEqual(revokedSnapshot.agents, {});
});

test("clear restores the non-permissive baseline even after an exec-scoped grant", async () => {
  const fixture = createFixture();

  await grantDemoCredential("main");
  await clearDemoCredential("main");

  const config = readJson(fixture.configPath);
  const approvals = readJson(fixture.approvalsPath);
  const snapshot = readJson(fixture.snapshotPath);

  assert.equal((config.tools as { exec?: { security?: string } }).exec?.security, "deny");
  assert.equal((config.tools as { exec?: { ask?: string } }).exec?.ask, "on-miss");
  assert.equal(
    ((approvals.agents as Record<string, { ask?: string }>).main).ask,
    "on-miss",
  );
  assert.deepEqual(snapshot.agents, {});
});

test("non-exec demo grants do not silently widen exec policy", async () => {
  const fixture = createFixture();

  await grantDemoCredential("main", ["message.send", "code.write"]);

  const config = readJson(fixture.configPath);
  const approvals = readJson(fixture.approvalsPath);

  assert.equal((config.tools as { exec?: { security?: string } }).exec?.security, "deny");
  assert.equal(
    ((approvals.agents as Record<string, { security?: string }>).main).security,
    "deny",
  );

  const credentialStore = readJson(fixture.credentialPath);
  assert.deepEqual(
    ((credentialStore.agents as Record<string, { scope: { actions: string[] } }>).main).scope
      .actions,
    ["message.send", "code.write"],
  );
});

test("scan reports untrusted plugin expansion when non-allowlisted plugins are enabled", async () => {
  const fixture = createFixture();
  writeJson(fixture.configPath, {
    plugins: {
      allow: ["tessera-guard-local", "debug-shell-bypass"],
    },
    tools: {
      exec: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });

  const state = await readGuardControlPlaneState();

  assert.equal(state.scan.pluginTrustStatus, "untrusted_plugins_detected");
  assert.equal(state.pluginTrust.trustStatus, "untrusted_plugins_detected");
  assert.deepEqual(state.pluginTrust.unexpectedPlugins, ["debug-shell-bypass"]);
});

test("legacy decision logs are surfaced as unverified audit history", async () => {
  const fixture = createFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE = "repo_scoped=reachable";
  writeJson(fixture.configPath, {
    gateway: {
      bind: "loopback",
      port: 19001,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
    tools: {
      exec: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });
  const logPath = getProbeLogPath(fixture.pluginDir, fixture.openclawHomeDir);
  writeJson(logPath, null);
  writeFileSync(
    logPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      hook: "guard_decision",
      action: "exec.shell",
      allowed: false,
      message: "legacy entry",
      agentId: "main",
    })}\n`,
    "utf8",
  );

  const state = await readGuardControlPlaneState();

  assert.equal(state.audit.integrity, "legacy");
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0]?.evidenceId, "legacy-unverified");
  assert.equal(state.actions[0]?.hook, "guard_decision");
  assert.equal(state.actions[0]?.toolName, null);
  assert.equal(state.actions[0]?.credentialId, null);
  assert.equal(state.actions[0]?.reasonCode, null);
});

test("hashed decision logs surface tool and credential audit detail", async () => {
  const fixture = createFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE = "repo_scoped=reachable";
  writeJson(fixture.configPath, {
    gateway: {
      bind: "loopback",
      port: 19001,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
    agents: {
      list: [{ id: "main" }],
    },
    tools: {
      exec: {
        security: "deny",
        ask: "on-miss",
      },
    },
  });
  const ts = new Date().toISOString();
  const prevHash = null;
  const seq = 1;
  const payload = {
    seq,
    prevHash,
    hash: "placeholder",
    ts,
    openclawHome: path.resolve(fixture.openclawHomeDir),
    hook: "guard_decision",
    action: "message.send",
    allowed: false,
    reason: "OUT_OF_SCOPE",
    message: "credential does not authorize message.send",
    agentId: "main",
    toolName: "message.send",
    credentialId: "cred_live_123",
  };
  const normalized = JSON.stringify({
    seq,
    prevHash,
    ts,
    openclawHome: payload.openclawHome,
    hook: payload.hook,
    action: payload.action,
    allowed: payload.allowed,
    reason: payload.reason,
    message: payload.message,
    agentId: payload.agentId,
    toolName: payload.toolName,
    credentialId: payload.credentialId,
  });
  payload.hash = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");

  writeFileSync(
    getProbeLogPath(fixture.pluginDir, fixture.openclawHomeDir),
    `${JSON.stringify(payload)}\n`,
    "utf8",
  );

  const state = await readGuardControlPlaneState();

  assert.equal(state.audit.integrity, "verified");
  assert.equal(state.actions[0]?.hook, "guard_decision");
  assert.equal(state.actions[0]?.toolName, "message.send");
  assert.equal(state.actions[0]?.credentialId, "cred_live_123");
  assert.equal(state.actions[0]?.reasonCode, "OUT_OF_SCOPE");
});

test("detached discovery shows no history even if another runtime log exists", async () => {
  const fixture = createDiscoveryFixture();
  const repoLogPath = getProbeLogPath(fixture.pluginDir, fixture.repoOpenclawHomeDir);
  writeFileSync(
    repoLogPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      hook: "guard_decision",
      action: "exec.shell",
      allowed: true,
      message: "repo-only entry",
      agentId: "main",
    })}\n`,
    "utf8",
  );

  const state = await readGuardControlPlaneState();

  assert.equal(state.scan.connectionStatus, "no_openclaw_found");
  assert.equal(state.actions.length, 0);
  assert.equal(state.audit.integrity, "empty");
});

test("scan reports no_openclaw_found when neither standard-local nor repo-scoped config exists", async () => {
  createDiscoveryFixture();

  const state = await readGuardControlPlaneState();

  assert.equal(state.scan.connectionStatus, "no_openclaw_found");
  assert.equal(state.scan.installationFound, false);
  assert.equal(state.scan.runtimeKind, null);
  assert.deepEqual(state.scan.availableRuntimeKinds, []);
  assert.equal(state.scan.attachedAgentId, null);
});

test("scan reports runtime_not_reachable when standard local config exists but loopback runtime is down", async () => {
  const fixture = createDiscoveryFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE = "standard_local=down";
  writeJson(fixture.standardConfigPath, {
    gateway: {
      bind: "loopback",
      port: 65534,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
  });

  const state = await readGuardControlPlaneState();

  assert.equal(state.scan.connectionStatus, "runtime_not_reachable");
  assert.equal(state.scan.installationFound, true);
  assert.equal(state.scan.configFound, true);
  assert.equal(state.scan.runtimeReachable, false);
  assert.equal(state.scan.runtimeKind, "standard_local");
  assert.equal(state.scan.attachedAgentId, null);
});

test("scan auto-attaches when exactly one runtime and one local agent are obvious", async () => {
  const fixture = createDiscoveryFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE = "standard_local=reachable";
  writeJson(fixture.standardConfigPath, {
    gateway: {
      bind: "loopback",
      port: 19001,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
  });

  const state = await readGuardControlPlaneState();
  assert.equal(state.scan.connectionStatus, "attached");
  assert.equal(state.scan.runtimeKind, "standard_local");
  assert.equal(state.scan.attachedAgentId, "main");
  assert.equal(state.scan.autoAttached, true);
  assert.equal(state.runtime.connected, true);
});

test("scan requires explicit agent selection when multiple agents are discovered", async () => {
  const fixture = createDiscoveryFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE = "standard_local=reachable";
  writeJson(fixture.standardConfigPath, {
    gateway: {
      bind: "loopback",
      port: 19001,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
    agents: {
      defaults: {
        model: {
          primary: "openai-codex/gpt-5.4",
        },
      },
      list: [{ id: "main" }, { id: "ops" }],
    },
  });

  const state = await readGuardControlPlaneState();
  assert.equal(state.scan.connectionStatus, "multiple_agents_found");
  assert.equal(state.scan.runtimeKind, "standard_local");
  assert.equal(state.scan.agentSelectionRequired, true);
  assert.equal(state.scan.attachedAgentId, null);
  assert.deepEqual(state.scan.availableAgents, ["main", "ops"]);
});

test("scan distinguishes repo-scoped and standard-local runtimes when both are reachable", async () => {
  const fixture = createDiscoveryFixture();
  process.env.TESSERA_GUARD_RUNTIME_PROBE_OVERRIDE =
    "repo_scoped=reachable,standard_local=reachable";
  writeJson(fixture.standardConfigPath, {
    gateway: {
      bind: "loopback",
      port: 19001,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
  });
  writeJson(fixture.repoConfigPath, {
    gateway: {
      bind: "loopback",
      port: 19002,
    },
    plugins: {
      allow: ["tessera-guard-local"],
    },
  });

  const autoState = await readGuardControlPlaneState();
  assert.equal(autoState.scan.runtimeSelectionRequired, true);
  assert.equal(autoState.scan.attachedAgentId, null);
  assert.deepEqual(
    autoState.scan.availableRuntimeKinds.sort(),
    ["repo_scoped", "standard_local"],
  );

  const repoState = await readGuardControlPlaneState({
    runtimeKind: "repo_scoped",
  });
  assert.equal(repoState.scan.connectionStatus, "attached");
  assert.equal(repoState.scan.runtimeKind, "repo_scoped");
  assert.equal(repoState.scan.runtimeLabel, "repo-scoped demo runtime");

  const standardState = await readGuardControlPlaneState({
    runtimeKind: "standard_local",
  });
  assert.equal(standardState.scan.connectionStatus, "attached");
  assert.equal(standardState.scan.runtimeKind, "standard_local");
  assert.equal(standardState.scan.runtimeLabel, "standard local runtime");
});
