import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDelegation, createIssuer, generateIssuerKeypair } from '@tessera-protocol/sdk';
import { createGuard } from './guard.js';
import { createSkillHandlers } from './skill.js';
import { serializeAgentCredential } from './token.js';

describe('skill handlers', () => {
  it('returns executable handlers bound to a guard instance', async () => {
    const keys = generateIssuerKeypair();
    const issuer = createIssuer({
      issuerPrivateKeyPem: keys.privateKeyPem,
      issuerPublicKeyPem: keys.publicKeyPem,
    });
    const issued = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'skill-test-anchor',
    });
    const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
      agentName: 'skill-agent',
      scope: {
        canPost: true,
        maxRecipients: 5,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const guard = createGuard({
      credential: serializeAgentCredential({
        version: 'tessera.openclaw/v1',
        credential: issued.credential,
        delegation,
      }),
      trustedIssuerKeys: [keys.publicKeyPem],
      offlineMode: true,
    });
    const handlers = createSkillHandlers(guard);

    const check = await handlers.tessera_check_permission({
      action: 'email.send',
      resource: { recipientCount: 10 },
    });
    const show = await handlers.tessera_show_permissions();
    const upgrade = await handlers.tessera_request_upgrade({ action: 'exec.shell' });

    assert.equal(check.allowed, false);
    assert.match(check.reason ?? '', /recipients/);
    assert.match(show.message, /Tessera credential/);
    assert.equal(show.status.credentialValid, true);
    assert.match(upgrade.message, /exec\.shell/);
  });
});
