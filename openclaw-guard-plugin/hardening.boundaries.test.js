import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import plugin from "./index.js";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const logPath = path.join(pluginDir, "probe-events.jsonl");

const handlers = {};
plugin.register({
  on(name, handler) {
    handlers[name] = handler;
  },
});

function writeCredentials(store) {
  fs.writeFileSync(credentialsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function clearLog() {
  fs.writeFileSync(logPath, "", "utf8");
}

function runBeforeToolCall(toolName, agentId = "main") {
  return handlers.before_tool_call(
    {
      toolName,
      params: toolName === "apply_patch" ? "*** Begin Patch\n*** End Patch\n" : {},
    },
    { agentId, sessionKey: `agent:${agentId}:main` },
  );
}

function runMessageSending(agentId = "main") {
  return handlers.message_sending(
    {
      to: "@dummy",
      content: "hello",
      metadata: {
        channelId: "telegram",
      },
    },
    { agentId, sessionKey: `agent:${agentId}:main` },
  );
}

afterEach(() => {
  writeCredentials({ agents: {} });
  clearLog();
});

test("before_tool_call blocks apply_patch when no credential exists", async () => {
  writeCredentials({ agents: {} });

  const result = await runBeforeToolCall("apply_patch");
  assert.equal(result?.block, true);
  assert.match(result?.blockReason ?? "", /no credential|blocked/i);
});

test("before_tool_call allows apply_patch with code.write scope", async () => {
  const now = Math.floor(Date.now() / 1000);
  writeCredentials({
    agents: {
      main: {
        credentialId: "cred-main-write-1",
        agentId: "main",
        issuer: "local-demo",
        issuedAt: now,
        expiresAt: now + 3600,
        revoked: false,
        scope: {
          actions: ["code.write"],
        },
      },
    },
  });

  const result = await runBeforeToolCall("apply_patch");
  assert.equal(result, undefined);
});

test("before_tool_call blocks apply_patch when scope omits code.write", async () => {
  const now = Math.floor(Date.now() / 1000);
  writeCredentials({
    agents: {
      main: {
        credentialId: "cred-main-exec-1",
        agentId: "main",
        issuer: "local-demo",
        issuedAt: now,
        expiresAt: now + 3600,
        revoked: false,
        scope: {
          actions: ["exec.shell"],
        },
      },
    },
  });

  const result = await runBeforeToolCall("apply_patch");
  assert.equal(result?.block, true);
  assert.match(result?.blockReason ?? "", /does not authorize|outside/i);
});

test("message_sending blocks by default and allows with message scope", async () => {
  writeCredentials({ agents: {} });
  const blocked = await runMessageSending("main");
  assert.equal(blocked?.cancel, true);

  const now = Math.floor(Date.now() / 1000);
  writeCredentials({
    agents: {
      main: {
        credentialId: "cred-main-msg-1",
        agentId: "main",
        issuer: "local-demo",
        issuedAt: now,
        expiresAt: now + 3600,
        revoked: false,
        scope: {
          actions: ["message.send"],
        },
      },
    },
  });
  const allowed = await runMessageSending("main");
  assert.equal(allowed, undefined);
});

test("decision events are hash-chained for audit verification", async () => {
  const now = Math.floor(Date.now() / 1000);
  writeCredentials({
    agents: {
      main: {
        credentialId: "cred-main-msg-1",
        agentId: "main",
        issuer: "local-demo",
        issuedAt: now,
        expiresAt: now + 3600,
        revoked: false,
        scope: {
          actions: ["message.send", "code.write"],
        },
      },
    },
  });

  await runMessageSending("main");
  await runBeforeToolCall("apply_patch", "main");

  const lines = fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.ok(lines.length >= 2);
  const first = lines[0];
  const second = lines[1];
  assert.equal(typeof first.seq, "number");
  assert.equal(typeof first.hash, "string");
  assert.equal(second.prevHash, first.hash);
});
