import { setMaxListeners } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { serve } from '@hono/node-server';
import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import {
  createDelegation,
  createIssuer,
  generateIssuerKeypair,
  prove,
} from '@tessera-protocol/sdk';
import { getDelegationId, serializeAgentCredential } from '@tessera-protocol/openclaw';
import { signDelegation } from '@tessera-protocol/sdk/dist/crypto.js';
import { createIssuerApp } from './app.js';
import { resolveIssuerBindHost } from './local-only.js';

const tempDirs: string[] = [];

setMaxListeners(20);

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('issuer service issues credentials, returns roots, and verifies proofs', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl, state } = await startIssuerServer(dataDir);
  const identity = new Identity();
  const holderKeys = generateIssuerKeypair();

  const issueResponse = await requestJson(baseUrl, '/credential/issue', {
    method: 'POST',
    body: {
      commitment: identity.commitment.toString(),
      anchorType: 'bank-account',
      anchorHash: 'anchor-hash-123',
      tier: 1,
      jurisdiction: 'EU',
      holderPublicKey: holderKeys.publicKeyPem,
    },
  });

  assert.equal(issueResponse.status, 201);
  const issued = issueResponse.json as {
    credential: Parameters<typeof prove>[2];
    groupRoot: string;
  };

  assert.equal(issued.credential.identityCommitment, identity.commitment.toString());
  assert.equal(issued.groupRoot, state.getCurrentRoot());

  const rootsResponse = await requestJson(baseUrl, '/roots');
  assert.equal(rootsResponse.status, 200);
  const rootsPayload = rootsResponse.json as {
    roots: string[];
    currentRoot: string;
    groupSize: number;
  };

  assert.equal(rootsPayload.groupSize, 1);
  assert.equal(rootsPayload.currentRoot, issued.groupRoot);
  assert.ok(rootsPayload.roots.includes(issued.groupRoot));

  const groupState = JSON.parse(
    readFileSync(join(dataDir, 'group.json'), 'utf8'),
  ) as { groupExport: string };
  const group = Group.import(groupState.groupExport);
  const proof = await prove(
    identity.export(),
    group,
    issued.credential,
    'demo-platform',
  );

  try {
    const verifyResponse = await requestJson(baseUrl, '/proof/verify', {
      method: 'POST',
      body: {
        platformId: 'demo-platform',
        proof,
      },
    });

    assert.equal(verifyResponse.status, 200);
    const verifyPayload = verifyResponse.json as {
      valid: boolean;
      type: 'human' | 'agent';
      tier: number;
      scope: null | Record<string, unknown>;
      error?: string;
    };

    assert.equal(verifyPayload.valid, true);
    assert.equal(verifyPayload.type, 'human');
    assert.equal(verifyPayload.tier, 1);
    assert.equal(verifyPayload.scope, null);

    const issuerKeys = JSON.parse(
      readFileSync(join(dataDir, 'issuer-keys.json'), 'utf8'),
    ) as {
      privateKeyPem: string;
      publicKeyPem: string;
    };
    const mirrorIssuer = createIssuer({
      issuerPrivateKeyPem: issuerKeys.privateKeyPem,
      issuerPublicKeyPem: issuerKeys.publicKeyPem,
    });
    const mirrorIssued = mirrorIssuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'guard-test-anchor',
    });
    const delegation = createDelegation(mirrorIssued.holderSecretKey, mirrorIssued.credential, {
      agentName: 'guard-test-agent',
      scope: {
        canPost: true,
        maxRecipients: 3,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const token = serializeAgentCredential({
      version: 'tessera.openclaw/v1',
      credential: mirrorIssued.credential,
      delegation,
    });

    const guardAllowed = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token,
        action: 'email.send',
        resource: {
          recipientCount: 2,
        },
      },
    });
    assert.equal(guardAllowed.status, 200);
    assert.equal((guardAllowed.json as { allowed: boolean }).allowed, true);

    const guardDenied = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token,
        action: 'email.send',
        resource: {
          recipientCount: 5,
        },
      },
    });
    assert.equal(guardDenied.status, 200);
    assert.equal((guardDenied.json as { allowed: boolean }).allowed, false);

    const delegationId = getDelegationId(delegation);
    const revokeResponse = await requestJson(baseUrl, '/delegation/revoke', {
      method: 'POST',
      body: {
        delegationId,
      },
    });
    assert.equal(revokeResponse.status, 200);
    assert.equal((revokeResponse.json as { revoked: boolean }).revoked, true);

    const guardRevoked = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token,
        action: 'email.send',
        resource: {
          recipientCount: 1,
        },
      },
    });
    assert.equal(guardRevoked.status, 200);
    assert.equal((guardRevoked.json as { allowed: boolean }).allowed, false);
    assert.match((guardRevoked.json as { reason?: string }).reason ?? '', /revoked/);
  } finally {
    await closeServer(server);
  }
});

