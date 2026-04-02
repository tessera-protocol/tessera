import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import plugin from "./index.js";
import {
  clearDemoCredential,
  grantDemoCredential,
  revokeDemoCredential,
} from "../apps/web/src/lib/guard-control-plane.ts";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pluginDir, "..");
const openclawHomeDir = path.join(repoRoot, ".openclaw-probe-home", ".openclaw");
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const exampleCredentialsPath = path.join(pluginDir, "local-credentials.example.json");
const logPath = path.join(pluginDir, "probe-events.jsonl");
const openclawConfigPath = path.join(openclawHomeDir, "openclaw.json");
const execApprovalsPath = path.join(openclawHomeDir, "exec-approvals.json");
const runtimePolicySnapshotPath = path.join(
  openclawHomeDir,
  "tessera-guard-runtime-policy.json",
);

const managedPaths = [
  credentialsPath,
  exampleCredentialsPath,
  logPath,
  openclawConfigPath,
  execApprovalsPath,
  runtimePolicySnapshotPath,
];

function captureState() {
  return new Map(
    managedPaths.map((filePath) => [
      filePath,
      fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
    ]),
  );
}

function restoreState(state) {
  for (const [filePath, contents] of state.entries()) {
    if (contents === null) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
      continue;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeCredential(actions) {
  const now = Math.floor(Date.now() / 1000);
  return {
    agents: {
      main: {
        credentialId: "cred-main-test",
        agentId: "main",
        issuer: "test",
        issuedAt: now,
        expiresAt: now + 3600,
        revoked: false,
        scope: {
          actions,
        },
      },
    },
  };
}

function registerPlugin() {
  const handlers = new Map();
  plugin.register({
    on(name, handler) {
      handlers.set(name, handler);
    },
  });
  return handlers;
}

let stateBackup;

test.beforeEach(() => {
  stateBackup = captureState();
  delete process.env.TESSERA_GUARD_DEBUG_LOG_PAYLOADS;
});

test.afterEach(() => {
  restoreState(stateBackup);
  delete process.env.TESSERA_GUARD_DEBUG_LOG_PAYLOADS;
});

test("revoke restores prior runtime policy snapshot and clear falls back fail-closed", async () => {
  const originalConfig = {
    plugins: {
      allow: ["tessera-guard-local"],
    },
    tools: {
      exec: {
        security: "allowlist",
        ask: "always",
        inherited: true,
      },
    },
  };
  const originalApprovals = {
    version: 1,
    defaults: {
      security: "deny",
      ask: "on-miss",
    },
    agents: {
      main: {
        security: "allowlist",
        ask: "always",
        allowlist: [{ id: "allow-1", pattern: "=command:test" }],
      },
    },
  };

  writeJson(openclawConfigPath, originalConfig);
  writeJson(execApprovalsPath, originalApprovals);
  writeJson(credentialsPath, { agents: {} });
  fs.rmSync(runtimePolicySnapshotPath, { force: true });

  await grantDemoCredential("main");

  const widenedConfig = readJson(openclawConfigPath);
  const widenedApprovals = readJson(execApprovalsPath);
  const snapshot = readJson(runtimePolicySnapshotPath);

  assert.equal(widenedConfig.tools.exec.security, "full");
  assert.equal(widenedConfig.tools.exec.ask, "off");
  assert.equal(widenedApprovals.agents.main.security, "full");
  assert.equal(widenedApprovals.agents.main.ask, "off");
  assert.deepEqual(snapshot.agents.main.toolsExec, originalConfig.tools.exec);
  assert.deepEqual(
    snapshot.agents.main.execApprovalsAgent,
    originalApprovals.agents.main,
  );

  await revokeDemoCredential("main");

  assert.deepEqual(readJson(openclawConfigPath), originalConfig);
  assert.deepEqual(readJson(execApprovalsPath), originalApprovals);
  assert.deepEqual(readJson(runtimePolicySnapshotPath), {
    version: 1,
    agents: {},
  });

  fs.rmSync(runtimePolicySnapshotPath, { force: true });
  fs.rmSync(execApprovalsPath, { force: true });
  writeJson(openclawConfigPath, {
    plugins: {
      allow: ["tessera-guard-local"],
    },
  });

  await clearDemoCredential("main");

  const fallbackConfig = readJson(openclawConfigPath);
  const fallbackApprovals = readJson(execApprovalsPath);

  assert.equal(fallbackConfig.tools.exec.security, "deny");
  assert.equal(fallbackConfig.tools.exec.ask, "on-miss");
  assert.equal(fallbackApprovals.agents.main.security, "deny");
  assert.equal(fallbackApprovals.agents.main.ask, "on-miss");
});

test("missing live credential file does not fall back to example credentials", async () => {
  fs.rmSync(credentialsPath, { force: true });
  writeJson(exampleCredentialsPath, makeCredential(["exec.shell"]));
  fs.rmSync(logPath, { force: true });

  const handlers = registerPlugin();
  const beforeToolCall = handlers.get("before_tool_call");

  const result = await beforeToolCall(
    {
      toolName: "exec",
      params: {
        command: "echo should-not-run",
      },
    },
    {
      agentId: "main",
      sessionKey: "agent:main:test",
      sessionId: "session-test",
      runId: "run-test",
      toolCallId: "tool-1",
    },
  );

  assert.equal(result?.block, true);
  assert.match(result?.blockReason ?? "", /no credential found/i);

  const logText = fs.readFileSync(logPath, "utf8");
  assert.doesNotMatch(logText, /should-not-run/);
});

test("default logging omits raw hook payloads and secret-bearing params", async () => {
  writeJson(credentialsPath, makeCredential(["exec.shell", "message.send"]));
  fs.rmSync(logPath, { force: true });

  const handlers = registerPlugin();
  const beforeToolCall = handlers.get("before_tool_call");
  const messageSending = handlers.get("message_sending");

  await beforeToolCall(
    {
      toolName: "exec",
      params: {
        command: "curl https://example.test?token=secret-token",
      },
    },
    {
      agentId: "main",
      sessionKey: "agent:main:test",
      sessionId: "session-test",
      runId: "run-exec",
      toolCallId: "tool-exec",
    },
  );

  await messageSending(
    {
      content: "secret message body",
      metadata: {
        channelId: "telegram",
      },
    },
    {
      agentId: "main",
      sessionKey: "agent:main:test",
      sessionId: "session-test",
      runId: "run-message",
      channelId: "telegram",
    },
  );

  const records = fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const beforeToolRecord = records.find((record) => record.hook === "before_tool_call");
  const messageRecord = records.find((record) => record.hook === "message_sending");

  assert.ok(beforeToolRecord);
  assert.ok(messageRecord);
  assert.equal("event" in beforeToolRecord, false);
  assert.equal("ctx" in beforeToolRecord, false);
  assert.equal("event" in messageRecord, false);
  assert.equal("ctx" in messageRecord, false);

  const logText = fs.readFileSync(logPath, "utf8");
  assert.doesNotMatch(logText, /secret-token/);
  assert.doesNotMatch(logText, /secret message body/);
});
