#!/usr/bin/env -S npx tsx

import { performance } from 'node:perf_hooks';
import {
  createDelegation,
  createIssuer,
  generateIssuerKeypair,
  type TesseraCredential,
} from '@tessera-protocol/sdk';
import { createGuard } from './guard.js';
import {
  serializeAgentCredential,
  type SerializedAgentCredentialPayload,
} from './token.js';

const PURPLE = '\x1b[35m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function main() {
  header();
  await pause(200);

  const issuerKeys = generateIssuerKeypair();
  const issuer = createIssuer({
    issuerPrivateKeyPem: issuerKeys.privateKeyPem,
    issuerPublicKeyPem: issuerKeys.publicKeyPem,
  });
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'openclaw-demo-anchor',
  });
  const trustedIssuerKeys = [issuerKeys.publicKeyPem];

  section('1. Agent tries to send email without Tessera');
  await timedCheck(
    createGuard({
      credential: '',
      trustedIssuerKeys,
      offlineMode: true,
    }),
    'email.send',
    { recipientCount: 1 },
  );
  await pause(250);

  section('2. User binds a Tessera credential with email + payment scope');
  const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'openclaw-assistant',
    parentScope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'GBP',
      allowedCategories: ['saas', 'infra'],
      maxRecipients: 20,
    },
    scope: {
      canPost: true,
      canTransact: true,
      maxTransactionValue: 50,
      currency: 'GBP',
      allowedCategories: ['saas', 'infra'],
      maxRecipients: 20,
    },
    expiresAt: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60,
  });
  const activeGuard = createGuardFromPayload({
    version: 'tessera.openclaw/v1',
    credential: issued.credential,
    delegation: {
      ...delegation,
      status: 'active',
    },
    metadata: {
      agentName: 'openclaw-assistant',
    },
  }, trustedIssuerKeys);
  detail(activeGuard.getAgentMessage());
  await pause(250);

  section('3. Untrusted issuer tries to present a credential');
  const rogueIssuerKeys = generateIssuerKeypair();
  const rogueIssuer = createIssuer({
    issuerPrivateKeyPem: rogueIssuerKeys.privateKeyPem,
    issuerPublicKeyPem: rogueIssuerKeys.publicKeyPem,
  });
  const rogueIssued = rogueIssuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'openclaw-demo-rogue-anchor',
  });
  const rogueDelegation = createDelegation(rogueIssued.holderSecretKey, rogueIssued.credential, {
    agentName: 'rogue-agent',
    scope: {
      canPost: true,
      maxRecipients: 20,
    },
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  await timedCheck(
    createGuardFromPayload({
      version: 'tessera.openclaw/v1',
      credential: rogueIssued.credential,
      delegation: rogueDelegation,
      metadata: {
        agentName: 'rogue-agent',
      },
    }, trustedIssuerKeys),
    'email.send',
    { recipientCount: 1 },
  );
  await pause(250);

  section('4. Agent sends email');
  await timedCheck(activeGuard, 'email.send', {
    recipientCount: 5,
    recipientDomains: ['acme.io'],
  });
  await pause(250);

  section('5. Agent tries to run shell command');
  await timedCheck(activeGuard, 'exec.shell', {
    command: 'rm -rf /tmp/demo',
  });
  await pause(250);

  section('6. User revokes credential, agent tries email again');
  const revokedGuard = createGuardFromPayload(makeRevokedPayload(issued, delegation), trustedIssuerKeys);
  await timedCheck(revokedGuard, 'email.send', {
    recipientCount: 1,
  });
}

function createGuardFromPayload(
  payload: Parameters<typeof serializeAgentCredential>[0],
  trustedIssuerKeys: string[],
) {
  return createGuard({
    credential: serializeAgentCredential(payload),
    trustedIssuerKeys,
    offlineMode: true,
  });
}

function makeRevokedPayload(
  issued: IssuedCredentialBundle,
  delegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'openclaw-assistant',
    scope: {
      canPost: true,
      maxRecipients: 20,
    },
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }),
) {
  return {
    version: 'tessera.openclaw/v1' as const,
    credential: issued.credential,
    delegation: {
      ...delegation,
      status: 'revoked' as const,
      revokedAt: Math.floor(Date.now() / 1000),
    },
    metadata: {
      agentName: 'openclaw-assistant',
    },
  } satisfies SerializedAgentCredentialPayload;
}

async function timedCheck(
  guard: ReturnType<typeof createGuard>,
  action: string,
  resource: object,
) {
  const start = performance.now();
  const result = await guard.check(action, resource);
  const duration = performance.now() - start;

  if (result.allowed) {
    console.log(`${GREEN}allowed${RESET} ${action} ${DIM}${duration.toFixed(1)}ms${RESET}`);
  } else {
    console.log(`${RED}blocked${RESET} ${action} ${DIM}${duration.toFixed(1)}ms${RESET}`);
    if (result.reason) {
      detail(result.reason);
    }
    if (result.suggestion) {
      detail(result.suggestion);
    }
  }
}

function header() {
  process.stdout.write('tessera');
  process.stdout.write(`${PURPLE}.${RESET}`);
  process.stdout.write(' openclaw guard demo\n');
  console.log(`${DIM}Permission middleware for agent actions.${RESET}\n`);
}

function section(title: string) {
  console.log(`\n${PURPLE}${title}${RESET}`);
}

function detail(value: string) {
  console.log(`${DIM}${value}${RESET}`);
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
interface IssuedCredentialBundle {
  credential: TesseraCredential;
  identitySecret: string;
  holderSecretKey: string;
}