test('revocation survives issuer restart', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-restart-test-'));
  tempDirs.push(dataDir);

  const first = await startIssuerServer(dataDir);
  const issuerKeys = JSON.parse(
    readFileSync(join(dataDir, 'issuer-keys.json'), 'utf8'),
  ) as {
    privateKeyPem: string;
    publicKeyPem: string;
  };
  const issuer = createIssuer({
    issuerPrivateKeyPem: issuerKeys.privateKeyPem,
    issuerPublicKeyPem: issuerKeys.publicKeyPem,
  });
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'restart-guard-anchor',
  });
  const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'restart-agent',
    scope: {
      canPost: true,
      maxRecipients: 2,
    },
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  const token = serializeAgentCredential({
    version: 'tessera.openclaw/v1',
    credential: issued.credential,
    delegation,
  });
  const delegationId = getDelegationId(delegation);

  try {
    const revokeResponse = await requestJson(first.baseUrl, '/delegation/revoke', {
      method: 'POST',
      body: {
        delegationId,
      },
    });
    assert.equal(revokeResponse.status, 200);
  } finally {
    await closeServer(first.server);
  }

  const second = await startIssuerServer(dataDir);
  try {
    const guardRevoked = await requestJson(second.baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token,
        action: 'email.send',
        resource: {
          recipientCount: 1,
        },
      },
    });
    assert.equal(guardRevoked.status, 200);
    assert.equal((guardRevoked.json as { allowed: boolean }).allowed, false);
    assert.match((guardRevoked.json as { reason?: string }).reason ?? '', /revoked/);
  } finally {
    await closeServer(second.server);
  }
});

test('revocation remains one-to-one for burst-issued delegations with different scopes', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-burst-revocation-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl } = await startIssuerServer(dataDir);
  const issuerKeys = JSON.parse(
    readFileSync(join(dataDir, 'issuer-keys.json'), 'utf8'),
  ) as {
    privateKeyPem: string;
    publicKeyPem: string;
  };
  const issuer = createIssuer({
    issuerPrivateKeyPem: issuerKeys.privateKeyPem,
    issuerPublicKeyPem: issuerKeys.publicKeyPem,
  });
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'burst-guard-anchor',
  });
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const firstDelegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'burst-agent',
    scope: {
      canPost: true,
      maxRecipients: 1,
    },
    issuedAt,
    expiresAt,
  });
  const secondDelegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'burst-agent',
    scope: {
      canPost: true,
      maxRecipients: 3,
    },
    issuedAt,
    expiresAt,
  });

  assert.notEqual(firstDelegation.id, secondDelegation.id);

  const firstToken = serializeAgentCredential({
    version: 'tessera.openclaw/v1',
    credential: issued.credential,
    delegation: firstDelegation,
  });
  const secondToken = serializeAgentCredential({
    version: 'tessera.openclaw/v1',
    credential: issued.credential,
    delegation: secondDelegation,
  });

  try {
    const revokeResponse = await requestJson(baseUrl, '/delegation/revoke', {
      method: 'POST',
      body: {
        delegationId: getDelegationId(firstDelegation),
      },
    });
    assert.equal(revokeResponse.status, 200);

    const firstCheck = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token: firstToken,
        action: 'email.send',
        resource: {
          recipientCount: 1,
        },
      },
    });
    assert.equal(firstCheck.status, 200);
    assert.equal((firstCheck.json as { allowed: boolean }).allowed, false);
    assert.match((firstCheck.json as { reason?: string }).reason ?? '', /revoked/);

    const secondCheck = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token: secondToken,
        action: 'email.send',
        resource: {
          recipientCount: 2,
        },
      },
    });
    assert.equal(secondCheck.status, 200);
    assert.equal((secondCheck.json as { allowed: boolean }).allowed, true);
  } finally {
    await closeServer(server);
  }
});

