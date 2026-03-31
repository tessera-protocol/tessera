import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDelegation, createIssuer, generateIssuerKeypair } from '@tessera-protocol/sdk';
import { createGuard } from './guard.js';
import { serializeAgentCredential, type SerializedAgentCredentialPayload } from './token.js';

function createIssuedCredential() {
  const keys = generateIssuerKeypair();
  const issuer = createIssuer({
    issuerPrivateKeyPem: keys.privateKeyPem,
    issuerPublicKeyPem: keys.publicKeyPem,
  });

  return issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: `guard-test-${Math.random()}`,
  });
}

function createPayload(overrides?: Partial<SerializedAgentCredentialPayload>) {
  const issued = createIssuedCredential();
  const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'guard-test-agent',
    parentScope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'GBP',
      allowedCategories: ['saas'],
      maxRecipients: 20,
    },
    scope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'GBP',
      allowedCategories: ['saas'],
      maxRecipients: 20,
    },
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });

  return {
    version: 'tessera.openclaw/v1' as const,
    credential: issued.credential,
    delegation: {
      ...delegation,
      status: 'active' as const,
    },
    metadata: {
      agentName: 'guard-test-agent',
    },
    ...overrides,
  };
}

describe('guard checks', () => {
  it('allows actions within scope', async () => {
    const guard = createGuard({
      credential: serializeAgentCredential(createPayload()),
      offlineMode: true,
    });

    const result = await guard.check('email.send', {
      recipientCount: 5,
      recipientDomains: ['acme.io'],
    });

    assert.equal(result.allowed, true);
  });

  it('denies actions outside payment scope', async () => {
    const guard = createGuard({
      credential: serializeAgentCredential(createPayload()),
      offlineMode: true,
    });

    const result = await guard.check('payment.intent', {
      amount: 80,
      currency: 'GBP',
      category: 'saas',
    });

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /only allows payments up to/);
  });

  it('denies unknown actions', async () => {
    const guard = createGuard({
      credential: serializeAgentCredential(createPayload()),
      offlineMode: true,
    });

    const result = await guard.check('filesystem.delete', {});

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /not recognised/);
  });

  it('denies expired credentials', async () => {
    const payload = createPayload();
    payload.delegation.expiresAt = Math.floor(Date.now() / 1000) - 60;

    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      offlineMode: true,
    });

    const result = await guard.check('email.send', { recipientCount: 1 });

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /expired/);
  });

  it('returns a legible agent message', () => {
    const guard = createGuard({
      credential: serializeAgentCredential(createPayload()),
      offlineMode: true,
    });

    const message = guard.getAgentMessage();

    assert.match(message, /send messages/);
    assert.match(message, /make purchases up to £50/);
    assert.match(message, /cannot run shell commands/);
  });
});
