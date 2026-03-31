import type { AgentScope, TesseraCredential } from '@tessera-protocol/sdk';
import {
  isScopeContained,
  verifyCredentialSignature,
  verifyDelegationSignature,
} from '@tessera-protocol/sdk/dist/crypto.js';
import { classifyAction } from './actions.js';
import {
  describeScope,
  formatCurrencyAmount,
  isActionAllowedByScope,
  parseAgentCredential,
  type SerializedAgentCredentialPayload,
} from './token.js';

export interface GuardConfig {
  credential: string;
  trustedIssuerKeys: string[];
  issuerUrl?: string;
  offlineMode?: boolean;
  onDeny?: (action: string, reason: string) => void;
  onAllow?: (action: string) => void;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  scope?: object;
  suggestion?: string;
}

export interface GuardStatus {
  credentialValid: boolean;
  expiresIn: string;
  scope: object;
}

export interface GuardInstance {
  check(action: string, resource?: object): Promise<GuardResult>;
  getStatus(): GuardStatus;
  getAgentMessage(): string;
}

const INVALID_CREDENTIAL_REASON = 'Invalid or corrupted credential';
const INVALID_CREDENTIAL_SUGGESTION = 'Ask the user to re-issue the Tessera credential';

export function createGuard(config: GuardConfig): GuardInstance {
  if (!Array.isArray(config.trustedIssuerKeys) || config.trustedIssuerKeys.length === 0) {
    throw new Error('trustedIssuerKeys is required — the guard must know which issuers to trust');
  }

  let parsed: SerializedAgentCredentialPayload | null = null;
  let degradedReason: string | null = null;

  try {
    parsed = parseAgentCredential(config.credential).payload;
  } catch {
    degradedReason = INVALID_CREDENTIAL_REASON;
  }

  const issuerUrl = config.issuerUrl ?? parsed?.metadata?.issuerUrl ?? 'http://localhost:3001';
  // Default to offline mode so the guard works out of the box; online mode adds
  // issuer-backed revocation checks and requires a running issuer service.
  const offlineMode = config.offlineMode ?? true;

  return {
    async check(action: string, resource?: object): Promise<GuardResult> {
      const classifiedAction = classifyAction(action) ?? action;
      if (degradedReason || !parsed) {
        const result = {
          allowed: false,
          reason: INVALID_CREDENTIAL_REASON,
          scope: {},
          suggestion: INVALID_CREDENTIAL_SUGGESTION,
        };
        config.onDeny?.(classifiedAction, result.reason);
        return result;
      }

      const localValidation = validateTokenLocally(parsed, config.trustedIssuerKeys);
      if (!localValidation.valid) {
        const result = deny(classifiedAction, localValidation.reason!, parsed.delegation.scope);
        config.onDeny?.(classifiedAction, result.reason!);
        return result;
      }

      if (!classifyAction(action)) {
        const result = deny(
          classifiedAction,
          `Action "${action}" is not recognised by Tessera Guard`,
          parsed.delegation.scope,
        );
        config.onDeny?.(classifiedAction, result.reason!);
        return result;
      }

      const scopeResult = isActionAllowedByScope(
        classifiedAction,
        parsed.delegation.scope,
        (resource ?? {}) as Record<string, unknown>,
      );
      if (!scopeResult.allowed) {
        const result = deny(classifiedAction, scopeResult.reason!, parsed.delegation.scope);
        config.onDeny?.(classifiedAction, result.reason!);
        return result;
      }

      if (!offlineMode) {
        const onlineResult = await verifyOnline({
          issuerUrl,
          token: config.credential,
          action: classifiedAction,
          resource,
        });
        if (!onlineResult.allowed) {
          const result = deny(classifiedAction, onlineResult.reason!, parsed.delegation.scope);
          config.onDeny?.(classifiedAction, result.reason!);
          return result;
        }
      }

      config.onAllow?.(classifiedAction);
      return {
        allowed: true,
        scope: parsed.delegation.scope,
      };
    },

    getStatus() {
      if (degradedReason || !parsed) {
        return {
          credentialValid: false,
          expiresIn: 'N/A',
          scope: {},
        };
      }

      const validation = validateTokenLocally(parsed, config.trustedIssuerKeys);
      return {
        credentialValid: validation.valid,
        expiresIn: formatDuration(parsed.delegation.expiresAt),
        scope: parsed.delegation.scope,
      };
    },

    getAgentMessage() {
      if (degradedReason || !parsed) {
        return 'My Tessera credential is invalid or corrupted. I cannot perform any sensitive actions. Please ask the user to re-issue the credential from the Tessera app.';
      }

      const validation = validateTokenLocally(parsed, config.trustedIssuerKeys);
      if (!validation.valid) {
        return `I have a Tessera credential, but it is not currently valid: ${validation.reason}.`;
      }

      const positives = describeScope(parsed.delegation.scope);
      const negatives: string[] = [];
      if (!(parsed.delegation.scope as Record<string, unknown>).canExecShell) {
        negatives.push('run shell commands');
      }
      const maxRecipients = (parsed.delegation.scope as Record<string, unknown>).maxRecipients;
      if (typeof maxRecipients === 'number') {
        negatives.push(`send emails to more than ${maxRecipients} recipients`);
      }

      const sentences = [
        `I have a Tessera credential that allows me to ${joinNaturalList(positives)}.`,
      ];

      if (negatives.length > 0) {
        sentences.push(`I cannot ${joinNaturalList(negatives)}.`);
      }

      sentences.push(
        `My credential expires ${formatDuration(parsed.delegation.expiresAt)}.`,
      );
      sentences.push(
        'If you need me to do something outside these permissions, you can issue a broader credential from the Tessera app.',
      );

      return sentences.join(' ');
    },
  };
}

