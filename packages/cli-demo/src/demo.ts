#!/usr/bin/env -S npx tsx

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createDelegation,
  createIssuer,
  createVerifier,
  generateIssuerKeypair,
  prove,
} from 'tessera-sdk';

const PURPLE = '\x1b[35m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), 'tessera-demo-'));

  try {
    printHeader();
    await pause(250);

    await runFullLifecycle(tempDir);
    await pause(350);

    await runSybilDetection(tempDir);
    await pause(350);

    await runAgentDelegation(tempDir);
    await pause(350);

    await runCrossPlatformPortability(tempDir);
    await pause(250);

    console.log(`${GREEN}Demo complete.${RESET}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function printHeader() {
  process.stdout.write('tessera');
  process.stdout.write(`${PURPLE}.${RESET}`);
  process.stdout.write(' protocol demo\n');
  console.log(`${DIM}Real Semaphore proofs, Ed25519 signatures, and SQLite nullifier checks.${RESET}\n`);
}

async function runFullLifecycle(baseDir: string) {
  section('1. Full lifecycle');

  const { issuer, verifierDbPath } = createDemoContext(baseDir, 'full-lifecycle');

  say('Generating issuer keypair');
  await pause(250);

  say('Issuing Tier 1 EU credential');
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'demo-anchor-full-lifecycle',
  });
  value('Identity commitment', truncate(issued.credential.identityCommitment));
  value('Current group root', truncate(issuer.getGroupRoot()));
  await pause(300);

  say('Generating Semaphore proof for demo-platform');
  const proofTimed = await time(async () =>
    prove(
      issued.identitySecret,
      issuer.getGroup(),
      issued.credential,
      'demo-platform',
    )
  );
  success(`Proof generated in ${proofTimed.ms.toFixed(1)}ms`);
  value('Nullifier', truncate(proofTimed.result.semaphoreProof.nullifier));
  value('Merkle root', truncate(proofTimed.result.semaphoreProof.merkleTreeRoot));
  await pause(300);

  say('Verifying proof with trusted issuer key and recent roots');
  const verifier = createVerifier({
    platformId: 'demo-platform',
    trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    trustedGroupRoots: issuer.getRecentRoots(),
    nullifierDbPath: verifierDbPath,
  });
  const verifyTimed = await time(async () => verifier.verify(proofTimed.result));
  if (verifyTimed.result.valid) {
    success(`Verified in ${verifyTimed.ms.toFixed(1)}ms`);
    value('Result', `${verifyTimed.result.type}, tier ${verifyTimed.result.tier}`);
  } else {
    failure(verifyTimed.result.error ?? 'verification failed');
  }
  verifier.close();
}

async function runSybilDetection(baseDir: string) {
  section('2. Sybil detection');

  const { issuer, verifierDbPath } = createDemoContext(baseDir, 'sybil');
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'demo-anchor-sybil',
  });
  const verifier = createVerifier({
    platformId: 'sybil-platform',
    trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    trustedGroupRoots: issuer.getRecentRoots(),
    nullifierDbPath: verifierDbPath,
  });

  say('Generating two proofs for the same platform using one credential');
  const proofA = await prove(
    issued.identitySecret,
    issuer.getGroup(),
    issued.credential,
    'sybil-platform',
  );
  const proofB = await prove(
    issued.identitySecret,
    issuer.getGroup(),
    issued.credential,
    'sybil-platform',
  );
  value('Proof A nullifier', truncate(proofA.semaphoreProof.nullifier));
  value('Proof B nullifier', truncate(proofB.semaphoreProof.nullifier));
  await pause(300);

  say('Verifying first proof');
  const firstResult = await verifier.verify(proofA);
  if (firstResult.valid) {
    success('First presentation accepted');
  } else {
    failure(firstResult.error ?? 'unexpected rejection');
  }
  await pause(250);

  say('Verifying second proof with the same verifier');
  const secondResult = await verifier.verify(proofB);
  if (!secondResult.valid) {
    failure(secondResult.error ?? 'second proof rejected');
  } else {
    success('Unexpectedly accepted duplicate presentation');
  }
  verifier.close();
}

async function runAgentDelegation(baseDir: string) {
  section('3. Agent delegation');

  const { issuer, verifierDbPath } = createDemoContext(baseDir, 'agent');
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'demo-anchor-agent',
  });

  say('Creating scoped agent delegation');
  const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'tessera-agent',
    parentScope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'EUR',
    },
    scope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'EUR',
    },
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  value('Delegation scope', JSON.stringify(delegation.scope));
  await pause(300);

  say('Generating proof that includes the delegation');
  const proof = await prove(
    issued.identitySecret,
    issuer.getGroup(),
    issued.credential,
    'agent-platform',
    '0',
    delegation,
  );
  const verifier = createVerifier({
    platformId: 'agent-platform',
    trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
    trustedGroupRoots: issuer.getRecentRoots(),
    nullifierDbPath: verifierDbPath,
  });

  say('Verifying delegated proof');
  const result = await verifier.verify(proof);
  if (result.valid) {
    success(`Accepted as ${result.type}`);
    value('Returned scope', JSON.stringify(result.scope));
    warning('The SDK verifies delegation authenticity and scope bounds. Platform-specific policy still uses the returned scope to decide what the agent may do.');
  } else {
    failure(result.error ?? 'delegated proof rejected');
  }
  verifier.close();
}

async function runCrossPlatformPortability(baseDir: string) {
  section('4. Cross-platform portability');

  const { issuer } = createDemoContext(baseDir, 'portability');
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'demo-anchor-portability',
  });

  const platforms = ['social-network', 'marketplace', 'dev-tools'] as const;

  for (const platformId of platforms) {
    say(`Generating proof for ${platformId}`);
    const proofTimed = await time(async () =>
      prove(
        issued.identitySecret,
        issuer.getGroup(),
        issued.credential,
        platformId,
      )
    );
    const verifier = createVerifier({
      platformId,
      trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
      trustedGroupRoots: issuer.getRecentRoots(),
      nullifierDbPath: join(baseDir, `${platformId}.sqlite`),
    });
    const verifyTimed = await time(async () => verifier.verify(proofTimed.result));

    if (verifyTimed.result.valid) {
      success(`${platformId} accepted the same credential`);
      value('Nullifier', truncate(proofTimed.result.semaphoreProof.nullifier));
      detail(`proof ${proofTimed.ms.toFixed(1)}ms, verify ${verifyTimed.ms.toFixed(1)}ms`);
    } else {
      failure(`${platformId}: ${verifyTimed.result.error ?? 'verification failed'}`);
    }
    verifier.close();
    await pause(250);
  }
}

function createDemoContext(baseDir: string, label: string) {
  const issuerKeys = generateIssuerKeypair();
  const issuer = createIssuer({
    issuerPrivateKeyPem: issuerKeys.privateKeyPem,
    issuerPublicKeyPem: issuerKeys.publicKeyPem,
  });

  return {
    issuer,
    verifierDbPath: join(baseDir, `${label}.sqlite`),
  };
}

async function time<T>(fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;

  return { result, ms };
}

function truncate(value: string, visible: number = 24) {
  return value.length <= visible ? value : `${value.slice(0, visible)}...`;
}

function section(title: string) {
  console.log(`\n${PURPLE}${title}${RESET}`);
}

function say(message: string) {
  console.log(message);
}

function success(message: string) {
  console.log(`${GREEN}${message}${RESET}`);
}

function failure(message: string) {
  console.log(`${RED}${message}${RESET}`);
}

function warning(message: string) {
  console.log(`${YELLOW}${message}${RESET}`);
}

function value(label: string, valueText: string) {
  console.log(`${YELLOW}${label}:${RESET} ${DIM}${valueText}${RESET}`);
}

function detail(message: string) {
  console.log(`${DIM}${message}${RESET}`);
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`${RED}${message}${RESET}`);
  process.exitCode = 1;
});
