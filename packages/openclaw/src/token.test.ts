import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDelegation, createIssuer, generateIssuerKeypair } from '@tessera-protocol/sdk';
import { getDelegationId, getLegacyDelegationId } from './token.js';

function issueCredential() {
  const keys = generateIssuerKeypair();
  const issuer = createIssuer({
    issuerPrivateKeyPem: keys.privateKeyPem,
    issuerPublicKeyPem: keys.publicKeyPem,
  });

  return issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: `token-test-${Math.random()}`,
  });
}

describe('delegation identifiers', () => {
  it('prefers the explicit delegation id when present', () => {
    const { credential, holderSecretKey } = issueCredential();
    const delegation = createDelegation(holderSecretKey, credential, {
      agentName: 'agent-explicit-id',
      scope: { canPost: true },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      issuedAt: 1_700_000_000,
    });

    assert.equal(getDelegationId(delegation), delegation.id);
    assert.notEqual(getDelegationId(delegation), getLegacyDelegationId(delegation));
  });

  it('falls back to the legacy tuple hash when id is missing', () => {
    const legacyDelegation = {
      parentCommitment: '123',
      agentName: 'legacy-agent',
      issuedAt: 1_700_000_000,
      expiresAt: 1_700_003_600,
    };

    assert.equal(getDelegationId(legacyDelegation), getLegacyDelegationId(legacyDelegation));
  });
});
