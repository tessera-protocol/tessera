import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  evaluateLocalGuard,
  TESSERA_ACTIONS
} from "../packages/openclaw/runtime/local-guard.js";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(pluginDir, "local-credentials.json");
const debugPayloadLogging = process.env.TESSERA_GUARD_DEBUG_LOG_PAYLOADS === "1";
const openclawHome = resolveOpenClawHome();
const logPath = path.join(pluginDir, getProbeLogFileName(openclawHome));

const ACTION_MAP = {
  "shell.exec": TESSERA_ACTIONS.EXEC_SHELL,
  exec: TESSERA_ACTIONS.EXEC_SHELL,
  apply_patch: TESSERA_ACTIONS.CODE_WRITE,
  "file.write": TESSERA_ACTIONS.CODE_WRITE,
  "fs.write": TESSERA_ACTIONS.CODE_WRITE,
  "workspace.write": TESSERA_ACTIONS.CODE_WRITE
};

let eventChainState = null;

function resolveOpenClawHome() {
  const raw = process.env.OPENCLAW_HOME;
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  return path.resolve(raw.trim(), ".openclaw");
}

function getProbeLogFileName(runtimeHome) {
  if (!runtimeHome) {
    return "probe-events.jsonl";
  }

  const suffix = crypto.createHash("sha256").update(runtimeHome, "utf8").digest("hex").slice(0, 12);
  return `probe-events-${suffix}.jsonl`;
}

function initializeEventChainState() {
  if (eventChainState) {
    return eventChainState;
  }

  const initial = {
    seq: 0,
    hash: null
  };

  if (!fs.existsSync(logPath)) {
    eventChainState = initial;
    return eventChainState;
  }

  try {
    const lines = fs
      .readFileSync(logPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const tail = lines.at(-1);
    if (!tail) {
      eventChainState = initial;
      return eventChainState;
    }
    const parsed = JSON.parse(tail);
    eventChainState = {
      seq: typeof parsed.seq === "number" ? parsed.seq : 0,
      hash: typeof parsed.hash === "string" ? parsed.hash : null
    };
    return eventChainState;
  } catch {
    eventChainState = initial;
    return eventChainState;
  }
}

function computeDecisionHash(input) {
  const normalized = JSON.stringify({
    seq: input.seq,
    prevHash: input.prevHash,
    ts: input.ts,
    openclawHome: input.openclawHome ?? null,
    hook: input.hook,
    action: input.action ?? null,
    allowed: input.allowed ?? null,
    reason: input.reason ?? null,
    message: input.message ?? null,
    agentId: input.agentId ?? null,
    toolName: input.toolName ?? null,
    credentialId: input.credentialId ?? null
  });
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function writeEvent(record) {
  try {
    const chain = initializeEventChainState();
    const seq = chain.seq + 1;
    const ts = new Date().toISOString();
    const prevHash = chain.hash;
    const hook = typeof record.hook === "string" ? record.hook : "event";
    const hash = computeDecisionHash({
      seq,
      prevHash,
      ts,
      openclawHome,
      hook,
      ...record
    });
    const entry = {
      seq,
      prevHash,
      hash,
      ts,
      openclawHome,
      hook,
      ...record
    };

    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    eventChainState = { seq, hash };
  } catch (error) {
    process.stderr.write(`[tessera-guard] failed to append audit event: ${String(error)}\n`);
  }
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

function sanitizeHookContext(ctx) {
  return {
    agentId: ctx?.agentId ?? null,
    sessionKey: ctx?.sessionKey ?? null,
    sessionId: ctx?.sessionId ?? null,
    runId: ctx?.runId ?? null,
    toolCallId: ctx?.toolCallId ?? null
  };
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
      const hookRecord = {
        hook: "before_tool_call",
        toolName: event?.toolName ?? null,
        action: mapToolToAction(event?.toolName),
        ...sanitizeHookContext(ctx)
      };

      writeEvent(
        debugPayloadLogging
          ? { ...hookRecord, event, ctx }
          : hookRecord
      );

      const action = mapToolToAction(event.toolName);
      if (!action) {
        return;
      }

      let decision;
      try {
        decision = evaluateAction({
          agentId: ctx.agentId,
          action,
          actionLabel: event.toolName ?? "tool"
        });
      } catch (error) {
        decision = {
          allowed: false,
          reason: "GUARD_EVALUATION_FAILED",
          message: `Tessera Guard could not evaluate ${event.toolName ?? "tool"} and failed closed.`,
          action,
          credentialId: undefined
        };
        writeEvent({
          hook: "guard_error",
          agentId: ctx.agentId,
          toolName: event.toolName,
          action,
          error: String(error)
        });
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
          blockReason: toToolBlockReason(decision, event.toolName ?? "tool", ctx.agentId)
        };
      }
    });

    api.on("message_sending", async (event, ctx) => {
      const hookRecord = {
        hook: "message_sending",
        toolName: "message.send",
        action: TESSERA_ACTIONS.MESSAGE_SEND,
        channelId: ctx?.channelId ?? event?.metadata?.channelId ?? null,
        ...sanitizeHookContext(ctx)
      };

      writeEvent(
        debugPayloadLogging
          ? { ...hookRecord, event, ctx }
          : hookRecord
      );

      let decision;
      try {
        decision = evaluateAction({
          agentId: ctx.agentId,
          action: TESSERA_ACTIONS.MESSAGE_SEND,
          actionLabel: "message.send"
        });
      } catch (error) {
        decision = {
          allowed: false,
          reason: "GUARD_EVALUATION_FAILED",
          message: "Tessera Guard failed while validating outbound message.send and denied the send.",
          action: TESSERA_ACTIONS.MESSAGE_SEND,
          credentialId: undefined
        };
        writeEvent({
          hook: "guard_error",
          agentId: ctx.agentId,
          toolName: "message.send",
          action: TESSERA_ACTIONS.MESSAGE_SEND,
          error: String(error)
        });
      }

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