function validateTokenLocally(
  payload: SerializedAgentCredentialPayload,
  trustedIssuerKeys: string[],
): { valid: true } | { valid: false; reason: string } {
  if (payload.delegation.status === 'revoked' || payload.delegation.revokedAt) {
    return { valid: false, reason: 'Credential has been revoked' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.credential.expiresAt <= now) {
    return { valid: false, reason: 'Credential has expired' };
  }

  if (payload.delegation.expiresAt <= now) {
    return { valid: false, reason: 'Agent delegation has expired' };
  }

  if (payload.delegation.parentCommitment !== payload.credential.identityCommitment) {
    return { valid: false, reason: 'Delegation does not match the parent credential' };
  }

  if (
    payload.delegation.parentScope &&
    !isScopeContained(payload.delegation.scope, payload.delegation.parentScope)
  ) {
    return { valid: false, reason: 'Delegated scope exceeds parent scope' };
  }

  if (!trustedIssuerKeys.includes(payload.credential.issuerPublicKey)) {
    return { valid: false, reason: 'Credential signed by untrusted issuer' };
  }

  const credentialValid = verifyCredentialSignature(
    payload.credential as TesseraCredential,
    trustedIssuerKeys,
  );
  if (!credentialValid) {
    return { valid: false, reason: 'Issuer signature verification failed' };
  }

  if (
    !verifyDelegationSignature(
      payload.delegation,
      payload.credential.holderPublicKey,
    )
  ) {
    return { valid: false, reason: 'Delegation signature verification failed' };
  }

  return { valid: true };
}

async function verifyOnline(params: {
  issuerUrl: string;
  token: string;
  action: string;
  resource?: object;
}): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const response = await fetch(new URL('/guard/check', params.issuerUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        token: params.token,
        action: params.action,
        resource: params.resource ?? null,
      }),
    });

    if (!response.ok) {
      return {
        allowed: false,
        reason: `Issuer check failed with HTTP ${response.status}`,
      };
    }

    const payload = await response.json() as { allowed?: boolean; reason?: string };
    return {
      allowed: payload.allowed === true,
      reason: payload.reason ?? (payload.allowed === true ? undefined : 'Issuer denied credential'),
    };
  } catch (error) {
    return {
      allowed: false,
      reason: `Issuer verification unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

function deny(action: string, reason: string, scope: AgentScope): GuardResult {
  return {
    allowed: false,
    reason,
    scope,
    suggestion: buildSuggestion(action, reason, scope),
  };
}

function buildSuggestion(action: string, reason: string, scope: AgentScope): string {
  if (action === 'payment.intent' && typeof scope.maxTransactionValue === 'number') {
    return `This Tessera credential only allows purchases up to ${formatCurrencyAmount(scope.maxTransactionValue, scope.currency ?? 'USD')}. Ask the user to issue a broader payment credential if they want this action to proceed.`;
  }

  if (action === 'exec.shell') {
    return 'This agent is not allowed to run shell commands. Ask the user to issue a credential that explicitly includes shell execution.';
  }

  if (reason.includes('recipient')) {
    return 'This credential has a recipient limit for outbound messaging. Ask the user to issue a broader messaging credential if they want bulk delivery.';
  }

  return 'Ask the user to issue a broader Tessera credential if they want this action to proceed.';
}

function formatDuration(expiresAt: number): string {
  const seconds = expiresAt - Math.floor(Date.now() / 1000);
  if (seconds <= 0) {
    return 'now';
  }

  const days = Math.floor(seconds / 86400);
  if (days > 0) {
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(seconds / 3600);
  if (hours > 0) {
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }

  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function joinNaturalList(items: string[]): string {
  if (items.length === 0) {
    return 'do nothing';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
