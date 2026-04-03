import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const probeHome = process.env.OPENCLAW_HOME ?? path.join(path.dirname(pluginDir), ".openclaw-probe-home");
const logPath = path.join(
  pluginDir,
  `probe-events-${crypto.createHash("sha256").update(path.resolve(probeHome, ".openclaw"), "utf8").digest("hex").slice(0, 12)}.jsonl`,
);

process.env.OPENCLAW_HOME = probeHome;

const registry = await import("/opt/homebrew/lib/node_modules/openclaw/dist/plugin-registry-0rdoDL6f.js");
const runtime = await import("/opt/homebrew/lib/node_modules/openclaw/dist/pi-embedded-BaSvmUpW.js");

function truncateLog() {
  fs.writeFileSync(logPath, "", "utf8");
}

function writeCredentials(store) {
  fs.writeFileSync(credentialsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function printStep(title) {
  console.log(`\n== ${title} ==`);
}

async function runShellProbe(agentId) {
  registry.ensurePluginRegistryLoaded({ scope: "all" });
  return runtime.gs({
    toolName: "shell.exec",
    params: { command: "pwd" },
    toolCallId: `probe-${agentId}-${Date.now()}`,
    ctx: {
      agentId,
      sessionKey: `session-${agentId}`,
      sessionId: `session-id-${agentId}`,
      runId: `run-${agentId}`
    }
  });
}

const now = Math.floor(Date.now() / 1000);

truncateLog();

printStep("1. No credential");
writeCredentials({ agents: {} });
console.log(await runShellProbe("agent-shell"));

printStep("2. Valid exec.shell credential");
writeCredentials({
  agents: {
    "agent-shell": {
      credentialId: "cred-shell-1",
      agentId: "agent-shell",
      issuer: "local-demo",
      issuedAt: now,
      expiresAt: now + 3600,
      revoked: false,
      scope: {
        actions: ["exec.shell"]
      }
    }
  }
});
console.log(await runShellProbe("agent-shell"));

printStep("3. Revoked credential");
writeCredentials({
  agents: {
    "agent-shell": {
      credentialId: "cred-shell-1",
      agentId: "agent-shell",
      issuer: "local-demo",
      issuedAt: now,
      expiresAt: now + 3600,
      revoked: true,
      scope: {
        actions: ["exec.shell"]
      }
    }
  }
});
console.log(await runShellProbe("agent-shell"));

printStep("Recent plugin log");
console.log(fs.readFileSync(logPath, "utf8"));
