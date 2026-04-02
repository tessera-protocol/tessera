import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  clearDemoCredential,
  grantDemoCredential,
  readGuardControlPlaneState,
  revokeDemoCredential,
} from "./guard-control-plane";

const cleanupPaths: string[] = [];
const envKeys = [
  "TESSERA_REPO_ROOT",
  "TESSERA_GUARD_PLUGIN_DIR",
  "TESSERA_OPENCLAW_HOME_DIR",
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

  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(openclawHomeDir, { recursive: true });

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
  cleanupPaths.push(root);

  return {
    configPath,
    approvalsPath,
    snapshotPath,
    credentialPath,
  };
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
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
  writeJson(path.join(path.dirname(fixture.credentialPath), "probe-events.jsonl"), null);
  writeFileSync(
    path.join(path.dirname(fixture.credentialPath), "probe-events.jsonl"),
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
});
