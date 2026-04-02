import type { AgentDelegation, AgentScope, TesseraCredential } from '@tessera-protocol/sdk';
import { createHash } from 'node:crypto';

export interface SerializedAgentCredentialPayload {
  version: 'tessera.openclaw/v1';
  credential: TesseraCredential;
  delegation: AgentDelegation & {
    id?: string;
    status?: 'active' | 'revoked';
    revokedAt?: number;
  };
  metadata?: {
    agentName?: string;
  };
}

export interface ParsedAgentCredential {
  payload: SerializedAgentCredentialPayload;
  token: string;
}

export function serializeAgentCredential(
  payload: SerializedAgentCredentialPayload,
): string {
  const header = {
    alg: 'EdDSA',
    typ: 'tessera+agent',
    v: payload.version,
  };

  return [
    encodeBase64UrlJson(header),
    encodeBase64UrlJson(payload),
    encodeBase64Url(payload.delegation.parentSignature),
  ].join('.');
}

export function parseAgentCredential(token: string): ParsedAgentCredential {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Tessera credential token format');
  }

  const payload = decodeBase64UrlJson<SerializedAgentCredentialPayload>(parts[1]);
  if (payload.version !== 'tessera.openclaw/v1') {
    throw new Error('Unsupported Tessera credential token version');
  }

  if (!payload.credential || !payload.delegation) {
    throw new Error('Tessera credential token is missing credential or delegation data');
  }

  return { payload, token };
}

export function getDelegationId(
  delegation: Pick<AgentDelegation, 'parentCommitment' | 'agentName' | 'issuedAt' | 'expiresAt'> & {
    id?: string;
  },
): string {
  if (typeof delegation.id === 'string' && delegation.id.length > 0) {
    return delegation.id;
  }

  return getLegacyDelegationId(delegation);
}

export function getLegacyDelegationId(
  delegation: Pick<AgentDelegation, 'parentCommitment' | 'agentName' | 'issuedAt' | 'expiresAt'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        parentCommitment: delegation.parentCommitment,
        agentName: delegation.agentName,
        issuedAt: delegation.issuedAt,
        expiresAt: delegation.expiresAt,
      }),
      'utf8',
    )
    .digest('hex');
}

export function formatCurrencyAmount(
  amount: number,
  currency: string,
): string {
  if (currency.toUpperCase() === 'GBP') {
    return `£${amount}`;
  }

  if (currency.toUpperCase() === 'EUR') {
    return `€${amount}`;
  }

  return `${amount} ${currency.toUpperCase()}`;
}

export function isActionAllowedByScope(
  action: string,
  scope: AgentScope,
  resource: Record<string, unknown> | undefined,
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'message.send':
    case 'content.publish':
      if (!canPost(scope)) {
        return { allowed: false, reason: 'Credential does not allow message publishing' };
      }
      return enforceRecipientLimit(scope, resource);
    case 'email.send': {
      if (!canPost(scope)) {
        return { allowed: false, reason: 'Credential does not allow email sending' };
      }
      const recipientCheck = enforceRecipientLimit(scope, resource);
      if (!recipientCheck.allowed) {
        return recipientCheck;
      }
      const domainCheck = enforceDomainRestrictions(scope, resource);
      if (!domainCheck.allowed) {
        return domainCheck;
      }
      return { allowed: true };
    }
    case 'payment.intent':
      return enforcePaymentScope(scope, resource);
    case 'exec.shell':
      if (!canExecShell(scope)) {
        return { allowed: false, reason: 'Credential does not allow shell execution' };
      }
      return { allowed: true };
    default:
      return { allowed: false, reason: `Action "${action}" is not recognised by Tessera Guard` };
  }
}

export function canPost(scope: AgentScope): boolean {
  return Boolean(
    scope.canPost === true ||
    (scope as Record<string, unknown>).post === true ||
    (scope as Record<string, unknown>).messages === true,
  );
}

export function canTransact(scope: AgentScope): boolean {
  return Boolean(
    scope.canTransact === true ||
    (scope as Record<string, unknown>).transact === true,
  );
}

