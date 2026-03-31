import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDelegation, createIssuer, generateIssuerKeypair } from '@tessera-protocol/sdk';
import { createGuard } from './guard.js';
import { serializeAgentCredential } from './token.js';

describe('demo scenarios', () => {
  it('covers allow, block, and revoke flows', async () => {
    const keys = generateIssuerKeypair();
    const issuer = createIssuer({
      issuerPrivateKeyPem: keys.privateKeyPem,
      issuerPublicKeyPem: keys.publicKeyPem,
    });
    const issued = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'demo-test-anchor',
    });

    const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
      agentName: 'demo-agent',
      scope: {
        canPost: true,
        canTransact: true,
        maxTransactionValue: 50,
        currency: 'GBP',
        maxRecipients: 20,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const activeGuard = createGuard({
      credential: serializeAgentCredential({
        version: 'tessera.openclaw/v1',
        credential: issued.credential,
        delegation: {
          ...delegation,
          status: 'active',
        },
      }),
      offlineMode: true,
    });
    const revokedGuard = createGuard({
      credential: serializeAgentCredential({
        version: 'tessera.openclaw/v1',
        credential: issued.credential,
        delegation: {
          ...delegation,
          status: 'revoked',
          revokedAt: Math.floor(Date.now() / 1000),
        },
      }),
      offlineMode: true,
    });

    const emailAllowed = await activeGuard.check('email.send', { recipientCount: 5 });
    const shellBlocked = await activeGuard.check('exec.shell', { command: 'ls' });
    const emailAfterRevoke = await revokedGuard.check('email.send', { recipientCount: 1 });

    assert.equal(emailAllowed.allowed, true);
    assert.equal(shellBlocked.allowed, false);
    assert.match(shellBlocked.reason ?? '', /shell execution/);
    assert.equal(emailAfterRevoke.allowed, false);
    assert.match(emailAfterRevoke.reason ?? '', /revoked/);
  });
});
