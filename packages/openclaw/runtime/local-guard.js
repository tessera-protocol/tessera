export const TESSERA_ACTIONS = {
  EXEC_SHELL: "exec.shell",
  MESSAGE_SEND: "message.send"
};

const SUPPORTED_ACTIONS = new Set(Object.values(TESSERA_ACTIONS));

export function evaluateLocalGuard({ agentId, action, credential, actionLabel }) {
  if (!SUPPORTED_ACTIONS.has(action)) {
    return deny(
      "UNKNOWN_ACTION",
      `Tessera Guard does not recognise ${actionLabel}.`,
      "This action class is not guarded yet.",
      action
    );
  }

  if (!agentId) {
    return deny(
      "MISSING_AGENT_ID",
      `Tessera Guard blocked ${actionLabel} because OpenClaw did not provide an agentId.`,
      "The runtime could not determine which agent is attempting this action.",
      action
    );
  }

  if (!credential) {
    return deny(
      "NO_CREDENTIAL",
      `Tessera Guard blocked ${actionLabel} because agent "${agentId}" has no local Tessera credential authorizing ${action}.`,
      "This agent needs a Tessera credential before it can perform this action.",
      action
    );
  }

  if (credential.agentId !== agentId) {
    return deny(
      "AGENT_MISMATCH",
      `Tessera Guard blocked ${actionLabel} because credential "${credential.credentialId}" is bound to a different agent.`,
      "This credential does not authorize the current agent instance.",
      action,
      credential
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(credential.expiresAt) <= now) {
    return deny(
      "EXPIRED",
      `Tessera Guard blocked ${actionLabel} because credential "${credential.credentialId}" has expired.`,
      "The user needs to issue a fresh credential before this action can run.",
      action,
      credential
    );
  }

  if (credential.revoked === true) {
    return deny(
      "REVOKED",
      `Tessera Guard blocked ${actionLabel} because credential "${credential.credentialId}" has been revoked.`,
      "The user revoked this credential, so the action is blocked immediately.",
      action,
      credential
    );
  }

  const actions = credential.scope?.actions;
  if (!Array.isArray(actions) || !actions.includes(action)) {
    return deny(
      "OUT_OF_SCOPE",
      `Tessera Guard blocked ${actionLabel} because credential "${credential.credentialId}" does not authorize ${action}.`,
      `This agent is outside its delegated scope for ${action}.`,
      action,
      credential
    );
  }

  return {
    allowed: true,
    blockedBy: "tessera_guard",
    reason: "AUTHORIZED",
    reasonCode: "AUTHORIZED",
    message: `Tessera Guard allowed ${actionLabel} for agent "${agentId}" via credential "${credential.credentialId}".`,
    userFacingMessage: `Tessera Guard authorizes ${actionLabel}.`,
    action,
    credentialId: credential.credentialId
  };
}

function deny(reasonCode, message, userFacingMessage, action, credential) {
  return {
    allowed: false,
    blockedBy: "tessera_guard",
    reason: reasonCode,
    reasonCode,
    message,
    userFacingMessage,
    action,
    credentialId: credential?.credentialId
  };
}