export function canExecShell(scope: AgentScope): boolean {
  return Boolean(
    (scope as Record<string, unknown>).canExecShell === true ||
    (scope as Record<string, unknown>).shell === true ||
    (scope as Record<string, unknown>).execShell === true,
    );
}

export function describeScope(scope: AgentScope): string[] {
  const descriptions: string[] = [];

  if (canPost(scope)) {
    descriptions.push('send messages');
  }

  if (canTransact(scope)) {
    const limit = typeof scope.maxTransactionValue === 'number'
      ? `make purchases up to ${formatCurrencyAmount(scope.maxTransactionValue, scope.currency ?? 'USD')}`
      : 'make purchases';
    descriptions.push(limit);
  }

  if (canExecShell(scope)) {
    descriptions.push('run shell commands');
  }

  if (!descriptions.length) {
    descriptions.push('perform no sensitive actions');
  }

  return descriptions;
}

function enforceRecipientLimit(
  scope: AgentScope,
  resource: Record<string, unknown> | undefined,
): { allowed: boolean; reason?: string } {
  const recipientCount = toNumber(resource?.recipientCount);
  const maxRecipients = toNumber((scope as Record<string, unknown>).maxRecipients);

  if (
    recipientCount !== undefined &&
    maxRecipients !== undefined &&
    recipientCount > maxRecipients
  ) {
    return {
      allowed: false,
      reason: `Credential only allows up to ${maxRecipients} recipients`,
    };
  }

  return { allowed: true };
}

function enforceDomainRestrictions(
  scope: AgentScope,
  resource: Record<string, unknown> | undefined,
): { allowed: boolean; reason?: string } {
  const allowedDomains = ((scope as Record<string, unknown>).allowedDomains ?? []) as unknown;
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
    return { allowed: true };
  }

  const recipientDomains = resource?.recipientDomains;
  if (!Array.isArray(recipientDomains)) {
    return { allowed: true };
  }

  const normalizedAllowed = allowedDomains.map(String);
  const invalidDomain = recipientDomains
    .map(String)
    .find((domain) => !normalizedAllowed.includes(domain));

  if (invalidDomain) {
    return {
      allowed: false,
      reason: `Credential does not allow email delivery to ${invalidDomain}`,
    };
  }

  return { allowed: true };
}

function enforcePaymentScope(
  scope: AgentScope,
  resource: Record<string, unknown> | undefined,
): { allowed: boolean; reason?: string } {
  if (!canTransact(scope)) {
    return { allowed: false, reason: 'Credential does not allow payments' };
  }

  const amount = toNumber(resource?.amount);
  if (
    amount !== undefined &&
    typeof scope.maxTransactionValue === 'number' &&
    amount > scope.maxTransactionValue
  ) {
    return {
      allowed: false,
      reason: `Credential only allows payments up to ${formatCurrencyAmount(scope.maxTransactionValue, scope.currency ?? 'USD')}`,
    };
  }

  const resourceCurrency = typeof resource?.currency === 'string' ? resource.currency : undefined;
  if (
    resourceCurrency &&
    typeof scope.currency === 'string' &&
    scope.currency.toUpperCase() !== resourceCurrency.toUpperCase()
  ) {
    return {
      allowed: false,
      reason: `Credential only allows ${scope.currency.toUpperCase()} transactions`,
    };
  }

  const allowedCategories = scope.allowedCategories;
  const category = typeof resource?.category === 'string' ? resource.category : undefined;
  if (
    category &&
    Array.isArray(allowedCategories) &&
    allowedCategories.length > 0 &&
    !allowedCategories.includes(category)
  ) {
    return {
      allowed: false,
      reason: `Credential does not allow ${category} purchases`,
    };
  }

  return { allowed: true };
}

function encodeBase64UrlJson(value: unknown): string {
  return encodeBase64Url(JSON.stringify(value));
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(normalizeBase64Url(value), 'base64').toString('utf8')) as T;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeBase64Url(value: string): string {
  const replaced = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = replaced.length % 4;
  return padding === 0 ? replaced : `${replaced}${'='.repeat(4 - padding)}`;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