test('legacy tokens without explicit delegation ids still revoke via the fallback identity', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-legacy-revocation-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl } = await startIssuerServer(dataDir);
  const issuerKeys = JSON.parse(
    readFileSync(join(dataDir, 'issuer-keys.json'), 'utf8'),
  ) as {
    privateKeyPem: string;
    publicKeyPem: string;
  };
  const issuer = createIssuer({
    issuerPrivateKeyPem: issuerKeys.privateKeyPem,
    issuerPublicKeyPem: issuerKeys.publicKeyPem,
  });
  const issued = issuer.issue({
    tier: 1,
    jurisdiction: 'EU',
    anchorHash: 'legacy-guard-anchor',
  });
  const currentDelegation = createDelegation(issued.holderSecretKey, issued.credential, {
    agentName: 'legacy-agent',
    scope: {
      canPost: true,
      maxRecipients: 2,
    },
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  const legacyDelegation = {
    ...currentDelegation,
    id: undefined,
  };
  legacyDelegation.parentSignature = signDelegation(
    {
      parentCommitment: legacyDelegation.parentCommitment,
      agentName: legacyDelegation.agentName,
      parentScope: legacyDelegation.parentScope,
      scope: legacyDelegation.scope,
      issuedAt: legacyDelegation.issuedAt,
      expiresAt: legacyDelegation.expiresAt,
    },
    issued.holderSecretKey,
  );

  const token = serializeAgentCredential({
    version: 'tessera.openclaw/v1',
    credential: issued.credential,
    delegation: legacyDelegation,
  });

  try {
    const revokeResponse = await requestJson(baseUrl, '/delegation/revoke', {
      method: 'POST',
      body: {
        delegationId: getDelegationId(legacyDelegation),
      },
    });
    assert.equal(revokeResponse.status, 200);

    const guardRevoked = await requestJson(baseUrl, '/guard/check', {
      method: 'POST',
      body: {
        token,
        action: 'email.send',
        resource: {
          recipientCount: 1,
        },
      },
    });
    assert.equal(guardRevoked.status, 200);
    assert.equal((guardRevoked.json as { allowed: boolean }).allowed, false);
    assert.match((guardRevoked.json as { reason?: string }).reason ?? '', /revoked/);
  } finally {
    await closeServer(server);
  }
});

test('credential issuance requires holderPublicKey', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-holder-key-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl } = await startIssuerServer(dataDir);
  const identity = new Identity();

  try {
    const issueResponse = await requestJson(baseUrl, '/credential/issue', {
      method: 'POST',
      body: {
        commitment: identity.commitment.toString(),
        anchorType: 'bank-account',
        anchorHash: 'missing-holder-key',
        tier: 1,
        jurisdiction: 'EU',
      },
    });

    assert.equal(issueResponse.status, 400);
    assert.match((issueResponse.json as { error?: string }).error ?? '', /holderPublicKey is required/);
  } finally {
    await closeServer(server);
  }
});

test('issuer resolves loopback bind by default and rejects wider binding without explicit opt-in', () => {
  assert.equal(resolveIssuerBindHost({}), '127.0.0.1');
  assert.equal(resolveIssuerBindHost({ ISSUER_HOST: '127.0.0.1' }), '127.0.0.1');
  assert.equal(resolveIssuerBindHost({ ISSUER_HOST: '::1' }), '::1');
  assert.equal(resolveIssuerBindHost({ ISSUER_HOST: '[::1]' }), '::1');
  assert.throws(
    () => resolveIssuerBindHost({ ISSUER_HOST: '0.0.0.0' }),
    /ISSUER_ALLOW_NON_LOCAL_BIND=1/,
  );
  assert.equal(
    resolveIssuerBindHost({
      ISSUER_HOST: '0.0.0.0',
      ISSUER_ALLOW_NON_LOCAL_BIND: '1',
    }),
    '0.0.0.0',
  );
});

