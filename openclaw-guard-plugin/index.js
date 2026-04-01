import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(pluginDir, "probe-events.jsonl");
const credentialsPath = path.join(pluginDir, "local-credentials.json");

const ACTION_MAP = {
  "shell.exec": "exec.shell",
  exec: "exec.shell"
};

function writeEvent(record) {
  fs.appendFileSync(logPath, `${JSON.stringify({
    ts: new Date().toISOString(),
    ...record
  })}\n`, "utf8");
}

function readCredentialStore() {
  if (!fs.existsSync(credentialsPath)) {
    return { agents: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.agents && typeof parsed.agents === "object") {
      return parsed;
    }
  } catch (error) {
    writeEvent({
      hook: "credential_store_error",
      error: String(error)
    });
  }

  return { agents: {} };
}

function mapToolToAction(toolName) {
  return ACTION_MAP[toolName] ?? null;
}

function buildDecision({
  agentId,
  toolName,
  action,
  allowed,
  reason,
  message,
  credential
}) {
  return {
    hook: "guard_decision",
    agentId,
    toolName,
    action,
    allowed,
    reason,
    message,
    credentialId: credential?.credentialId
  };
}

function evaluateShellExec({ agentId, toolName }) {
  const action = mapToolToAction(toolName);
  if (action !== "exec.shell") {
    return null;
  }

  const toolLabel = toolName ?? "exec";

  if (!agentId) {
    return {
      allowed: false,
      reason: "MISSING_AGENT_ID",
      message: `Tessera Guard blocked ${toolLabel} because OpenClaw did not provide an agentId.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: missing agentId for credential lookup.`
    };
  }

  const store = readCredentialStore();
  const credential = store.agents?.[agentId] ?? null;

  if (!credential) {
    return {
      allowed: false,
      reason: "NO_CREDENTIAL",
      message: `Tessera Guard blocked ${toolLabel} because agent "${agentId}" has no local Tessera credential authorizing exec.shell.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: no credential found for agent "${agentId}" authorizing exec.shell.`,
      credential
    };
  }

  if (credential.agentId !== agentId) {
    return {
      allowed: false,
      reason: "AGENT_MISMATCH",
      message: `Tessera Guard blocked ${toolLabel} because credential "${credential.credentialId}" is bound to a different agent.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: credential "${credential.credentialId}" does not match agent "${agentId}".`,
      credential
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(credential.expiresAt) <= now) {
    return {
      allowed: false,
      reason: "EXPIRED",
      message: `Tessera Guard blocked ${toolLabel} because credential "${credential.credentialId}" has expired.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: credential "${credential.credentialId}" has expired.`,
      credential
    };
  }

  if (credential.revoked === true) {
    return {
      allowed: false,
      reason: "REVOKED",
      message: `Tessera Guard blocked ${toolLabel} because credential "${credential.credentialId}" has been revoked.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: credential "${credential.credentialId}" has been revoked.`,
      credential
    };
  }

  const actions = credential.scope?.actions;
  if (!Array.isArray(actions) || !actions.includes("exec.shell")) {
    return {
      allowed: false,
      reason: "OUT_OF_SCOPE",
      message: `Tessera Guard blocked ${toolLabel} because credential "${credential.credentialId}" does not include exec.shell scope.`,
      blockReason: `Tessera Guard blocked ${toolLabel}: credential "${credential.credentialId}" does not authorize exec.shell.`,
      credential
    };
  }

  return {
    allowed: true,
    reason: "AUTHORIZED",
    message: `Tessera Guard allowed ${toolLabel} for agent "${agentId}" via credential "${credential.credentialId}".`,
    credential
  };
}

export default {
  id: "tessera-guard-local",
  name: "Tessera Guard Local",
  description: "Local Tessera Guard enforcement for OpenClaw shell.exec tool calls.",
  register(api) {
    writeEvent({
      hook: "plugin_loaded"
    });

    api.on("before_tool_call", async (event, ctx) => {
      writeEvent({
        hook: "before_tool_call",
        event,
        ctx
      });

      const decision = evaluateShellExec({
        agentId: ctx.agentId,
        toolName: event.toolName
      });

      if (!decision) {
        return;
      }

      writeEvent(buildDecision({
        agentId: ctx.agentId,
        toolName: event.toolName,
        action: mapToolToAction(event.toolName),
        ...decision
      }));

      if (!decision.allowed) {
        return {
          block: true,
          blockReason: decision.blockReason
        };
      }
    });

    api.on("message_sending", async (event, ctx) => {
      writeEvent({
        hook: "message_sending",
        event,
        ctx
      });
    });
  }
};
