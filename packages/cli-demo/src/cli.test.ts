import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  attachRoleCredential,
  createCustomPolicyScaffold,
  revokeRoleCredential,
  resolveCliRuntimePaths,
} from "./runtime-attach.js";
import { renderSafetyManifest, resolveRoleTemplate } from "./roles.js";

test("developer manifest includes allowed, blocked, limits, boundary, and revoke sections", () => {
  const template = resolveRoleTemplate({
    roleId: "developer",
    projectRoot: "/tmp/project",
    expiryHours: 24,
  });
  const manifest = renderSafetyManifest({
    template,
    runtimeKind: "standard_local",
    agentId: "main",
  });

  assert.match(manifest, /Allowed/);
  assert.match(manifest, /Blocked/);
  assert.match(manifest, /Limits/);
  assert.match(manifest, /Boundary/);
  assert.match(manifest, /Revoke/);
  assert.match(manifest, /semantic acceptability/);
});

test("custom role scaffold is generated for advanced path", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-custom-"));
  const outputPath = createCustomPolicyScaffold({ projectRoot: tempDir });
  const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
    role: string;
    boundary: { semanticEnforcement: boolean };
  };

  assert.equal(parsed.role, "custom");
  assert.equal(parsed.boundary.semanticEnforcement, false);
});

test("attach and revoke developer role writes local credential state and restores exec baseline", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-protect-"));
  const repoRoot = path.join(tempDir, "repo");
  const pluginDir = path.join(repoRoot, "openclaw-guard-plugin");
  const runtimeHome = path.join(repoRoot, ".openclaw-probe-home", ".openclaw");

  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(runtimeHome, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "packages", "cli-demo"), { recursive: true });
  fs.writeFileSync(
    path.join(runtimeHome, "openclaw.json"),
    `${JSON.stringify({ tools: { exec: { security: "deny", ask: "on-miss" } } }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(runtimeHome, "exec-approvals.json"),
    `${JSON.stringify({ version: 1, agents: { main: { security: "deny", ask: "on-miss" } } }, null, 2)}\n`,
  );

  const previousRepoRoot = process.env.TESSERA_REPO_ROOT;
  const previousStandard = process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR;
  const previousRepoHome = process.env.TESSERA_OPENCLAW_HOME_DIR;
  try {
    process.env.TESSERA_REPO_ROOT = repoRoot;
    process.env.TESSERA_OPENCLAW_HOME_DIR = runtimeHome;
    process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR = runtimeHome;

    const attached = attachRoleCredential({
      runtimeKind: "repo_scoped",
      agentId: "main",
      actions: ["code.write", "exec.shell"],
      roleId: "developer",
      expiryHours: 24,
    });
    const storePath = resolveCliRuntimePaths("repo_scoped").credentialsPath;
    const store = JSON.parse(fs.readFileSync(storePath, "utf8")) as {
      agents: Record<string, { credentialId: string; revoked: boolean; scope: { actions: string[] } }>;
    };
    assert.deepEqual(store.agents.main.scope.actions, ["code.write", "exec.shell"]);
    assert.equal(store.agents.main.revoked, false);

    const approvals = JSON.parse(fs.readFileSync(path.join(runtimeHome, "exec-approvals.json"), "utf8")) as {
      agents: Record<string, { security: string; ask: string }>;
    };
    assert.equal(approvals.agents.main.security, "full");
    assert.equal(approvals.agents.main.ask, "off");

    revokeRoleCredential({
      runtimeKind: "repo_scoped",
      credentialId: attached.credentialId,
      agentId: "main",
    });

    const revokedStore = JSON.parse(fs.readFileSync(storePath, "utf8")) as {
      agents: Record<string, { revoked: boolean }>;
    };
    assert.equal(revokedStore.agents.main.revoked, true);

    const restoredApprovals = JSON.parse(
      fs.readFileSync(path.join(runtimeHome, "exec-approvals.json"), "utf8"),
    ) as {
      agents: Record<string, { security: string; ask: string }>;
    };
    assert.equal(restoredApprovals.agents.main.security, "deny");
    assert.equal(restoredApprovals.agents.main.ask, "on-miss");
  } finally {
    process.env.TESSERA_REPO_ROOT = previousRepoRoot;
    process.env.TESSERA_STANDARD_OPENCLAW_HOME_DIR = previousStandard;
    process.env.TESSERA_OPENCLAW_HOME_DIR = previousRepoHome;
  }
});
