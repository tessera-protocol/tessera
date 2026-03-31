/**
 * Tessera SDK — Security and lifecycle tests
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { createDelegation } from './delegation.js';
import { createIssuer } from './issuer.js';
import { prove } from './prover.js';
import { createVerifier } from './verifier.js';

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop()!, { recursive: true, force: true });
  }
});

describe('Tessera credential lifecycle', () => {
  it('should issue a credential with signed issuer and holder keys', () => {
    const issuer = createIssuer();

    const { credential, identitySecret, holderSecretKey } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-001',
    });

    assert.ok(credential.identityCommitment, 'should have identity commitment');
    assert.ok(credential.holderPublicKey.includes('BEGIN PUBLIC KEY'));
    assert.ok(credential.issuerPublicKey.includes('BEGIN PUBLIC KEY'));
    assert.ok(credential.issuerSignature, 'should have issuer signature');
    assert.ok(identitySecret, 'should return identity secret');
    assert.ok(holderSecretKey.includes('BEGIN PRIVATE KEY'));
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

  it('full flow: issue → prove → verify', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'test-platform',
      minimumTier: 1,
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-003',
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'test-platform',
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, true);
    assert.equal(result.type, 'human');
    assert.equal(result.tier, 1);
    assert.equal(result.scope, null);

    verifier.close();
  });

  it('should reject forged credential claims even when the proof is valid', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'secure-platform',
      minimumTier: 1,
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret } = issuer.issue({
      tier: 3,
      jurisdiction: 'US',
      anchorHash: 'sha256-hash-of-bank-account-004',
    });

    const forgedCredential = {
      ...credential,
      anchor: {
        ...credential.anchor,
        tier: 1 as const,
      },
      expiresAt: credential.expiresAt + 60 * 60 * 24 * 365,
    };

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      forgedCredential,
      'secure-platform',
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /Credential signature verification failed/);

    verifier.close();
  });

  it('should reject proofs generated for a different platform', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'platform-b',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-005',
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'platform-a',
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /different platform/);

    verifier.close();
  });

  it('should reject proof with insufficient tier', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'strict-platform',
      minimumTier: 2,
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret } = issuer.issue({
      tier: 3,
      jurisdiction: 'US',
      anchorHash: 'sha256-hash-of-phone-006',
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'strict-platform',
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('does not meet minimum'));

    verifier.close();
  });

  it('should detect double-presentation via a persistent SQLite nullifier registry', async () => {
    const issuer = createIssuer();
    const databaseDir = mkdtempSync(join(tmpdir(), 'tessera-nullifiers-'));
    const databasePath = join(databaseDir, 'registry.sqlite');
    cleanupPaths.push(databaseDir);

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-007',
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'platform-a',
    );

    const verifierA = createVerifier({
      platformId: 'platform-a',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
      nullifierDbPath: databasePath,
    });
    const verifierB = createVerifier({
      platformId: 'platform-a',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
      nullifierDbPath: databasePath,
    });

    const result1 = await verifierA.verify(proof);
    const result2 = await verifierB.verify(proof);

    assert.equal(result1.valid, true);
    assert.equal(result2.valid, false);
    assert.ok(result2.error?.includes('already been presented'));

    verifierA.close();
    verifierB.close();
  });

  it('should allow same credential on different platforms', async () => {
    const issuer = createIssuer();
    const verifierA = createVerifier({
      platformId: 'platform-a',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });
    const verifierB = createVerifier({
      platformId: 'platform-b',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-008',
    });

    const proofA = await prove(identitySecret, issuer.getGroup(), credential, 'platform-a');
    const proofB = await prove(identitySecret, issuer.getGroup(), credential, 'platform-b');

    const resultA = await verifierA.verify(proofA);
    const resultB = await verifierB.verify(proofB);

    assert.equal(resultA.valid, true);
    assert.equal(resultB.valid, true);

    verifierA.close();
    verifierB.close();
  });

  it('should reject forged agent delegation signatures', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'platform-agent',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret, holderSecretKey } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-009',
    });

    const validDelegation = createDelegation(holderSecretKey, credential, {
      agentName: 'agent-1',
      scope: { canPost: true },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const forgedDelegation = {
      ...validDelegation,
      scope: { canPost: true, canTransact: true },
    };

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'platform-agent',
      '0',
      forgedDelegation,
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /signature verification failed/);

    verifier.close();
  });

  it('should reject agent delegation scopes that exceed the parent scope', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'platform-scope',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret, holderSecretKey } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-010',
    });

    const delegation = createDelegation(holderSecretKey, credential, {
      agentName: 'agent-2',
      parentScope: { canPost: true, maxTransactionValue: 10, allowedCategories: ['saas'] },
      scope: { canPost: true, maxTransactionValue: 50, allowedCategories: ['saas', 'api'] },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'platform-scope',
      '0',
      delegation,
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, false);
    assert.match(result.error ?? '', /scope exceeds parent scope/);

    verifier.close();
  });

  it('should accept valid agent delegations', async () => {
    const issuer = createIssuer();
    const verifier = createVerifier({
      platformId: 'platform-valid-agent',
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    });

    const { credential, identitySecret, holderSecretKey } = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'sha256-hash-of-bank-account-011',
    });

    const delegation = createDelegation(holderSecretKey, credential, {
      agentName: 'agent-3',
      parentScope: { canPost: true, maxTransactionValue: 100 },
      scope: { canPost: true, maxTransactionValue: 25 },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const proof = await prove(
      identitySecret,
      issuer.getGroup(),
      credential,
      'platform-valid-agent',
      '0',
      delegation,
    );

    const result = await verifier.verify(proof);

    assert.equal(result.valid, true);
    assert.equal(result.type, 'agent');
    assert.deepEqual(result.scope, delegation.scope);

    verifier.close();
  });
});
