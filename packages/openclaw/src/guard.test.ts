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

  return {
    issuerPublicKey: keys.publicKeyPem,
    issued: issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: `guard-test-${Math.random()}`,
    }),
  };
}

function createPayload(overrides?: Partial<SerializedAgentCredentialPayload>) {
  const { issued, issuerPublicKey } = createIssuedCredential();
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

  const payload = {
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

  return {
    payload,
    trustedIssuerKeys: [issuerPublicKey],
  };
}

describe('guard checks', () => {
  it('allows actions within scope', async () => {
    const { payload, trustedIssuerKeys } = createPayload();
    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys,
      offlineMode: true,
    });

    const result = await guard.check('email.send', {
      recipientCount: 5,
      recipientDomains: ['acme.io'],
    });

    assert.equal(result.allowed, true);
  });

  it('denies actions outside payment scope', async () => {
    const { payload, trustedIssuerKeys } = createPayload();
    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys,
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
    const { payload, trustedIssuerKeys } = createPayload();
    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys,
      offlineMode: true,
    });

    const result = await guard.check('filesystem.delete', {});

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /not recognised/);
  });

  it('denies expired credentials', async () => {
    const { payload, trustedIssuerKeys } = createPayload();
    payload.delegation.expiresAt = Math.floor(Date.now() / 1000) - 60;

    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys,
      offlineMode: true,
    });

    const result = await guard.check('email.send', { recipientCount: 1 });

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /expired/);
  });

  it('returns a legible agent message', () => {
    const { payload, trustedIssuerKeys } = createPayload();
    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys,
      offlineMode: true,
    });

    const message = guard.getAgentMessage();

    assert.match(message, /send messages/);
    assert.match(message, /make purchases up to £50/);
    assert.match(message, /cannot run shell commands/);
  });

  it('denies credentials signed by an untrusted issuer', async () => {
    const { payload } = createPayload();
    const guard = createGuard({
      credential: serializeAgentCredential(payload),
      trustedIssuerKeys: ['-----BEGIN PUBLIC KEY-----\nNOT-TRUSTED\n-----END PUBLIC KEY-----\n'],
      offlineMode: true,
    });

    const result = await guard.check('email.send', { recipientCount: 1 });

    assert.equal(result.allowed, false);
    assert.match(result.reason ?? '', /untrusted issuer/);
  });

  it('fails closed for malformed credentials without crashing', async () => {
    const guard = createGuard({
      credential: 'definitely-not-a-valid-token',
      trustedIssuerKeys: ['trusted-key'],
      offlineMode: true,
    });

    const result = await guard.check('email.send', { recipientCount: 1 });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Invalid or corrupted credential');
    assert.equal(result.suggestion, 'Ask the user to re-issue the Tessera credential');
    assert.deepEqual(guard.getStatus(), {
      credentialValid: false,
      expiresIn: 'N/A',
      scope: {},
    });
    assert.match(guard.getAgentMessage(), /invalid or corrupted/);
  });

  it('fails closed for empty credentials without crashing', async () => {
    const guard = createGuard({
      credential: '',
      trustedIssuerKeys: ['trusted-key'],
      offlineMode: true,
    });

    const result = await guard.check('payment.intent', { amount: 10 });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Invalid or corrupted credential');
  });
});
