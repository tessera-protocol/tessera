import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import plugin from "./index.js";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const logPath = path.join(pluginDir, "probe-events.jsonl");

const handlers = {};

plugin.register({
  on(name, handler) {
    handlers[name] = handler;
  }
});

function writeCredentials(store) {
  fs.writeFileSync(credentialsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function truncateLog() {
  fs.writeFileSync(logPath, "", "utf8");
}

async function runMessageHook(agentId) {
  return handlers.message_sending(
    {
      to: "@dummy",
      content: "hello from Tessera Guard",
      metadata: {
        channelId: "telegram"
      }
    },
    {
      agentId,
      channelId: "telegram",
      conversationId: "conversation-main",
      sessionKey: "agent:main:main",
      sessionId: "session-main",
      runId: `run-${agentId}`
    }
  );
}

function printStep(title) {
  console.log(`\n== ${title} ==`);
}

const now = Math.floor(Date.now() / 1000);

truncateLog();

printStep("1. No credential");
writeCredentials({ agents: {} });
console.log(await runMessageHook("main"));

printStep("2. Valid message.send credential");
writeCredentials({
  agents: {
    main: {
      credentialId: "cred-main-message-1",
      agentId: "main",
      issuer: "local-demo",
      issuedAt: now,
      expiresAt: now + 3600,
      revoked: false,
      scope: {
        actions: ["message.send"]
      }
    }
  }
});
console.log(await runMessageHook("main"));

printStep("3. Revoked credential");
writeCredentials({
  agents: {
    main: {
      credentialId: "cred-main-message-1",
      agentId: "main",
      issuer: "local-demo",
      issuedAt: now,
      expiresAt: now + 3600,
      revoked: true,
      scope: {
        actions: ["message.send"]
      }
    }
  }
});
console.log(await runMessageHook("main"));

printStep("Recent plugin log");
console.log(fs.readFileSync(logPath, "utf8"));
