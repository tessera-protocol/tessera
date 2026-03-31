/**
 * Tessera SDK — Integration Tests
 *
 * Tests the full credential lifecycle:
 *   1. Issuer creates a credential (after anchor verification)
 *   2. User generates a ZK proof
 *   3. Platform verifies the proof
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIssuer } from './issuer.js';
import { prove } from './prover.js';
import { createVerifier } from './verifier.js';

describe('Tessera credential lifecycle', () => {

  it('should issue a credential and return identity secret', () => {
    const issuer = createIssuer();

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-001',
    });

    assert.ok(credential.identityCommitment, 'should have identity commitment');
    assert.equal(credential.anchor.tier, 1);
    assert.equal(credential.anchor.jurisdiction, 'EU');
    assert.ok(credential.expiresAt > Date.now() / 1000, 'should expire in the future');
    assert.ok(identitySecret, 'should return identity secret');
    assert.equal(issuer.getMemberCount(), 1);
  });

  it('should reject duplicate anchor hashes', () => {
    const issuer = createIssuer();
    const anchorHash = 'sha256-hash-of-bank-account-002';

    issuer.issue({ tier: 1, jurisdiction: 'EU', anchorHash });

    assert.throws(
      () => issuer.issue({ tier: 1, jurisdiction: 'EU', anchorHash }),
      /already been used/,
    );
  });

  it('should issue multiple credentials for different anchors', () => {
    const issuer = createIssuer();

    issuer.issue({ tier: 1, jurisdiction: 'EU', anchorHash: 'hash-a' });
    issuer.issue({ tier: 2, jurisdiction: 'US', anchorHash: 'hash-b' });
    issuer.issue({ tier: 3, jurisdiction: 'UK', anchorHash: 'hash-c' });

    assert.equal(issuer.getMemberCount(), 3);
  });

  it('full flow: issue → prove → verify', async () => {
    const issuer = createIssuer();

    // Step 1: Issue credential
    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-003',
    });

    // Step 2: Generate proof
    const group = issuer.getGroup();
    const proof = await prove(
      identitySecret,
      group,
      credential,
      'test-platform',
    );

    assert.ok(proof.semaphoreProof, 'should contain Semaphore proof');
    assert.ok(proof.semaphoreProof.nullifier, 'should contain nullifier');
    assert.equal(proof.credential.anchor.tier, 1);

    // Step 3: Verify proof
    const verifier = createVerifier({
      platformScope: 'test-platform',
      minimumTier: 1,
    });

    const result = await verifier.verify(proof);

    assert.equal(result.valid, true);
    assert.equal(result.type, 'human');
    assert.equal(result.tier, 1);
    assert.equal(result.scope, null);
    assert.equal(result.error, undefined);
  });

  it('should reject proof with insufficient tier', async () => {
    const issuer = createIssuer();

    const { credential, identitySecret } = issuer.issue({
      tier: 3, // Mobile carrier verification
      jurisdiction: 'US',
      anchorHash: 'sha256-hash-of-phone-004',
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'strict-platform',
    );

    // Platform requires Tier 2 or better
    const verifier = createVerifier({
      platformScope: 'strict-platform',
      minimumTier: 2,
    });

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('does not meet minimum'));
  });

  it('should detect double-presentation via nullifier', async () => {
    const issuer = createIssuer();

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-005',
    });

    const group = issuer.getGroup();

    // Generate two proofs for the same platform
    const proof1 = await prove(identitySecret, group, credential, 'platform-a');
    const proof2 = await prove(identitySecret, group, credential, 'platform-a');

    const verifier = createVerifier({
      platformScope: 'platform-a',
    });

    // First presentation should succeed
    const result1 = await verifier.verify(proof1);
    assert.equal(result1.valid, true);

    // Second presentation should fail (same nullifier)
    const result2 = await verifier.verify(proof2);
    assert.equal(result2.valid, false);
    assert.ok(result2.error?.includes('already been presented'));
  });

  it('should allow same credential on different platforms', async () => {
    const issuer = createIssuer();

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-006',
    });

    const group = issuer.getGroup();

    // Different platforms = different scopes = different nullifiers
    const proofA = await prove(identitySecret, group, credential, 'platform-a');
    const proofB = await prove(identitySecret, group, credential, 'platform-b');

    const verifierA = createVerifier({ platformScope: 'platform-a' });
    const verifierB = createVerifier({ platformScope: 'platform-b' });

    const resultA = await verifierA.verify(proofA);
    const resultB = await verifierB.verify(proofB);

    assert.equal(resultA.valid, true);
    assert.equal(resultB.valid, true);
  });

  it('should reject expired credentials', async () => {
    const issuer = createIssuer();

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-007',
    });

    // Manually expire the credential
    credential.expiresAt = Math.floor(Date.now() / 1000) - 1;

    // Proof generation should fail
    await assert.rejects(
      () => prove(identitySecret, issuer.getGroup(), credential, 'platform'),
      /expired/,
    );
  });
});