test('issuer write routes reject non-loopback requests even if the process is reachable', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-local-only-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl } = await startIssuerServer(dataDir);
  const identity = new Identity();
  const holderKeys = generateIssuerKeypair();

  try {
    const rejectedIssue = await requestJson(baseUrl, '/credential/issue', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3001',
        origin: 'http://evil.example',
        'x-forwarded-for': '203.0.113.7',
      },
      body: {
        commitment: identity.commitment.toString(),
        anchorType: 'bank-account',
        anchorHash: 'remote-issue-attempt',
        tier: 1,
        jurisdiction: 'EU',
        holderPublicKey: holderKeys.publicKeyPem,
      },
    });
    assert.equal(rejectedIssue.status, 403);
    assert.match((rejectedIssue.json as { error?: string }).error ?? '', /loopback|demo-only/i);

    const localIssue = await requestJson(baseUrl, '/credential/issue', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3001',
        origin: 'http://127.0.0.1:3000',
        'x-forwarded-for': '127.0.0.1',
      },
      body: {
        commitment: identity.commitment.toString(),
        anchorType: 'bank-account',
        anchorHash: 'local-issue-attempt',
        tier: 1,
        jurisdiction: 'EU',
        holderPublicKey: holderKeys.publicKeyPem,
      },
    });
    assert.equal(localIssue.status, 201);

    const localIssueWithoutOrigin = await requestJson(baseUrl, '/credential/issue', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3001',
      },
      body: {
        commitment: new Identity().commitment.toString(),
        anchorType: 'bank-account',
        anchorHash: 'local-issue-without-origin',
        tier: 1,
        jurisdiction: 'EU',
        holderPublicKey: holderKeys.publicKeyPem,
      },
    });
    assert.equal(localIssueWithoutOrigin.status, 201);

    const localIpv6HostIssue = await requestJson(baseUrl, '/credential/issue', {
      method: 'POST',
      headers: {
        host: '[::1]:3001',
        origin: 'http://[::1]:3000',
        'x-forwarded-for': '::1',
      },
      body: {
        commitment: new Identity().commitment.toString(),
        anchorType: 'bank-account',
        anchorHash: 'local-ipv6-host-issue',
        tier: 1,
        jurisdiction: 'EU',
        holderPublicKey: holderKeys.publicKeyPem,
      },
    });
    assert.equal(localIpv6HostIssue.status, 201);

    const issuerKeys = JSON.parse(
      readFileSync(join(dataDir, 'issuer-keys.json'), 'utf8'),
    ) as {
      privateKeyPem: string;
      publicKeyPem: string;
    };
    const issuer = createIssuer({
      issuerPrivateKeyPem: issuerKeys.privateKeyPem,
      issuerPublicKeyPem: issuerKeys.publicKeyPem,
    });
    const issued = issuer.issue({
      tier: 1,
      jurisdiction: 'EU',
      anchorHash: 'local-only-revoke-anchor',
    });
    const delegation = createDelegation(issued.holderSecretKey, issued.credential, {
      agentName: 'local-only-agent',
      scope: {
        canPost: true,
        maxRecipients: 1,
      },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const rejectedRevoke = await requestJson(baseUrl, '/delegation/revoke', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3001',
        origin: 'http://evil.example',
        'x-forwarded-for': '203.0.113.7',
      },
      body: {
        delegationId: getDelegationId(delegation),
      },
    });
    assert.equal(rejectedRevoke.status, 403);
    assert.match((rejectedRevoke.json as { error?: string }).error ?? '', /loopback|demo-only/i);
  } finally {
    await closeServer(server);
  }
});

test('issuer CORS is limited to local allowlist and never returns wildcard origins', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tessera-issuer-cors-test-'));
  tempDirs.push(dataDir);

  const { server, baseUrl } = await startIssuerServer(dataDir);

  try {
    const allowed = await requestText(baseUrl, '/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:3000',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://127.0.0.1:3000');
    assert.notEqual(allowed.headers['access-control-allow-origin'], '*');

    const allowedIpv6 = await requestText(baseUrl, '/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://[::1]:3000',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(allowedIpv6.status, 204);
    assert.equal(allowedIpv6.headers['access-control-allow-origin'], 'http://[::1]:3000');
    assert.notEqual(allowedIpv6.headers['access-control-allow-origin'], '*');

    const denied = await requestText(baseUrl, '/health', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://evil.example',
        'access-control-request-method': 'POST',
      },
    });
    assert.equal(denied.status, 204);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  } finally {
    await closeServer(server);
  }
});

function startIssuerServer(dataDir: string) {
  const { app, state } = createIssuerApp({ dataDir });
  return new Promise<{
    server: ReturnType<typeof serve>;
    state: ReturnType<typeof createIssuerApp>['state'];
    baseUrl: string;
  }>((resolve, reject) => {
    const server = serve(
      { fetch: app.fetch, port: 0, hostname: '127.0.0.1' },
      (info) => {
        resolve({
          server,
          state,
          baseUrl: `http://127.0.0.1:${info.port}`,
        });
      },
    );

    server.once('error', reject);
  });
}

function closeServer(server: ReturnType<typeof serve>) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function requestJson(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);

    const req = httpRequest(
      url,
      {
        method: options.method ?? 'GET',
        headers: {
          connection: 'close',
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            json: data.length > 0 ? JSON.parse(data) : null,
          });
        });
      },
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

function requestText(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);

    const req = httpRequest(
      url,
      {
        method: options.method ?? 'GET',
        headers: {
          connection: 'close',
          ...(options.headers ?? {}),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === 'string') {
              headers[key] = value;
            }
          }
          resolve({
            status: res.statusCode ?? 0,
            headers,
            body: data,
          });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}
