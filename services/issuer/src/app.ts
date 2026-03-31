import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createVerifier } from '@tessera-protocol/sdk';
import type {
  AnchorTier,
  Jurisdiction,
  TesseraProof,
  VerificationResult,
} from '@tessera-protocol/sdk';
import {
  DuplicateAnchorError,
  DuplicateCommitmentError,
  IssuerServiceState,
} from './state.js';

interface CreateIssuerAppOptions {
  dataDir: string;
}

interface IssueCredentialRequestBody {
  commitment?: string;
  anchorType?: string;
  anchorHash?: string;
  tier?: AnchorTier;
  jurisdiction?: Jurisdiction;
  holderPublicKey?: string;
}

interface VerifyProofRequestBody {
  proof?: TesseraProof;
  platformId?: string;
}

export function createIssuerApp(options: CreateIssuerAppOptions) {
  const app = new Hono();
  const state = new IssuerServiceState({ dataDir: options.dataDir });

  state.log('Issuer service started', {
    publicKeyPem: state.getIssuerPublicKey(),
    groupSize: state.getGroupSize(),
    dataDir: state.dataDir,
  });

  app.use('*', cors());

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      groupSize: state.getGroupSize(),
      uptime: state.getUptimeSeconds(),
    });
  });

  app.get('/roots', (c) => {
    return c.json({
      roots: state.getRecentRoots(),
      currentRoot: state.getCurrentRoot(),
      groupSize: state.getGroupSize(),
    });
  });

  app.post('/credential/issue', async (c) => {
    const body = await c.req.json<IssueCredentialRequestBody>();

    const validationError = validateIssueCredentialBody(body);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    try {
      const result = state.issueCredential({
        commitment: body.commitment!,
        anchorType: body.anchorType!,
        anchorHash: body.anchorHash!,
        tier: body.tier!,
        jurisdiction: body.jurisdiction!,
        holderPublicKey: body.holderPublicKey,
      });

      state.log('Issued credential', {
        commitment: body.commitment,
        tier: body.tier,
        jurisdiction: body.jurisdiction,
        anchorType: body.anchorType,
      });

      return c.json(result, 201);
    } catch (error) {
      if (error instanceof DuplicateCommitmentError || error instanceof DuplicateAnchorError) {
        return c.json({ error: error.message }, 409);
      }

      state.log('Credential issuance failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: 'Credential issuance failed' }, 500);
    }
  });

  app.post('/proof/verify', async (c) => {
    const body = await c.req.json<VerifyProofRequestBody>();

    if (!body.platformId || typeof body.platformId !== 'string') {
      return c.json({ valid: false, error: 'platformId is required' }, 400);
    }

    if (!body.proof || typeof body.proof !== 'object') {
      return c.json({ valid: false, error: 'proof is required' }, 400);
    }

    const verifier = createVerifier({
      platformId: body.platformId,
      trustedIssuerPublicKeys: [state.getIssuerPublicKey()],
      trustedGroupRoots: state.getRecentRoots(),
      nullifierDbPath: state.nullifierDbPath,
    });

    try {
      const result = await verifier.verify(body.proof);
      state.log('Verified proof', {
        platformId: body.platformId,
        valid: result.valid,
        type: result.type,
        error: result.error ?? null,
      });
      return c.json(result);
    } catch (error) {
      const result: VerificationResult = {
        valid: false,
        type: body.proof.delegation ? 'agent' : 'human',
        tier: body.proof.credential.anchor.tier,
        scope: body.proof.delegation?.scope ?? null,
        error: error instanceof Error ? error.message : 'Proof verification failed',
      };
      state.log('Proof verification failed', {
        platformId: body.platformId,
        error: result.error,
      });
      return c.json(result, 500);
    } finally {
      verifier.close();
    }
  });

  return { app, state };
}

function validateIssueCredentialBody(body: IssueCredentialRequestBody): string | null {
  if (!body.commitment || typeof body.commitment !== 'string') {
    return 'commitment is required';
  }

  if (!body.anchorType || typeof body.anchorType !== 'string') {
    return 'anchorType is required';
  }

  if (!body.anchorHash || typeof body.anchorHash !== 'string') {
    return 'anchorHash is required';
  }

  if (!body.jurisdiction || typeof body.jurisdiction !== 'string') {
    return 'jurisdiction is required';
  }

  if (body.tier !== 1 && body.tier !== 2 && body.tier !== 3 && body.tier !== 4) {
    return 'tier must be 1, 2, 3, or 4';
  }

  return null;
}
