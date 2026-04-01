import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateLocalGuard,
  TESSERA_ACTIONS
} from "../packages/openclaw/runtime/local-guard.js";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(pluginDir, "probe-events.jsonl");
const credentialsPath = path.join(pluginDir, "local-credentials.json");

const ACTION_MAP = {
  "shell.exec": TESSERA_ACTIONS.EXEC_SHELL,
  exec: TESSERA_ACTIONS.EXEC_SHELL
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
  credential,
  credentialId
}) {
  return {
    hook: "guard_decision",
    agentId,
    toolName,
    action,
    allowed,
    reason,
    message,
    credentialId: credentialId ?? credential?.credentialId
  };
}

function getCredentialForAgent(agentId) {
  const store = readCredentialStore();
  return store.agents?.[agentId] ?? null;
}

function evaluateAction({ agentId, action, actionLabel }) {
  return evaluateLocalGuard({
    agentId,
    action,
    actionLabel,
    credential: getCredentialForAgent(agentId)
  });
}

function toToolBlockReason(decision, toolLabel, agentId) {
  if (decision.reason === "NO_CREDENTIAL") {
    return `Tessera Guard blocked ${toolLabel}: no credential found for agent "${agentId ?? "unknown"}" authorizing ${decision.action}.`;
  }

  if (decision.credentialId && decision.reason === "REVOKED") {
    return `Tessera Guard blocked ${toolLabel}: credential "${decision.credentialId}" has been revoked.`;
  }

  if (decision.credentialId && decision.reason === "EXPIRED") {
    return `Tessera Guard blocked ${toolLabel}: credential "${decision.credentialId}" has expired.`;
  }

  if (decision.credentialId && decision.reason === "AGENT_MISMATCH") {
    return `Tessera Guard blocked ${toolLabel}: credential "${decision.credentialId}" does not match the current agent.`;
  }

  if (decision.credentialId && decision.reason === "OUT_OF_SCOPE") {
    return `Tessera Guard blocked ${toolLabel}: credential "${decision.credentialId}" does not authorize ${decision.action}.`;
  }

  return `Tessera Guard blocked ${toolLabel}: ${decision.message}`;
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

      const action = mapToolToAction(event.toolName);
      if (!action) {
        return;
      }

      const decision = evaluateAction({
        agentId: ctx.agentId,
        action,
        actionLabel: event.toolName ?? "tool"
      });

      writeEvent(buildDecision({
        agentId: ctx.agentId,
        toolName: event.toolName,
        action: mapToolToAction(event.toolName),
        ...decision
      }));

      if (!decision.allowed) {
        return {
          block: true,
          blockReason: toToolBlockReason(decision, event.toolName ?? "tool", ctx.agentId)
        };
      }
    });

    api.on("message_sending", async (event, ctx) => {
      writeEvent({
        hook: "message_sending",
        event,
        ctx
      });

      const decision = evaluateAction({
        agentId: ctx.agentId,
        action: TESSERA_ACTIONS.MESSAGE_SEND,
        actionLabel: "message.send"
      });

      writeEvent(buildDecision({
        agentId: ctx.agentId,
        toolName: "message.send",
        action: TESSERA_ACTIONS.MESSAGE_SEND,
        ...decision,
        credential: decision.credentialId ? { credentialId: decision.credentialId } : undefined
      }));

      if (!decision.allowed) {
        return {
          cancel: true,
          content: decision.message
        };
      }
    });
  }
};
